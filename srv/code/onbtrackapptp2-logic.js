/**
 * @On(event = { "onbTrackAppTP2" })
 * @param {cds.Request} request - User information, tenant-specific CDS model, headers and query parameters
 */
module.exports = async function (request) {
  const cds = require("@sap/cds");
  const { ID, sessionType } = request.data;

  console.log("onbTrackAppTP2 called for ID:", ID, "sessionType:", sessionType);

  try {
    // 1. Buscar o customer pelo ID
    const customer = await SELECT.one.from("EMLACustomers").where({ ID: ID });

    if (!customer) {
      return request.error(404, `Customer with ID ${ID} not found`);
    }

    // 2. Verificar se trackAppTP2 já está preenchido
    const isTrackAppTP2Empty =
      !customer.trackAppTP2 || customer.trackAppTP2.trim() === "";

    if (!isTrackAppTP2Empty) {
      return {
        ID: ID,
        trackAppTP2: customer.trackAppTP2,
        generated: false,
        message: "trackAppTP2 already exists",
      };
    }

    // 3. Chamar serviço externo para gerar código
    console.log("=== TP2 EXTERNAL SERVICE CALL ===");
    console.log("Customer ID:", customer.ID);
    console.log("Existing trackApp:", customer.trackApp);
    console.log("Existing trackAppTP2:", customer.trackAppTP2);
    console.log("Will call external service for TP2...");
    
    const generatedTrackAppTP2 = await callExternalService(customer, request, sessionType);

    console.log("Generated trackAppTP2:", generatedTrackAppTP2);
    console.log("Is it same as existing trackApp?", generatedTrackAppTP2 === customer.trackApp);
    console.log("=== END TP2 EXTERNAL SERVICE CALL ===");

    // Don't treat fallback codes as errors - they are valid UUIDs or usable codes
    // Only treat actual errors as errors (empty or null responses)
    if (!generatedTrackAppTP2) {
      return request.error(
        500,
        `Error generating trackAppTP2: No code generated`
      );
    }

    // 4. Atualizar o registro com o código gerado para TP2
    await UPDATE("EMLACustomers")
      .set({ trackAppTP2: generatedTrackAppTP2 })
      .where({ ID: ID });

    return {
      ID: ID,
      trackAppTP2: generatedTrackAppTP2,
      generated: true,
      message: "trackAppTP2 generated and saved successfully",
    };
  } catch (error) {
    console.error("Error in onbTrackAppTP2:", error);
    return request.error(500, `Error generating trackAppTP2: ${error.message}`);
  }
};

/**
 * Função para chamar o serviço externo via destination
 */
async function callExternalService(customer, request, sessionType) {
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
    } catch(e){ return null; }
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
      sessionType: sessionType
    };
    if (startDateFmt) payloadInput.startDate = startDateFmt;
    if (assignDateFmt) payloadInput.onbAdvAssignDate = assignDateFmt;
    const payload = { input: payloadInput };

    console.log("Calling external service with payload for TP2:", JSON.stringify(payload, null, 2));

    // Fazer a chamada ao serviço OData
    let result;
    try {
      result = await destination.post("/emlaSession", payload);
    } catch(e) {
      const remoteMsg = e && e.response && e.response.body && e.response.body.error && e.response.body.error.message;
      if (remoteMsg && /not a valid date/i.test(remoteMsg)) {
        console.warn('[onbTrackAppTP2] Remote date validation failed. Payload sent:', payload);
      }
      throw e;
    }

    console.log("External service response for TP2:", JSON.stringify(result, null, 2));

    // Extrair o código gerado da resposta
    if (result && result.value) {
      console.log("TP2 result value:", result.value);
      console.log("TP2 result value type:", typeof result.value);
      return result.value;
    } else {
      console.log("Invalid response format from external service for TP2:", result);
      throw new Error("Invalid response format from external service");
    }
  } catch (error) {
    console.error("External service call failed for TP2:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    
    // The external service should provide the session code - do not generate fallback
    throw new Error(`External service failed for TP2: ${error.message}`);
  }
}