/**
 * 
 * @On(event = { "setCompleted" }, entity = "EMLATrackerService.EMLACustomers")
 * @param {cds.Request} request - User information, tenant-specific CDS model, headers and query parameters
*/
module.exports = async function (request) {
	console.log("ACtion para completar");

	let params = request.params;
	let len = params.length;

	const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

	for (i = 0; i < len; i++) {
		let ID = params[i].ID;
		console.log(`current ID: ${ID}`);
		await UPDATE('EMLACustomers').set({ status: 'Completed', completedOn: today }).where({ ID });
	}
	const { ID } = request.data;


	return true;

}