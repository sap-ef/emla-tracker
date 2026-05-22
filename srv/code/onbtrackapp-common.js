const cds = require("@sap/cds");

function formatDateOnly(val) {
  if (!val) return null;
  try {
    let d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return null;
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch (e) { return null; }
}

/**
 * Call the external onb_session service to create a session.
 * @param {object} customer - EMLACustomers record
 * @param {string} sessionType - session type identifier
 * @param {string} label - log label (e.g. "onbTrackApp")
 * @param {boolean} useFallback - if true, generate a fallback code on failure instead of throwing
 * @returns {string} generated session code
 */
async function callExternalService(customer, sessionType, label, useFallback) {
  if (!customer.btpOnbAdvAssignedOn) {
    throw new Error("BTP Onboarding Advisor Assigned Date (btpOnbAdvAssignedOn) is required to create a session");
  }

  try {
    const destination = await cds.connect.to("onb_session");

    const contractStartDateFmt = formatDateOnly(customer.startDate);
    const payloadInput = {
      customerNumber: customer.customerNumber,
      reponsible: customer.btpOnbAdvEmail,
      emlaType: customer.emlaType,
      emlaID: customer.ID,
      sessionType: sessionType,
      onbAdvAssignDate: customer.btpOnbAdvAssignedOn
    };
    if (contractStartDateFmt && sessionType !== "VCR") payloadInput.contractStartDate = contractStartDateFmt;
    if (contractStartDateFmt && sessionType !== "VCR") payloadInput.startDate = contractStartDateFmt;
    if (customer.productSKU) payloadInput.contractSKU = customer.productSKU;
    const payload = { input: payloadInput };

    let result;
    try {
      result = await destination.post("/emlaSession", payload);
    } catch (e) {
      const remoteMsg = e && e.response && e.response.body && e.response.body.error && e.response.body.error.message;
      if (remoteMsg && /not a valid date/i.test(remoteMsg)) {
        console.warn(`[${label}] Remote date validation failed. Payload sent:`, payload);
      }
      throw e;
    }

    if (result && result.value) {
      return result.value;
    } else {
      throw new Error("Invalid response format from external service");
    }
  } catch (error) {
    console.error(`External service call failed for ${label}:`, error && error.message);
    if (useFallback) {
      const fallbackCode = `TRACK_${customer.customerNumber}_${Date.now()}`;
      console.log(`Using fallback code: ${fallbackCode}`);
      return fallbackCode;
    }
    throw new Error(`External service failed for ${label}: ${error.message}`);
  }
}

/**
 * Unified handler for onbTrackApp, onbTrackAppTP2, onbTrackAppSH.
 * @param {cds.Request} request
 * @param {string} field - DB column name: "trackApp" | "trackAppTP2" | "trackAppSH"
 */
async function handleTrackApp(request, field) {
  const { ID, sessionType } = request.data;
  const label = `onb${field.charAt(0).toUpperCase() + field.slice(1)}`;
  const useFallback = field === 'trackApp'; // only trackApp uses fallback codes

  try {
    const customer = await SELECT.one.from("EMLACustomers").where({ ID: ID });
    if (!customer) {
      return request.error(404, `Customer with ID ${ID} not found`);
    }

    const currentValue = customer[field];
    if (currentValue && currentValue.trim() !== "") {
      return {
        ID: ID,
        [field]: currentValue,
        generated: false,
        message: `${field} already exists`,
      };
    }

    const generatedCode = await callExternalService(customer, sessionType, label, useFallback);

    if (useFallback && generatedCode.startsWith("TRACK_")) {
      return request.error(500, `Error generating ${field}: Problem to callExternalService`);
    }
    if (!generatedCode) {
      return request.error(500, `Error generating ${field}: No code generated`);
    }

    await UPDATE("EMLACustomers").set({ [field]: generatedCode }).where({ ID: ID });

    return {
      ID: ID,
      [field]: generatedCode,
      generated: true,
      message: `${field} generated and saved successfully`,
    };
  } catch (error) {
    console.error(`Error in ${label}:`, error);
    return request.error(500, `Error generating ${field}: ${error.message}`);
  }
}

/**
 * Handler for onbFollowUpTrackApp — creates a VCR session for a FollowUp record.
 * @param {cds.Request} request
 */
async function handleFollowUpTrackApp(request) {
  const { ID } = request.data;
  const label = "onbFollowUpTrackApp";

  try {
    const followUp = await SELECT.one.from("FollowUp").where({ ID: ID });
    if (!followUp) {
      return request.error(404, `FollowUp with ID ${ID} not found`);
    }

    if (followUp.trackApp && followUp.trackApp.trim() !== "") {
      return {
        ID: ID,
        trackApp: followUp.trackApp,
        generated: false,
        message: "trackApp already exists",
      };
    }

    const customer = await SELECT.one.from("EMLACustomers").where({ ID: followUp.customer_ID });
    if (!customer) {
      return request.error(404, `Customer for FollowUp ${ID} not found`);
    }

    const generatedCode = await callExternalService(customer, "VCR", label, false);
    if (!generatedCode) {
      return request.error(500, "Error generating trackApp: No code generated");
    }

    await UPDATE("FollowUp").set({ trackApp: generatedCode }).where({ ID: ID });

    return {
      ID: ID,
      trackApp: generatedCode,
      generated: true,
      message: "trackApp generated and saved successfully",
    };
  } catch (error) {
    console.error(`Error in ${label}:`, error);
    return request.error(500, `Error generating trackApp: ${error.message}`);
  }
}

/**
 * Bound action handler for createVCRSession on FollowUpTracking.
 * Called with the customer ID (view key). Looks up the FollowUp record and creates a VCR session.
 * @param {cds.Request} request
 * @param {string} customerID - the EMLACustomers.ID (key of FollowUpTracking view)
 */
async function createVCRSessionForFollowUp(request, customerID) {
  const label = "createVCRSession";

  try {
    const followUp = await SELECT.one.from("FollowUp").where({ customer_ID: customerID });
    if (!followUp) {
      return request.error(404, `No FollowUp found for customer ${customerID}`);
    }

    if (followUp.trackApp && followUp.trackApp.trim() !== "") {
      return followUp.trackApp;
    }

    const customer = await SELECT.one.from("EMLACustomers").where({ ID: customerID });
    if (!customer) {
      return request.error(404, `Customer ${customerID} not found`);
    }

    const generatedCode = await callExternalService(customer, "VCR", label, false);
    if (!generatedCode) {
      return request.error(500, "Error generating VCR session: No code generated");
    }

    await UPDATE("FollowUp").set({ trackApp: generatedCode }).where({ customer_ID: customerID });

    return generatedCode;
  } catch (error) {
    console.error(`Error in ${label}:`, error);
    return request.error(500, `Error generating VCR session: ${error.message}`);
  }
}

module.exports = { handleTrackApp, handleFollowUpTrackApp, createVCRSessionForFollowUp };
