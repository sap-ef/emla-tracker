sap.ui.define([], function () {
  "use strict";

  function _normalizeCompleted(v) {
    console.log("DEBUG: _normalizeCompleted input:", v, "type:", typeof v);
    if (v === true) return true;
    if (v === 1) return true;
    if (typeof v === "string") {
      var s = v.trim().toLowerCase();
      var result = s === "true" || s === "x" || s === "1" || s === "yes";
      console.log("DEBUG: string '" + v + "' normalized to:", result);
      return result;
    }
    console.log("DEBUG: value normalized to false");
    return false;
  }

  function icon(trackApp, completed) {
    console.log("DEBUG: icon() called with trackApp:", trackApp, "completed:", completed);
    // Empty trackApp => create icon
    if (!trackApp) return "sap-icon://create";
    // trackApp exists, decide completed vs in-progress
    var isCompleted = _normalizeCompleted(completed);
    console.log("DEBUG: normalized completed to:", isCompleted);
    return isCompleted
      ? "sap-icon://status-completed"
      : "sap-icon://document-text";
  }

  function tooltip(trackApp, completed, sessionLabel) {
    if (!sessionLabel) sessionLabel = "Sessão"; // fallback
    if (!trackApp) return "Criar " + sessionLabel;
    return _normalizeCompleted(completed)
      ? sessionLabel + " concluído"
      : sessionLabel + " em andamento";
  }

  function greenClass(completed) {
    return _normalizeCompleted(completed) ? "emlaIconGreen" : "";
  }

  return {
    iconTP1: function (trackApp, completed) {
      return icon(trackApp, completed);
    },
    tooltipTP1: function (trackApp, completed) {
      return tooltip(trackApp, completed, "TP1");
    },
    iconTP2: function (trackAppTP2, completedTP2) {
      return icon(trackAppTP2, completedTP2);
    },
    tooltipTP2: function (trackAppTP2, completedTP2) {
      return tooltip(trackAppTP2, completedTP2, "TP2");
    },
    iconSH: function (trackAppSH, completedSH) {
      return icon(trackAppSH, completedSH);
    },
    tooltipSH: function (trackAppSH, completedSH) {
      return tooltip(trackAppSH, completedSH, "SH");
    },
    greenClass: greenClass
  };
});
