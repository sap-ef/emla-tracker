sap.ui.define(
  [
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/DatePicker",
    "sap/m/VBox",
    "sap/m/Label",
    "sap/m/Button",
  ],
  function (MessageToast, MessageBox, Dialog, DatePicker, VBox, Label, Button) {
    "use strict";

    var OpenAppController = {
      onPressEMLA: function (oEvent) {
        const emla_url =
          "https://emla-prod.launchpad.cfapps.us10.hana.ondemand.com/site/prod#CustomerData-manage?sap-ui-app-id-hint=saas_approuter_com.sap.rise.managecustomerdata&/CustomerMaster(ID=#ID#,IsActiveEntity=true)";
        var trackApp_url =
          "https://onb.launchpad.cfapps.eu10.hana.ondemand.com/site/onb#session-manage?sap-ui-app-id-hint=saas_approuter_session&/Sessions(ID=#ID#,IsActiveEntity=true)?layout=MidColumnFullScreen";

        if (window.location.hostname.includes("move2sap-onb")) {
          console.log("move2sap-onb found in hostname");
          trackApp_url =
            "https://move2sap-onb.launchpad.cfapps.br10.hana.ondemand.com/site/onbdev#session-manage?sap-ui-app-id-hint=saas_approuter_session&/Sessions(ID=#ID#,IsActiveEntity=true)?layout=MidColumnFullScreen";
        }

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
                if (
                  norm.includes("private") &&
                  norm.includes("cloud") &&
                  norm.includes("erp")
                ) {
                  sEmlaType = "Private Cloud ERP";
                } else if (
                  norm.includes("public") &&
                  norm.includes("cloud") &&
                  norm.includes("erp")
                ) {
                  sEmlaType = "Public Cloud ERP";
                } else if (
                  norm.includes("integration") &&
                  norm.includes("suite")
                ) {
                  sEmlaType = "Integration Suite";
                }
              }
              if (originalType !== sEmlaType) {
                console.log(
                  `Normalized emlaType '${originalType}' -> '${sEmlaType}'`
                );
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
        // Defensive normalization here as well
        if (sEmlaType) {
          const norm = sEmlaType.toLowerCase();
          if (
            norm.includes("private") &&
            norm.includes("cloud") &&
            norm.includes("erp")
          ) {
            sEmlaType = "Private Cloud ERP";
          } else if (
            norm.includes("public") &&
            norm.includes("cloud") &&
            norm.includes("erp")
          ) {
            sEmlaType = "Public Cloud ERP";
          } else if (norm.includes("integration") && norm.includes("suite")) {
            sEmlaType = "Integration Suite";
          }
        }
        var sActionKey = sEmlaType + "_" + sButtonPressed;

        console.log("Action Key:", sActionKey);

        switch (sActionKey) {
          case "Public Cloud ERP_button1":
            MessageToast.show("Opening Touch Point 1 for Public Cloud ERP");
            OpenAppController._handleTrackApp(
              oCompleteData, oContext, oModel, sCustomerID, trackApp_url, "button1"
            );
            break;

          case "Public Cloud ERP_button2":
            MessageToast.show("Opening Touch Point 2 for Public Cloud ERP");
            OpenAppController._handleTrackApp(
              oCompleteData, oContext, oModel, sCustomerID, trackApp_url, "button2"
            );
            break;

          case "Integration Suite_button1":
            MessageToast.show("Opening Touch Point 1 for Integration Suite");
            OpenAppController._handleTrackApp(
              oCompleteData, oContext, oModel, sCustomerID, trackApp_url, "button1"
            );
            break;

          case "Integration Suite_button2":
            MessageToast.show("Opening Touch Point 2 for Integration Suite");
            OpenAppController._handleTrackApp(
              oCompleteData, oContext, oModel, sCustomerID, trackApp_url, "button2"
            );
            break;

          case "Integration Suite_button3":
            MessageToast.show("Opening Sales Handover for Integration Suite");
            OpenAppController._handleTrackApp(
              oCompleteData, oContext, oModel, sCustomerID, trackApp_url, "button3"
            );
            break;

          case "Private Cloud ERP_button1":
          case "Cloud ERP Private_button1":
            MessageToast.show("Opening Touch Point 1 for Private Cloud ERP");
            OpenAppController._handleTrackApp(
              oCompleteData, oContext, oModel, sCustomerID, trackApp_url, "button1"
            );
            break;

          case "Private Cloud ERP_button2":
          case "Cloud ERP Private_button2":
            MessageToast.show("Opening Touch Point 2 for Private Cloud ERP");
            OpenAppController._handleTrackApp(
              oCompleteData, oContext, oModel, sCustomerID, trackApp_url, "button2"
            );
            break;

          default:
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
        // Validate that a BTP Onboarding Advisor is assigned before proceeding
        var btpAdvisor = (oCompleteData.btpOnbAdvNome || "").trim();
        var btpAdvisorEmail = (oCompleteData.btpOnbAdvEmail || "").trim();
        if (!btpAdvisor && !btpAdvisorEmail) {
          MessageBox.warning(
            "Cannot create session: no BTP Onboarding Advisor is assigned to this customer. Please assign an advisor before proceeding."
          );
          return;
        }

        var sTrackAppField = "trackApp";
        var sTrackAppValue = "";
        var sBackendAction = "onbTrackApp";
        var sSessionType = "TP1";

        switch (sButtonType) {
          case "button1":
            sTrackAppField = "trackApp";
            sTrackAppValue = oCompleteData.trackApp;
            sBackendAction = "onbTrackApp";
            sSessionType = "TP1";
            break;
          case "button2":
            sTrackAppField = "trackAppTP2";
            sTrackAppValue = oCompleteData.trackAppTP2;
            sBackendAction = "onbTrackAppTP2";
            sSessionType = "TP2";
            break;
          case "button3":
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

        if (!sTrackAppValue) {
          // If btpOnbAdvAssignedOn is missing, ask the user before creating the session
          if (!oCompleteData.btpOnbAdvAssignedOn) {
            OpenAppController._openAssignDateDialog(oContext, function () {
              OpenAppController._callBackendForSession(
                oModel, sCustomerID, sBackendAction, sSessionType,
                sTrackAppField, trackApp_url, oContext
              );
            });
            return;
          }

          OpenAppController._callBackendForSession(
            oModel, sCustomerID, sBackendAction, sSessionType,
            sTrackAppField, trackApp_url, oContext
          );
        } else {
          var url = trackApp_url.replace("#ID#", sTrackAppValue);
          window.open(url, "_blank");
          console.log("Using existing URL:", url);
          MessageToast.show(`Opening ${sTrackAppField}: ${sTrackAppValue}`);
        }
      },

      _callBackendForSession: function (
        oModel, sCustomerID, sBackendAction, sSessionType,
        sTrackAppField, trackApp_url, oContext
      ) {
        const oFunction = oModel.bindContext(`/${sBackendAction}(...)`);
        oFunction.setParameter("ID", sCustomerID);
        oFunction.setParameter("sessionType", sSessionType);

        oFunction
          .execute()
          .then(() => {
            const oResult = oFunction.getBoundContext().getObject();
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
      },

      _openAssignDateDialog: function (oContext, fnProceed) {
        var oDatePicker = new DatePicker({
          valueFormat: "yyyy-MM-dd",
          displayFormat: "yyyy-MM-dd",
          width: "100%",
          placeholder: "YYYY-MM-DD",
        }).addStyleClass("sapUiSmallMarginTop");

        var oDialog = new Dialog({
          title: "BTP OA Assigned Date Required",
          contentWidth: "480px",
          content: [
            new VBox({
              renderType: "Bare",
              width: "100%",
              items: [
                new Label({
                  text: "The BTP Onboarding Advisor Assigned Date is required to create a session. Please enter it to proceed:",
                  wrapping: true,
                }),
                oDatePicker,
              ],
            }),
          ],
          beginButton: new Button({
            text: "Confirm",
            type: "Emphasized",
            press: function () {
              var sDate = oDatePicker.getValue();
              if (!sDate || !oDatePicker.isValidValue()) {
                MessageToast.show("Please enter a valid date.");
                return;
              }
              oContext
                .setProperty("btpOnbAdvAssignedOn", sDate)
                .then(function () {
                  oDialog.close();
                  oDialog.destroy();
                  fnProceed();
                })
                .catch(function (oError) {
                  MessageBox.error("Error saving date: " + oError.message);
                });
            },
          }),
          endButton: new Button({
            text: "Cancel",
            press: function () {
              oDialog.close();
              oDialog.destroy();
            },
          }),
        }).addStyleClass("sapUiContentPadding");

        oDialog.open();
      },
    };

    return OpenAppController;
  }
);
