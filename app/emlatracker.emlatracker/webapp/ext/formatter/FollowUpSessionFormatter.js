sap.ui.define([], function () {
	"use strict";

	return {
		icon: function (sTrackApp) {
			if (!sTrackApp || sTrackApp.trim() === "") {
				return "sap-icon://create";
			}
			return "sap-icon://document-text";
		},

		color: function (sTrackApp) {
			if (!sTrackApp || sTrackApp.trim() === "") {
				return "Default";
			}
			return "Default";
		},

		tooltip: function (sTrackApp) {
			if (!sTrackApp || sTrackApp.trim() === "") {
				return "";
			}
			return "VCR:" + sTrackApp;
		}
	};
});
