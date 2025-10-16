sap.ui.define([
    "sap/m/MessageToast"
], function (MessageToast) {
    'use strict';

    return {
        onPressEMLA: function (oEvent) {
            const emla_url = "https://emla-prod.launchpad.cfapps.us10.hana.ondemand.com/site/prod#CustomerData-manage?sap-ui-app-id-hint=saas_approuter_com.sap.rise.managecustomerdata&/CustomerMaster(ID=#ID#,IsActiveEntity=true)"
            const trackApp_url = "https://movetosap-dev2.launchpad.cfapps.br10.hana.ondemand.com/site?siteId=fe90bf68-d6c5-48ef-8c11-9fc6924d1e6e#session-manage?sap-ui-app-id-hint=saas_approuter_session&/Sessions(ID=#ID#,IsActiveEntity=true)";

            // 1. Pegar o contexto da linha
            var oButton = oEvent.getSource();
            var oRow = oButton.getParent();
            var oContext = oRow.getBindingContext();
            var oRowData = oContext.getObject();

            const sCustomerID = oRowData.ID;
            const oModel = this.getModel();

            var oNewContext = oModel.bindContext(`/EMLACustomers('${sCustomerID}')`);

            oNewContext.requestObject().then(function (oCompleteData) {
                console.log("TODOS os dados:", oCompleteData);
                console.log("Email completo:", oCompleteData.btpOnbAdvEmail);
                console.log("TrackApp:", oCompleteData.trackApp);
                console.log("Nome Advisor:", oCompleteData.btpOnbAdvNome);

                // Agora você tem todos os campos, incluindo os que não estavam na tabela
                if (oCompleteData.emlaType === "Private Cloud ERP") {
                    var url = emla_url.replace("#ID#", oCompleteData.externalID);
                    window.open(url, "_blank");
                    MessageToast.show("OPEN Workflow App.");
                } else {
                    //work with the 1:1 app
                    if (!oCompleteData.trackApp) {
                        const oFunction = oModel.bindContext(`/onbTrackApp(...)`);
                        oFunction.setParameter("ID", sCustomerID);

                        oFunction.execute()
                            .then(() => {
                                const oResult = oFunction.getBoundContext().getObject();

                                var url = trackApp_url.replace("#ID#", oResult.trackApp);
                                window.open(url, "_blank");
                                console.log(url);
                                MessageToast.show(`TrackApp: ${oResult.trackApp}`);

                                // Forçar refresh da lista/objeto
                                oContext.refresh();
                            })
                            .catch((oError) => {
                                MessageBox.error(`Error: ${oError.message}`);
                            });
                    } else {
                        var url = trackApp_url.replace("#ID#", oCompleteData.trackApp);
                        window.open(url, "_blank");

                    }
                }
            }).catch(function (oError) {
                MessageBox.error("Erro: " + oError.message);
            });
        }
    };
});
