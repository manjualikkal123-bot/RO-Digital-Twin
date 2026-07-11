import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';

const SmartUploader = ({ onUploadComplete, plantId = 'generic_plant' }) => {
  const [file, setFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setError(null);
      setPreview(null);
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
        
        // Read directly as array of objects
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
        
        if (raw.length === 0) throw new Error('The spreadsheet appears to be empty.');
        
        // Extract columns from the keys of the first row
        const columns = Object.keys(raw[0]).map((k) => ({ key: k, label: k }));
        
        setPreview({ columns, rows: raw });
      } catch (err) {
        setError(err.message);
      } finally {
        setIsParsing(false);
      }
    };
    reader.onerror = () => {
      setError("Failed to read file.");
      setIsParsing(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleUpload = () => {
    if (onUploadComplete && preview) {
      onUploadComplete(preview.rows, file.name);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-start gap-3">
          <AlertTriangle className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      {!preview ? (
        <div className="bg-theme-panel border border-theme-border rounded-xl p-6">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-theme-border rounded-xl p-10 hover:border-blue-500/50 transition-colors bg-black/10">
            <Upload className="w-10 h-10 text-theme-muted mb-4" />
            <p className="text-theme-text font-medium mb-1">Drag & drop ANY logsheet here</p>
            <p className="text-theme-muted text-sm mb-4">No specific template required (.xlsx, .csv)</p>
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="block w-full max-w-xs text-sm text-theme-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 cursor-pointer"
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col space-y-6">
          <div className="flex justify-between items-center bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl">
            <div>
              <h3 className="font-bold text-blue-100 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-400" />
                Sheet Parsed Automatically
              </h3>
              <p className="text-blue-200/70 text-sm mt-1">Found {preview.columns.length} columns and {preview.rows.length} rows.</p>
            </div>
            <button
              onClick={handleUpload}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg transition-colors"
            >
              Upload Data
            </button>
          </div>

          <div className="bg-theme-panel border border-theme-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs text-theme-muted uppercase bg-black/40 sticky top-0 z-10">
                  <tr>
                    {preview.columns.map(col => (
                      <th key={col.key} className="px-4 py-3 font-medium border-b border-theme-border/50">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 10).map((row, rIdx) => (
                    <tr key={rIdx} className="border-b border-theme-border/50 hover:bg-white/5">
                      {preview.columns.map(col => (
                        <td key={col.key} className="px-4 py-2 text-theme-text/80">{String(row[col.key] || '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rows.length > 10 && (
              <div className="p-3 text-center text-xs text-theme-muted border-t border-theme-border bg-black/20">
                Showing first 10 of {preview.rows.length} rows...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartUploader;