const cds = require("@sap/cds");
const { executeHttpRequest } = require("@sap-cloud-sdk/http-client");

/**
 * Session Sync Logic for Selected Records
 * 
 * This function syncs session status for only the selected records by:
 * 1. Checking if trackApp fields are filled
 * 2. Calling the OData service to check status and date
 * 3. Updating the isTrackAppCompleted, isTrackAppTP2Completed, and isTrackAppSHCompleted flags
 * 
 * @param {cds.Request} request - Request containing the selected record IDs
 */
async function sessionSync(req) {
  const logger = cds.log("session-sync");
  logger.info("Starting session sync for selected records...");

  try {
    // Extract selected record IDs from request parameters
    const params = req.params;
    if (!params || params.length === 0) {
      logger.warn("No records selected for session sync");
      return "No records selected for session sync";
    }

    const selectedIds = params.map(param => param.ID);
    logger.info(`Processing session sync for ${selectedIds.length} selected records`);

    // Get database connection
    const db = await cds.connect.to("db");
    const { EMLACustomers } = db.entities;

    let totalUpdated = 0;
    let totalChecked = 0;

    // Fetch only the selected records
    const selectedRecords = await SELECT.from(EMLACustomers).where({ 
      ID: { 'in': selectedIds } 
    });

    logger.info(`Found ${selectedRecords.length} records to process`);

    // Process each selected record
    for (const record of selectedRecords) {
      logger.debug(
        `Processing record ID: ${record.ID}, Customer: ${record.customerNumber}`
      );

      const sessionChecks = [];

      // Check TP1 session if exists and not completed
      if (record.trackApp && !isCompletedValue(record.isTrackAppCompleted)) {
        sessionChecks.push({
          sessionId: record.trackApp,
          type: "TP1",
          field: "isTrackAppCompleted",
          rejectionField: "isTrackAppRejected",
          statusField: "trackAppStatus",
        });
        logger.debug(
          `  - TP1 session ${record.trackApp} needs checking (current status: ${record.isTrackAppCompleted})`
        );
      }

      // Check TP2 session if exists and not completed
      if (
        record.trackAppTP2 &&
        !isCompletedValue(record.isTrackAppTP2Completed)
      ) {
        sessionChecks.push({
          sessionId: record.trackAppTP2,
          type: "TP2",
          field: "isTrackAppTP2Completed",
          rejectionField: "isTrackAppTP2Rejected",
          statusField: "trackAppTP2Status",
        });
        logger.debug(
          `  - TP2 session ${record.trackAppTP2} needs checking (current status: ${record.isTrackAppTP2Completed})`
        );
      }

      // Check SH session if exists and not completed
      if (
        record.trackAppSH &&
        !isCompletedValue(record.isTrackAppSHCompleted)
      ) {
        sessionChecks.push({
          sessionId: record.trackAppSH,
          type: "SH",
          field: "isTrackAppSHCompleted",
          rejectionField: "isTrackAppSHRejected",
          statusField: "trackAppSHStatus",
        });
        logger.debug(
          `  - SH session ${record.trackAppSH} needs checking (current status: ${record.isTrackAppSHCompleted})`
        );
      }

      logger.debug(
        `  - Total sessions to check for this record: ${sessionChecks.length}`
      );

      // Process each session for this record
      for (const check of sessionChecks) {
        totalChecked++;
        logger.info(
          `Checking ${check.type} session: ${check.sessionId} (${totalChecked}/${totalChecked})`
        );

        try {
          // Call webservice to check session status
          logger.debug(`Calling webservice for session ${check.sessionId}...`);
          const sessionData = await checkSessionStatus(check.sessionId, logger);

          if (sessionData) {
            // Always update status and reset flags for fresh state
            const updateData = {};
            
            // Store the raw status value
            updateData[check.statusField] = sessionData.status || sessionData.rawStatus || 'Unknown';
            logger.info(`📝 Session ${check.sessionId} status - updating ${check.statusField} to '${updateData[check.statusField]}'`);
            
            // ALWAYS reset completion and rejection flags first
            updateData[check.field] = false; // Reset completion flag
            updateData[check.rejectionField] = false; // Reset rejection flag
            
            // Then set the appropriate flags based on current status
            if (sessionData.completed) {
              updateData[check.field] = true; // Set Boolean true for completion
              logger.info(`📅 Session ${check.sessionId} completed - updating ${check.field} to true`);
              
              // Also update completedOn date if provided
              if (sessionData.completedDate) {
                updateData.completedOn = sessionData.completedDate;
              }
            }
            
            if (sessionData.rejected) {
              updateData[check.rejectionField] = true;
              logger.info(`❌ Session ${check.sessionId} rejected - updating ${check.rejectionField} to true`);
            }

            logger.debug(`🔄 Updating database for record ID: ${record.ID}`);
            logger.debug(`🔄 Update data:`, JSON.stringify(updateData, null, 2));
            
            const updateResult = await UPDATE(EMLACustomers)
              .set(updateData)
              .where({ ID: record.ID });

            logger.debug(`🔄 Update result:`, updateResult);
            totalUpdated++; // Increment the counter when database is updated
            
            if (sessionData.completed) {
              logger.info(
                `✅ Updated ${check.type} session ${check.sessionId} for customer ${record.customerNumber} - marked as completed`
              );
              if (sessionData.completedDate) {
                logger.debug(
                  `   - Completed date set to: ${sessionData.completedDate}`
                );
              }
            } else if (sessionData.rejected) {
              logger.info(
                `❌ Updated ${check.type} session ${check.sessionId} for customer ${record.customerNumber} - marked as rejected`
              );
            } else {
              logger.info(
                `📝 Updated ${check.type} session ${check.sessionId} for customer ${record.customerNumber} - status updated to '${updateData[check.statusField]}', flags reset`
              );
            }
          } else {
            logger.debug(
              `⏳ ${check.type} session ${check.sessionId} still in progress`
            );
          }
        } catch (error) {
          logger.error(
            `❌ Failed to check ${check.type} session ${check.sessionId} for customer ${record.customerNumber}:`,
            error.message
          );
        }
      }
    }

    const result = `Session sync completed. Checked ${totalChecked} sessions, updated ${totalUpdated} records.`;
    logger.info(result);
    return result;
  } catch (error) {
    logger.error("Session sync failed:", error);
    throw new Error(`Session sync failed: ${error.message}`);
  }
}

// Helper function to check if a value represents completion
function isCompletedValue(value) {
  const logger = cds.log("session-sync");
  logger.debug(`Checking completion value: ${value} (type: ${typeof value})`);

  if (value === true || value === 1) {
    logger.debug("Value is boolean true or number 1 - completed");
    return true;
  }
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    const isCompleted = s === "true" || s === "yes" || s === "x" || s === "1";
    logger.debug(
      `String value '${value}' normalized to '${s}' - completed: ${isCompleted}`
    );
    return isCompleted;
  }
  logger.debug("Value not recognized as completed");
  return false;
}

// Function to call webservice and check session status
async function checkSessionStatus(sessionId, logger) {
  logger.info(
    `🌐 Calling webservice to check status for session: ${sessionId}`
  );

  try {
    // Use the same destination and API path as session-status-logic.js
    const destination = "onb_session"; // Configure this in BTP destinations
    const apiPath = `/api/Sessions(ID='${sessionId}')`;

    logger.info(`📍 Destination name: ${destination}`);
    logger.info(`📍 API path: ${apiPath}`);
    logger.info(
      `📍 Full request URL will be: [destination-base-url]${apiPath}`
    );

    // Log the request configuration before making the call
    const destinationConfig = { destinationName: destination };
    const requestConfig = {
      method: "GET",
      url: apiPath,
      headers: {
        "Content-Type": "application/json",
      },
    };

    logger.info(
      `🔧 Destination config:`,
      JSON.stringify(destinationConfig, null, 2)
    );
    logger.info(`🔧 Request config:`, JSON.stringify(requestConfig, null, 2));

    // Make the HTTP request
    logger.info(`🚀 Making HTTP request now...`);
    const response = await executeHttpRequest(destinationConfig, requestConfig);

    logger.info(`✅ Webservice response status: ${response.status}`);
    logger.info(
      `📄 Webservice response headers:`,
      JSON.stringify(response.headers, null, 2)
    );
    logger.info(
      `� Webservice response data:`,
      JSON.stringify(response.data, null, 2)
    );

    if (response.status === 200) {
      const data = response.data;
      
      // Log the exact status value we received
      logger.info(`🔍 Raw sessionStatus_name received: "${data.sessionStatus_name}"`);
      
      // Check if this is a rejected session first - be more flexible with rejection detection
      const isRejected = data.sessionStatus_name && 
        (data.sessionStatus_name.toLowerCase().includes("reject") ||
         data.sessionStatus_name.toLowerCase().includes("cancelled") ||
         data.sessionStatus_name.toLowerCase().includes("cancel") ||
         data.sessionStatus_name.toLowerCase().includes("declined") ||
         data.sessionStatus_name.toLowerCase().includes("decline") ||
         data.sessionStatus_name.toLowerCase().includes("denied") ||
         data.sessionStatus_name.toLowerCase().includes("deny"));
      
      logger.info(`🔍 Rejection check result: ${isRejected} (for status: "${data.sessionStatus_name}")`);
      
      // Check if sessionDate exists and is BEFORE today (only for non-rejected sessions)
      // Sessions created today should NOT be automatically marked as completed
      let isDateCompleted = false;
      if (!isRejected && data.sessionDate) {
        const sessionDate = new Date(data.sessionDate);
        const today = new Date();
        // Set time to 00:00:00 for date-only comparison
        today.setHours(0, 0, 0, 0);
        sessionDate.setHours(0, 0, 0, 0);
        
        // Only mark as completed if session date is BEFORE today (not today or future)
        isDateCompleted = sessionDate < today;
        logger.info(`📅 Date analysis for session ${sessionId}:`);
        logger.info(`   - sessionDate from API: ${data.sessionDate}`);
        logger.info(`   - sessionDate parsed: ${sessionDate.toISOString()}`);
        logger.info(`   - today: ${today.toISOString()}`);
        logger.info(`   - sessionDate < today (must be BEFORE today): ${isDateCompleted}`);
        logger.debug(`📅 Session date: ${data.sessionDate}, Today: ${today.toISOString().split('T')[0]}, Date completed: ${isDateCompleted}`);
      } else {
        logger.info(`📅 Date check skipped for session ${sessionId}:`);
        logger.info(`   - isRejected: ${isRejected}`);
        logger.info(`   - has sessionDate: ${!!data.sessionDate}`);
      }
      
      const result = {
        completed:
          !isRejected && (data.sessionStatus_name && data.sessionStatus_name.toLowerCase().includes("completed") || isDateCompleted),
        rejected: isRejected,
        status: data.sessionStatus_name || 'Unknown',
        completedDate: data.completedDate ? new Date(data.completedDate) : null,
        progress: data.progress || 0,
      };
      
      logger.info(`🔍 Session ${sessionId} completion analysis:`);
      logger.info(`   - sessionStatus_name: "${data.sessionStatus_name}"`);
      logger.info(`   - sessionStatus_name.toLowerCase().includes("completed"): ${data.sessionStatus_name && data.sessionStatus_name.toLowerCase().includes("completed")}`);
      logger.info(`   - isRejected: ${isRejected}`);
      logger.info(`   - isDateCompleted (date < today): ${isDateCompleted}`);
      logger.info(`   - completion formula: !isRejected && (status.includes("completed") || dateBeforeToday)`);
      logger.info(`   - completion formula: !${isRejected} && (${data.sessionStatus_name && data.sessionStatus_name.toLowerCase().includes("completed")} || ${isDateCompleted})`);
      logger.info(`   - final completed flag: ${result.completed}`);
      logger.info(`   - final rejected flag: ${result.rejected}`);
      logger.debug(`📊 Final result for ${sessionId}:`, JSON.stringify(result, null, 2));
      return result;
    } else {
      logger.warn(
        `⚠️  Webservice returned non-200 status ${response.status} for session ${sessionId}`
      );
      return null;
    }
  } catch (error) {
    const destination = "onb_session"; // Redeclare for error handling
    const apiPath = `/api/Sessions(ID='${sessionId}')`;

    logger.error(
      `🔥 Webservice call failed for session ${sessionId}:`,
      error.message
    );
    logger.info(`📍 Attempted destination: ${destination}`);
    logger.info(`📍 Attempted API path: ${apiPath}`);
    logger.info(`🔍 Full error details:`, error);

    // For development/testing - return mock data if destination not configured
    if (
      error.message.includes("destination") ||
      error.message.includes("ENOTFOUND") ||
      error.message.includes("404")
    ) {
      logger.warn(
        `📝 Using mock data for session ${sessionId} (webservice not available)`
      );
      logger.info(
        `💡 To use real webservice, configure BTP destination '${destination}' with base URL`
      );
      // For new sessions, always return in-progress, never completed
      return {
        completed: false,
        rejected: false,
        status: 'in progress',
        completedDate: null,
        progress: Math.floor(Math.random() * 100),
      };
    }

    throw error;
  }
}

module.exports = {
  sessionSync,
};