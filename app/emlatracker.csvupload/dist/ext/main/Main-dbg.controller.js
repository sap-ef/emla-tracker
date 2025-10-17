sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/m/MessageToast", "sap/m/MessageBox"],
  function (Controller, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("emlatracker.csvupload.ext.main.Main", {
      onInit: function () {
        this._selectedFile = null;
        this._updateUploadButtonState();

        // Get model from view instead of core
        var oModel = this.getView().getModel();
        console.log("Model instance:", oModel);
        console.log(
          "Is OData V4 model?",
          oModel instanceof sap.ui.model.odata.v4.ODataModel
        );
        if (oModel) {
          console.log("Available methods on model:", Object.keys(oModel));
        }

        // Debug: Check if model is available (safe access)
        setTimeout(
          function () {
            var oModel =
              (this.getView &&
                this.getView().getModel &&
                this.getView().getModel()) ||
              (this.getOwnerComponent &&
                this.getOwnerComponent().getModel &&
                this.getOwnerComponent().getModel());
            console.log("Model available:", !!oModel);
            try {
              if (oModel && oModel.getMetadata) {
                console.log("Model type:", oModel.getMetadata().getName());
              }
            } catch (e) {
              console.log("Model metadata not available");
            }
          }.bind(this),
          1000
        );
      },

      onFileChange: function (oEvent) {
        var oFileUploader = oEvent.getSource();
        var oFile =
          oEvent.getParameter("files") && oEvent.getParameter("files")[0];

        if (oFile) {
          this._selectedFile = oFile;
          this._showMessage("File selected: " + oFile.name, "Information");
        } else {
          this._selectedFile = null;
        }
        this._updateUploadButtonState();
      },

      onCsvTypeChange: function (oEvent) {
        this._updateUploadButtonState();
        var iIndex = oEvent.getParameter("selectedIndex");
        var sKey = null;
        if (iIndex === 0) sKey = "integration";
        else if (iIndex === 1) sKey = "public";

        if (sKey) {
          // show the label text
          var sText = this.byId(
            iIndex === 0 ? "rbIntegration" : "rbPublic"
          ).getText();
          this._showMessage("CSV type selected: " + sText, "Information");
        }
      },

      _updateUploadButtonState: function () {
        var bFileSelected = !!this._selectedFile;
        var rb = this.byId("csvTypeRadio");
        var bTypeSelected =
          rb &&
          typeof rb.getSelectedIndex === "function" &&
          rb.getSelectedIndex() !== -1;

        this.byId("uploadButton").setEnabled(bFileSelected && bTypeSelected);
      },

      onUploadPress: function () {
        // Read the selected file as raw text and send to server. The server is authoritative for CSV parsing.
        if (!this._selectedFile) {
          this._showMessage("Please select a CSV file first.", "Error");
          return;
        }

        var rb = this.byId("csvTypeRadio");
        var idx =
          rb && typeof rb.getSelectedIndex === "function"
            ? rb.getSelectedIndex()
            : -1;
        var sCsvType = idx === 0 ? "integration" : idx === 1 ? "public" : null;
        if (!sCsvType) {
          this._showMessage("Please choose a CSV type", "Error");
          return;
        }

        var that = this;
        var reader = new FileReader();
        reader.onload = function (e) {
          var text = e.target.result;
          that._showMessage("Uploading CSV...", "Information");
          try {
            that.byId("uploadButton").setEnabled(false);
          } catch (e) {
            /* ignore if button missing in view during tests */
          }
          // send raw CSV text to server; server will run PapaParse
          that._uploadViaHTTP(text, sCsvType);
        };
        reader.onerror = function (e) {
          console.error("File read error", e);
          that._showMessage(
            "Failed to read file: " + (e && e.message ? e.message : String(e)),
            "Error"
          );
        };
        reader.readAsText(this._selectedFile, "UTF-8");
      },

      _uploadCSVData: function (csvData /*, oModel - not used anymore */) {
        var that = this;
        console.log(
          "Entering _uploadCSVData, this.getModel exists? ->",
          typeof this.getModel
        );

        // Get CSV options
        // read csv type from radio group
        var sCsvType = null;
        var rb = this.byId("csvTypeRadio");
        if (rb && typeof rb.getSelectedIndex === "function") {
          var idx = rb.getSelectedIndex();
          if (idx === 0) sCsvType = "integration";
          else if (idx === 1) sCsvType = "public";
        }
        var sDelimiter = this.byId("delimiterSelect").getSelectedKey();
        if (sDelimiter === "tab") {
          sDelimiter = "\t";
        }
        var bHasHeader = this.byId("hasHeaderCheckBox").getSelected();

        // Parse and validate CSV
        var aParsedData = this._parseCSV(
          csvData,
          sDelimiter,
          bHasHeader,
          sCsvType
        );
        if (!aParsedData) {
          return; // Error already shown
        }

        this._showMessage(
          "Uploading " +
            aParsedData.length +
            " records (" +
            sCsvType +
            " format)...",
          "Information"
        );

        // Convert parsed data back to CSV format for backend
        var sProcessedCSV = this._arrayToCSV(aParsedData, sCsvType);

        // Use HTTP fallback only to ensure upload works regardless of model type
        try {
          this._uploadViaHTTP(sProcessedCSV);
        } catch (err) {
          console.error("Upload failed (HTTP fallback):", err);
          that._showMessage("Upload failed: " + err.message, "Error");
        }
      },

      /**
       * Upload CSV via OData service action with proper authentication
       * Processes in batches to avoid HTTP 413 errors
       * Expects server response JSON like: { inserted: number, errors: [ ... ], failedRowsCsv: string }
       */
      _uploadViaHTTP: function (csvText, csvType) {
        var that = this;
        var oModel = this.getView().getModel();

        if (!oModel) {
          that._showMessage("OData model not available", "Error");
          return Promise.reject(new Error("No OData model"));
        }

        // Debug: Log the service URL being used
        console.log("Model service URL:", oModel.getServiceUrl());
        console.log("Model type:", oModel.getMetadata().getName());

        // Split CSV into header and rows
        var lines = csvText.split(/\r?\n/).filter(function(line) {
          return line.trim().length > 0;
        });

        if (lines.length === 0) {
          that._showMessage("CSV file is empty", "Error");
          return Promise.reject(new Error("Empty CSV"));
        }

        var header = lines[0];
        var dataLines = lines.slice(1);
        var totalRows = dataLines.length;

        // Process in batches of 100 rows (backend now supports up to 10MB)
        var BATCH_SIZE = 100;
        var batches = [];

        for (var i = 0; i < dataLines.length; i += BATCH_SIZE) {
          var batchLines = dataLines.slice(i, Math.min(i + BATCH_SIZE, dataLines.length));
          var batchCsv = header + "\n" + batchLines.join("\n");
          batches.push(batchCsv);
        }

        console.log("Processing " + totalRows + " rows in " + batches.length + " batches");
        that._showMessage("Processing " + totalRows + " rows in " + batches.length + " batches...", "Information");

        // Process batches sequentially
        var allResults = {
          inserted: 0,
          errors: [],
          failedRowsCsv: ""
        };

        var currentBatch = 0;

        function processBatch(batchIndex) {
          if (batchIndex >= batches.length) {
            // All batches processed
            console.log("All batches processed. Total inserted:", allResults.inserted);
            that._handleUploadResponse(allResults);
            return Promise.resolve(allResults);
          }

          currentBatch = batchIndex + 1;
          var progress = "Batch " + currentBatch + " of " + batches.length;
          console.log(progress);
          that._showMessage(progress + " - uploading...", "Information");

          return new Promise(function (resolve, reject) {
            try {
              var oAction = oModel.bindContext("/uploadCSV(...)");
              oAction.setParameter("csvData", batches[batchIndex]);
              if (csvType) {
                oAction.setParameter("csvType", csvType);
              }

              oAction
                .execute()
                .then(function () {
                  try {
                    var oResult = oAction.getBoundContext().getObject();
                    console.log("Batch " + currentBatch + " response:", oResult);

                    // Handle CAP action response format
                    var data;
                    if (oResult && typeof oResult.value === "string") {
                      try {
                        data = JSON.parse(oResult.value);
                      } catch (e) {
                        data = {
                          message: oResult.value,
                          inserted: 0,
                          errors: [],
                        };
                      }
                    } else if (oResult && oResult.value) {
                      data = oResult.value;
                    } else {
                      data = oResult;
                    }

                    // Accumulate results
                    allResults.inserted += data.inserted || 0;
                    if (data.errors && data.errors.length > 0) {
                      allResults.errors = allResults.errors.concat(data.errors);
                    }
                    if (data.failedRowsCsv) {
                      allResults.failedRowsCsv += data.failedRowsCsv + "\n";
                    }

                    resolve();
                  } catch (e) {
                    console.error("Error parsing batch response", e);
                    reject(e);
                  }
                })
                .catch(function (oError) {
                  console.error("Batch " + currentBatch + " error:", oError);
                  reject(oError);
                });
            } catch (e) {
              console.error("Error setting up batch call:", e);
              reject(e);
            }
          }).then(function() {
            // Process next batch
            return processBatch(batchIndex + 1);
          });
        }

        return processBatch(0).catch(function(oError) {
          console.error("Batch processing error:", oError);
          var message = "Upload failed";
          if (oError && oError.message) {
            message += ": " + oError.message;
          } else if (oError && oError.error && oError.error.message) {
            message += ": " + oError.error.message;
          }
          that._showMessage(message, "Error");

          // Show partial results if any
          if (allResults.inserted > 0 || allResults.errors.length > 0) {
            that._handleUploadResponse(allResults);
          }

          return Promise.reject(oError);
        });
      },

      _handleUploadResponse: function (data) {
        var that = this;
        var inserted =
          (data && (data.inserted || data.insertedCount || 0)) || 0;
        var errors = (data && data.errors) || [];
        var failedCsv = data && data.failedRowsCsv;

        // Show message strip
        that._showMessage(
          "Upload finished. Inserted: " +
            inserted +
            ", Errors: " +
            (errors.length || 0),
          "Success"
        );

        // Build dialog with counts and optional error table + download
        var oSummaryBox = new sap.m.VBox({
          items: [
            new sap.m.Text({ text: "Inserted: " + inserted }),
            new sap.m.Text({ text: "Errors: " + (errors.length || 0) }),
          ],
          renderType: "Bare",
          applyContentPadding: true,
        });

        var oTable = null;
        if (errors && errors.length > 0) {
          oTable = new sap.m.Table({
            headerText: "Error details",
            inset: false,
            growing: false,
            columns: [
              new sap.m.Column({ header: new sap.m.Label({ text: "Row" }) }),
              new sap.m.Column({ header: new sap.m.Label({ text: "Reason" }) }),
              new sap.m.Column({ header: new sap.m.Label({ text: "Raw" }) }),
            ],
          });

          errors.forEach(function (er) {
            var rawText = "";
            try {
              rawText = er.raw ? JSON.stringify(er.raw) : "";
            } catch (e) {
              rawText = String(er.raw);
            }
            var oItem = new sap.m.ColumnListItem({
              cells: [
                new sap.m.Text({ text: er.row || "" }),
                new sap.m.Text({ text: er.reason || er.__dbError || "" }),
                new sap.m.Text({ text: rawText }),
              ],
            });
            oTable.addItem(oItem);
          });
        }

        var oPanel = new sap.m.Panel({
          backgroundDesign: "Transparent",
          width: "100%",
          content: oTable ? [oSummaryBox, oTable] : [oSummaryBox],
        });

        var oDialog = new sap.m.Dialog({
          title: "Upload result",
          contentWidth: "70%",
          content: [oPanel],
          beginButton: new sap.m.Button({
            text: "Close",
            press: function () {
              oDialog.close();
            },
          }),
          endButton: new sap.m.Button({
            text: "Download Errors",
            type: "Emphasized",
            press: function () {
              if (failedCsv) {
                var blob = new Blob([failedCsv], {
                  type: "text/csv;charset=utf-8;",
                });
                var url = URL.createObjectURL(blob);
                var a = document.createElement("a");
                a.href = url;
                a.download = "upload-errors.csv";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                return;
              }
              if (!errors || errors.length === 0) {
                that._showMessage("No errors to download", "Information");
                return;
              }
              // build CSV fallback
              var csv = "row,reason,raw\n";
              errors.forEach(function (er) {
                var raw = er.raw
                  ? JSON.stringify(er.raw).replace(/"/g, '""')
                  : "";
                csv +=
                  (er.row || "") +
                  "," +
                  '"' +
                  (er.reason || er.__dbError || "") +
                  '"' +
                  "," +
                  '"' +
                  raw +
                  '"' +
                  "\n";
              });
              var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              var url = URL.createObjectURL(blob);
              var a = document.createElement("a");
              a.href = url;
              a.download = "upload-errors.csv";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            },
          }),
          afterClose: function () {
            oDialog.destroy();
          },
        });
        oDialog.open();
      },

      _parseCSV: function (csvData, delimiter, hasHeader, csvType) {
        try {
          var lines = csvData
            .split(/\r?\n/)
            .map(function (line) {
              return line.trim();
            })
            .filter(function (line) {
              return line.length > 0;
            });

          if (lines.length === 0) {
            this._showMessage("CSV file is empty", "Error");
            return null;
          }

          var parsedData = [];
          var headers = [];

          // If delimiter not provided, detect from first line
          if (!delimiter) {
            // simple detection: check common delimiters outside quotes
            var firstLine = lines[0];
            var candidates = [",", ";", "|", "\t"];
            var scores = {};
            candidates.forEach(function (d) {
              scores[d] = 0;
            });
            var inQuotes = false;
            for (var i = 0; i < firstLine.length; i++) {
              var ch = firstLine[i];
              if (ch === '"') {
                inQuotes = !inQuotes;
              }
              if (!inQuotes && candidates.indexOf(ch) !== -1) {
                scores[ch]++;
              }
            }
            // choose delimiter with highest count
            delimiter = candidates[0];
            var best = -1;
            candidates.forEach(function (d) {
              if (scores[d] > best) {
                best = scores[d];
                delimiter = d;
              }
            });
          }

          // Parse each line (respecting delimiter)
          for (var r = 0; r < lines.length; r++) {
            var row = this._parseCSVLine(lines[r], delimiter);
            if (r === 0 && hasHeader) {
              headers = row.map(function (h) {
                return h && h.toString().trim();
              });
              continue;
            }

            if (hasHeader && row.length !== headers.length) {
              this._showMessage(
                "Row " + (r + 1) + ": Column count mismatch",
                "Error"
              );
              return null;
            }

            parsedData.push(row);
          }

          // If no header, create default headers
          if (!hasHeader && parsedData.length > 0) {
            headers = parsedData[0].map(function (_, index) {
              return "Column" + (index + 1);
            });
          }

          // Normalize headers for mapping
          var normalize = function (h) {
            if (!h) return "";
            return h.toString().trim().toLowerCase().replace(/\s+/g, " ");
          };

          var normalized = headers.map(normalize);

          // Map common Integration Suite / CSV names to expected fields
          var headerMap = {
            "account name": "customerName",
            opp_accountname: "customerName",
            accountname: "customerName",
            "erp cust number": "customerNumber",
            "erp cust no": "customerNumber",
            "product list": "emlaType",
            productlist: "emlaType",
            "emla staffing for btp": "btpOnbAdvNome",
            "btp onb advisor": "btpOnbAdvNome",
            "btp onb advisor email": "btpOnbAdvEmail",
            "btp onboard advisor email": "btpOnbAdvEmail",
            "emla staffing for sap cloud erp": "erpOnbAdvNome",
            "region lvl 1": "region",
            "region lvl 2": "region",
            "region l5/country": "country",
            "region l5/country": "country",
            "revenue start date": "startDate",
            "contract start date (line item)": "startDate",
            "contract start date": "startDate",
          };

          var expectedHeaders;
          if (csvType === "integration") {
            expectedHeaders = [
              "customerName",
              "customerNumber",
              "emlaType",
              "region",
              "country",
            ];
          } else if (csvType === "public") {
            expectedHeaders = ["customerName", "customerNumber", "emlaType"];
          } else {
            expectedHeaders = ["customerName", "customerNumber", "emlaType"];
          }

          // Build list of mapped headers present
          var mapped = normalized
            .map(function (h) {
              return (
                headerMap[h] || (expectedHeaders.indexOf(h) !== -1 ? h : null)
              );
            })
            .filter(function (x) {
              return x;
            });

          var missingHeaders = expectedHeaders.filter(function (h) {
            return mapped.indexOf(h) === -1;
          });

          if (missingHeaders.length > 0) {
            this._showMessage(
              "Missing required headers for " +
                csvType +
                " CSV: " +
                missingHeaders.join(", "),
              "Error"
            );
            return null;
          }

          return parsedData;
        } catch (error) {
          this._showMessage("CSV parsing error: " + error.message, "Error");
          return null;
        }
      },

      _parseCSVLine: function (line, delimiter) {
        var result = [];
        var current = "";
        var inQuotes = false;

        for (var i = 0; i < line.length; i++) {
          var ch = line[i];
          if (ch === '"') {
            // handle escaped quotes
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++; // skip escaped quote
            } else {
              inQuotes = !inQuotes;
            }
          } else if (ch === delimiter && !inQuotes) {
            result.push(current);
            current = "";
          } else {
            current += ch;
          }
        }
        result.push(current);
        return result;
      },

      _showMessage: function (sMessage, sType) {
        var oMessageStrip = this.byId("messageStrip");
        oMessageStrip.setText(sMessage);

        switch (sType) {
          case "Success":
            oMessageStrip.setType("Success");
            break;
          case "Error":
            oMessageStrip.setType("Error");
            break;
          case "Information":
          default:
            oMessageStrip.setType("Information");
            break;
        }

        oMessageStrip.setVisible(true);
      },
    });
  }
);
