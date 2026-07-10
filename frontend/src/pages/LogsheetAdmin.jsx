import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Check, AlertTriangle, Save, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

const CANONICAL_FIELDS = [
  "timestamp", "feed_pressure", "booster1_pressure_in", "booster1_pressure_out",
  "booster2_pressure_in", "booster2_pressure_out", "reject_pressure", "tmf_pressure_in",
  "tmf_pressure_out", "differential_pressure", "flow_rate", "reject_flow", "recovery_rate",
  "conductivity", "feed_conductivity", "permeate_conductivity_3rd", "tds", "salt_rejection",
  "pH", "permeate_pH", "turbidity", "vfd_rpm", "orp", "feed_tank_level", "valve_position",
  "temperature", "energy_kwh", "cip_active"
];

const LogsheetAdmin = () => {
  const [file, setFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [error, setError] = useState(null);
  const [mappings, setMappings] = useState({}); // { [blockIndex]: { [colIndex]: 'fieldName' } }
  const [facilityStageName, setFacilityStageName] = useState('custom_plant_stage1');
  const [successMsg, setSuccessMsg] = useState(null);
  
  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setParseResult(null);
      setError(null);
      setSuccessMsg(null);
    }
  };

  const handleParse = async () => {
    if (!file) return;
    setIsParsing(true);
    setError(null);
    setSuccessMsg(null);
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        const token = localStorage.getItem('dt_token');
        
        const res = await fetch('/api/logsheets/parse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ contentBase64: base64 })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Parse failed');
        
        setParseResult(data);
        
        // Initialize mappings state from suggestions
        const initialMappings = {};
        Object.values(data.sheets).forEach((sheet, sIdx) => {
          sheet.blocks.forEach((block, bIdx) => {
            if (!initialMappings[sIdx]) initialMappings[sIdx] = {};
            initialMappings[sIdx][bIdx] = {};
            block.columns.forEach((col, cIdx) => {
              initialMappings[sIdx][bIdx][cIdx] = col.suggestedField || '';
            });
          });
        });
        setMappings(initialMappings);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleMappingChange = (sIdx, bIdx, cIdx, val) => {
    setMappings(prev => ({
      ...prev,
      [sIdx]: {
        ...prev[sIdx],
        [bIdx]: {
          ...prev[sIdx][bIdx],
          [cIdx]: val === '' ? null : val
        }
      }
    }));
  };

  const handleConfirm = async (sheetName, sIdx, block, bIdx) => {
    setIsParsing(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        const token = localStorage.getItem('dt_token');
        
        // Prepare mapping array
        const colMapping = Object.keys(mappings[sIdx][bIdx])
          .sort((a,b) => Number(a) - Number(b))
          .map(k => mappings[sIdx][bIdx][k] || null);

        const res = await fetch('/api/logsheets/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            contentBase64: base64,
            sheetName,
            blockLabel: block.blockLabel,
            mapping: colMapping,
            facilityStageName: facilityStageName // used to save as generic json
          })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Confirm failed');
        
        setSuccessMsg(`Successfully confirmed mapping! Fingerprint: ${data.fingerprint}. Extracted ${data.rowCount} rows.`);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-theme-text flex items-center gap-2">
            <FileSpreadsheet className="text-blue-400" />
            Logsheet Parser Admin
          </h1>
          <p className="text-theme-muted mt-1">Upload a vendor logsheet to automatically detect its structure and map it to canonical telemetry fields.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-start gap-3">
          <AlertTriangle className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg flex items-start gap-3">
          <Check className="text-green-400 shrink-0 mt-0.5" />
          <p className="text-green-200 text-sm">{successMsg}</p>
        </div>
      )}

      <div className="bg-theme-panel border border-theme-border rounded-xl p-6">
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-theme-border rounded-xl p-10 hover:border-blue-500/50 transition-colors bg-black/10">
          <Upload className="w-10 h-10 text-theme-muted mb-4" />
          <p className="text-theme-text font-medium mb-1">Drag & drop an Excel file here</p>
          <p className="text-theme-muted text-sm mb-4">.xlsx, .xls</p>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            className="block w-full max-w-xs text-sm text-theme-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 cursor-pointer"
          />
        </div>
        
        {file && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleParse}
              disabled={isParsing}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium shadow-lg transition-colors"
            >
              {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Analyze Structure
            </button>
          </div>
        )}
      </div>

      {parseResult && (
        <div className="flex-1 overflow-y-auto space-y-6 pb-20">
          {Object.entries(parseResult.sheets).map(([sheetName, sheet], sIdx) => (
            <div key={sheetName} className="bg-theme-panel border border-theme-border rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-theme-border bg-black/20 flex justify-between items-center">
                <h3 className="font-semibold text-theme-text">Sheet: {sheetName}</h3>
                <span className="text-xs text-theme-muted">Data starts at row {sheet.dataStart + 1} | {sheet.isBlockSplit ? 'Multi-block detected' : 'Single block'}</span>
              </div>
              
              <div className="p-6 space-y-8">
                {sheet.blocks.map((block, bIdx) => (
                  <div key={bIdx} className="border border-theme-border/50 rounded-lg p-4 bg-black/10">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h4 className="font-medium text-theme-text">{block.blockLabel || '(Whole Sheet)'}</h4>
                        <div className="text-xs text-theme-muted mt-1">Fingerprint: {block.fingerprint}</div>
                      </div>
                      
                      {!block.needsReview ? (
                        <div className="flex items-center gap-2 text-green-400 bg-green-400/10 px-3 py-1.5 rounded-full text-xs font-medium border border-green-400/20">
                          <Check size={14} /> Already Mapped (Template matched)
                        </div>
                      ) : (
                        <div className="flex items-center gap-4">
                           <div className="flex items-center gap-2">
                             <label className="text-xs text-theme-muted">Target ID:</label>
                             <input 
                               type="text" 
                               value={facilityStageName}
                               onChange={(e) => setFacilityStageName(e.target.value)}
                               className="bg-black/20 border border-theme-border rounded px-2 py-1 text-sm text-theme-text focus:outline-none focus:border-blue-500 w-48"
                               placeholder="e.g. generic_plant_ro1"
                               title="This sets the filename for GlobalSyncManager (e.g. generic_plant_ro1.json)"
                             />
                           </div>
                           <button
                             onClick={() => handleConfirm(sheetName, sIdx, block, bIdx)}
                             disabled={isParsing}
                             className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded font-medium transition-colors text-sm"
                           >
                             {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                             Confirm Mapping
                           </button>
                        </div>
                      )}
                    </div>
                    
                    {block.needsReview && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-theme-muted uppercase bg-black/20">
                            <tr>
                              <th className="px-4 py-2 font-medium">Sheet Column</th>
                              <th className="px-4 py-2 font-medium">Original Header Text</th>
                              <th className="px-4 py-2 font-medium">Suggested Canonical Field</th>
                              <th className="px-4 py-2 font-medium">Confidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {block.columns.map((col, cIdx) => (
                              <tr key={cIdx} className="border-b border-theme-border/50 last:border-0 hover:bg-white/5">
                                <td className="px-4 py-2 text-theme-muted w-24">Col {col.sheetColumnIndex}</td>
                                <td className="px-4 py-2 text-theme-text font-mono text-xs">{col.rawLabel}</td>
                                <td className="px-4 py-2">
                                  <select
                                    value={mappings[sIdx]?.[bIdx]?.[cIdx] || ''}
                                    onChange={(e) => handleMappingChange(sIdx, bIdx, cIdx, e.target.value)}
                                    className="bg-black/40 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text focus:outline-none focus:border-blue-500 w-full"
                                  >
                                    <option value="">-- Ignore Column --</option>
                                    {CANONICAL_FIELDS.map(f => (
                                      <option key={f} value={f}>{f}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-4 py-2">
                                  {col.confidence > 0 ? (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                      col.confidence >= 70 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                    }`}>
                                      {col.confidence}%
                                    </span>
                                  ) : (
                                    <span className="text-theme-muted text-xs">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LogsheetAdmin;
