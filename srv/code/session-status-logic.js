const cds = require("@sap/cds");
const { executeHttpRequest } = require("@sap-cloud-sdk/http-client");

async function updateSessionStatus(req) {
  const logger = cds.log("update-session-status");

  try {
    const db = await cds.connect.to("db");
    const { EMLACustomers } = db.entities;

    let totalUpdated = 0;
    let totalChecked = 0;

    const tp1Records = await SELECT.from(EMLACustomers).where(`
      trackApp is not null 
      and trackApp != '' 
      and (isTrackAppCompleted is null or isTrackAppCompleted = false)
    `);

    const tp2Records = await SELECT.from(EMLACustomers).where(`
      trackAppTP2 is not null 
      and trackAppTP2 != '' 
      and (isTrackAppTP2Completed is null or isTrackAppTP2Completed = false)
    `);

    const shRecords = await SELECT.from(EMLACustomers).where(`
      trackAppSH is not null 
      and trackAppSH != '' 
      and (isTrackAppSHCompleted is null or isTrackAppSHCompleted = false)
    `);

    const recordMap = new Map();
    [...tp1Records, ...tp2Records, ...shRecords].forEach((record) => {
      recordMap.set(record.ID, record);
    });
    const incompleteRecords = Array.from(recordMap.values());

    for (const record of incompleteRecords) {
      const sessionChecks = [];

      // Check TP1 session if exists and not completed
      if (record.trackApp && !isCompletedValue(record.isTrackAppCompleted)) {
        sessionChecks.push({
          sessionId: record.trackApp,
          type: "TP1",
          field: "isTrackAppCompleted",
          rejectionField: "isTrackAppRejected",
          statusField: "trackAppStatus",
          dateField: "trackAppDate",
        });
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
          dateField: "trackAppTP2Date",
        });
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
          dateField: "trackAppSHDate",
        });
      }

      logger.debug(
        `  - Total sessions to check for this record: ${sessionChecks.length}`
      );

      // Process each session for this record
      for (const check of sessionChecks) {
        totalChecked++;
        try {
          const sessionData = await checkSessionStatus(check.sessionId, logger);

          if (sessionData) {
            // Always update status if we have session data
            const updateData = {};
            
            updateData[check.statusField] = sessionData.status || sessionData.rawStatus || 'Unknown';
            
            // Update session date if available
            if (sessionData.sessionDate && check.dateField) {
              updateData[check.dateField] = new Date(sessionData.sessionDate);
            }
            
            // Set flags only if completed or rejected
            if (sessionData.completed || sessionData.rejected) {
              if (sessionData.completed) {
                updateData[check.field] = true;
                if (sessionData.completedDate) {
                  updateData.completedOn = sessionData.completedDate;
                }
              }
              if (sessionData.rejected) {
                updateData[check.rejectionField] = true;
              }
            }

            const updateResult = await UPDATE(EMLACustomers)
              .set(updateData)
              .where({ ID: record.ID });

            totalUpdated++;
          }
        } catch (error) {
          logger.error(`Failed ${check.type} session ${check.sessionId}: ${error.message}`);
        }
      }
    }

    const result = `Session status update completed. Checked ${totalChecked} sessions, updated ${totalUpdated} records.`;
    logger.info(result);
    return result;
  } catch (error) {
    logger.error("Session status update failed:", error);
    throw new Error(`Session status update failed: ${error.message}`);
  }
}

// Helper function to check if a value represents completion
function isCompletedValue(value) {
  const logger = cds.log("update-session-status");
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
      
      const isRejected = data.sessionStatus_name && 
        (data.sessionStatus_name.toLowerCase().includes("reject") ||
         data.sessionStatus_name.toLowerCase().includes("cancelled") ||
         data.sessionStatus_name.toLowerCase().includes("cancel") ||
         data.sessionStatus_name.toLowerCase().includes("declined") ||
         data.sessionStatus_name.toLowerCase().includes("decline") ||
         data.sessionStatus_name.toLowerCase().includes("denied") ||
         data.sessionStatus_name.toLowerCase().includes("deny"));
      
      let isDateCompleted = false;
      if (!isRejected && data.sessionDate) {
        const sessionDate = new Date(data.sessionDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        sessionDate.setHours(0, 0, 0, 0);
        
        isDateCompleted = sessionDate <= today;
      }
      
      const statusIncludesCompleted = data.sessionStatus_name && data.sessionStatus_name.toLowerCase().includes("completed");
      const completedByStatusAndDate = !isRejected && statusIncludesCompleted && isDateCompleted;

      const result = {
        // require BOTH: status contains 'completed' AND sessionDate is today or before (unless rejected)
        completed: completedByStatusAndDate,
        rejected: isRejected,
        status: data.sessionStatus_name || 'Unknown',
        sessionDate: data.sessionDate || null,
        completedDate: data.completedDate ? new Date(data.completedDate) : null,
        progress: data.progress || 0,
      };

      return result;
    } else {
      logger.warn(
        `⚠️  Webservice returned non-200 status ${response.status} for session ${sessionId}`
      );
      return null;
    }
  } catch (error) {
    const destination = "onb_session";
    const apiPath = `/api/Sessions(ID='${sessionId}')`;

    logger.error(`Webservice call failed for session ${sessionId}: ${error.message}`);

    if (
      error.message.includes("destination") ||
      error.message.includes("ENOTFOUND") ||
      error.message.includes("404")
    ) {
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
  updateSessionStatus,
};
