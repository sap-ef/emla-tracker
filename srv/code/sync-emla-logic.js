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

    // Process each record
    for (const record of externalData) {
      // Normalize possible customer identifier fields from external service
      // Some services use customerId, some use customerNumber; fallback to ID
      record.customerNumber =
        record.customerNumber || record.customerId || record.ID || null;
      try {
        // Validate required fields
        if (!record.customerName || !record.customerNumber) {
          errors.push({
            record: record,
            reason: "Missing required fields: customerName or customerNumber",
          });
          continue;
        }

        // Determine emlaType from the external record (may be nested)
        const emlaTypeFromRecord =
          record.emLAType?.name || record.emlaType || null;

        // If there is no emlaType associated, skip this row (per requirement)
        if (!emlaTypeFromRecord) {
          LOG.info(
            `Skipping record ${
              record.customerNumber || record.customerId || record.ID
            } - missing emlaType`
          );
          continue;
        }

        // Check if customer already exists (match both customerNumber and emlaType when available)
        let existing = await SELECT.one
          .from(EMLACustomers)
          .where({
            customerNumber: record.customerNumber,
            emlaType: emlaTypeFromRecord,
          });

        // Extract expanded navigation properties
        // OData $expand returns nested objects: country, emLAType, region
        const emlaTypeName = emlaTypeFromRecord || existing?.emlaType;
        const regionName =
          record.region?.name || record.region || existing?.region;
        const countryName =
          record.country?.name || record.country || existing?.country;
        const erpAdvName =
          record.onboardingAdvisor_userId ||
          record.erpOnbAdvNome ||
          existing?.erpOnbAdvNome;
        const btpAdvName =
          record.btpOnboardingAdvisor_userId ||
          record.btpOnbAdvNome ||
          existing?.btpOnbAdvNome;

        if (existing) {
          // Update existing record
          await UPDATE(EMLACustomers)
            .set({
              customerName: record.customerName,
              emlaType: emlaTypeName,
              region: regionName,
              country: countryName,
              startDate: record.startDate || existing.startDate,
              erpOnbAdvNome: erpAdvName,
              btpOnbAdvNome: btpAdvName,
              btpOnbAdvEmail: record.btpOnbAdvEmail || existing.btpOnbAdvEmail,
              // Keep existing status and completion data
              status: existing.status,
              completedOn: existing.completedOn,
            })
            .where({ ID: existing.ID });

          updated++;
          LOG.info(`Updated customer: ${record.customerNumber}`);
        } else {
          // Insert new record
          await INSERT.into(EMLACustomers).entries({
            customerName: record.customerName,
            customerNumber: record.customerNumber,
            emlaType: emlaTypeName,
            region: regionName,
            country: countryName,
            startDate: record.startDate,
            erpOnbAdvNome: erpAdvName,
            btpOnbAdvNome: btpAdvName,
            btpOnbAdvEmail: record.btpOnbAdvEmail,
            status: "Not Started",
          });

          inserted++;
          LOG.info(`Inserted new customer: ${record.customerNumber}`);
        }
      } catch (err) {
        LOG.error(`Error processing record ${record.customerNumber}:`, err);
        errors.push({
          record: record,
          reason: err.message,
        });
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
