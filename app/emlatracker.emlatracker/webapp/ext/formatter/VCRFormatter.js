sap.ui.define([], function () {
	"use strict";

	return {
		icon: function (sEmlaType, sFollowUpID, bIsSessionInterested) {
			if (sEmlaType !== "Integration Suite") { return ""; }
			if (bIsSessionInterested === true || bIsSessionInterested === "true" || bIsSessionInterested === 1) {
				return "sap-icon://activity-2";
			}
			return sFollowUpID ? "sap-icon://calendar" : "sap-icon://add";
		},

		buttonType: function (sEmlaType, sFollowUpID, bIsSessionInterested) {
			if (sEmlaType !== "Integration Suite") { return "Transparent"; }
			if (sFollowUpID || bIsSessionInterested === true || bIsSessionInterested === "true" || bIsSessionInterested === 1) {
				return "Success";
			}
			return "Default";
		},

		tooltip: function (sEmlaType, sFollowUpID, bIsSessionInterested) {
			if (sEmlaType !== "Integration Suite") { return ""; }
			if (!sFollowUpID) { return "No Follow-Up registered"; }
			if (bIsSessionInterested === true || bIsSessionInterested === "true" || bIsSessionInterested === 1) {
				return "Follow-Up: Session interest registered";
			}
			return "Follow-Up: No session interest";
		},

		isVisible: function (sEmlaType) {
			return sEmlaType === "Integration Suite";
		}
	};
});
