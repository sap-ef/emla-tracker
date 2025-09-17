sap.ui.define([
    "sap/m/MessageToast"
], function (MessageToast) {
    'use strict';

    return {
        onPressApp: function (oEvent) { 
            MessageToast.show("App handler invoked.");
        },
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

            if (oRowData.emlaType == "Public Cloud ERP") {
                // Open a new tab pointing to a URL
                window.open(`https://sap.sharepoint.com/sites/124347/Lists/SAP%20Cloud%20ERP%20Assignment%20Decisions/DispForm.aspx?ID=${oRowData.externalID}`, "_blank");

            }

            MessageToast.show("EMLA handler invoked.");
        }
    };
});
