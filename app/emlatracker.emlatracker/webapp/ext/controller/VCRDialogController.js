sap.ui.define([
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/ui/core/Fragment",
	"sap/m/SelectDialog",
	"sap/m/StandardListItem",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/json/JSONModel"
], function (MessageToast, MessageBox, Fragment, SelectDialog, StandardListItem, Filter, FilterOperator, JSONModel) {
	"use strict";

	let _oVCRDialog = null;
	let _oSelectDialog = null;
	let _oAdvisorDialog = null;
	let _oCurrentRowContext = null;
	let _oCurrentView = null;

	function findAncestor(oControl, sType) {
		let oCurrent = oControl;
		while (oCurrent && !oCurrent.isA(sType)) {
			oCurrent = oCurrent.getParent();
		}
		return oCurrent;
	}

	function findView(oControl) {
		return findAncestor(oControl, "sap.ui.core.mvc.View");
	}

	/**
	 * Refreshes the List Report table binding so the VCR button icon updates.
	 */
	function refreshList(oView) {
		try {
			const oTable = oView.byId("fe::table::EMLACustomers::LineItem-innerTable")
				|| oView.byId("fe::ListReport::EMLACustomers::Table");
			if (oTable && oTable.getBinding("items")) {
				oTable.getBinding("items").refresh();
				return;
			}
			// Fallback: refresh all list bindings on the model
			if (_oCurrentRowContext) {
				_oCurrentRowContext.getModel().refresh();
			}
		} catch (e) {
			if (_oCurrentRowContext) {
				_oCurrentRowContext.getModel().refresh();
			}
		}
	}

	/**
	 * Deletes a FollowUp record by ID using a direct OData DELETE request.
	 */
	function deleteFollowUp(oODataModel, sFollowUpID) {
		return new Promise(function (resolve, reject) {
			const oListBinding = oODataModel.bindList("/FollowUp");
			// Use a filter to find the exact context then delete
			oListBinding.filter([new Filter("ID", FilterOperator.EQ, sFollowUpID)]);
			oListBinding.requestContexts(0, 1, "$direct").then(function (aContexts) {
				if (aContexts && aContexts.length > 0) {
					return aContexts[0].delete("$auto").then(resolve).catch(reject);
				} else {
					// Already gone
					resolve();
				}
			}).catch(reject);
		});
	}

	/**
	 * Loads FollowUp data for the given customer context via OData $expand,
	 * then populates the dialog's JSON model.
	 */
	function loadFollowUpIntoModel(oCustomerContext, oDialogModel) {
		const oODataModel = oCustomerContext.getModel();
		const sPath = oCustomerContext.getPath();

		// Read the customer with followUp and scenarios expanded — always fresh from server
		return oODataModel.bindContext(sPath, null, {
			$$groupId: "$direct",
			"$expand": "followUp($expand=scenarios($expand=scenario))"
		}).requestObject().then(function (oData) {
			const oFollowUp = oData.followUp || null;
			oDialogModel.setData({
				customerID: oData.ID,
				customerName: oData.customerName,
				emlaType: oData.emlaType,
				btpOnbAdvEmailDefault: oData.btpOnbAdvEmail || "",
				followUpID: oFollowUp ? oFollowUp.ID : null,
				isSessionInterested: oFollowUp ? !!oFollowUp.isSessionInterested : false,
				returnDate: oFollowUp ? (oFollowUp.returnDate || "") : "",
				btpOnbAdvEmail: oFollowUp ? (oFollowUp.btpOnbAdvEmail || oData.btpOnbAdvEmail || "") : (oData.btpOnbAdvEmail || ""),
				notes: oFollowUp ? (oFollowUp.notes || "") : "",
				scenarios: oFollowUp && oFollowUp.scenarios
					? oFollowUp.scenarios.map(function (s) {
						return {
							id: s.ID,
							scenario_ID: s.scenario_ID,
							scenarioName: s.scenario ? s.scenario.name : "",
							scenarioEmlaType: s.scenario ? s.scenario.emlaType : ""
						};
					})
					: []
			});
		});
	}

	return {

		onOpenVCRDialog: function (oEvent) {
			const oButton = oEvent.getSource();
			const oBindingContext = oButton.getBindingContext();
			const that = this;

			if (!oBindingContext) {
				MessageToast.show("No data available");
				return;
			}

			const oView = findView(oButton);
			if (!oView) {
				MessageToast.show("Could not find view");
				return;
			}

			_oCurrentRowContext = oBindingContext;
			_oCurrentView = oView;

			const openWithData = function (oDialog) {
				const oDialogModel = oDialog.getModel("vcr");
				loadFollowUpIntoModel(oBindingContext, oDialogModel).then(function () {
					oDialog.open();
				}).catch(function (oError) {
					console.error("Failed to load Follow-Up data:", oError);
					// Still open with defaults (customer has no followUp yet)
					const oData = oBindingContext.getObject();
					oDialogModel.setData({
						customerID: oData.ID,
						customerName: oData.customerName,
						emlaType: oData.emlaType,
						btpOnbAdvEmailDefault: oData.btpOnbAdvEmail || "",
						followUpID: null,
						isSessionInterested: false,
						returnDate: "",
						btpOnbAdvEmail: oData.btpOnbAdvEmail || "",
						notes: "",
						scenarios: []
					});
					oDialog.open();
				});
			};

			if (!_oVCRDialog) {
				Fragment.load({
					id: oView.getId(),
					name: "emlatracker.emlatracker.ext.fragment.VCRDialog",
					controller: that
				}).then(function (oDialog) {
					_oVCRDialog = oDialog;
					// Attach a dedicated JSON model for the dialog form
					const oDialogModel = new JSONModel({});
					_oVCRDialog.setModel(oDialogModel, "vcr");
					oView.addDependent(_oVCRDialog);
					openWithData(_oVCRDialog);
				}).catch(function (oError) {
					console.error("Failed to load VCR dialog fragment:", oError);
					MessageBox.error("Failed to open dialog. Please refresh and try again.");
				});
			} else {
				openWithData(_oVCRDialog);
			}
		},

		onSaveVCRDialog: function (oEvent) {
			const oButton = oEvent.getSource();
			const oDialog = findAncestor(oButton, "sap.m.Dialog");
			if (!oDialog || !_oCurrentRowContext) { return; }

			const oDialogModel = oDialog.getModel("vcr");
			const oFormData = oDialogModel.getData();
			const oODataModel = _oCurrentRowContext.getModel();

			// Session interest disabled + FollowUp exists → delete it
			if (!oFormData.isSessionInterested && oFormData.followUpID) {
				deleteFollowUp(oODataModel, oFormData.followUpID).then(function () {
					MessageToast.show("Follow-Up removed");
					refreshList(_oCurrentView);
					oDialog.close();
				}).catch(function (oErr) {
					console.error("Failed to delete Follow-Up:", oErr);
					MessageBox.error("Failed to remove Follow-Up. Please try again.");
				});
				return;
			}

			// Session interest disabled + no FollowUp → nothing to do
			if (!oFormData.isSessionInterested && !oFormData.followUpID) {
				oDialog.close();
				return;
			}

			// Session interest enabled — validate required date
			if (!oFormData.returnDate) {
				MessageBox.error("Return Date is required.");
				return;
			}

			const oPayload = {
				customer_ID: oFormData.customerID,
				isSessionInterested: true,
				returnDate: oFormData.returnDate,
				btpOnbAdvEmail: oFormData.btpOnbAdvEmail || "",
				notes: oFormData.notes || ""
			};

			const afterSave = function (sFollowUpID) {
				const aNew = (oFormData.scenarios || []).filter(function (s) { return !s.id && s.scenario_ID; });
				const aPromises = aNew.map(function (s) {
					return oODataModel.bindList("/FollowUpScenarios").create({
						followUp_ID: sFollowUpID,
						scenario_ID: s.scenario_ID
					}).created();
				});
				Promise.all(aPromises).then(function () {
					MessageToast.show("Follow-Up saved");
					refreshList(_oCurrentView);
					oDialog.close();
				}).catch(function (oErr) {
					console.error("Failed to save scenarios:", oErr);
					MessageBox.error("Follow-Up saved but some scenarios could not be added.");
					refreshList(_oCurrentView);
					oDialog.close();
				});
			};

			if (!oFormData.followUpID) {
				// Create
				const oNewCtx = oODataModel.bindList("/FollowUp").create(oPayload);
				oNewCtx.created().then(function () {
					afterSave(oNewCtx.getProperty("ID"));
				}).catch(function (oErr) {
					console.error("Failed to create Follow-Up:", oErr);
					MessageBox.error("Failed to save Follow-Up. Please try again.");
				});
			} else {
				// Update — PATCH
				const oUpdateCtx = oODataModel.bindContext(
					"/FollowUp(" + oFormData.followUpID + ")",
					null,
					{ $$groupId: "vcrUpdate" }
				);
				oUpdateCtx.requestObject().then(function () {
					const oBound = oUpdateCtx.getBoundContext();
					return Promise.all([
						oBound.setProperty("isSessionInterested", oPayload.isSessionInterested),
						oBound.setProperty("returnDate", oPayload.returnDate),
						oBound.setProperty("btpOnbAdvEmail", oPayload.btpOnbAdvEmail),
						oBound.setProperty("notes", oPayload.notes)
					]);
				}).then(function () {
					return oODataModel.submitBatch("vcrUpdate");
				}).then(function () {
					afterSave(oFormData.followUpID);
				}).catch(function (oErr) {
					console.error("Failed to update Follow-Up:", oErr);
					MessageBox.error("Failed to save Follow-Up. Please try again.");
				});
			}
		},

		onCancelVCRDialog: function (oEvent) {
			const oButton = oEvent.getSource();
			const oDialog = findAncestor(oButton, "sap.m.Dialog");
			if (oDialog) { oDialog.close(); }
		},

		onAddScenario: function (oEvent) {
			const oButton = oEvent.getSource();
			const oDialog = findAncestor(oButton, "sap.m.Dialog");
			if (!oDialog) { return; }

			const oDialogModel = oDialog.getModel("vcr");
			const aScenarios = oDialogModel.getProperty("/scenarios") || [];
			aScenarios.push({ id: null, scenario_ID: null, scenarioName: "", scenarioEmlaType: "" });
			oDialogModel.setProperty("/scenarios", aScenarios);
		},

		onDeleteScenario: function (oEvent) {
			const oButton = oEvent.getSource();
			const oDialog = findAncestor(oButton, "sap.m.Dialog");
			if (!oDialog) { return; }

			const oDialogModel = oDialog.getModel("vcr");
			const oFormData = oDialogModel.getData();
			const sPath = oButton.getBindingContext("vcr").getPath(); // e.g. /scenarios/2
			const iIndex = parseInt(sPath.split("/").pop(), 10);
			const oScenario = oFormData.scenarios[iIndex];

			const doDelete = function () {
				if (oScenario.id && _oCurrentRowContext) {
					const oODataModel = _oCurrentRowContext.getModel();
					oODataModel.bindContext("/FollowUpScenarios(" + oScenario.id + ")", null, { $$groupId: "$auto" })
						.requestObject().then(function () {
							return oODataModel.bindContext("/FollowUpScenarios(" + oScenario.id + ")", null, { $$groupId: "$auto" })
								.getBoundContext().delete("$auto");
						}).catch(function (oErr) {
							console.error("Failed to delete scenario from backend:", oErr);
						});
				}
				const aUpdated = oFormData.scenarios.filter(function (_, i) { return i !== iIndex; });
				oDialogModel.setProperty("/scenarios", aUpdated);
			};

			MessageBox.confirm("Remove this scenario?", {
				onClose: function (sAction) {
					if (sAction === MessageBox.Action.OK) { doDelete(); }
				}
			});
		},

		onAdvisorValueHelp: function (oEvent) {
			const oInput = oEvent.getSource();
			const oDialog = findAncestor(oInput, "sap.m.Dialog");
			if (!oDialog) { return; }

			const oDialogModel = oDialog.getModel("vcr");
			const oODataModel = _oCurrentRowContext.getModel();

			if (!_oAdvisorDialog) {
				_oAdvisorDialog = new SelectDialog({
					title: "Select BTP Onboarding Advisor",
					search: function (oEvt) {
						const sValue = oEvt.getParameter("value");
						const aFilters = sValue ? [
							new Filter([
								new Filter("name", FilterOperator.Contains, sValue),
								new Filter("email", FilterOperator.Contains, sValue)
							], false)
						] : [];
						oEvt.getParameter("itemsBinding").filter(aFilters);
					},
					confirm: function (oEvt) {
						const oSelectedItem = oEvt.getParameter("selectedItem");
						if (oSelectedItem) {
							const oAdvisorData = oSelectedItem.getBindingContext().getObject();
							oDialogModel.setProperty("/btpOnbAdvEmail", oAdvisorData.email);
						}
					},
					cancel: function () {}
				});
				_oAdvisorDialog.setModel(oODataModel);
				_oAdvisorDialog.bindAggregation("items", {
					path: "/OnboardAdvisors",
					template: new StandardListItem({
						title: "{name}",
						description: "{email}"
					})
				});
			}

			_oAdvisorDialog.open();
		},

		onScenarioValueHelp: function (oEvent) {
			const oInput = oEvent.getSource();
			const oDialog = findAncestor(oInput, "sap.m.Dialog");
			if (!oDialog) { return; }

			const oDialogModel = oDialog.getModel("vcr");
			const sEmlaType = oDialogModel.getProperty("/emlaType");
			const sRowPath = oInput.getBindingContext("vcr").getPath(); // /scenarios/N
			const iIndex = parseInt(sRowPath.split("/").pop(), 10);
			const oODataModel = _oCurrentRowContext.getModel();

			if (!_oSelectDialog) {
				_oSelectDialog = new SelectDialog({
					title: "Select Scenario",
					search: function (oEvt) {
						const sValue = oEvt.getParameter("value");
						const oFilter = new Filter("name", FilterOperator.Contains, sValue);
						oEvt.getParameter("itemsBinding").filter([oFilter]);
					},
					cancel: function () {}
				});
				_oSelectDialog.setModel(oODataModel);
			}

			// Attach confirm handler fresh each time to capture current iIndex
			_oSelectDialog.detachConfirm(_oSelectDialog._fnConfirm);
			_oSelectDialog._fnConfirm = function (oEvt) {
				const oSelectedItem = oEvt.getParameter("selectedItem");
				if (oSelectedItem) {
					const oScenarioData = oSelectedItem.getBindingContext().getObject();
					const aScenarios = oDialogModel.getProperty("/scenarios");
					aScenarios[iIndex].scenario_ID = oScenarioData.ID;
					aScenarios[iIndex].scenarioName = oScenarioData.name;
					oDialogModel.setProperty("/scenarios", aScenarios.slice());
				}
			};
			_oSelectDialog.attachConfirm(_oSelectDialog._fnConfirm);

			const aFilters = sEmlaType ? [new Filter("emlaType", FilterOperator.EQ, sEmlaType)] : [];
			_oSelectDialog.bindAggregation("items", {
				path: "/Scenarios",
				filters: aFilters,
				template: new StandardListItem({ title: "{name}", description: "{emlaType}" })
			});
			_oSelectDialog.open();
		}
	};
});
