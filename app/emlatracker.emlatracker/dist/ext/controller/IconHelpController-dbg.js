sap.ui.define([
    "sap/ui/core/Fragment"
], function (Fragment) {
    "use strict";

    var _oDialog;
    var _oController = {
        onCloseIconHelpDialog: function() {
            console.log("Close button clicked");
            if (_oDialog) {
                console.log("Closing dialog");
                _oDialog.close();
            } else {
                console.log("Dialog not found");
            }
        },
        
        onAfterCloseIconHelpDialog: function() {
            console.log("Dialog closed successfully");
        }
    };

    return {
        /**
         * Opens the icon help dialog
         */
        onOpenIconHelpDialog: function(oBindingContext, aSelectedContexts) {
            console.log("Opening help dialog");
            
            // Create dialog if it doesn't exist
            if (!_oDialog) {
                Fragment.load({
                    name: "emlatracker.emlatracker.ext.fragment.IconHelpDialog",
                    controller: _oController
                }).then(function(oDialog) {
                    _oDialog = oDialog;
                    console.log("Dialog created successfully");
                    
                    // Set initial focus to close button for accessibility
                    oDialog.attachAfterOpen(function() {
                        console.log("Dialog opened");
                        setTimeout(function() {
                            var oCloseButton = oDialog.getButtons()[0];
                            if (oCloseButton) {
                                oCloseButton.focus();
                                console.log("Focus set to close button");
                            }
                        }, 100);
                    });
                    
                    _oDialog.open();
                }).catch(function(error) {
                    console.error("Error loading dialog fragment:", error);
                });
            } else {
                console.log("Dialog already exists, opening");
                _oDialog.open();
            }
        }
    };
});