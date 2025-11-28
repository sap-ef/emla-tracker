sap.ui.define([
	"sap/m/MessageToast",
	"sap/ui/core/Fragment"
], function (MessageToast, Fragment) {
	"use strict";

	return {
		onOpenInfoDialog: function (oEvent) {
			const oButton = oEvent.getSource();
			const oBindingContext = oButton.getBindingContext();
			
			if (!oBindingContext) {
				MessageToast.show("No data available");
				return;
			}

			const oView = oButton.getParent();
			
			// Request the binding to refresh from server to get latest data including dates
			// Wait for the side effects to complete before opening dialog
			oBindingContext.requestSideEffects([
				"trackAppStatus",
				"trackAppTP2Status", 
				"trackAppSHStatus",
				"trackAppDate",
				"trackAppTP2Date",
				"trackAppSHDate"
			]).then(function() {
				// Load and open the dialog after data is refreshed
				if (!this._oInfoDialog) {
					Fragment.load({
						id: oView.getId(),
						name: "emlatracker.emlatracker.ext.fragment.InfoDialog",
						controller: this
					}).then(function (oDialog) {
						this._oInfoDialog = oDialog;
						oView.addDependent(this._oInfoDialog);
						this._oInfoDialog.setBindingContext(oBindingContext);
						this._oInfoDialog.open();
					}.bind(this));
				} else {
					this._oInfoDialog.setBindingContext(oBindingContext);
					this._oInfoDialog.open();
				}
			}.bind(this)).catch(function(error) {
				// If requestSideEffects fails, still open the dialog with available data
				console.error("Failed to refresh data:", error);
				if (!this._oInfoDialog) {
					Fragment.load({
						id: oView.getId(),
						name: "emlatracker.emlatracker.ext.fragment.InfoDialog",
						controller: this
					}).then(function (oDialog) {
						this._oInfoDialog = oDialog;
						oView.addDependent(this._oInfoDialog);
						this._oInfoDialog.setBindingContext(oBindingContext);
						this._oInfoDialog.open();
					}.bind(this));
				} else {
					this._oInfoDialog.setBindingContext(oBindingContext);
					this._oInfoDialog.open();
				}
			}.bind(this));
		},

		onCloseInfoDialog: function () {
			if (this._oInfoDialog) {
				this._oInfoDialog.close();
			}
		}
	};
});
