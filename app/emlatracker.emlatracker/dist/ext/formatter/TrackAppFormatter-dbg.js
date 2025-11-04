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

  function icon(trackApp, completed, emlaType, sessionType) {
    console.log("DEBUG: icon() called with trackApp:", trackApp, "completed:", completed, "emlaType:", emlaType, "sessionType:", sessionType);
    
    // First check emlaType to see if this session type should be visible
    if (emlaType === "Private Cloud ERP") {
      console.log("DEBUG: Private Cloud ERP - no icons");
      return "";
    }
    
    if (emlaType === "Public Cloud ERP" && sessionType !== "TP1") {
      console.log("DEBUG: Public Cloud ERP - only TP1 allowed, this is:", sessionType);
      return "";
    }
    
    if (emlaType === "Integration Suite") {
      console.log("DEBUG: Integration Suite - all session types allowed");
      // All session types allowed, continue with trackApp check
    }
    
    // Now check if trackApp has value
    if (!trackApp || trackApp.trim() === "") {
      console.log("DEBUG: trackApp is empty, returning create icon");
      return "sap-icon://create";
    }
    
    console.log("DEBUG: trackApp has value, checking completion");
    
    // trackApp exists and has value, decide completed vs in-progress
    var isCompleted = _normalizeCompleted(completed);
    console.log("DEBUG: normalized completed to:", isCompleted);
    var iconResult = isCompleted
      ? "sap-icon://status-completed"
      : "sap-icon://document-text";
    console.log("DEBUG: returning icon:", iconResult);
    return iconResult;
  }

  function tooltip(trackApp, completed, sessionLabel) {
    if (!sessionLabel) sessionLabel = "Sessão"; // fallback
    
    // Check if trackApp is empty string, null, undefined, or just whitespace
    if (!trackApp || trackApp.trim() === "") {
      return "";
    }
    
    return _normalizeCompleted(completed)
      ? sessionLabel + " concluído"
      : sessionLabel + " em andamento";
  }

  function greenClass(completed) {
    return _normalizeCompleted(completed) ? "emlaIconGreen" : "";
  }

  return {
    iconTP1: function (trackApp, completed, emlaType) {
      return icon(trackApp, completed, emlaType, "TP1");
    },
    tooltipTP1: function (trackApp, completed) {
      return tooltip(trackApp, completed, "TP1");
    },
    iconTP2: function (trackAppTP2, completedTP2, emlaType) {
      return icon(trackAppTP2, completedTP2, emlaType, "TP2");
    },
    tooltipTP2: function (trackAppTP2, completedTP2) {
      return tooltip(trackAppTP2, completedTP2, "TP2");
    },
    iconSH: function (trackAppSH, completedSH, emlaType) {
      return icon(trackAppSH, completedSH, emlaType, "SH");
    },
    tooltipSH: function (trackAppSH, completedSH) {
      return tooltip(trackAppSH, completedSH, "SH");
    },
    greenClass: greenClass
  };
});
