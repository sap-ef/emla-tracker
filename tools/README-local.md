Run the mock Engagement Analyzer and the CAP service locally

1) Install dependencies (if not already):
   npm install

2) Start the mock engagement analyzer (defaults to port 4001):
   node tools/mock-engagement-analyzer.js

3) In another terminal, start the CAP service with local bindings:
   cds run

Notes:
- `default-env.json` contains a local `engagement-analyzer` destination pointing to http://localhost:4001
- If your code uses `cds.connect.to('engagement-analyzer')` or reads a destination by that name, it will resolve to the mock when running locally.
- To customize port set PORT environment variable when starting the mock, e.g.
  PORT=5000 node tools/mock-engagement-analyzer.js
