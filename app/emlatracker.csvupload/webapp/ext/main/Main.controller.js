sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageBox"
], function (Controller, MessageBox) {
  "use strict";

  return Controller.extend("emlatracker.csvupload.ext.main.Main", {
    onInit: function () {
      this._selectedFile = null;
      this._updateUploadButtonState();
    },

    onFileChange: function (oEvent) {
      var oFile = oEvent.getParameter("files") && oEvent.getParameter("files")[0];
      this._selectedFile = oFile || null;
      if (oFile) this._showMessage("File selected: " + oFile.name, "Information");
      this._updateUploadButtonState();
    },

    onCsvTypeChange: function () { this._updateUploadButtonState(); },

    _updateUploadButtonState: function () {
      var rb = this.byId("csvTypeRadio");
      var hasType = rb && typeof rb.getSelectedIndex === "function" && rb.getSelectedIndex() !== -1;
      this.byId("uploadButton").setEnabled(!!this._selectedFile && hasType);
    },

    onUploadPress: function () {
      if (!this._selectedFile) { this._showMessage("Please select a CSV file first.", "Error"); return; }
      var rb = this.byId("csvTypeRadio");
      var idx = rb && typeof rb.getSelectedIndex === "function" ? rb.getSelectedIndex() : -1;
      var csvType = idx === 0 ? "integration" : idx === 1 ? "public" : null;
      if (!csvType) { this._showMessage("Please choose a CSV type", "Error"); return; }
      var that = this; var reader = new FileReader();
      reader.onload = function (e) { that.byId("uploadButton").setEnabled(false); that._uploadViaHTTP(e.target.result, csvType); };
      reader.onerror = function (e) { console.error("File read error", e); that._showMessage("Failed to read file", "Error"); };
      reader.readAsText(this._selectedFile, "UTF-8");
    },

    // Upload function (quote-aware splitting + size constrained direct action calls)
    _uploadViaHTTP: function (csvText, csvType) {
      var oModel = this.getView().getModel();
      if (!oModel) return Promise.reject(new Error("No OData model"));
      var that = this;

      function smartSplitLines(text){ var out=[],cur='',q=false; for(var i=0;i<text.length;i++){ var ch=text[i]; if(ch==='"'){ if(q && i+1<text.length && text[i+1]==='"'){ cur+='"'; i++; continue;} q=!q; cur+=ch; continue;} if(!q && (ch==='\n'||ch==='\r')){ if(ch==='\r' && i+1<text.length && text[i+1]==='\n'){/*skip*/} if(cur.trim().length>0) out.push(cur); cur=''; continue;} cur+=ch;} if(cur.trim().length>0) out.push(cur); return out; }
      var lines = smartSplitLines(csvText); if(lines.length===0){ that._showMessage("CSV file is empty","Error"); return Promise.reject(new Error("Empty")); }
      var header = lines[0]; var dataLines = lines.slice(1); var totalRows=dataLines.length;

      var MAX_BATCH_BYTES=90000, MAX_ROWS_PER_BATCH=250;
      function buildBatches(h, rows){ var batches=[],cur=[],base=h.length+1,size=base; for(var i=0;i<rows.length;i++){ var l=rows[i], ls=l.length+1; if(cur.length>0 && (size+ls>MAX_BATCH_BYTES || cur.length>=MAX_ROWS_PER_BATCH)){ batches.push(h+'\n'+cur.join('\n')); cur=[]; size=base; } if(ls+base>MAX_BATCH_BYTES && cur.length===0){ batches.push(h+'\n'+l); continue;} cur.push(l); size+=ls; } if(cur.length>0) batches.push(h+'\n'+cur.join('\n')); return batches; }
      var batches = buildBatches(header, dataLines);
      batches.forEach(function(b,i){ console.log('Prepared batch', i+1,'/',batches.length,'size='+b.length+' bytes'); });
      that._showMessage('Processing '+ totalRows +' rows in '+ batches.length +' batches...', 'Information');
  var allResults={ inserted:0, updated:0, updateErrors:0, errors:[], failedRowsCsv:'', skippedNoAdvisor:0, validationErrors:0, dbErrors:0, advisorUnresolved:0 }; var currentBatch=0;
  function processBatch(idx){ if(idx>=batches.length){ that._handleUploadResponse(allResults); return Promise.resolve(allResults);} currentBatch=idx+1; that._showMessage('Batch '+currentBatch+' of '+batches.length+' - uploading...','Information'); return new Promise(function(res,rej){ try{ var act=oModel.bindContext('/uploadCSV(...)',undefined,{groupId:'$direct'}); act.setParameter('csvData', batches[idx]); if(csvType) act.setParameter('csvType', csvType); act.execute().then(function(){ try{ var o=act.getBoundContext().getObject(); var d; if(o && typeof o.value==='string'){ try{ d=JSON.parse(o.value);}catch(e){ d={message:o.value,inserted:0,errors:[]}; } } else if(o && o.value){ d=o.value; } else { d=o; } allResults.inserted+=d.inserted||0; allResults.updated+=d.updated||0; allResults.updateErrors+=d.updateErrors||0; allResults.skippedNoAdvisor += d.skippedNoAdvisor || 0; allResults.validationErrors += d.validationErrors || 0; allResults.dbErrors += d.dbErrors || 0; allResults.advisorUnresolved += d.advisorNotFoundCount || 0; if(d.errors&&d.errors.length) allResults.errors=allResults.errors.concat(d.errors); if(d.failedRowsCsv) allResults.failedRowsCsv+=d.failedRowsCsv+'\n'; res(); }catch(e){ console.error('Parse response error',e); rej(e);} }).catch(function(err){ console.error('Action error batch '+currentBatch, err); rej(err); }); }catch(e){ console.error('Config action error',e); rej(e);} }).then(function(){ return processBatch(idx+1); }); }
      return processBatch(0).catch(function(err){ var msg='Upload failed'; if(err&&err.message) msg+=': '+err.message; that._showMessage(msg,'Error'); if(allResults.inserted>0||allResults.errors.length>0) that._handleUploadResponse(allResults); return Promise.reject(err); });
    },

    _handleUploadResponse: function (data) {
  var inserted = (data && (data.inserted||data.insertedCount||0))||0;
  var updated = (data && data.updated) || 0;
  var updateErrors = (data && data.updateErrors) || 0;
  var errors = (data && data.errors)||[]; var failedCsv=data && data.failedRowsCsv; var skipped=data && data.skippedNoAdvisor || 0; var unresolved=data && (data.advisorUnresolved || data.advisorNotFoundCount) || 0;
  this._showMessage('Upload finished. Inserted: '+inserted+', Updated: '+updated+', Errors: '+errors.length + (skipped? ', Skipped (no advisor): '+skipped:'') + (unresolved? ', Advisor unresolved: '+unresolved:'') + (updateErrors? ', UpdateErrors: '+updateErrors:''),'Success');
      var that=this;
      // Build summary content
      var summaryItems=[
        new sap.m.Text({text:'Inserted: '+ inserted}),
        new sap.m.Text({text:'Updated: '+ updated}),
        new sap.m.Text({text:'Errors: '+ errors.length}),
        updateErrors? new sap.m.Text({text:'Update Errors: '+ updateErrors}): null,
        skipped? new sap.m.Text({text:'Skipped (no advisor): '+ skipped}): null,
        unresolved? new sap.m.Text({text:'Advisor Unresolved: '+ unresolved}): null
      ].filter(Boolean);
      if(errors.length===0){ summaryItems.push(new sap.m.Text({text:'No errors encountered.'})); }
      var oSummary=new sap.m.VBox({items:summaryItems});
      var oTable=null;
      if(errors.length){
        oTable=new sap.m.Table({
          headerText:'Error Details',
          columns:[
            new sap.m.Column({header:new sap.m.Label({text:'Row'})}),
            new sap.m.Column({header:new sap.m.Label({text:'Reason'})}),
            new sap.m.Column({header:new sap.m.Label({text:'Raw'})})
          ]
        });
        errors.forEach(function(er){
          var raw=''; try{ raw=er.raw? JSON.stringify(er.raw): (er.record? JSON.stringify(er.record):''); }catch(e){ raw=''; }
          oTable.addItem(new sap.m.ColumnListItem({cells:[
            new sap.m.Text({text: er.row!=null? er.row: ''}),
            new sap.m.Text({text: er.reason || er.__dbError || ''}),
            new sap.m.Text({text: raw})
          ]}));
        });
      }
      var content=[oSummary]; if(oTable) content.push(oTable);
      var oDialog=new sap.m.Dialog({
        title:'Upload Result',
        contentWidth:'70%',
        content: content,
        beginButton: new sap.m.Button({text:'Close', press:function(){ oDialog.close(); }}),
        endButton: new sap.m.Button({text:'Download Errors', type:'Emphasized', press:function(){
          if(!errors.length){ that._showMessage('No errors to download','Information'); return; }
          var exportCsv='';
          if(failedCsv){ exportCsv=failedCsv; }
          else {
            exportCsv='row,reason,raw\n';
            errors.forEach(function(er){ var raw=''; try{ raw=er.raw? JSON.stringify(er.raw): (er.record? JSON.stringify(er.record):''); }catch(e){ raw=''; }
              exportCsv += (er.row||'')+','+ '"'+ (er.reason||er.__dbError||'').replace(/"/g,'""') +'"'+','+'"'+ raw.replace(/"/g,'""') +'"'+'\n'; });
          }
          var blob=new Blob([exportCsv],{type:'text/csv;charset=utf-8;'}); var url=URL.createObjectURL(blob); var a=document.createElement('a'); a.href=url; a.download='upload-errors.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        }}),
        afterClose:function(){ oDialog.destroy(); }
      });
      oDialog.open();
    },

    _showMessage: function (sMessage, sType) {
      var strip=this.byId('messageStrip'); if(!strip) return; strip.setText(sMessage); strip.setType(sType||'Information'); strip.setVisible(true);
    }
  });
});
