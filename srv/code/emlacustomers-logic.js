/**
 * 
 * @On(event = { "setCompleted" }, entity = "EMLATrackerService.EMLACustomers")
 * @param {cds.Request} request - User information, tenant-specific CDS model, headers and query parameters
*/
module.exports = async function (request) {
	let params = request.params;
	let len = params.length;

	const today = new Date().toISOString().split('T')[0];

	for (i = 0; i < len; i++) {
		let ID = params[i].ID;
		
		const current = await SELECT.one.from('EMLACustomers').where({ ID }).columns('status');
		
		if (current && current.status === 'Completed') {
			await UPDATE('EMLACustomers').set({ status: 'Open', completedOn: null }).where({ ID });
		} else {
			await UPDATE('EMLACustomers').set({ status: 'Completed', completedOn: today }).where({ ID });
		}
	}

	return true;

}