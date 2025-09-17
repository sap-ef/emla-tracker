sap.ui.define([
    "sap/m/MessageToast"
], function (MessageToast) {
    'use strict';

    return {
        onPressEMLA: function (oEvent) {
            // 1. The button that was pressed
            var oButton = oEvent.getSource();

            // 2. The row (list item / column list item) that contains this button
            var oRow = oButton.getParent(); // works if parent is ColumnListItem
            // If button is inside a cell layout, you may need oButton.getParent().getParent()

            // 3. Access the binding context of that row
            var oContext = oRow.getBindingContext();

            // 4. Get the underlying data object
            var oRowData = oContext.getObject();

            if (oRowData.emlaType == "Private Cloud ERP") {
                // Open a new tab pointing to a URL
                MessageToast.show("OPEN Workflow App.");

            } else {

                const emla_url = "https://emla-prod.launchpad.cfapps.us10.hana.ondemand.com/site/prod#CustomerData-manage?sap-ui-app-id-hint=saas_approuter_com.sap.rise.managecustomerdata&/CustomerMaster(ID=#ID#,IsActiveEntity=true)"
                //work with the 1:1 app
                const oContext = oEvent.getSource().getBindingContext();
                const sCustomerID = oContext.getProperty("ID");

                const oModel = this.getModel();

                const oFunction = oModel.bindContext(`/onbTrackApp(...)`);
                oFunction.setParameter("ID", sCustomerID);

                oFunction.execute()
                    .then(() => {
                        const oResult = oFunction.getBoundContext().getObject();

                        const url = emla_url.replace('#ID#', oResult.trackApp);
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
