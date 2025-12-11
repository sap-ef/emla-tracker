sap.ui.define([], function () {
  "use strict";

  function _normalizeCompleted(v) {
    console.log("🔥 _normalizeCompleted input:", v, "type:", typeof v, "JSON:", JSON.stringify(v));
    if (v === true) {
      console.log("🔥 Matched: v === true");
      return true;
    }
    if (v === 1) {
      console.log("🔥 Matched: v === 1");
      return true;
    }
    if (typeof v === "string") {
      var s = v.trim().toLowerCase();
      var result = s === "true" || s === "x" || s === "1" || s === "yes";
      console.log("🔥 String '" + v + "' normalized to '" + s + "' result:", result);
      return result;
    }
    console.log("🔥 No match - returning false");
    return false;
  }

  function icon(trackApp, completed, emlaType, sessionType, rejected) {
    console.log("🔥 DEBUG ICON: trackApp:", trackApp, "completed:", completed, "emlaType:", emlaType, "sessionType:", sessionType, "rejected:", rejected, "rejected type:", typeof rejected);
    
    // First check emlaType to see if this session type should be visible
    if (emlaType === "Cloud ERP Private") {
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
    
    console.log("🔥 CHECKING REJECTION: rejected raw value:", rejected, "type:", typeof rejected);
    
    // Check if session is rejected first (highest priority)
    var isRejected = _normalizeCompleted(rejected); // Using same normalization logic
    console.log("🔥 REJECTION RESULT: isRejected =", isRejected);
    if (isRejected) {
      console.log("🔥 RETURNING DECLINE ICON!");
      return "sap-icon://decline";
    }
    
    // Check if session is completed
    var isCompleted = _normalizeCompleted(completed);
    console.log("DEBUG: normalized completed to:", isCompleted);
    var iconResult = isCompleted
      ? "sap-icon://status-completed"
      : "sap-icon://document-text";
    console.log("DEBUG: returning icon:", iconResult);
    return iconResult;
  }

  function tooltip(trackApp, completed, sessionLabel, rejected, status, date) {
    if (!sessionLabel) sessionLabel = "Sessão"; // fallback
    
    // Check if trackApp is empty string, null, undefined, or just whitespace
    if (!trackApp || trackApp.trim() === "") {
      return "";
    }
    
    // Format: SessionType:DATE:Status
    let tooltipText = sessionLabel;
    
    // Add date if available
    if (date) {
      let dateStr = "";
      if (date instanceof Date) {
        // Format date as YYYY-MM-DD
        dateStr = date.toISOString().split('T')[0];
      } else if (typeof date === "string" && date.trim() !== "") {
        // Already a string, use as-is (should be YYYY-MM-DD format)
        dateStr = date.split('T')[0]; // Remove time part if present
      }
      if (dateStr) {
        tooltipText += ":" + dateStr;
      }
    }
    
    // Add status
    tooltipText += ":";
    if (status && status.trim() !== "" && status !== "Unknown") {
      // Use the actual status text from external system
      tooltipText += status;
    } else if (_normalizeCompleted(rejected)) {
      tooltipText += "Rejected";
    } else if (_normalizeCompleted(completed)) {
      tooltipText += "Completed";
    } else {
      tooltipText += "In Progress";
    }
    
    return tooltipText;
  }

  function greenClass(completed) {
    return _normalizeCompleted(completed) ? "emlaIconGreen" : "";
  }

  function iconColor(trackApp, completed, rejected) {
    // console.log("🔥 iconColor CALLED WITH:", {
    //   trackApp: trackApp,
    //   completed: completed,
    //   rejected: rejected,
    //   rejected_type: typeof rejected
    // });
    
    // Only apply semantic color if trackApp exists
    if (!trackApp || trackApp.trim() === "") {
      //console.log("🔥 iconColor: No trackApp, returning Default");
      return "Default"; // No special color for create icon
    }
    
    // Check rejection first (highest priority - red color)
    var isRejected = _normalizeCompleted(rejected);
    //console.log("🔥 iconColor: isRejected =", isRejected);
    if (isRejected) {
      //console.log("🔥 iconColor: RETURNING Negative (RED COLOR)!");
      return "Negative"; // Red color for rejected sessions - changed from "Error" to "Negative"
    }
    
    // Then check completion (green color)
    var isCompleted = _normalizeCompleted(completed);
    //console.log("🔥 iconColor: isCompleted =", isCompleted);
    if (isCompleted) {
      //console.log("🔥 iconColor: RETURNING Positive (GREEN COLOR)!");
      return "Positive"; // Green color for completed sessions
    }
    
    // Default color for in-progress sessions
    //console.log("🔥 iconColor: RETURNING Default");
    return "Default";
  }

  return {
    iconTP1: function (trackApp, completed, emlaType, rejected) {
      console.log("🔥 iconTP1 CALLED WITH:", {
        trackApp: trackApp,
        completed: completed,
        emlaType: emlaType,
        rejected: rejected,
        rejected_type: typeof rejected
      });
      
      if (rejected === true || rejected === "true" || rejected === 1 || rejected === "1") {
        console.log("🔥 TP1 DIRECT REJECTION TEST: YES, showing decline icon!");
        return "sap-icon://decline";
      }
      
      return icon(trackApp, completed, emlaType, "TP1", rejected);
    },
    tooltipTP1: function (trackApp, completed, rejected, status, date) {
      return tooltip(trackApp, completed, "TP1", rejected, status, date);
    },
    colorTP1: function (trackApp, completed, rejected) {
      console.log("🔥 colorTP1 called with rejected:", rejected, typeof rejected);
      var result = iconColor(trackApp, completed, rejected);
      console.log("🔥 colorTP1 returning:", result);
      return result;
    },
    iconTP2: function (trackAppTP2, completedTP2, emlaType, rejectedTP2) {
      console.log("🔥 iconTP2 CALLED WITH:", {
        trackAppTP2: trackAppTP2,
        completedTP2: completedTP2,
        emlaType: emlaType,
        rejectedTP2: rejectedTP2,
        rejectedTP2_type: typeof rejectedTP2
      });
      
      if (rejectedTP2 === true || rejectedTP2 === "true" || rejectedTP2 === 1 || rejectedTP2 === "1") {
        console.log("🔥 TP2 DIRECT REJECTION TEST: YES, showing decline icon!");
        return "sap-icon://decline";
      }
      
      return icon(trackAppTP2, completedTP2, emlaType, "TP2", rejectedTP2);
    },
    tooltipTP2: function (trackAppTP2, completedTP2, rejectedTP2, statusTP2, dateTP2) {
      return tooltip(trackAppTP2, completedTP2, "TP2", rejectedTP2, statusTP2, dateTP2);
    },
    colorTP2: function (trackAppTP2, completedTP2, rejectedTP2) {
      console.log("🔥 colorTP2 called with rejectedTP2:", rejectedTP2, typeof rejectedTP2);
      var result = iconColor(trackAppTP2, completedTP2, rejectedTP2);
      console.log("🔥 colorTP2 returning:", result);
      return result;
    },
    iconSH: function (trackAppSH, completedSH, emlaType, rejectedSH) {
      // console.log("🔥🔥🔥 iconSH CALLED WITH:", {
      //   trackAppSH: trackAppSH,
      //   completedSH: completedSH,
      //   emlaType: emlaType,
      //   rejectedSH: rejectedSH,
      //   rejectedSH_type: typeof rejectedSH,
      //   rejectedSH_stringified: JSON.stringify(rejectedSH)
      // });
      
      // Let's also test the rejection directly here
      if (rejectedSH === true || rejectedSH === "true" || rejectedSH === 1 || rejectedSH === "1") {
        // console.log("🔥🔥🔥 DIRECT REJECTION TEST: YES, this should show decline icon!");
        return "sap-icon://decline";
      }
      
      // console.log("🔥🔥🔥 iconSH calling main icon function");
      var result = icon(trackAppSH, completedSH, emlaType, "SH", rejectedSH);
      // console.log("🔥🔥🔥 iconSH returning:", result);
      return result;
    },
    tooltipSH: function (trackAppSH, completedSH, rejectedSH, statusSH, dateSH) {
      return tooltip(trackAppSH, completedSH, "SH", rejectedSH, statusSH, dateSH);
    },
    colorSH: function (trackAppSH, completedSH, rejectedSH) {
      // console.log("🔥 colorSH called with rejectedSH:", rejectedSH, typeof rejectedSH);
      var result = iconColor(trackAppSH, completedSH, rejectedSH);
      // console.log("🔥 colorSH returning:", result);
      return result;
    },
    greenClass: greenClass
  };
});
