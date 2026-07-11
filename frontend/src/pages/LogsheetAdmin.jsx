import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Check, AlertTriangle, Save, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAppStore } from '../store/useAppStore';

const LogsheetAdmin = () => {
  const [file, setFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [sheetData, setSheetData] = useState(null); // { columns: [], rows: [], rawVal: [] }
  const [error, setError] = useState(null);
  const [plantId, setPlantId] = useState('custom_plant_stage1');
  const [successMsg, setSuccessMsg] = useState(null);
  const fileInputRef = useRef(null);
  
  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setSheetData(null);
      setError(null);
      setSuccessMsg(null);
      await parseDynamicWorkbook(selected);
    }
  };

  const parseDynamicWorkbook = (file) => {
    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        
        // Read raw data
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        
        // Find first row with data (headers)
        const headerRowIdx = raw.findIndex(r => r.some(cell => cell !== ''));
        if (headerRowIdx < 0) throw new Error('The spreadsheet appears to be empty.');
        
        const headerRow = raw[headerRowIdx] || [];
        const dataRows = raw.slice(headerRowIdx + 1).filter(r => r.some(cell => cell !== ''));
        
        const columns = headerRow.map((h, i) => {
            const label = String(h).trim() || `Column ${i+1}`;
            return { key: `col_${i}`, label };
        });

        if (columns.length === 0) throw new Error('No column headers found.');

        // Format time properly if it is Excel serial date
        const fmtTime = (rawVal) => {
          if (typeof rawVal === 'number' && rawVal < 1) {
            const totalMin = Math.round(rawVal * 1440);
            const h = Math.floor(totalMin / 60) % 24;
            const m = totalMin % 60;
            return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
          }
          return rawVal;
        };

        const rows = dataRows.map(r => {
          const obj = {};
          columns.forEach((col, i) => {
            const rawVal = r[i];
            if (rawVal === undefined || rawVal === '') {
              obj[col.label] = null; // using actual label instead of col_i for JSON upload
            } else if (col.label.toLowerCase().includes('time')) {
              obj[col.label] = fmtTime(rawVal);
            } else if (typeof rawVal === 'number') {
              obj[col.label] = rawVal;
            } else {
              const n = parseFloat(rawVal);
              obj[col.label] = isNaN(n) ? String(rawVal).trim() : n;
            }
          });
          return obj;
        });

        setSheetData({
          name: wsName,
          columns,
          rows
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setIsParsing(false);
      }
    };
    reader.onerror = () => {
      setError('File read error');
      setIsParsing(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSaveToDatabase = async () => {
    if (!sheetData) return;
    setIsParsing(true);
    setError(null);
    try {
      const payload = {
        plantId: plantId,
        fileName: file.name,
        rows: sheetData.rows
      };

      const res = await fetch('/api/training-data/upload-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      
      setSuccessMsg(`Successfully imported ${data.rows} rows to the ML Engine Database! (Dataset ID: ${data.id})`);
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
            Dynamic Logsheet Parser
          </h1>
          <p className="text-theme-muted mt-1">Upload any Excel design. It will automatically read all rows and columns exactly as they are.</p>
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

      {!sheetData && (
        <div className="bg-theme-panel border border-theme-border rounded-xl p-6">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-theme-border rounded-xl p-10 hover:border-blue-500/50 transition-colors bg-black/10">
            <Upload className="w-10 h-10 text-theme-muted mb-4" />
            <p className="text-theme-text font-medium mb-1">Drag & drop any Excel Logsheet here</p>
            <p className="text-theme-muted text-sm mb-4">.xlsx, .xls</p>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="block w-full max-w-xs text-sm text-theme-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 cursor-pointer"
            />
          </div>
        </div>
      )}

      {sheetData && (
        <div className="flex-1 flex flex-col bg-theme-panel border border-theme-border rounded-xl overflow-hidden shadow-2xl">
          {/* Header Bar */}
          <div className="px-6 py-4 border-b border-theme-border bg-black/40 flex justify-between items-center backdrop-blur-md">
            <div>
              <h3 className="font-semibold text-theme-text text-lg">{file?.name}</h3>
              <span className="text-xs text-theme-muted">Sheet: {sheetData.name} • {sheetData.rows.length} rows detected</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-theme-muted uppercase font-semibold">Target Plant ID:</label>
                <input 
                  type="text" 
                  value={plantId}
                  onChange={(e) => setPlantId(e.target.value)}
                  className="bg-black/30 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-48"
                  placeholder="e.g. custom_plant_stage1"
                />
              </div>
              <button
                onClick={handleSaveToDatabase}
                disabled={isParsing}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-lg font-medium shadow-lg hover:shadow-blue-500/25 transition-all"
              >
                {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save to Database
              </button>
              <button
                onClick={() => {
                  setSheetData(null);
                  setFile(null);
                  if(fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-4 py-2 bg-theme-border/50 hover:bg-theme-border/80 text-theme-text rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
          
          {/* Spreadsheet View */}
          <div className="flex-1 overflow-auto bg-[#0a0a0a] p-4">
            <div className="inline-block min-w-full align-middle border border-theme-border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-theme-border/50">
                <thead className="bg-[#1a1a1a]">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-theme-muted border-r border-theme-border/50 w-12 text-center">#</th>
                    {sheetData.columns.map((col, i) => (
                      <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider border-r border-theme-border/50 last:border-0 whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border/30 bg-[#111]">
                  {sheetData.rows.slice(0, 100).map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-white/5 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-theme-muted border-r border-theme-border/50 text-center bg-[#1a1a1a]">
                        {rIdx + 1}
                      </td>
                      {sheetData.columns.map((col) => {
                        const val = row[col.label];
                        return (
                          <td key={col.key} className="px-4 py-2 whitespace-nowrap text-sm text-gray-300 border-r border-theme-border/50 last:border-0">
                            {val !== null ? String(val) : <span className="text-gray-600">-</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {sheetData.rows.length > 100 && (
                <div className="p-3 text-center text-xs text-theme-muted bg-[#1a1a1a] border-t border-theme-border/50">
                  Showing first 100 of {sheetData.rows.length} rows
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogsheetAdmin;
