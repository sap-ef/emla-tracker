/**
 * Analyze Engagement Progress
 * Implemented as a code-style module (same pattern as sync-emla-logic)
 */
const cds = require("@sap/cds");
const { executeHttpRequest } = require("@sap-cloud-sdk/http-client");
const { getDestination } = require("@sap-cloud-sdk/connectivity");

module.exports = async function analyzeEngagement(request) {
  const LOG = cds.log("analyze-engagement");
  LOG.info("Starting AnalyzeEngagementProgress (code-style handler)");

  LOG.info(`INterval in days: ${request.data.internalInDays}`);

  // Helper function to update customer record based on engagement task
  async function updateCustomerFromEngagement(customerId, taskName, engagementDate, engagementStatus, db) {
    try {
      const { EMLACustomers } = db.entities("EMLATracker");
      
      // Find customer by customerNumber and emlaType
      const customerRecord = await SELECT.one.from(EMLACustomers)
        .where({ customerNumber: customerId, emlaType: 'Cloud ERP Private' });
      
      if (!customerRecord) {
        LOG.warn(`Customer not found for customerId: ${customerId} with emlaType 'Cloud ERP Private'`);
        return;
      }

      const updateData = {};
      
      // Map engagement task name to fields
      if (taskName === 'SAP Build Foundation') {
        // TP2
        updateData.trackAppTP2Date = engagementDate;
        updateData.trackAppTP2Status = engagementStatus;
      } else if (taskName === 'SAP BTP Foundation') {
        // TP1
        updateData.trackAppDate = engagementDate;
        updateData.trackAppStatus = engagementStatus;
      }
      
      if (Object.keys(updateData).length > 0) {
        await UPDATE(EMLACustomers)
          .set(updateData)
          .where({ ID: customerRecord.ID });
        
        LOG.info(`Updated customer ${customerId} with ${taskName} data`);
      }
    } catch (custError) {
      LOG.warn(`Failed to update customer ${customerId}: ${custError.message}`);
    }
  }

  try {
    const db = await cds.connect.to("db");
    const { AnalyzeEngagementProgress, EMLACustomers } = db.entities("EMLATracker");

    // Check destination availability
    let destinationAvailable = false;
    try {
      const dest = await getDestination({
        destinationName: "emla-private",
      });
      if (dest && dest.url) {
        LOG.info(`Analyzer destination found: ${dest.url}`);
        destinationAvailable = true;
      }
    } catch (e) {
      LOG.warn(
        "Analyzer destination not available, falling back to local analysis"
      );
    }

    let inserted = 0;
    let updated = 0;
    const errors = [];

    // If destination available, try to fetch analysis results in batch using OData-style query
    let analysisMap = new Map();
    if (destinationAvailable) {
      try {
        // Build $filter for provided IDs or fetch recent analyses
        const entityPath = "analyze-progress/AnalyzeEngagementProgress";
        let filter =
          "engagementTaskName in ( 'SAP BTP Foundation','SAP Build Foundation') and modifiedAt gt #DATE#";

//calculate the date usin gthe internalInDays parameter subtract tthe number od days from current date
        const date = new Date();
        date.setDate(date.getDate() - request.data.internalInDays);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");

        // replace #DATE# with actual date
        // Use the date calculated above
        filter = filter.replace("#DATE#", `${yyyy}-${mm}-${String(date.getDate()).padStart(2, "0")}`);

        const queryParts = [
          "$count=true",
          "$select=ID,btpOnboardingAdvisor_userId,btpOnboardingCheckInDate,btpOnboardingRejectionNote,customerId,customerName,date,deliveryBy_userId,deliveryName,detailedStatusName,engagementTaskName,solutionName,status_ID,modifiedAt",
          "$expand=btpOnboardingRejectionReason($select=ID,name),deliveryBy($select=name,userId),detailedStatus($select=ID,criticality_code),emLAType($select=ID,name),status($select=ID,criticality_code,name)",
          `$filter=${filter}`,
          "$top=1000",
        ];
        const queryString = queryParts.join("&");
        const fullUrl = `${entityPath}?${queryString}`;
        LOG.info(`Calling analyzer destination with: ${fullUrl}`);

        const resp = await executeHttpRequest(
          { destinationName: "emla-private" },
          {
            method: "GET",
            url: fullUrl,
            headers: { Accept: "application/json" },
          }
        );
        if (resp && resp.data && Array.isArray(resp.data.value)) {
          for (const a of resp.data.value) {
            try {
              //check if this record already exist on the table AnalyzeEngagementProgress select one
              var existing = await cds.run(
                SELECT.one(AnalyzeEngagementProgress)
                  .where({ ID: a.ID })
                  .columns("ID")
              );
              if (!existing) {
                //create
                console.log("🔥 Creating new analysis record for ID:", a.ID);
                var newEngaement = {
                  ID: a.ID,
                  btpOnboardingAdvisor_userId: a.btpOnboardingAdvisor_userId,
                  status: a.status.name,
                  detailedStatusName: a.detailedStatusName,
                  engagementTaskName: a.engagementTaskName,
                  customerId: a.customerId,
                  date: a.date,
                };

                console.log("🔥 New Engagement Record:", newEngaement);
                await INSERT.into(AnalyzeEngagementProgress).entries(
                  newEngaement
                );
                inserted++;
                
                // Update corresponding EMLACustomers record based on engagement task type
                if (a.customerId) {
                  await updateCustomerFromEngagement(a.customerId, a.engagementTaskName, a.date, a.detailedStatusName, db);
                }
              } else {
                //update
                console.log(
                  "🔥 Updating existing analysis record for ID:",
                  a.ID
                );

                await UPDATE(AnalyzeEngagementProgress).set({
                  status: a.status.name,
                  detailedStatusName: a.detailedStatusName,
                  date: a.date,
                }).where({
                  ID: a.ID,
                });

                updated++;
                
                // Update corresponding EMLACustomers record based on engagement task type
                if (a.customerId) {
                  await updateCustomerFromEngagement(a.customerId, a.engagementTaskName, a.date, a.detailedStatusName, db);
                }
              }
            } catch (error) {
              errors.push({
                ID: a.ID,
                reason: `Error processing analysis record: ${error.message}`,
              });
            }
          }
          LOG.info(
            `Received ${analysisMap.size} analysis results from analyzer destination`
          );

          const result = {
            success: true,
            message: "AnalyzeEngagementProgress completed",
            processed: resp.data.value.length,
            inserted: inserted,
            updated: updated,
            errors: errors,
            timestamp: new Date().toISOString(),
          };

          LOG.info(`Analysis completed: ${inserted} progress records inserted`);
          return JSON.stringify({ Analysis: result });
        } else {
          LOG.warn(
            "Analyzer destination returned empty or unexpected payload, will fallback per-customer or local analysis"
          );
        }
      } catch (e) {
        LOG.warn(
          "Batch analyzer call failed, falling back to per-customer calls or local analysis",
          e.message
        );
      }
    } else {
      // destination not available — continue and rely on per-customer or local fallback
      LOG.warn(
        "Destination emla-private not available, will fallback per-customer or local analysis"
      );
    }
    return "Error";
  } catch (error) {
    cds
      .log("analyze-engagement")
      .error("Error during AnalyzeEngagementProgress:", error);
    return JSON.stringify({
      EMLAData: {
        success: false,
        message: error.message,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: [{ reason: error.message }],
      },
    });
  }
};
