/**
 * 
 * @On(event = { "setCompleted" }, entity = "EMLATrackerService.EMLACustomers")
 * @param {cds.Request} request - User information, tenant-specific CDS model, headers and query parameters
*/
module.exports = async function (request) {
	console.log("Action to toggle completion status");

	let params = request.params;
	let len = params.length;

	const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

	for (i = 0; i < len; i++) {
		let ID = params[i].ID;
		console.log(`current ID: ${ID}`);
		
		// Check current status
		const current = await SELECT.one.from('EMLACustomers').where({ ID }).columns('status');
		
		if (current && current.status === 'Completed') {
			// If already completed, clear the status
			console.log(`Clearing completion for ID: ${ID}`);
			await UPDATE('EMLACustomers').set({ status: 'Open', completedOn: null }).where({ ID });
		} else {
			// If not completed, set as completed
			console.log(`Setting as completed for ID: ${ID}`);
			await UPDATE('EMLACustomers').set({ status: 'Completed', completedOn: today }).where({ ID });
		}
	}

	return true;

}