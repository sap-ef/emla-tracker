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
            'account name': 'Account Name',
            'btp onb advisor': 'BTP ONB Advisor',
            'btp onboarding advisor': 'BTP Onboarding Advisor',
            'region lvl 1': 'Region Lvl 1',
            'region l5/country': 'Region L5/Country',
            region: 'Region',
            country: 'Country',
            'contract start date': 'Contract Start Date',
            'revenue start date': 'Revenue Start Date',
            'crt link': 'CRT Link',
            'cloud erp onboarding advisor': 'Cloud ERP Onboarding Advisor',
            id: 'ID'
        };

        // Use PapaParse in header mode so we rely entirely on PapaParse for CSV handling
        const parsed = Papa.parse(csvData, {
            header: true,
            skipEmptyLines: true,
            quoteChar: '"',
            transformHeader: function(h) {
                const n = normalizeHeader(h).replace(/\uFEFF/g, '');
                return HEADER_SYNONYMS[n] || (h ? h.toString().trim().replace(/"/g, '') : '');
            }
        });
        const data = parsed && parsed.data ? parsed.data : [];
        if (!data || data.length === 0) {
            request.error(400, 'CSV file is empty or has no data rows');
            return;
        }

        // Mapping from various Integration Suite header names to our expected model fields
        const headerMap = {
            'account name': 'customerName',
            'opp_accountname': 'customerName',
            'accountname': 'customerName',
            'erp cust number': 'customerNumber',
            'erp cust no': 'customerNumber',
            'erp cust number': 'customerNumber',
            'erp customer number': 'customerNumber',
            'product list': 'emlaType',
            'productlist': 'emlaType',
            'emla staffing for btp': 'btpOnbAdvNome',
            'btp onb advisor': 'btpOnbAdvNome',
            'btp onb advisor email': 'btpOnbAdvEmail',
            'btp onboard advisor email': 'btpOnbAdvEmail',
            'emla staffing for sap cloud erp': 'erpOnbAdvNome',
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
                result[target] = raw[originalKey];
            }

            // Map startDate field
            if (result.startDate) { result.startDateL = result.startDate; delete result.startDate; }
            if (result.ID && !result.externalID) { result.externalID = result.ID; delete result.ID; }

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
                const accIdx = findIndex(['Account Name','Opp_AccountName']);
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
                if (!result.externalID) {
                    if (result.customerNumber && result.customerName) result.externalID = `IS_${result.customerName.replace(/\s+/g,'_')}_${result.customerNumber}`;
                    else if (result.customerName) result.externalID = `IS_${result.customerName.replace(/\s+/g,'_')}_${Date.now()}`;
                    else result.externalID = `IS_UNKNOWN_${Date.now()}`;
                }
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
                const accIdx = findIndex(['Customer Name','Account Name','Opp_AccountName','AccountName','Account Name']);
                if (accIdx >= 0 && tokens[accIdx]) result.customerName = tokens[accIdx].trim();
                const custIdx = findIndex(['Customer ID','ERP Cust Number','Customer Number','ERP Cust#','ERP Cust']);
                if (custIdx >= 0) {
                    const val = (tokens[custIdx] || raw['Customer ID'] || raw['Customer ID'] || '').toString().trim();
                    if (val) {
                        if (!result.customerNumber) result.customerNumber = val;
                        if (!result.externalID) result.externalID = val;
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
                    } else if (crtIdxPub >= 0 && tokens[crtIdxPub]) {
                        const t = tokens[crtIdxPub];
                        const match = t.match(/id=(\d+)/i);
                        if (match) result.customerNumber = match[1];
                        else {
                            const m2 = t.match(/(\d{4,})/);
                            if (m2) result.customerNumber = m2[1];
                        }
                    }
                }
                const idIdx = findIndex(['ID']);
                if ((!result.externalID || result.externalID.indexOf('UNKNOWN') === 0) && idIdx >= 0 && tokens[idIdx]) { result.ID = tokens[idIdx].trim(); if (!result.externalID) result.externalID = result.ID; }
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
                    const candidate2 = raw['S/4HANA Finance ONB Advisor'] || '';
                    if (isMeaningfulCandidate(candidate2)) result.erpOnbAdvNome = (candidate2+'').trim();
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

            console.log(`Mapping Debug for ${mappingType}:`);
            console.log('Original headers:', Object.keys(raw));
            console.log('Raw row data:', raw);
            console.log('Applied rename map:', mapping.rename_map);
            console.log('Mapped result:', {
                customerName: result.customerName,
                customerNumber: result.customerNumber,
                region: result.region,
                country: result.country,
                externalID: result.externalID,
                startDateL: result.startDateL,
                erpOnbAdvNome: result.erpOnbAdvNome,
                btpOnbAdvEmail: result.btpOnbAdvEmail,
                CRTLink: result.CRTLink
            });

            return { record: result, mappingType };
        }

        // End of mapRecord definition
        // Now iterate rows using mapRecord for robust mapping
        const recordsToInsert2 = [];
        const errors2 = [];
        const failedRawRows2 = [];

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

            // If PubCloudERP import must include BTP Onboarding Advisor, skip rows lacking it
            if (mappingType === 'PubCloudERP' && (!mappedRecord.btpOnbAdvNome || (mappedRecord.btpOnbAdvNome + '').trim() === '')) {
                errors2.push({ row: csvRowNumber, reason: 'Missing BTP Onboarding Advisor (required for Public Cloud ERP import)' });
                failedRawRows2.push(rowObj);
                continue;
            }

            if (!mappedRecord.customerName || !mappedRecord.customerNumber || !mappedRecord.emlaType) {
                errors2.push({ row: csvRowNumber, reason: 'Missing required fields (customerName, customerNumber, emlaType)' });
                failedRawRows2.push(rowObj);
                continue;
            }

            // Advisor enrichment: directly query the OnboardAdvisors table by onbAdvisor using the provided field
            try {
                if (mappedRecord.btpOnbAdvNome) {
                    try {
                        const dbRes = await SELECT.one.from('OnboardAdvisors').where({ onbAdvisor: mappedRecord.btpOnbAdvNome });
                        if (dbRes) {
                            mappedRecord.btpOnbAdvEmail = dbRes.email || mappedRecord.btpOnbAdvEmail || '';
                            mappedRecord.btpOnbAdvNome = dbRes.name || mappedRecord.btpOnbAdvNome;
                        }
                    } catch (e) {
                        // if DB lookup fails, continue without enrichment
                        console.warn('OnboardAdvisors per-row lookup failed:', e && e.message);
                    }
                }
            } catch (e) {
                // ignore enrichment-level failures
            }
            // Debug: log first few parsed rows and mapped result to diagnose mapping issues
            try {
                if (r < 5) {
                    console.log('DEBUG parsed row[' + r + ']:', rowObj);
                    console.log('DEBUG mapped result[' + r + ']:', mappedRecord);
                }
            } catch (e) {}

            // If advisor fields are not meaningful (e.g., 'Yes'), clear them
            if (!isMeaningfulCandidate(mappedRecord.btpOnbAdvNome)) mappedRecord.btpOnbAdvNome = '';
            if (!isMeaningfulCandidate(mappedRecord.btpOnbAdvEmail)) mappedRecord.btpOnbAdvEmail = '';

            mappedRecord.ID = cds.utils.uuid();
            mappedRecord.status = 'Open';
            recordsToInsert2.push(mappedRecord);
        }

        // Perform inserts one-by-one so a single failing INSERT (e.g. UNIQUE constraint)
        // does not abort the whole upload. Collect per-row errors for reporting.
        let inserted = 0;
        const insertErrors = [];
        if (recordsToInsert2.length > 0) {
            for (let i = 0; i < recordsToInsert2.length; i++) {
                const rec = recordsToInsert2[i];
                try {
                    await cds.run(INSERT.into('EMLACustomers').entries([rec]));
                    inserted++;
                } catch (e) {
                    // capture DB error message and attach the original raw row if possible
                    const reason = e && e.message ? e.message : String(e);
                    insertErrors.push({ index: i, reason, record: rec });
                    // also push into errors2 and failedRawRows2 so frontend gets them
                    errors2.push({ row: i + 1, reason });
                    // store a simple raw object snapshot for CSV export
                    failedRawRows2.push(Object.assign({}, rec, { __dbError: reason }));
                    console.error(`Insert failed for record ${i}:`, reason);
                    // continue with next record
                }
            }
        }

        let failedRowsCsv = '';
        if (failedRawRows2.length > 0) {
            const allKeys = Array.from(new Set(failedRawRows2.flatMap(r => Object.keys(r))));
            failedRowsCsv = allKeys.join(',') + '\n' + failedRawRows2.map(r => allKeys.map(k => '"' + ((r[k] || '') + '').replace(/"/g, '""') + '"').join(',')).join('\n');
        }

        return { inserted: inserted, errors: errors2, failedRowsCsv: failedRowsCsv, message: `Processed ${data.length - 1} rows: inserted ${inserted}, errors ${errors2.length}` };

    } catch (error) {
        console.error('CSV upload error:', error);
        request.error(500, `Upload failed: ${error.message}`);
    }
};