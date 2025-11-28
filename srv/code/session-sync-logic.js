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

  try {
    const params = req.params;
    if (!params || params.length === 0) {
      logger.warn("No records selected for session sync");
      return "No records selected for session sync";
    }

    const selectedIds = params.map(param => param.ID);

    const db = await cds.connect.to("db");
    const { EMLACustomers } = db.entities;

    let totalUpdated = 0;
    let totalChecked = 0;

    const selectedRecords = await SELECT.from(EMLACustomers).where({ 
      ID: { 'in': selectedIds } 
    });

    for (const record of selectedRecords) {
      const sessionChecks = [];

      logger.info(`Processing record ID: ${record.ID}, customerNumber: ${record.customerNumber}`);

      // Check ALL sessions regardless of current completion status to re-validate
      if (record.trackApp) {
        sessionChecks.push({
          sessionId: record.trackApp,
          type: "TP1",
          field: "isTrackAppCompleted",
          rejectionField: "isTrackAppRejected",
          statusField: "trackAppStatus",
          dateField: "trackAppDate",
        });
      }

      // Check TP2 session if exists
      if (record.trackAppTP2) {
        sessionChecks.push({
          sessionId: record.trackAppTP2,
          type: "TP2",
          field: "isTrackAppTP2Completed",
          rejectionField: "isTrackAppTP2Rejected",
          statusField: "trackAppTP2Status",
          dateField: "trackAppTP2Date",
        });
      }

      // Check SH session if exists
      if (record.trackAppSH) {
        sessionChecks.push({
          sessionId: record.trackAppSH,
          type: "SH",
          field: "isTrackAppSHCompleted",
          rejectionField: "isTrackAppSHRejected",
          statusField: "trackAppSHStatus",
          dateField: "trackAppSHDate",
        });
      }

      // Process each session for this record
      for (const check of sessionChecks) {
        totalChecked++;
        logger.info(`Checking ${check.type} session: ${check.sessionId}`);
        try {
          const sessionData = await checkSessionStatus(check.sessionId, logger);

          logger.info(`Session data received for ${check.sessionId}:`, JSON.stringify(sessionData, null, 2));

          if (sessionData) {
            // Build update payload
            const updateData = {};
            updateData[check.statusField] = sessionData.status || 'Unknown';
            
            // Update session-specific date field (trackAppDate, trackAppTP2Date, or trackAppSHDate)
            if (sessionData.sessionDate && check.dateField) {
              logger.info(`Setting ${check.dateField} to ${sessionData.sessionDate} for ${check.type} session`);
              // For date-only fields, keep as string in YYYY-MM-DD format
              updateData[check.dateField] = sessionData.sessionDate;
            }
            
            // Reset completion/rejection flags
            updateData[check.field] = false;
            updateData[check.rejectionField] = false;

            // Set completion flag if completed (completedOn is managed by setCompleted action)
            if (sessionData.completed) {
              updateData[check.field] = true;
            }
            
            // Set rejection flag if rejected
            if (sessionData.rejected) {
              updateData[check.rejectionField] = true;
            }

            logger.info(`Updating record ${record.ID} with:`, JSON.stringify(updateData, null, 2));
            const updateResult = await UPDATE(EMLACustomers).set(updateData).where({ ID: record.ID });
            logger.info(`Update result:`, updateResult);
            totalUpdated++;

            // Consolidate a single log entry with all relevant info for this session
            const details = {
              recordID: record.ID,
              customerNumber: record.customerNumber,
              sessionType: check.type,
              sessionId: check.sessionId,
              previous: {
                status: record[check.statusField] || null,
                completedFlag: record[check.field] || false,
                rejectedFlag: record[check.rejectionField] || false,
              },
              remote: sessionData,
              computed: {
                statusIncludesCompleted: sessionData.sessionStatus_name && sessionData.sessionStatus_name.toLowerCase().includes("completed"),
                isRejected: sessionData.rejected || false,
                isDateCompleted: (() => {
                  if (!sessionData.sessionDate) return false;
                  const sessionDate = new Date(sessionData.sessionDate);
                  const today = new Date(); today.setHours(0,0,0,0); sessionDate.setHours(0,0,0,0);
                  return sessionDate < today;
                })(),
                finalCompletedFlag: updateData[check.field],
                finalRejectedFlag: updateData[check.rejectionField]
              },
              updateData: updateData,
              updateResult: updateResult
            };

            logger.info(`SessionSyncResult: ${JSON.stringify(details)}`);
          }
        } catch (error) {
          logger.error(`Failed ${check.type} session ${check.sessionId}: ${error.message}`);
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
function isCompletionValue(value, logger) {
  if (value === true || value === 1) {
    return true;
  }
  if (typeof value === "string") {
    const lowerValue = value.toLowerCase().trim();
    return ["yes", "completed", "true", "1"].includes(lowerValue);
  }
  return false;
}

// Function to call webservice and check session status
async function checkSessionStatus(sessionId, logger) {
  try {
    const destination = "onb_session";
    const apiPath = `/api/Sessions(ID='${sessionId}')`;

    const destinationConfig = { destinationName: destination };
    const requestConfig = {
      method: "GET",
      url: apiPath,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const response = await executeHttpRequest(destinationConfig, requestConfig);

    if (response.status === 200) {
      const data = response.data;
      
      // Log the full response to see actual field names
      logger.info(`Raw OData response for session ${sessionId}:`, JSON.stringify(data, null, 2));
      
      // Extract session date - try multiple possible field names
      const rawSessionDate = data.sessionDate || data.session_date || data.date || data.startDate || data.start_date || null;
      
      // Check if this is a rejected session first
      const isRejected = data.sessionStatus_name && 
        (data.sessionStatus_name.toLowerCase().includes("reject") ||
         data.sessionStatus_name.toLowerCase().includes("cancelled") ||
         data.sessionStatus_name.toLowerCase().includes("cancel") ||
         data.sessionStatus_name.toLowerCase().includes("declined") ||
         data.sessionStatus_name.toLowerCase().includes("decline") ||
         data.sessionStatus_name.toLowerCase().includes("denied") ||
         data.sessionStatus_name.toLowerCase().includes("deny"));
      
      // Check if sessionDate exists and is BEFORE today (only for non-rejected sessions)
      // Sessions created today should NOT be automatically marked as completed
      let isDateCompleted = false;
      if (!isRejected && rawSessionDate) {
        const sessionDate = new Date(rawSessionDate);
        const today = new Date();
        // Set time to 00:00:00 for date-only comparison
        today.setHours(0, 0, 0, 0);
        sessionDate.setHours(0, 0, 0, 0);
        
        // Only mark as completed if session date is BEFORE today (not today or future)
        isDateCompleted = sessionDate < today;
      }
      
      const statusIncludesCompleted = data.sessionStatus_name && data.sessionStatus_name.toLowerCase().includes("completed");
      const completedByStatusAndDate = !isRejected && statusIncludesCompleted && isDateCompleted;

      const result = {
        // require BOTH: status contains 'completed' AND date is before today (unless rejected)
        completed: completedByStatusAndDate,
        rejected: isRejected,
        status: data.sessionStatus_name || 'Unknown',
        rawStatus: data.sessionStatus || data.status || null,
        sessionDate: rawSessionDate,
        completedDate: data.completedDate || data.completed_date || null,
        progress: data.progress || 0,
        rawData: data, // Include full response for debugging
      };

      return result;
    } else {
      logger.warn(`Webservice returned status ${response.status} for session ${sessionId}`);
      return null;
    }
  } catch (error) {
    logger.debug(`Webservice call failed for session ${sessionId}: ${error.message}`);

    // For development/testing - return mock data if destination not configured
    if (
      error.message.includes("destination") ||
      error.message.includes("ENOTFOUND") ||
      error.message.includes("404")
    ) {
      logger.debug(`Using mock data for session ${sessionId}`);
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