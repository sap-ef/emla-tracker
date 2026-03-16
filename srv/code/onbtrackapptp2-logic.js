/**
 * @On(event = { "onbTrackAppTP2" })
 * @param {cds.Request} request
 */
const { handleTrackApp } = require("./onbtrackapp-common");
module.exports = async function (request) {
  return handleTrackApp(request, "trackAppTP2");
};
