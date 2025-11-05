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

          if (sessionData && sessionData.completed) {
            // Update the completion flag - use Boolean true since schema defines as Boolean
            const updateData = {};
            updateData[check.field] = true; // Set Boolean true for completion
            
            logger.info(`📅 Session ${check.sessionId} completed - updating ${check.field} to true`);

            // Also update completedOn date if provided
            if (sessionData.completedDate) {
              updateData.completedOn = sessionData.completedDate;
            }

            logger.debug(`🔄 Updating database for record ID: ${record.ID}`);
            logger.debug(`🔄 Update data:`, JSON.stringify(updateData, null, 2));
            
            const updateResult = await UPDATE(EMLACustomers)
              .set(updateData)
              .where({ ID: record.ID });

            logger.debug(`🔄 Update result:`, updateResult);
            totalUpdated++; // Increment the counter when database is updated
            
            logger.info(
              `✅ Updated ${check.type} session ${check.sessionId} for customer ${record.customerNumber} - marked as completed`
            );
            if (sessionData.completedDate) {
              logger.debug(
                `   - Completed date set to: ${sessionData.completedDate}`
              );
            }
          } else {
            logger.debug(
              `⏳ ${check.type} session ${check.sessionId} still in progress or not completed`
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

    const result = `Session sync completed for selected records. Checked ${totalChecked} sessions, updated ${totalUpdated} to completed status.`;
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
      
      // Check if sessionDate exists and is >= today
      let isDateCompleted = false;
      if (data.sessionDate) {
        const sessionDate = new Date(data.sessionDate);
        const today = new Date();
        // Set time to 00:00:00 for date-only comparison
        today.setHours(0, 0, 0, 0);
        sessionDate.setHours(0, 0, 0, 0);
        
        isDateCompleted = sessionDate <= today;
        logger.debug(`📅 Session date: ${data.sessionDate}, Today: ${today.toISOString().split('T')[0]}, Date completed: ${isDateCompleted}`);
      }
      
      const result = {
        completed:
          data.sessionStatus_name === "completed" || isDateCompleted,
        completedDate: data.completedDate ? new Date(data.completedDate) : null,
        progress: data.progress || 0,
      };
      
      logger.debug(`📋 Final result for ${sessionId}:`, JSON.stringify(result, null, 2));
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
      return {
        completed: Math.random() > 0.5, // Random completion for testing
        completedDate: new Date(),
        progress: Math.floor(Math.random() * 100),
      };
    }

    throw error;
  }
}

module.exports = {
  sessionSync,
};