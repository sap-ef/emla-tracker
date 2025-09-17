sap.ui.define([
    "sap/m/MessageToast"
], function(MessageToast) {
    'use strict';

    return {
        onPress: function(oEvent) {
            console.log(oEvent);
            MessageToast.show("Custom handler invoked.");
        }
    };
});
