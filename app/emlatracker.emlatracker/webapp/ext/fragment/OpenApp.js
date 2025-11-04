sap.ui.define(
  ["sap/m/MessageToast", "sap/m/MessageBox"],
  function (MessageToast, MessageBox) {
    "use strict";

    var OpenAppController = {
      onPressEMLA: function (oEvent) {
        const emla_url =
          "https://emla-prod.launchpad.cfapps.us10.hana.ondemand.com/site/prod#CustomerData-manage?sap-ui-app-id-hint=saas_approuter_com.sap.rise.managecustomerdata&/CustomerMaster(ID=#ID#,IsActiveEntity=true)";
        // const trackApp_url = "https://movetosap-dev2.launchpad.cfapps.br10.hana.ondemand.com/site?siteId=fe90bf68-d6c5-48ef-8c11-9fc6924d1e6e#session-manage?sap-ui-app-id-hint=saas_approuter_session&/Sessions(ID=#ID#,IsActiveEntity=true)";
        const trackApp_url =
          "https://onb.launchpad.cfapps.eu10.hana.ondemand.com/site/onb#session-manage?sap-ui-app-id-hint=saas_approuter_session&/Sessions(ID=#ID#,IsActiveEntity=true)";

        // 1. Get the context from the button
        var oButton = oEvent.getSource();
        var oRow = oButton.getParent();
        var oContext = oRow.getBindingContext();
        var oRowData = oContext.getObject();

        // Get action from custom data
        var aCustomData = oButton.getCustomData();
        var sAction = "";

        aCustomData.forEach(function (oCustomData) {
          if (oCustomData.getKey() === "action") {
            sAction = oCustomData.getValue();
          }
        });

        const sCustomerID = oRowData.ID;
        const oModel = this.getModel();

        var oNewContext = oModel.bindContext(
          `/EMLACustomers('${sCustomerID}')`
        );

        oNewContext
          .requestObject()
          .then(
            function (oCompleteData) {
              console.log("=== DEBUG INFO ===");
              console.log("Button pressed:", sAction);
              console.log("Customer ID:", sCustomerID);
              console.log("Complete data:", oCompleteData);
              console.log("Raw trackApp values from API:");
              console.log("  trackApp:", oCompleteData.trackApp);
              console.log("  trackAppTP2:", oCompleteData.trackAppTP2);
              console.log("  trackAppSH:", oCompleteData.trackAppSH);
              console.log("=== END DEBUG ===");

              // Get both values for decision making and normalize emlaType variants
              var sEmlaType = oCompleteData.emlaType;
              var originalType = sEmlaType;
              if (sEmlaType) {
                const norm = sEmlaType.toLowerCase();
                if (norm.includes('private') && norm.includes('cloud') && norm.includes('erp')) {
                  // Accept permutations like 'Cloud ERP Private'
                  sEmlaType = 'Private Cloud ERP';
                } else if (norm.includes('public') && norm.includes('cloud') && norm.includes('erp')) {
                  sEmlaType = 'Public Cloud ERP';
                } else if (norm.includes('integration') && norm.includes('suite')) {
                  sEmlaType = 'Integration Suite';
                }
              }
              if (originalType !== sEmlaType) {
                console.log(`Normalized emlaType '${originalType}' -> '${sEmlaType}'`);
              }
              var sButtonPressed = sAction;

              // Define your actions based on combination of emlaType and button
              OpenAppController._defineAction(
                sEmlaType,
                sButtonPressed,
                oCompleteData,
                oContext,
                oModel,
                sCustomerID,
                trackApp_url,
                emla_url
              );
            }.bind(this)
          )
          .catch(function (oError) {
            MessageBox.error("Error: " + oError.message);
          });
      },

      _defineAction: function (
        sEmlaType,
        sButtonPressed,
        oCompleteData,
        oContext,
        oModel,
        sCustomerID,
        trackApp_url,
        emla_url
      ) {
        // Defensive normalization here as well (in case earlier normalization not applied in some build/cached version)
        if (sEmlaType) {
          const norm = sEmlaType.toLowerCase();
            if (norm.includes('private') && norm.includes('cloud') && norm.includes('erp')) {
              sEmlaType = 'Private Cloud ERP';
            } else if (norm.includes('public') && norm.includes('cloud') && norm.includes('erp')) {
              sEmlaType = 'Public Cloud ERP';
            } else if (norm.includes('integration') && norm.includes('suite')) {
              sEmlaType = 'Integration Suite';
            }
        }
        // Create a unique action key combining emlaType and button
        var sActionKey = sEmlaType + "_" + sButtonPressed;

        console.log("Action Key:", sActionKey);

        // Define your actions based on the combination
        switch (sActionKey) {
          case "Public Cloud ERP_button1": // Touch Point 1
            MessageToast.show("Opening Touch Point 1 for Public Cloud ERP");
            OpenAppController._handleTrackApp(
              oCompleteData,
              oContext,
              oModel,
              sCustomerID,
              trackApp_url,
              "button1"
            );
            break;

          case "Public Cloud ERP_button2": // Touch Point 2
            MessageToast.show("Opening Touch Point 2 for Public Cloud ERP");
            OpenAppController._handleTrackApp(
              oCompleteData,
              oContext,
              oModel,
              sCustomerID,
              trackApp_url,
              "button2"
            );
            break;

          case "Integration Suite_button1": // Touch Point 1
            MessageToast.show("Opening Touch Point 1 for Integration Suite");
            OpenAppController._handleTrackApp(
              oCompleteData,
              oContext,
              oModel,
              sCustomerID,
              trackApp_url,
              "button1"
            );
            break;

          case "Integration Suite_button2": // Touch Point 2
            MessageToast.show("Opening Touch Point 2 for Integration Suite");
            OpenAppController._handleTrackApp(
              oCompleteData,
              oContext,
              oModel,
              sCustomerID,
              trackApp_url,
              "button2"
            );
            break;

          case "Integration Suite_button3": // SH
            MessageToast.show("Opening Sales Handover for Integration Suite");
            OpenAppController._handleTrackApp(
              oCompleteData,
              oContext,
              oModel,
              sCustomerID,
              trackApp_url,
              "button3"
            );
            break;

          case "Private Cloud ERP_button1": // Workflow App
            if (!oCompleteData.externalID) {
              MessageBox.warning("External ID ausente para Workflow App. Atualize o registro antes de abrir.");
              return;
            }
            MessageToast.show("Opening Workflow App for Private Cloud ERP");
            var url3 = emla_url.replace("#ID#", oCompleteData.externalID);
            window.open(url3, "_blank");
            break;
          case "Cloud ERP Private_button1": // Fallback variant if somehow normalization missed
            console.log("[Fallback] Handling 'Cloud ERP Private' variant");
            if (!oCompleteData.externalID) {
              MessageBox.warning("External ID ausente para Workflow App (variant). Atualize o registro antes de abrir.");
              return;
            }
            MessageToast.show("Opening Workflow App (variant)");
            var urlFallback = emla_url.replace("#ID#", oCompleteData.externalID);
            window.open(urlFallback, "_blank");
            break;

          default:
            // Handle empty buttons (when text is empty)
            console.log("Empty button clicked, no action defined");
            break;
        }
      },

      _handleTrackApp: function (
        oCompleteData,
        oContext,
        oModel,
        sCustomerID,
        trackApp_url,
        sButtonType
      ) {
        // Determine which trackApp field to use based on button type
        var sTrackAppField = "trackApp"; // default
        var sTrackAppValue = "";
        var sBackendAction = "onbTrackApp"; // default backend action
        var sSessionType = "TP1"; // default session type

        switch (sButtonType) {
          case "button1": // TP1
            sTrackAppField = "trackApp";
            sTrackAppValue = oCompleteData.trackApp;
            sBackendAction = "onbTrackApp";
            sSessionType = "TP1";
            break;
          case "button2": // TP2
            sTrackAppField = "trackAppTP2";
            sTrackAppValue = oCompleteData.trackAppTP2;
            sBackendAction = "onbTrackAppTP2";
            sSessionType = "TP2";
            break;
          case "button3": // SH
            sTrackAppField = "trackAppSH";
            sTrackAppValue = oCompleteData.trackAppSH;
            sBackendAction = "onbTrackAppSH";
            sSessionType = "SH";
            break;
          default:
            sTrackAppField = "trackApp";
            sTrackAppValue = oCompleteData.trackApp;
            sBackendAction = "onbTrackApp";
            sSessionType = "TP1";
            break;
        }

        console.log("=== FIELD CHECK DEBUG ===");
        console.log("Button type:", sButtonType);
        console.log("Field to check:", sTrackAppField);
        console.log("Field value:", sTrackAppValue);
        console.log("Is field empty?", !sTrackAppValue);
        console.log("Backend action:", sBackendAction);
        console.log("Will call backend?", !sTrackAppValue);
        console.log("=== END FIELD CHECK DEBUG ===");

        console.log("=== FIELD CHECK DEBUG ===");
        console.log("Button type:", sButtonType);
        console.log("Field to check:", sTrackAppField);
        console.log("Field value:", sTrackAppValue);
        console.log("Is field empty?", !sTrackAppValue);
        console.log("Backend action:", sBackendAction);
        console.log("Will call backend?", !sTrackAppValue);
        console.log("=== END FIELD CHECK DEBUG ===");

        if (!sTrackAppValue) {
          // Create trackApp if it doesn't exist using the specific backend action
          const oFunction = oModel.bindContext(`/${sBackendAction}(...)`);
          oFunction.setParameter("ID", sCustomerID);
          oFunction.setParameter("sessionType", sSessionType);

          oFunction
            .execute()
            .then(() => {
              const oResult = oFunction.getBoundContext().getObject();
              // Use the appropriate field from the result
              var sResultTrackApp = oResult[sTrackAppField] || oResult.trackApp;
              var url = trackApp_url.replace("#ID#", sResultTrackApp);
              window.open(url, "_blank");
              console.log("Generated URL:", url);
              MessageToast.show(`${sTrackAppField}: ${sResultTrackApp}`);
              oContext.refresh();
            })
            .catch((oError) => {
              MessageBox.error(`Error: ${oError.message}`);
            });
        } else {
          // Use existing trackApp value
          var url = trackApp_url.replace("#ID#", sTrackAppValue);
          window.open(url, "_blank");
          console.log("Using existing URL:", url);
          MessageToast.show(`Opening ${sTrackAppField}: ${sTrackAppValue}`);
        }
      },
    };

    return OpenAppController;
  }
);
