sap.ui.define([], function () {
	"use strict";

	return {
		/**
		 * Returns button type based on FollowUp existence and session interest.
		 * @param {string} sFollowUpID - FollowUp/ID
		 * @param {boolean} bIsSessionInterested - FollowUp/isSessionInterested
		 * @returns {string} sap.m.ButtonType
		 */
		buttonType: function (sFollowUpID, bIsSessionInterested) {
			if (!sFollowUpID) {
				return "Default";
			}
			if (bIsSessionInterested === true || bIsSessionInterested === "true" || bIsSessionInterested === 1) {
				return "Success";
			}
			return "Attention";
		},

		/**
		 * Returns tooltip based on FollowUp status.
		 * @param {string} sFollowUpID - FollowUp/ID
		 * @param {boolean} bIsSessionInterested - FollowUp/isSessionInterested
		 * @returns {string} tooltip text
		 */
		tooltip: function (sFollowUpID, bIsSessionInterested) {
			if (!sFollowUpID) {
				return "No Follow-Up registered";
			}
			if (bIsSessionInterested === true || bIsSessionInterested === "true" || bIsSessionInterested === 1) {
				return "Follow-Up: Session interest registered";
			}
			return "Follow-Up: No session interest";
		}
	};
});
