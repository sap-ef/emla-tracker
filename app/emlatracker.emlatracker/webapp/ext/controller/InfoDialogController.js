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
			
			// Load and open the dialog
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
		},

		onCloseInfoDialog: function () {
			if (this._oInfoDialog) {
				this._oInfoDialog.close();
			}
		}
	};
});
