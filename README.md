# Getting Started

Welcome to your new project.

It contains these folders and files, following our recommended project layout:

File or Folder | Purpose
---------|----------
`app/` | content for UI frontends goes here
`db/` | your domain models and data go here
`srv/` | your service models and code go here
`package.json` | project metadata and configuration
`readme.md` | this getting started guide


## Next Steps

- Open a new terminal and run `cds watch`
- (in VS Code simply choose _**Terminal** > Run Task > cds watch_)
- Start adding content, for example, a [db/schema.cds](db/schema.cds).


## Learn More

Learn more at https://cap.cloud.sap/docs/get-started/.

## Destinations (create these in BTP Cockpit)

This project requires two HTTP destinations in your subaccount to call external services from the backend. The names must match the destinations used in the code (for example `cds.connect.to('onb_session')`).

1) `onb_session`

- Type: HTTP
- URL: https://btp-onboarding-cpea-movetosap-dev2-dev-onbsession-srv.cfapps.br10.hana.ondemand.com/
- Proxy Type: Internet
- Authentication: OAuth2ClientCredentials
- clientId: sb-onbsession!t20640
- tokenServiceURL: https://movetosap-dev2.authentication.br10.hana.ondemand.com/oauth/token

Purpose: used by the CAP service to POST to `/api/emlaSession` (TP1/TP2/SH session creation). In the server code this destination is referenced with `cds.connect.to('onb_session')`.

2) `emla-private`

- Type: HTTP
- URL: https://s4hanads-emla-dev-riseorchestrationapp-srv.cfapps.us10.hana.ondemand.com
- Proxy Type: Internet
- Authentication: OAuth2ClientCredentials
- clientId: sb-RISEOrchestrationApp-S4HANADS_emla-dev!t346973
- tokenServiceURL: https://emla.authentication.us10.hana.ondemand.com/oauth/token

Purpose: used to call private S/4 or orchestration endpoints when the UI initiates private ERP flows.

Notes:
- Provide the client secret when you create the destination in the BTP cockpit.
- If you deploy to multiple environments (dev/prod), create environment-specific destinations (e.g. `onb_session_dev`, `onb_session_prod`). Update your deployment configuration accordingly.
- For local development you can mock these endpoints or use `default-env.json` / environment variables to point to test instances.
