sap.ui.define([
    "sap/m/MessageToast"
], function (MessageToast) {
    'use strict';

    return {
        onPressEMLA: function (oEvent) {
            const emla_url = "https://emla-prod.launchpad.cfapps.us10.hana.ondemand.com/site/prod#CustomerData-manage?sap-ui-app-id-hint=saas_approuter_com.sap.rise.managecustomerdata&/CustomerMaster(ID=#ID#,IsActiveEntity=true)"

            // 1. Pegar o contexto da linha
            var oButton = oEvent.getSource();
            var oRow = oButton.getParent();
            var oContext = oRow.getBindingContext();
            var oRowData = oContext.getObject();

            const sCustomerID = oRowData.ID;
            const oModel = this.getModel();

            if (oRowData.emlaType == "Private Cloud ERP") {
                // Criar um novo binding para buscar TODOS os campos
                var oNewContext = oModel.bindContext(`/EMLACustomers('${sCustomerID}')`);

                oNewContext.requestObject().then(function (oCompleteData) {
                    console.log("TODOS os dados:", oCompleteData);

                    // Agora você tem todos os campos, incluindo os que não estavam na tabela
                    if (oCompleteData.emlaType === "Private Cloud ERP") {
                        console.log("Email completo:", oCompleteData.btpOnbAdvEmail);
                        console.log("TrackApp:", oCompleteData.trackApp);
                        console.log("Nome Advisor:", oCompleteData.btpOnbAdvNome);

                        MessageToast.show("OPEN Workflow App.");
                    }
                }).catch(function (oError) {
                    MessageBox.error("Erro: " + oError.message);
                });


            } else {
                //work with the 1:1 app
                const oFunction = oModel.bindContext(`/onbTrackApp(...)`);
                oFunction.setParameter("ID", sCustomerID);

                oFunction.execute()
                    .then(() => {
                        const oResult = oFunction.getBoundContext().getObject();


                        console.log(url);
                        MessageToast.show(`TrackApp: ${oResult.trackApp}`);

                        // Forçar refresh da lista/objeto
                        oContext.refresh();
                    })
                    .catch((oError) => {
                        MessageBox.error(`Error: ${oError.message}`);
                    });
            }

            MessageToast.show("EMLA handler invoked.");
        }
    };
});
