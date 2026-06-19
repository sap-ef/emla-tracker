sap.ui.define([], function () {
	"use strict";

	function _normalize(v) {
		if (v === true || v === 1) return true;
		if (typeof v === "string") {
			var s = v.trim().toLowerCase();
			return s === "true" || s === "x" || s === "1" || s === "yes";
		}
		return false;
	}

	return {
		icon: function (sTrackApp, bCompleted, bRejected) {
			if (!sTrackApp || sTrackApp.trim() === "") {
				return "sap-icon://create";
			}
			if (_normalize(bRejected)) return "sap-icon://decline";
			if (_normalize(bCompleted)) return "sap-icon://status-completed";
			return "sap-icon://document-text";
		},

		color: function (sTrackApp, bCompleted, bRejected) {
			if (!sTrackApp || sTrackApp.trim() === "") {
				return "Default";
			}
			if (_normalize(bRejected)) return "Negative";
			if (_normalize(bCompleted)) return "Positive";
			return "Default";
		},

		tooltip: function (sTrackApp, bCompleted, bRejected, sStatus, sDate) {
			if (!sTrackApp || sTrackApp.trim() === "") {
				return "";
			}
			var text = "VRC";
			if (sDate) {
				var dateStr = typeof sDate === "string" ? sDate.split("T")[0] : sDate;
				if (dateStr) text += ":" + dateStr;
			}
			text += ":";
			if (sStatus && sStatus.trim() !== "" && sStatus !== "Unknown") {
				text += sStatus;
			} else if (_normalize(bRejected)) {
				text += "Rejected";
			} else if (_normalize(bCompleted)) {
				text += "Completed";
			} else {
				text += "In Progress";
			}
			return text;
		}
	};
});

