sap.ui.define([
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (MessageToast, MessageBox) {
	"use strict";

	var trackApp_url =
		"https://onb.launchpad.cfapps.eu10.hana.ondemand.com/site/onb#session-manage?sap-ui-app-id-hint=saas_approuter_session&/Sessions(ID=#ID#,IsActiveEntity=true)?layout=MidColumnFullScreen";

	if (window.location.hostname.includes("move2sap-onb")) {
		trackApp_url =
			"https://move2sap-onb.launchpad.cfapps.br10.hana.ondemand.com/site/onbdev#session-manage?sap-ui-app-id-hint=saas_approuter_session&/Sessions(ID=#ID#,IsActiveEntity=true)?layout=MidColumnFullScreen";
	}

	return {
		onPressVCR: function (oEvent) {
			var oLink = oEvent.getSource();
			var oRow = oLink.getParent();
			var oContext = oRow.getBindingContext();

			if (!oContext) {
				MessageToast.show("No data available");
				return;
			}

			var sFollowUpID = oContext.getProperty("followUpID");
			var sTrackApp = oContext.getProperty("trackApp");

			if (sTrackApp) {
				var url = trackApp_url.replace("#ID#", sTrackApp);
				window.open(url, "_blank");
				MessageToast.show("VCR: " + sTrackApp);
				return;
			}

			if (!sFollowUpID) {
				MessageToast.show("No FollowUp record found for this row");
				return;
			}

			var oModel = oContext.getModel();
			var oFunction = oModel.bindContext("/onbFollowUpTrackApp(...)");
			oFunction.setParameter("ID", sFollowUpID);

			oFunction.execute().then(function () {
				var oResult = oFunction.getBoundContext().getObject();
				var sCode = (oResult && oResult.trackApp) || "";
				if (sCode) {
					var sUrl = trackApp_url.replace("#ID#", sCode);
					window.open(sUrl, "_blank");
				}
				MessageToast.show("VCR Session created: " + sCode);
				oContext.refresh();
			}).catch(function (oErr) {
				MessageBox.error("Failed to create VCR Session: " + oErr.message);
			});
		}
	};
});
