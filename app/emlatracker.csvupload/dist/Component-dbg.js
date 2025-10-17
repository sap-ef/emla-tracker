sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/m/App"
], function (UIComponent, App) {
    "use strict";

    return UIComponent.extend("emlatracker.csvupload.Component", {
        metadata: {
            manifest: "json"
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);
            
            // Set the data model on the view
            var oModel = this.getModel();
            if (oModel) {
                this.setModel(oModel);
            }
            
            this.getRouter().initialize();
        },

        createContent: function () {
            return new App({
                id: "app"
            });
        }
    });
});