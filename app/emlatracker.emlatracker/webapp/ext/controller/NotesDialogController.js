sap.ui.define([
	"sap/m/MessageToast",
	"sap/ui/core/Fragment",
	"sap/ui/core/mvc/Controller"
], function (MessageToast, Fragment, Controller) {
	"use strict";

	return {
		onOpenNotesDialog: function (oEvent) {
			const oButton = oEvent.getSource();
			const oBindingContext = oButton.getBindingContext();
			const that = this;
			
			if (!oBindingContext) {
				MessageToast.show("No data available");
				return;
			}

			// Find the view by traversing up the control tree
			let oView = oButton;
			while (oView && !oView.isA("sap.ui.core.mvc.View")) {
				oView = oView.getParent();
			}
			
			if (!oView) {
				MessageToast.show("Could not find view");
				return;
			}
			
			const openDialog = function() {
				if (!that._oNotesDialog) {
					Fragment.load({
						id: oView.getId(),
						name: "emlatracker.emlatracker.ext.fragment.NotesDialog",
						controller: that
					}).then(function (oDialog) {
						that._oNotesDialog = oDialog;
						oView.addDependent(that._oNotesDialog);
						that._oNotesDialog.setBindingContext(oBindingContext);
						that._oNotesDialog.open();
					});
				} else {
					that._oNotesDialog.setBindingContext(oBindingContext);
					that._oNotesDialog.open();
				}
			};
			
			// Request the binding to refresh from server to get latest notes
			oBindingContext.requestSideEffects(["notes"]).then(function() {
				openDialog();
			}).catch(function(error) {
				// If requestSideEffects fails, still open the dialog with available data
				console.error("Failed to refresh notes:", error);
				openDialog();
			});
		},

		onCloseNotesDialog: function (oEvent) {
			const oButton = oEvent.getSource();
			
			// Traverse up to find the dialog
			let oDialog = oButton;
			while (oDialog && !oDialog.isA("sap.m.Dialog")) {
				oDialog = oDialog.getParent();
			}
			
			if (oDialog) {
				oDialog.close();
			}
		}
	};
});
