/**
 * @On(event = { "onbTrackApp" })
 * @param {cds.Request} request - User information, tenant-specific CDS model, headers and query parameters
 */
module.exports = async function (request) {
  const cds = require("@sap/cds");
  const { ID, sessionType } = request.data;

  try {
    // 1. Buscar o customer pelo ID
    const customer = await SELECT.one.from("EMLACustomers").where({ ID: ID });

    if (!customer) {
      return request.error(404, `Customer with ID ${ID} not found`);
    }

    // 2. Verificar se trackApp já está preenchido
    const isTrackAppEmpty =
      !customer.trackApp || customer.trackApp.trim() === "";

    if (!isTrackAppEmpty) {
      return {
        ID: ID,
        trackApp: customer.trackApp,
        generated: false,
        message: "trackApp already exists",
      };
    }

    // 3. Chamar serviço externo para gerar código
    const generatedTrackApp = await callExternalService(customer, request, sessionType);

    if (generatedTrackApp.startsWith("TRACK_")) {
      return request.error(
        500,
        `Error generating trackApp: Problem to callExternalService`
      );
    }

    // 4. Atualizar o registro com o código gerado
    await UPDATE("EMLACustomers")
      .set({ trackApp: generatedTrackApp })
      .where({ ID: ID });

    return {
      ID: ID,
      trackApp: generatedTrackApp,
      generated: true,
      message: "trackApp generated and saved successfully",
    };
  } catch (error) {
    console.error("Error in onbTrackApp:", error);
    return request.error(500, `Error generating trackApp: ${error.message}`);
  }
};

/**
 * Função para chamar o serviço externo via destination
 */
async function callExternalService(customer, request, sessionType) {
  const cds = require("@sap/cds");

  // Helper to format a JS Date or date-like string to YYYY-MM-DD expected by remote service
  function formatDateOnly(val) {
    if (!val) return null;
    try {
      // If already a Date object
      let d = val instanceof Date ? val : new Date(val);
      if (isNaN(d.getTime())) return null;
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch (e) { return null; }
  }

  try {
    // Conectar à destination configurada
    const destination = await cds.connect.to("onb_session");

    // Preparar dados para enviar ao serviço externo
    const startDateFmt = formatDateOnly(customer.startDate);
    const assignDateFmt = formatDateOnly(customer.createdAt);
    const payloadInput = {
      customerNumber: customer.customerNumber,
      reponsible: customer.btpOnbAdvEmail,
      emlaType: customer.emlaType,
      emlaID: customer.ID,
      sessionType: sessionType // Use the sessionType from the request
    };
    if (startDateFmt) payloadInput.startDate = startDateFmt; // only include if valid
    if (assignDateFmt) payloadInput.onbAdvAssignDate = assignDateFmt; // only include if valid
    const payload = { input: payloadInput };

    let result;
    try {
      result = await destination.post("/emlaSession", payload);
    } catch (e) {
      // Surface remote 400 error message if present
      const remoteMsg = e && e.response && e.response.body && e.response.body.error && e.response.body.error.message;
      if (remoteMsg && /not a valid date/i.test(remoteMsg)) {
        console.warn('[onbTrackApp] Remote date validation failed. Payload sent:', payload);
      }
      throw e; // let outer catch handle fallback code
    }

    // Extrair o código gerado da resposta
    if (result && result.value) {
      return result.value;
    } else {
      throw new Error("Invalid response format from external service");
    }
  } catch (error) {
    console.error("External service call failed:", error && error.message, 'payload may have invalid dates');
    const fallbackCode = `TRACK_${customer.customerNumber}_${Date.now()}`;
    console.log(`Using fallback code: ${fallbackCode}`);
    return fallbackCode;
  }
}
