// Simple mock server for local testing of sync-emla-logic
// Run with: node tools/mock-emla-server.js

const http = require('http');
const url = require('url');

const PORT = process.env.MOCK_EMLA_PORT || 4005;

const sample = {
  "@odata.context": "$metadata#CustomerMaster",
  "@odata.count": 1,
  value: [
    {
      "ID": "4627c38b-afb9-3100-f000-000296614800",
      "btpOnboardingAdvisor_userId": "chloe.jin@sap.com",
      "customerId": "27894968",
      "customerName": "Cimbria Heid Gmbh",
      "onboardingAdvisor_userId": "",
      "startDate": "2025-07-14",
      "country": {
        "ID": "7be96060-f39a-11ef-86dc-31f15052fd77",
        "name": "Austria"
      },
      "emLAType": {
        "ID": "550122b0-5adf-11f0-ba9f-79a5430fb27e",
        "name": "Cloud ERP Private"
      },
      "region": {
        "ID": "7f4312b0-f39a-11ef-86dc-31f15052fd77",
        "name": "Middle and Eastern Europe"
      },
      "soTimeEstimatedBasedOnEngagementProgression": 0,
      "HasDraftEntity": false,
      "HasActiveEntity": false,
      "DraftAdministrativeData": null,
      "IsActiveEntity": true
    }
  ]
};

const server = http.createServer((req, res) => {
  const p = url.parse(req.url, true);
  if (p.pathname.indexOf('/mock/customerMaster/CustomerMaster') === 0) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sample));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Mock EMLA OData server listening on http://localhost:${PORT}/mock/customerMaster/CustomerMaster`);
});
