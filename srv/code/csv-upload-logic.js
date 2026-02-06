const cds = require('@sap/cds');
const Papa = require('papaparse');

// Helper: parse a CSV line respecting quoted fields
function parseCSVLine(line, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { // escaped quote
                current += '"';
                i++; // skip next
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === delimiter && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

function detectDelimiter(headerLine) {
    // Count delimiter occurrences outside quotes for common delimiters
    const candidates = [',', ';', '|', '\t'];
    let best = ',';
    let bestCount = -1;

    for (const d of candidates) {
        let count = 0;
        let inQuotes = false;
        for (let i = 0; i < headerLine.length; i++) {
            const ch = headerLine[i];
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === d && !inQuotes) {
                count++;
            }
        }
        if (count > bestCount) {
            bestCount = count;
            best = d;
        }
    }
    return best;
}

function normalizeHeader(h) {
    if (!h) return '';
    return h.toString().trim().toLowerCase().replace(/\s+/g, ' ').replace(/[\"']/g, '');
}

// Function to sanitize text fields that might contain problematic content
function sanitizeTextField(value, maxLength = 5000) {
    if (!value) return '';
    
    let cleanValue = value.toString().trim();
    
    // Remove or replace problematic characters
    cleanValue = cleanValue
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '') // Remove control characters
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/\r/g, '\n') // Convert remaining \r to \n
        .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
        .replace(/\t/g, ' ') // Convert tabs to spaces
        .replace(/ {2,}/g, ' '); // Collapse multiple spaces
    
    // Truncate to respect field length limits
    if (cleanValue.length > maxLength) {
        cleanValue = cleanValue.substring(0, maxLength - 3) + '...';
    }
    
    return cleanValue;
}

// Function to sanitize fields based on their expected schema limits
function sanitizeFieldByType(value, fieldName) {
    if (!value) return '';
    
    const fieldLimits = {
        'customerName': 250,
        'customerNumber': 20,
        'emlaType': 50,
        'region': 25,
        'country': 25,
        'erpOnbAdvNome': 100,
        'btpOnbAdvNome': 100,
        'btpOnbAdvEmail': 100,
        'status': 100,
        'externalID': 40
    };
    
    const maxLength = fieldLimits[fieldName] || 5000; // Back to original 5000
    return sanitizeTextField(value, maxLength);
}

function parseDateToISO(s) {
    if (!s) return null;
    s = s.trim();
    // try dd/mm/yyyy or d/m/yyyy
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
        const day = parseInt(m[1], 10);
        const month = parseInt(m[2], 10);
        const year = parseInt(m[3], 10);
        const dt = new Date(Date.UTC(year, month - 1, day));
        if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
    }
    // fallback to Date parser
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
    return null;
}

// Heuristic: detect meaningless tokens that should not be treated as advisor names/emails
function isMeaningfulCandidate(val) {
    if (!val && val !== 0) return false;
    const s = ('' + val).trim();
    if (!s) return false;
    const low = s.toLowerCase();
    const booleanLike = new Set(['yes','no','y','n','true','false','1','0','ok']);
    if (booleanLike.has(low)) return false;
    if (low === 'na' || low === 'n/a' || low === 'none' || low === '-') return false;
    // purely numeric or very short tokens are unlikely names
    if (/^[0-9\-\s]+$/.test(s)) return false;
    if (s.length < 3) return false;
    return true;
}

// Specialized check for advisor names: allow short surnames, commas, and accented chars; disallow pure booleans / digits
function isMeaningfulAdvisorName(val) {
    if (!val && val !== 0) return false;
    const s = ('' + val).trim();
    if (!s) return false;
    const low = s.toLowerCase();
    if (['yes','no','true','false','n/a','na','none','-','ok'].includes(low)) return false;
    // Reject purely numeric or single char
    if (/^[0-9]+$/.test(s)) return false;
    if (s.length < 2) return false; // allow 2-char initials like 'Li'
    // Accept if contains comma or space (Lastname, Firstname or Firstname Lastname)
    if (/[ ,]/.test(s)) return true;
    // Accept alphabetic (including accents) words length >=2
    if (/^[A-Za-zÀ-ÖØ-öø-ÿ'.-]{2,}$/.test(s)) return true;
    return false;
}

module.exports = async function(request) {
    const { csvData } = request.data;
    if (!csvData) {
        request.error(400, 'CSV data is required');
        return;
    }

    try {
        const csvType = request.data && request.data.csvType ? request.data.csvType : null;
        // Header synonyms must be available before calling Papa.parse transformHeader
        const HEADER_SYNONYMS = {
            'customer name': 'Customer Name',
            'emla staffing for btp': 'EmLA Staffing for BTP',
            'customer id': 'Customer ID',
            'customer number': 'Customer ID',
            'customer number': 'Customer ID',
            'account name': 'Account Name',
            'btp onb advisor': 'BTP ONB Advisor',
            'btp onboarding advisor': 'BTP Onboarding Advisor',
            's/4hana finance onb advisor': 'S/4HANA Finance ONB Advisor',
            'region lvl 1': 'Region Lvl 1',
            'region l5/country': 'Region L5/Country',
            region: 'Region',
            country: 'Country',
            'contract start date': 'Contract Start Date',
            'revenue start date': 'Revenue Start Date',
            'crt link': 'CRT Link',
            'cloud erp onboarding advisor': 'Cloud ERP Onboarding Advisor',
            id: 'ID'
        }

        // Simple CSV preprocessing - just basic cleanup
        function preprocessCSV(data) {
            // Remove BOM if present
            let cleaned = data.replace(/^\uFEFF/, '');
            
            // Normalize line endings
            cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            
            return cleaned;
        }

    // Preprocess the CSV data
    const processedCsvData = preprocessCSV(csvData);
    const headerLineRaw = processedCsvData.split(/\n/,1)[0] || '';
    const autoDelim = detectDelimiter(headerLineRaw);
    console.log('[CSVUPLOAD] Detected delimiter:', JSON.stringify(autoDelim), 'Header preview length:', headerLineRaw.length);

        // Use PapaParse with simple, reliable configuration
        const parsed = Papa.parse(processedCsvData, {
            header: true,
            skipEmptyLines: true,
            delimiter: autoDelim, // explicitly use detected delimiter to avoid mis-detection on complex lines
            quoteChar: '"',
            transformHeader: function(h) {
                const n = normalizeHeader(h).replace(/\uFEFF/g, '');
                return HEADER_SYNONYMS[n] || (h ? h.toString().trim().replace(/"/g, '') : '');
            }
        });
        
        const data = parsed && parsed.data ? parsed.data : [];
        console.log(`Parsed ${data.length} rows from CSV`);
        
        // Only fail on truly critical errors
        if (parsed.errors && parsed.errors.length > 0) {
            const criticalErrors = parsed.errors.filter(err => 
                err.code === 'UndetectableDelimiter'
            );
            
            if (criticalErrors.length > 0) {
                console.error('Critical CSV parsing errors:', criticalErrors);
                const errorMessages = criticalErrors.map(err => `Row ${err.row}: ${err.message}`).join('; ');
                request.error(400, `CSV parsing errors: ${errorMessages}`);
                return;
            } else {
                console.log('Non-critical parsing errors detected, continuing with available data');
            }
        }
        
        if (!data || data.length === 0) {
            request.error(400, 'CSV file is empty or has no data rows');
            return;
        }

        // Mapping from various Integration Suite header names to our expected model fields
        const headerMap = {
            'account name': 'customerName',
            'accountname': 'customerName',
            'erp cust number': 'customerNumber',
            'erp cust no': 'customerNumber',
            'erp cust number': 'customerNumber',
            'erp customer number': 'customerNumber',
            'customer id': 'customerNumber',
            'customer number': 'customerNumber',
            'product list': 'emlaType',
            'productlist': 'emlaType',
            'emla staffing for btp': 'btpOnbAdvNome',
            'btp onb advisor': 'btpOnbAdvNome',
            'btp onb advisor email': 'btpOnbAdvEmail',
            'btp onboard advisor email': 'btpOnbAdvEmail',
            'region lvl 1': 'region',
            'region lvl 2': 'region',
            'region lvl 5/country': 'country',
            'region lvl 5/country': 'country',
            'region l5/country': 'country',
            'region l5/country': 'country',
            'revenue start date': 'startDate',
            'contract start date (line item)': 'startDate',
            'contract start date': 'startDate'
        };

        // Expected target headers for validation
        const expectedHeaders = [
            'customerName',
            'customerNumber',
            'emlaType',
            'region',
            'country',
            'startDate',
            'erpOnbAdvNome',
            'btpOnbAdvNome',
            'btpOnbAdvEmail'
        ];
        // Use the richer mapping logic (borrowed from reference implementation)
        // Helper to map raw CSV row object into our internal record shape

        function mapHeaderName(rawHeader) {
            const n = normalizeHeader(rawHeader).replace(/\uFEFF/g, '');
            return HEADER_SYNONYMS[n] || rawHeader.trim().replace(/"/g, '');
        }

        // Mapping tables (rename maps) similar to reference
        const MAPPINGS = {
            PubCloudERP: {
                wanted: [
                    'Customer Name',
                    'Customer ID',
                    'BTP Onboarding Advisor',
                    'Country',
                    'Cloud ERP Onboarding Advisor',
                    'Region',
                    'Contract Start Date',
                    'ID'
                ],
                rename_map: {
                    ID: 'externalID',
                    'Customer ID': 'customerNumber',
                    'Customer Name': 'customerName',
                    'BTP Onboarding Advisor': 'btpOnbAdvNome',
                    'BTP Onboarding Advisor Email': 'btpOnbAdvEmail',
                    'Cloud ERP Onboarding Advisor': 'erpOnbAdvNome',
                    'S/4HANA Finance ONB Advisor': 'erpOnbAdvNome',
                    Region: 'region',
                    Country: 'country',
                    'Contract Start Date': 'startDate'
                }
            },
            IntegrationSuite: {
                wanted: [
                    'Account Name',
                    'BTP ONB Advisor',
                    'Region Lvl 1',
                    'Region L5/Country',
                    'Revenue Start Date',
                    'CRT Link'
                ],
                rename_map: {
                    'Account Name': 'customerName',
                    'BTP ONB Advisor': 'btpOnbAdvNome',
                    'BTP ONB Advisor Email': 'btpOnbAdvEmail',
                    'Region Lvl 1': 'region',
                    'Region L5/Country': 'country',
                    'Revenue Start Date': 'startDate',
                    'CRT Link': 'CRTLink'
                }
            }
        };

        function mapRecord(raw, forcedType) {
            const headers = Object.keys(raw).filter(k => k !== '__rawHeaders' && k !== '__tokens');
            const has = name => headers.indexOf(name) !== -1;
            let mapping = null; let mappingType = 'unknown';
            let customerNumberSource = 'unknown';

            // If caller provided a forcedType from the UI, use it explicitly to choose mapping
            // Support forcedType values coming from UI or API. Accept both short keys and explicit mapping names.
            if (forcedType === 'integration' || forcedType === 'IntegrationSuite') {
                mapping = MAPPINGS.IntegrationSuite; mappingType = 'IntegrationSuite';
            } else if (forcedType === 'public' || forcedType === 'erp' || forcedType === 'pub' || forcedType === 'PubCloudERP') {
                mapping = MAPPINGS.PubCloudERP; mappingType = 'PubCloudERP';
            } else {
                // auto-detect based on header presence/scoring when not forced
                if (has('Customer ID') || has('Cloud ERP Onboarding Advisor') || has('Contract Start Date')) {
                    mapping = MAPPINGS.PubCloudERP; mappingType = 'PubCloudERP';
                } else if (has('Account Name') || has('BTP ONB Advisor') || has('Revenue Start Date')) {
                    mapping = MAPPINGS.IntegrationSuite; mappingType = 'IntegrationSuite';
                }

                if (!mapping) {
                    const pubScore = MAPPINGS.PubCloudERP.wanted.filter(h => has(h)).length;
                    const intScore = MAPPINGS.IntegrationSuite.wanted.filter(h => has(h)).length;
                    if (pubScore > intScore) { mapping = MAPPINGS.PubCloudERP; mappingType = 'PubCloudERP'; }
                    else if (intScore > pubScore) { mapping = MAPPINGS.IntegrationSuite; mappingType = 'IntegrationSuite'; }
                    else { mapping = MAPPINGS.PubCloudERP; mappingType = 'PubCloudERP'; }
                }
            }

            const result = {};
            const rename = mapping.rename_map || {};
            // build a normalized rename map for case-insensitive header matching
            const renameNorm = {};
            Object.keys(rename).forEach(k => { renameNorm[normalizeHeader(k)] = rename[k]; });
            // iterate raw headers and map to target fields using several fallbacks
            for (const originalKey of headers) {
                const norm = normalizeHeader(originalKey);
                let target = null;
                if (rename[originalKey]) target = rename[originalKey];
                else if (renameNorm[norm]) target = renameNorm[norm];
                else if (headerMap[norm]) target = headerMap[norm];
                else target = originalKey;
                const incomingVal = raw[originalKey];
                if (target === 'erpOnbAdvNome' && result[target] && isMeaningfulAdvisorName(result[target]) && (!incomingVal || !isMeaningfulAdvisorName(incomingVal))) {
                    // keep existing meaningful advisor name; skip overwrite
                    continue;
                }
                result[target] = incomingVal;
                if (target === 'customerNumber' && incomingVal) {
                    customerNumberSource = 'direct:' + originalKey;
                }
            }

            // Map startDate field
            if (result.startDate) { result.startDateL = result.startDate; delete result.startDate; }
            // Always prefer explicit ID column for externalID (override previous heuristic/customerNumber)
            if (result.ID) {
                // External ID deve sempre vir da coluna ID explícita do outro sistema
                if (!result.externalID || result.externalID !== result.ID) {
                    result.externalID = result.ID;
                }
                delete result.ID; // remover campo temporário
            }

            // Positional fallbacks for IntegrationSuite
            if (mappingType === 'IntegrationSuite') {
                const rawHeaders = raw.__rawHeaders ? raw.__rawHeaders.map(h => normalizeHeader(h)) : [];
                const tokens = raw.__tokens || [];
                const findIndex = (names) => {
                    for (const name of names) {
                        const n = normalizeHeader(name);
                        let idx = rawHeaders.indexOf(n);
                        if (idx !== -1) return idx;
                        idx = rawHeaders.findIndex(h => h && h.indexOf(n) !== -1);
                        if (idx !== -1) return idx;
                    }
                    return -1;
                };
                const accIdx = findIndex(['Account Name']);
                if (accIdx >= 0 && tokens[accIdx]) result.customerName = tokens[accIdx].trim();
                const regionIdx = findIndex(['Region Lvl 1','Region']);
                if (regionIdx >= 0 && tokens[regionIdx]) result.region = tokens[regionIdx].trim();
                const countryIdx = findIndex(['Region L5/Country','Country']);
                if (countryIdx >= 0 && tokens[countryIdx]) result.country = tokens[countryIdx].trim();
                // Try to extract customerNumber from CRT Link field (when PapaParse header mode used the token array may be empty)
                const crtIdx = findIndex(['CRT Link','CRTLink']);
                if (!result.customerNumber) {
                    // direct field presence (preferred)
                    const possible = (raw['CRT Link'] || raw['CRTLink'] || result.CRTLink || '').toString().trim();
                    if (possible) {
                        const match = possible.match(/id=(\d+)/i);
                        if (match) result.customerNumber = match[1];
                        else {
                            const m2 = possible.match(/(\d{4,})/);
                            if (m2) result.customerNumber = m2[1];
                        }
                    } else if (crtIdx >= 0 && tokens[crtIdx]) {
                        const t = tokens[crtIdx];
                        const match = t.match(/id=(\d+)/i);
                        if (match) result.customerNumber = match[1];
                        else {
                            const m2 = t.match(/(\d{4,})/);
                            if (m2) result.customerNumber = m2[1];
                        }
                    }
                }
                // REMOVIDO: não gerar externalID sintético para IntegrationSuite; deve vir somente de coluna ID se fornecida
            }

            // PubCloudERP positional fallbacks
            if (mappingType === 'PubCloudERP') {
                const rawHeaders = raw.__rawHeaders ? raw.__rawHeaders.map(h => normalizeHeader(h)) : [];
                const tokens = raw.__tokens || [];
                const findIndex = (names) => {
                    for (const name of names) {
                        const n = normalizeHeader(name);
                        let idx = rawHeaders.indexOf(n);
                        if (idx !== -1) return idx;
                        idx = rawHeaders.findIndex(h => h && h.indexOf(n) !== -1);
                        if (idx !== -1) return idx;
                    }
                    return -1;
                };
                const accIdx = findIndex(['Customer Name','Account Name','AccountName','Account Name']);
                if (accIdx >= 0 && tokens[accIdx]) result.customerName = tokens[accIdx].trim();
                const custIdx = findIndex(['Customer ID','ERP Cust Number','Customer Number','ERP Cust#','ERP Cust']);
                if (custIdx >= 0) {
                    const val = (tokens[custIdx] || raw['Customer ID'] || raw['Customer ID'] || '').toString().trim();
                    if (val) {
                        if (!result.customerNumber) result.customerNumber = val;
                        if (!result.externalID) result.externalID = val;
                        if (!customerNumberSource) customerNumberSource = 'positional:Customer ID';
                    }
                }
                // Also try extracting customerNumber from CRT Link (same logic as IntegrationSuite)
                const crtIdxPub = findIndex(['CRT Link','CRTLink']);
                if (!result.customerNumber) {
                    const possiblePub = (raw['CRT Link'] || raw['CRTLink'] || result.CRTLink || '').toString().trim();
                    if (possiblePub) {
                        const match = possiblePub.match(/id=(\d+)/i);
                        if (match) result.customerNumber = match[1];
                        else {
                            const m2 = possiblePub.match(/(\d{4,})/);
                            if (m2) result.customerNumber = m2[1];
                        }
                        if (result.customerNumber && !customerNumberSource) customerNumberSource = 'fallback:CRT Link';
                    } else if (crtIdxPub >= 0 && tokens[crtIdxPub]) {
                        const t = tokens[crtIdxPub];
                        const match = t.match(/id=(\d+)/i);
                        if (match) result.customerNumber = match[1];
                        else {
                            const m2 = t.match(/(\d{4,})/);
                            if (m2) result.customerNumber = m2[1];
                        }
                        if (result.customerNumber && !customerNumberSource) customerNumberSource = 'fallback:CRT Link(token)';
                    }
                }
                const idIdx = findIndex(['ID']);
                if (idIdx >= 0 && tokens[idIdx]) { result.ID = tokens[idIdx].trim(); if (!result.externalID) result.externalID = result.ID; }
            }

            // cross-mapping fallbacks
            try {
                if (!result.region) { if (raw['Region Lvl 1']) result.region = (raw['Region Lvl 1']+'').trim(); else if (raw['Region']) result.region = (raw['Region']+'').trim(); }
                if (!result.country) { if (raw['Region L5/Country']) result.country = (raw['Region L5/Country']+'').trim(); else if (raw['Country']) result.country = (raw['Country']+'').trim(); }
                if (!result.startDateL) { if (raw['Revenue Start Date']) result.startDateL = (raw['Revenue Start Date']+'').trim(); else if (raw['Closing Date']) result.startDateL = (raw['Closing Date']+'').trim(); }
                if (!result.btpOnbAdvEmail) {
                    const candidate = raw['BTP Onboarding Advisor'] || raw['BTP ONB Advisor'] || '';
                    if (isMeaningfulCandidate(candidate)) result.btpOnbAdvEmail = (candidate+'').trim();
                }
                if (!result.erpOnbAdvNome) {
                    const candidate2 = raw['S/4HANA Finance ONB Advisor'] || raw['Cloud ERP Onboarding Advisor'] || '';
                    if (candidate2 && isMeaningfulAdvisorName(candidate2)) {
                        result.erpOnbAdvNome = (candidate2+'').trim();
                        console.log('[CSVUPLOAD] ERP advisor captured from raw headers:', result.erpOnbAdvNome);
                    } else if (candidate2) {
                        console.log('[CSVUPLOAD] ERP advisor value present but rejected by advisor validator:', candidate2);
                    }
                }
                if (!result.CRTLink) { if (raw['CRT Link']) result.CRTLink = (raw['CRT Link']+'').trim(); else if (raw['CRTLink']) result.CRTLink = (raw['CRTLink']+'').trim(); }
            } catch (e) {}

            // Ensure emlaType is normalized according to detected mapping type
            try {
                // Follow priority: if caller explicitly said PubCloudERP, treat as Public Cloud ERP.
                if (forcedType === 'PubCloudERP' || forcedType === 'pubclouderp' || forcedType === 'public') {
                    result.emlaType = 'Public Cloud ERP';
                } else if (mappingType === 'IntegrationSuite') {
                    result.emlaType = 'Integration Suite';
                } else {
                    result.emlaType = result.emlaType || raw['product list'] || raw['productlist'] || '';
                }
                // normalize common synonyms
                const v = (result.emlaType + '').toLowerCase();
                if (v.indexOf('public') !== -1 || v.indexOf('pubcloud') !== -1 || v.indexOf('public cloud') !== -1) result.emlaType = 'Public Cloud ERP';
                else if (v.indexOf('integration') !== -1 || v.indexOf('integration suite') !== -1) result.emlaType = 'Integration Suite';
            } catch (e) {}

            // Universal CRT extraction BEFORE logging so we see final value in debug
            try {
                const crtRawUniversal = (raw['CRT Link'] || raw['CRTLink'] || result.CRTLink || '').toString().trim();
                if (crtRawUniversal) {
                    let extractedU = null;
                    const matchIdU = crtRawUniversal.match(/id=(\d+)/i);
                    if (matchIdU) extractedU = matchIdU[1];
                    else {
                        const matchNumU = crtRawUniversal.match(/(\d{4,})/);
                        if (matchNumU) extractedU = matchNumU[1];
                    }
                    if (extractedU) {
                        if (result.customerNumber !== extractedU) {
                            console.log('[CSVUPLOAD] CRT extraction overriding customerNumber (pre-log):', extractedU, 'previous:', result.customerNumber, 'mappingType:', mappingType);
                            result.customerNumber = extractedU;
                            customerNumberSource = 'universalCRT';
                        }
                        // Não atribuir externalID a partir de CRT; somente customerNumber deve ser ajustado
                    }
                }
            } catch(e) { /* ignore universal CRT */ }

            console.log(`Mapping Debug for ${mappingType}:`);
            console.log('Original headers:', Object.keys(raw));
            console.log('Raw row data:', raw);
            console.log('Applied rename map:', mapping.rename_map);
            console.log('Mapped result (post CRT extraction):', {
                customerName: result.customerName,
                customerNumber: result.customerNumber,
                region: result.region,
                country: result.country,
                externalID: result.externalID,
                startDateL: result.startDateL,
                erpOnbAdvNome: result.erpOnbAdvNome,
                btpOnbAdvEmail: result.btpOnbAdvEmail,
                CRTLink: result.CRTLink,
                customerNumberSource: customerNumberSource
            });
            if (mappingType === 'IntegrationSuite') {
                console.log('[CSVUPLOAD] IntegrationSuite final customerNumber (after CRT logic):', result.customerNumber, 'source:', customerNumberSource);
            }
            if (!result.erpOnbAdvNome && (raw['S/4HANA Finance ONB Advisor'] || raw['Cloud ERP Onboarding Advisor'])) {
                console.log('DEBUG ERP Advisor header present but value considered empty or not meaningful. Raw value(s):', raw['S/4HANA Finance ONB Advisor'], raw['Cloud ERP Onboarding Advisor']);
            }

            return { record: result, mappingType };
        }

        // End of mapRecord definition
        // Now iterate rows using mapRecord for robust mapping
    const recordsToInsert2 = [];
    const errors2 = [];
    const failedRawRows2 = [];
    let skippedNoAdvisor = 0; // count of PubCloudERP rows skipped due to missing BTP advisor (not treated as error)
    let validationErrorCount = 0; // missing required field errors
    let dbErrorCount = 0; // insert / DB-level errors
    let recoveredAdvisorCount = 0; // rows where advisor was recovered via fallback

        // Prepare advisor lookup maps (so we can enrich names/emails from OnboardAdvisors)
        let advisorEmailMap = {};
        let advisorNameMap = {};
        let advisorKeyMap = {};
        try {
            const advisors = await cds.run(SELECT.from('OnboardAdvisors'));
            if (Array.isArray(advisors)) {
                for (const a of advisors) {
                    if (a.email) advisorEmailMap[(a.email+'').toLowerCase()] = a;
                    if (a.name) advisorNameMap[(a.name+'').toLowerCase()] = a;
                    if (a.advisorKey) advisorKeyMap[(a.advisorKey+'').toLowerCase()] = a;
                }
            }
        } catch (e) {
            // non-fatal: continue without enrichment if lookup fails
            console.warn('OnboardAdvisors lookup failed, enrichment disabled:', e && e.message);
        }

        // Iterate PapaParse-produced objects (header:true) — let PapaParse handle quoting, delimiters, etc.
        for (let r = 0; r < data.length; r++) {
            const rowObj = data[r];
            if (!rowObj) continue;
            // attach raw headers array (transformed by transformHeader)
            rowObj.__rawHeaders = (parsed.meta && parsed.meta.fields) ? parsed.meta.fields.slice() : Object.keys(rowObj);
            rowObj.__tokens = null; // not used when relying on PapaParse header mode

            const mapped = mapRecord(rowObj, csvType);
            const mappedRecord = mapped && mapped.record ? mapped.record : mapped;
            const mappingType = mapped && mapped.mappingType ? mapped.mappingType : '';

            // For PubCloudERP, try additional fallbacks: Account Name for customerName and CRT Link extraction for customerNumber
            if (mappingType === 'PubCloudERP') {
                try {
                    if (!mappedRecord.customerName) {
                        mappedRecord.customerName = (rowObj['Account Name'] || rowObj['Customer Name'] || rowObj['AccountName'] || '') + '';
                        if (mappedRecord.customerName) mappedRecord.customerName = mappedRecord.customerName.trim();
                    }
                    if (!mappedRecord.customerNumber) {
                        const possiblePub = (rowObj['CRT Link'] || rowObj['CRTLink'] || mappedRecord.CRTLink || '').toString().trim();
                        if (possiblePub) {
                            const match = possiblePub.match(/id=(\d+)/i);
                            if (match) mappedRecord.customerNumber = match[1];
                            else {
                                const m2 = possiblePub.match(/(\d{4,})/);
                                if (m2) mappedRecord.customerNumber = m2[1];
                            }
                        }
                    }
                } catch (e) {}
            }

            // convert startDateL to ISO date if present
            if (mappedRecord.startDateL) {
                const iso = parseDateToISO(mappedRecord.startDateL);
                if (iso) mappedRecord.startDate = iso;
            }

            // basic validation
            // r is zero-based index into data (header present), so CSV row number is r+2
            const csvRowNumber = r + (parsed.meta && parsed.meta.fields ? 2 : 1);

            // Removed restriction: Allow import even without BTP Onboarding Advisor
            // Still attempt to extract advisor info from alternative columns if available
            if (mappingType === 'PubCloudERP' && (!mappedRecord.btpOnbAdvNome || (mappedRecord.btpOnbAdvNome + '').trim() === '')) {
                // Attempt fallback extraction from alternative columns
                try {
                    const fallbackCandidate = (rowObj['BTP Onboarding Advisor'] || rowObj['BTP ONB Advisor'] || rowObj['EmLA Staffing for BTP'] || rowObj['EmLA Staffing for SAP Cloud ERP'] || '').toString().trim();
                    if (fallbackCandidate && isMeaningfulCandidate(fallbackCandidate)) {
                        mappedRecord.btpOnbAdvNome = fallbackCandidate;
                        recoveredAdvisorCount++;
                        console.log('[CSVUPLOAD] Recovered advisor via fallback for row', csvRowNumber, 'advisor=', fallbackCandidate);
                    }
                } catch (e) { /* ignore */ }
                // No longer skip rows without advisor - continue processing
                if (!mappedRecord.btpOnbAdvNome || !(mappedRecord.btpOnbAdvNome+'').trim()) {
                    console.log('[CSVUPLOAD] Continuing import without advisor for row', csvRowNumber, 'customerName=', mappedRecord.customerName, 'customerNumber=', mappedRecord.customerNumber);
                }
            }

            if (!mappedRecord.customerName || !mappedRecord.customerNumber || !mappedRecord.emlaType) {
                validationErrorCount++;
                errors2.push({ row: csvRowNumber, reason: 'Missing required fields (customerName, customerNumber, emlaType)' });
                failedRawRows2.push(rowObj);
                continue;
            }

            // Defer advisor enrichment to bulk phase (removed per-row SELECT)
            // Debug: log first few parsed rows and mapped result to diagnose mapping issues
            try {
                if (r < 5) {
                    console.log('DEBUG parsed row[' + r + ']:', rowObj);
                    console.log('DEBUG mapped result[' + r + ']:', mappedRecord);
                }
            } catch (e) {}

            // NOTE: Removed validation for BTP Advisor to allow all values including non-typical names
            // Heuristic: if name missing and email field holds a probable name (no '@', contains space/comma), treat it as name
            if (!mappedRecord.btpOnbAdvNome && mappedRecord.btpOnbAdvEmail) {
                const possibleName = mappedRecord.btpOnbAdvEmail.trim();
                if (possibleName && possibleName.indexOf('@') === -1 && /[ ,]/.test(possibleName)) {
                    mappedRecord.btpOnbAdvNome = possibleName;
                    mappedRecord.btpOnbAdvEmail = '';
                }
            }

            // Sanitize all text fields to respect schema limits and remove problematic characters
            mappedRecord.customerName = sanitizeFieldByType(mappedRecord.customerName, 'customerName');
            mappedRecord.customerNumber = sanitizeFieldByType(mappedRecord.customerNumber, 'customerNumber');
            mappedRecord.emlaType = sanitizeFieldByType(mappedRecord.emlaType, 'emlaType');
            mappedRecord.region = sanitizeFieldByType(mappedRecord.region, 'region');
            mappedRecord.country = sanitizeFieldByType(mappedRecord.country, 'country');
            // Prevent boolean-like tokens ("Yes"/"No") from being stored as advisor names
            if (mappedRecord.erpOnbAdvNome && !isMeaningfulAdvisorName(mappedRecord.erpOnbAdvNome)) {
                console.log('[CSVUPLOAD] Clearing erpOnbAdvNome as non-meaningful:', mappedRecord.erpOnbAdvNome);
                mappedRecord.erpOnbAdvNome = '';
            }
            mappedRecord.erpOnbAdvNome = sanitizeFieldByType(mappedRecord.erpOnbAdvNome, 'erpOnbAdvNome');
            mappedRecord.btpOnbAdvNome = sanitizeFieldByType(mappedRecord.btpOnbAdvNome, 'btpOnbAdvNome');
            mappedRecord.btpOnbAdvEmail = sanitizeFieldByType(mappedRecord.btpOnbAdvEmail, 'btpOnbAdvEmail');
            if (mappedRecord.externalID) {
                mappedRecord.externalID = sanitizeFieldByType(mappedRecord.externalID, 'externalID');
            }

            mappedRecord.ID = cds.utils.uuid();
            mappedRecord.status = 'Open';
            mappedRecord.csvRowNumber = csvRowNumber; // retain original CSV row number for downstream error logging
            // Preserve initial advisor references for advisor-not-found diagnostics post enrichment
            mappedRecord._initialAdvisorName = mappedRecord.btpOnbAdvNome;
            mappedRecord._initialAdvisorEmail = mappedRecord.btpOnbAdvEmail;
            recordsToInsert2.push(mappedRecord);
        }

        // --- Bulk Advisor Enrichment (single/multi SELECT to minimize DB calls) ---
        try {
            const nameCandidates = new Set();
            const emailCandidates = new Set();
            for (const rec of recordsToInsert2) {
                if (rec.btpOnbAdvNome && rec.btpOnbAdvNome.trim()) nameCandidates.add(rec.btpOnbAdvNome.trim());
                if (rec.btpOnbAdvEmail && rec.btpOnbAdvEmail.trim()) emailCandidates.add(rec.btpOnbAdvEmail.trim());
            }

            const nameList = Array.from(nameCandidates);
            const emailList = Array.from(emailCandidates);
            let byName = [];
            let byEmail = [];
            if (nameList.length > 0) {
                try { byName = await SELECT.from('OnboardAdvisors').where({ onbAdvisor: { 'in': nameList } }); } catch(e){ console.warn('Bulk advisor byName failed:', e.message); }
            }
            if (emailList.length > 0) {
                try { byEmail = await SELECT.from('OnboardAdvisors').where({ email: { 'in': emailList } }); } catch(e){ console.warn('Bulk advisor byEmail failed:', e.message); }
            }
            const indexByName = new Map();
            const indexByEmail = new Map();
            [...byName, ...byEmail].forEach(row => {
                if (row.onbAdvisor) indexByName.set(row.onbAdvisor.trim(), row);
                if (row.email) indexByEmail.set(row.email.trim(), row);
            });
            for (const rec of recordsToInsert2) {
                // enrich based on advisor name
                if (rec.btpOnbAdvNome && indexByName.has(rec.btpOnbAdvNome.trim())) {
                    const row = indexByName.get(rec.btpOnbAdvNome.trim());
                    rec.btpOnbAdvEmail = row.email || rec.btpOnbAdvEmail || '';
                    rec.btpOnbAdvNome = row.name || row.onbAdvisor || rec.btpOnbAdvNome;
                }
                // if name missing but email present, enrich by email
                if ((!rec.btpOnbAdvNome || !rec.btpOnbAdvNome.trim()) && rec.btpOnbAdvEmail && indexByEmail.has(rec.btpOnbAdvEmail.trim())) {
                    const rowE = indexByEmail.get(rec.btpOnbAdvEmail.trim());
                    rec.btpOnbAdvNome = rowE.name || rowE.onbAdvisor || rec.btpOnbAdvNome || '';
                }
                // NOTE: Removed validation cleanup for BTP Advisor to preserve all values
            }
            console.log('Bulk advisor enrichment complete. byName rows:', byName.length, 'byEmail rows:', byEmail.length);
        } catch (e) {
            console.warn('Bulk advisor enrichment outer failure:', e && e.message);
        }
        // --- End Bulk Advisor Enrichment ---

        // Identify rows where an advisor value was provided but no match found in lookup tables
        let advisorNotFoundCount = 0;
        try {
            for (const rec of recordsToInsert2) {
                const initName = rec._initialAdvisorName && rec._initialAdvisorName.trim();
                const initEmail = rec._initialAdvisorEmail && rec._initialAdvisorEmail.trim();
                const finalName = rec.btpOnbAdvNome && rec.btpOnbAdvNome.trim();
                const finalEmail = rec.btpOnbAdvEmail && rec.btpOnbAdvEmail.trim();

                // Skip if enrichment produced a final name or email (advisor successfully resolved)
                if (finalName || finalEmail) continue;

                // Only log if an initial advisor value was supplied but produced no final advisor fields and no lookup match
                if (initName) {
                    const hasMatchName = advisorNameMap[initName.toLowerCase()] || advisorKeyMap[initName.toLowerCase()] || advisorEmailMap[initName.toLowerCase()] || false;
                    if (!hasMatchName) {
                        advisorNotFoundCount++;
                        errors2.push({ row: rec.csvRowNumber, reason: `Onboarding advisor (name) not found: ${initName}` });
                        failedRawRows2.push(Object.assign({}, rec, { __advisorMissing: initName }));
                    }
                } else if (initEmail) {
                    const hasMatchEmail = advisorEmailMap[initEmail.toLowerCase()] || false;
                    if (!hasMatchEmail) {
                        advisorNotFoundCount++;
                        errors2.push({ row: rec.csvRowNumber, reason: `Onboarding advisor (email) not found: ${initEmail}` });
                        failedRawRows2.push(Object.assign({}, rec, { __advisorEmailMissing: initEmail }));
                    }
                }
            }
            if (advisorNotFoundCount > 0) console.log('[CSVUPLOAD] Advisor unresolved count (after enrichment):', advisorNotFoundCount);
        } catch(e){ console.warn('Advisor not-found detection failed:', e.message); }

    // Removed restriction: Allow records without advisor info to be imported
    // Keep all records regardless of advisor assignment
    const advisorFiltered = recordsToInsert2; // No longer filter out records without advisors
    const advisorDropped = 0; // No records dropped
    console.log('[CSVUPLOAD] Allowing import of all records, including those without advisor assignment');

        // Perform inserts or advisor updates in smaller batches to avoid payload size limits
        // New logic: if a record with same (customerNumber, emlaType) exists, update advisor fields only when changed
        let inserted = 0;
        let updated = 0;
        let updateErrors = 0;
        const insertErrors = [];
        const BATCH_SIZE = 10; // Process 10 records at a time

        if (advisorFiltered.length > 0) {
            // Build key set for existing lookup (customerNumber + emlaType)
            const keyPairs = advisorFiltered
                .filter(r => r.customerNumber && r.emlaType)
                .map(r => ({ customerNumber: r.customerNumber, emlaType: r.emlaType }));
            // Deduplicate
            const keyMap = new Map();
            for (const kp of keyPairs) {
                const k = kp.customerNumber + '||' + kp.emlaType;
                if (!keyMap.has(k)) keyMap.set(k, kp);
            }
            const uniqueKeys = Array.from(keyMap.values());
            let existingRows = [];
            try {
                if (uniqueKeys.length > 0) {
                    // Split into chunks for WHERE IN to avoid parameter limits
                    const CHUNK_SIZE = 100;
                    for (let i = 0; i < uniqueKeys.length; i += CHUNK_SIZE) {
                        const chunk = uniqueKeys.slice(i, i + CHUNK_SIZE);
                        const custNums = chunk.map(c => c.customerNumber);
                        // Fetch by customerNumber first, then filter by emlaType in JS (safer if DB can't handle composite IN easily)
                        const rows = await cds.run(SELECT.from('EMLACustomers').columns('ID','customerNumber','emlaType','erpOnbAdvNome','btpOnbAdvNome','btpOnbAdvEmail').where({ customerNumber: { 'in': custNums } }));
                        if (Array.isArray(rows)) existingRows.push(...rows);
                    }
                }
            } catch(e) {
                console.warn('[CSVUPLOAD] Existing record bulk fetch failed:', e.message);
            }
            // Index existing by composite key
            const existingIndex = new Map();
            for (const row of existingRows) {
                if (row.customerNumber && row.emlaType) {
                    existingIndex.set(row.customerNumber + '||' + row.emlaType, row);
                }
            }

            console.log(`[CSVUPLOAD] Advisor processing: ${advisorFiltered.length} candidate records. Existing matches found: ${existingIndex.size}`);

            for (let batchStart = 0; batchStart < advisorFiltered.length; batchStart += BATCH_SIZE) {
                const batchEnd = Math.min(batchStart + BATCH_SIZE, advisorFiltered.length);
                const batch = advisorFiltered.slice(batchStart, batchEnd);

                console.log(`Processing batch ${Math.floor(batchStart/BATCH_SIZE) + 1}: records ${batchStart + 1} to ${batchEnd}`);

                // Process this batch
                for (let i = 0; i < batch.length; i++) {
                    const rec = batch[i];
                    const originalIndex = batchStart + i;
                    const compositeKey = rec.customerNumber + '||' + rec.emlaType;
                    const existing = existingIndex.get(compositeKey);
                    if (existing) {
                        // Determine if advisor fields need update
                        const newBtpName = rec.btpOnbAdvNome ? rec.btpOnbAdvNome.trim() : '';
                        const newBtpEmail = rec.btpOnbAdvEmail ? rec.btpOnbAdvEmail.trim() : '';
                        const newErpName = rec.erpOnbAdvNome ? rec.erpOnbAdvNome.trim() : '';
                        const newExternalID = rec.externalID ? rec.externalID.trim() : '';
                        const diff = (
                            newBtpName !== (existing.btpOnbAdvNome || '').trim() ||
                            newBtpEmail !== (existing.btpOnbAdvEmail || '').trim() ||
                            newErpName !== (existing.erpOnbAdvNome || '').trim() ||
                            newExternalID !== (existing.externalID || '').trim()
                        );
                        if (diff) {
                            const updateObj = {};
                            if (newBtpName !== (existing.btpOnbAdvNome || '').trim()) updateObj.btpOnbAdvNome = newBtpName;
                            if (newBtpEmail !== (existing.btpOnbAdvEmail || '').trim()) updateObj.btpOnbAdvEmail = newBtpEmail;
                            if (newErpName !== (existing.erpOnbAdvNome || '').trim()) updateObj.erpOnbAdvNome = newErpName;
                            if (newExternalID !== (existing.externalID || '').trim()) updateObj.externalID = newExternalID;
                            try {
                                await cds.run(UPDATE('EMLACustomers').set(updateObj).where({ ID: existing.ID }));
                                updated++;
                            } catch (e) {
                                updateErrors++;
                                let reason = e && e.message ? e.message : String(e);
                                errors2.push({ row: rec.csvRowNumber || originalIndex + 1, reason: `Update failed: ${reason}` });
                                failedRawRows2.push(Object.assign({}, rec, { __updateError: reason }));
                                console.error(`Update failed for existing record ID=${existing.ID}:`, reason);
                            }
                        } else {
                            // No advisor difference; skip silently
                        }
                    } else {
                        // Insert new record
                        try {
                            await cds.run(INSERT.into('EMLACustomers').entries([rec]));
                            inserted++;
                        } catch (e) {
                            // capture DB error message and attach the original raw row if possible
                            let reason = e && e.message ? e.message : String(e);
                            if (reason.includes('value too long') || reason.includes('string exceeds maximum length')) {
                                reason = `Field value too long. Consider shortening text content. Original error: ${reason}`;
                            } else if (reason.includes('invalid character') || reason.includes('encoding')) {
                                reason = `Invalid characters detected in text field. Original error: ${reason}`;
                            } else if (reason.includes('constraint') && reason.includes('unique')) {
                                reason = `Duplicate record detected (same customer already exists). Original error: ${reason}`;
                            }
                            dbErrorCount++;
                            insertErrors.push({ index: originalIndex, reason, record: rec });
                            errors2.push({ row: originalIndex + 1, reason });
                            failedRawRows2.push(Object.assign({}, rec, { __dbError: reason }));
                            console.error(`Insert failed for record ${originalIndex}:`, reason);
                        }
                    }
                }
                // Small delay between batches to prevent overwhelming the database
                if (batchEnd < advisorFiltered.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        }

        let failedRowsCsv = '';
        if (failedRawRows2.length > 0) {
            const allKeys = Array.from(new Set(failedRawRows2.flatMap(r => Object.keys(r))));
            failedRowsCsv = allKeys.join(',') + '\n' + failedRawRows2.map(r => allKeys.map(k => '"' + ((r[k] || '') + '').replace(/"/g, '""') + '"').join(',')).join('\n');
        }

        return { 
            inserted: inserted, 
            updated: updated,
            updateErrors: updateErrors,
            errors: errors2, 
            failedRowsCsv: failedRowsCsv, 
            skippedNoAdvisor, 
            totalRows: data.length, 
            validationErrors: validationErrorCount,
            dbErrors: dbErrorCount,
            recoveredAdvisorCount,
            advisorNotFoundCount,
            message: `Processed ${data.length} data rows: inserted ${inserted}, updated ${updated}, updateErrors ${updateErrors}, validationErrors ${validationErrorCount}, dbErrors ${dbErrorCount}, skippedNoAdvisor ${skippedNoAdvisor}, advisorUnresolved ${advisorNotFoundCount}` 
        };

    } catch (error) {
        console.error('CSV upload error:', error);
        request.error(500, `Upload failed: ${error.message}`);
    }
};