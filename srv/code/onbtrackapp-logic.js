/**
 * @On(event = { "onbTrackApp" })
 * @param {cds.Request} request - User information, tenant-specific CDS model, headers and query parameters
 */
module.exports = async function (request) {
	const cds = require('@sap/cds');
	const { ID } = request.data;

	try {
		// 1. Buscar o customer pelo ID
		const customer = await SELECT.one
			.from('EMLACustomers')
			.where({ ID: ID });

		if (!customer) {
			return request.error(404, `Customer with ID ${ID} not found`);
		}

		// 2. Verificar se trackApp já está preenchido
		const isTrackAppEmpty = !customer.trackApp ||
			customer.trackApp.trim() === '';

		if (!isTrackAppEmpty) {
			return {
				ID: ID,
				trackApp: customer.trackApp,
				generated: false,
				message: 'trackApp already exists'
			};
		}

		// 3. Chamar serviço externo para gerar código
		const generatedTrackApp = await callExternalService(customer, request);

		// 4. Atualizar o registro com o código gerado
		await UPDATE('EMLACustomers')
			.set({ trackApp: generatedTrackApp })
			.where({ ID: ID });

		return {
			ID: ID,
			trackApp: generatedTrackApp,
			generated: true,
			message: 'trackApp generated and saved successfully'
		};

	} catch (error) {
		console.error('Error in onbTrackApp:', error);
		return request.error(500, `Error generating trackApp: ${error.message}`);
	}
};

/**
 * Função para chamar o serviço externo via destination
 */
async function callExternalService(customer, request) {
	const cds = require('@sap/cds');

	try {
		// Conectar à destination configurada
		const destination = await cds.connect.to('onb_session');

		// Preparar dados para enviar ao serviço externo
		const payload = {
			customer_CUSTOMERID: customer.customerNumber,
			oaResponsible: customer.btpOnbAdvEmail,
			customerBTPACV: 0
		};

		console.log('Calling external service with payload:', payload);

		// Fazer a chamada ao serviço OData
		const result = await destination.post('/Sessions', payload);

		// Extrair o código gerado da resposta
		if (result && (result.ID)) {
			console.log(result.ID);
			return result.ID;
		} else {
			throw new Error('Invalid response format from external service');
		}

	} catch (error) {
		console.error('External service call failed:', error);

		// Fallback: gerar código local se serviço externo falhar
		const fallbackCode = `TRACK_${customer.customerNumber}_${Date.now()}`;
		console.log(`Using fallback code: ${fallbackCode}`);

		return fallbackCode;
	}
}
