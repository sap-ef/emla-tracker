/**
 * Sync EMLA Data from External OData Service
 *
 * This function is called by Job Scheduling Service to fetch data from
 * the external OData service via the 'emla-private' destination (Client Credentials)
 * and update the database.
 */

const cds = require("@sap/cds");
const { executeHttpRequest } = require("@sap-cloud-sdk/http-client");
const { getDestination } = require("@sap-cloud-sdk/connectivity");

module.exports = async function syncEMLAData(request) {
  const LOG = cds.log("sync-emla");
  LOG.info("Starting EMLA data sync from OData destination: emla-private");

  console.log(request.authInfo?.getScopes?.());

  try {
    // Get database service
    const db = await cds.connect.to("db");
    const { EMLACustomers } = db.entities("EMLATracker");

    // Fetch data from OData destination 'emla-private'
    LOG.info("Fetching data from OData service via destination: emla-private");

    // Get destination to verify URL
    const destination = await getDestination({
      destinationName: "emla-private",
    });
    LOG.info(`Destination URL: ${destination.url}`);

    // OData query to get EMLA customers
    const entityPath = "customerMaster/CustomerMaster";

    // Build OData query parameters manually (don't encode $ symbols)
    const queryString = [
      "$count=true",
      "$select=HasActiveEntity,HasDraftEntity,ID,IsActiveEntity,btpOnboardingAdvisor_userId,customerId,customerName,onboardingAdvisor_userId,startDate",
      "$expand=DraftAdministrativeData($select=DraftUUID,InProcessByUser),country($select=ID,name),emLAType($select=ID,name),region($select=ID,name)",
      "$filter=btpOnboardingAdvisor_userId ne null and (IsActiveEntity eq false or SiblingEntity/IsActiveEntity eq null)",
      "$skip=0",
      "$top=1000",
    ].join("&");

    const fullUrl = `${entityPath}?${queryString}`;
    LOG.info(`Full request URL: ${destination.url}/${fullUrl}`);

    // Call destination with Client Credentials authentication
    const response = await executeHttpRequest(
      { destinationName: "emla-private" },
      {
        method: "GET",
        url: fullUrl,
        headers: {
          Accept: "application/json",
        },
      }
    );

    // Handle OData response structure
    if (!response.data || !response.data.value) {
      LOG.error(
        "No data received from OData service or invalid response structure"
      );
      return JSON.stringify({
        success: false,
        message: "No data received from OData service",
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: [
          {
            reason: "Invalid OData response structure",
            response: response.data,
          },
        ],
      });
    }

    // OData returns data in the 'value' property
    const externalData = response.data.value;
    LOG.info(`Received ${externalData.length} records from OData service`);

    let inserted = 0;
    let updated = 0;
    const errors = [];

    // Build normalized view of incoming data first
    const normalized = externalData.map(r => {
      return {
        raw: r,
        customerNumber: r.customerNumber || r.customerId || r.ID || null,
        customerName: r.customerName,
        emlaType: r.emLAType?.name || r.emlaType || null,
        region: r.region?.name || r.region || null,
        country: r.country?.name || r.country || null,
        erpUserId: r.onboardingAdvisor_userId || null,
        btpUserId: r.btpOnboardingAdvisor_userId || null,
        startDate: r.startDate || null,
        externalID: r.ID || null
      };
    });

    // Filter out rows missing required fields early
    const candidates = normalized.filter(n => n.customerNumber && n.customerName && n.emlaType);

    // Prefetch existing records for all composite keys to minimize round trips
    if (candidates.length) {
      const uniqueKeys = Array.from(new Set(candidates.map(c => `${c.customerNumber}||${c.emlaType}`)));
      const keyConditions = uniqueKeys.map(key => {
        const [customerNumber, emlaType] = key.split('||');
        return { customerNumber, emlaType };
      });
      // CAP doesn't support OR array directly; fetch all then map
      const existingAll = await SELECT.from(EMLACustomers).where({ customerNumber: { 'in': candidates.map(c => c.customerNumber) } });
      var existingMap = new Map();
      for (const ex of existingAll) {
        existingMap.set(`${ex.customerNumber}||${ex.emlaType}`, ex);
      }
    } else {
      var existingMap = new Map();
    }

    // Advisor enrichment: if we only have userId, attempt to map to known advisor name/email from OnboardAdvisors
    let advisorTable = await SELECT.from('EMLATracker.OnboardAdvisors');
    const advisorNameById = new Map();
    const advisorEmailById = new Map();
    for (const adv of advisorTable) {
      // Assume onbAdvisor field might store userId or key
      advisorNameById.set(adv.onbAdvisor, adv.name);
      advisorEmailById.set(adv.onbAdvisor, adv.email);
    }

    for (const n of normalized) {
      if (!n.customerNumber || !n.customerName || !n.emlaType) {
        errors.push({ record: n.raw, reason: 'Missing required fields: customerName, customerNumber or emlaType' });
        continue;
      }

      const key = `${n.customerNumber}||${n.emlaType}`;
      const existing = existingMap.get(key);

      // Derive advisor names
      const erpAdvName = n.erpUserId || existing?.erpOnbAdvNome || n.raw.erpOnbAdvNome || null;
      let btpAdvName = n.btpUserId || existing?.btpOnbAdvNome || n.raw.btpOnbAdvNome || null;
      let btpAdvEmail = n.raw.btpOnbAdvEmail || existing?.btpOnbAdvEmail || null;

      // Enrich if only userId present (and no readable name) using OnboardAdvisors
      if (n.btpUserId && (!btpAdvName || btpAdvName === n.btpUserId)) {
        if (advisorNameById.has(n.btpUserId)) btpAdvName = advisorNameById.get(n.btpUserId);
        if (advisorEmailById.has(n.btpUserId) && !btpAdvEmail) btpAdvEmail = advisorEmailById.get(n.btpUserId);
      }

      try {
        if (existing) {
          // Only update changed fields to reduce delta churn
          const delta = {};
          if (n.customerName && n.customerName !== existing.customerName) delta.customerName = n.customerName;
          if (n.emlaType && n.emlaType !== existing.emlaType) delta.emlaType = n.emlaType; // Should rarely change
          if (n.region && n.region !== existing.region) delta.region = n.region;
          if (n.country && n.country !== existing.country) delta.country = n.country;
          if (n.startDate && n.startDate !== existing.startDate) delta.startDate = n.startDate;
          if (erpAdvName && erpAdvName !== existing.erpOnbAdvNome) delta.erpOnbAdvNome = erpAdvName;
          if (btpAdvName && btpAdvName !== existing.btpOnbAdvNome) delta.btpOnbAdvNome = btpAdvName;
          if (btpAdvEmail && btpAdvEmail !== existing.btpOnbAdvEmail) delta.btpOnbAdvEmail = btpAdvEmail;
          if (n.externalID && n.externalID !== existing.externalID) delta.externalID = n.externalID;

          if (Object.keys(delta).length) {
            await UPDATE(EMLACustomers).set(delta).where({ ID: existing.ID });
            updated++;
            LOG.info(`Updated customer: ${n.customerNumber} (${Object.keys(delta).join(',')})`);
          }
        } else {
          await INSERT.into(EMLACustomers).entries({
            customerName: n.customerName,
            customerNumber: n.customerNumber,
            emlaType: n.emlaType,
            region: n.region,
            country: n.country,
            startDate: n.startDate,
            erpOnbAdvNome: erpAdvName,
            btpOnbAdvNome: btpAdvName,
            btpOnbAdvEmail: btpAdvEmail,
            externalID: n.externalID,
            status: 'Not Started'
          });
          inserted++;
          LOG.info(`Inserted new customer: ${n.customerNumber}`);
        }
      } catch (err) {
        LOG.error(`Error processing record ${n.customerNumber}:`, err);
        errors.push({ record: n.raw, reason: err.message });
      }
    }

    const result = {
      success: true,
      message: `Sync completed successfully`,
      processed: externalData.length,
      inserted: inserted,
      updated: updated,
      errors: errors,
      timestamp: new Date().toISOString(),
    };

    LOG.info(
      `Sync completed: ${inserted} inserted, ${updated} updated, ${errors.length} errors`
    );
    return JSON.stringify(result);
  } catch (error) {
    LOG.error("Error during EMLA data sync:", error);

    return JSON.stringify({
      success: false,
      message: error.message || "Unknown error during sync",
      processed: 0,
      inserted: 0,
      updated: 0,
      errors: [
        {
          reason: error.message,
          stack: error.stack,
        },
      ],
      timestamp: new Date().toISOString(),
    });
  }
};
