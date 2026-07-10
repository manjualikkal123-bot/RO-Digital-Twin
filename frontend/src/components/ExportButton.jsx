/**
 * ExportButton.jsx
 * 
 * A reusable "Export to Excel" button with a date-range picker popup.
 * Drop this onto any page and pass the relevant data.
 * 
 * Usage:
 * <ExportButton
 * plantName="JETL — Jeedimetla ETP"
 * filename="JETL_Performance"
 * telemetryHistory={telemetryHistory}
 * alarms={alarms}
 * limits={config?.limits}
 * />
 */
import React, { useState, useRef, useEffect } from 'react';
import { Download, Calendar, X, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import {
 exportToExcel,
 buildSensorSheet,
 buildKPISheet,
 buildComplianceSheet,
 buildAlarmSheet,
 buildFinancialSheet,
} from '../utils/exportToExcel';

const SHEET_OPTIONS = [
 { key: 'sensor', label: 'Sensor Readings', desc: 'pH, EC, pressure, flow — raw values' },
 { key: 'kpi', label: 'KPI Summary', desc: 'Daily averages — recovery, SEC, flux' },
 { key: 'compliance', label: 'PCB Compliance', desc: 'Parameter vs limit, pass/fail per reading' },
 { key: 'alarms', label: 'Alarm History', desc: 'All events, severity, root cause' },
 { key: 'financial', label: 'Financial / OPEX', desc: 'Energy cost per m³' },
];

export default function ExportButton({ plantName, filename, telemetryHistory = [], alarms = [], limits = {} }) {
 const [open, setOpen] = useState(false);
 const [dateFrom, setDateFrom] = useState('');
 const [dateTo, setDateTo] = useState('');
 const [selected, setSelected] = useState(['sensor', 'kpi', 'compliance', 'alarms', 'financial']);
 const [exporting, setExporting] = useState(false);
 const [done, setDone] = useState(false);
 const panelRef = useRef(null);

 // Default date range: last 7 days
 useEffect(() => {
 const to = new Date();
 const from = new Date();
 from.setDate(from.getDate() - 7);
 setDateTo(to.toISOString().slice(0, 10));
 setDateFrom(from.toISOString().slice(0, 10));
 }, []);

 // Close on outside click
 useEffect(() => {
 const handler = (e) => {
 if (open && panelRef.current && !panelRef.current.contains(e.target)) {
 setOpen(false);
 setDone(false);
 }
 };
 document.addEventListener('mousedown', handler);
 return () => document.removeEventListener('mousedown', handler);
 }, [open]);

 const toggleSheet = (key) => {
 setSelected(prev =>
 prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
 );
 };

 const handleExport = () => {
 setExporting(true);

 const sheets = [];
 if (selected.includes('sensor')) sheets.push(buildSensorSheet(telemetryHistory, dateFrom, dateTo));
 if (selected.includes('kpi')) sheets.push(buildKPISheet(telemetryHistory));
 if (selected.includes('compliance')) sheets.push(buildComplianceSheet(telemetryHistory, limits));
 if (selected.includes('alarms')) sheets.push(buildAlarmSheet(alarms, dateFrom, dateTo));
 if (selected.includes('financial')) sheets.push(buildFinancialSheet(telemetryHistory));

 if (sheets.length === 0) {
 setExporting(false);
 return;
 }

 setTimeout(() => {
 exportToExcel({
 filename: filename || 'Permionics_Export',
 plantName,
 dateFrom,
 dateTo,
 sheets,
 });
 setExporting(false);
 setDone(true);
 setTimeout(() => setDone(false), 3000);
 }, 300);
 };

 return (
 <div className="relative" ref={panelRef}>
 {/* Trigger Button */}
 <button
 onClick={() => { setOpen(prev => !prev); setDone(false); }}
 className="flex items-center gap-2 px-4 py-2 bg-transparent hover:bg-slate-100 dark:bg-slate-800 border border-theme-border hover:border-slate-500 text-theme-text font-bold text-xs rounded-lg transition-all"
 >
 <Download size={14} />
 Export Excel
 </button>

 {/* Dropdown Panel */}
 {open && (
 <div className="absolute right-0 top-full mt-2 w-80 bg-theme-panel border border-theme-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2 duration-150 premium-card">
 
 {/* Header */}
 <div className="flex items-center justify-between px-4 py-3 bg-[#0a1020] border-b border-theme-border">
 <div className="flex items-center gap-2">
 <FileSpreadsheet size={14} className="text-emerald-700 dark:text-emerald-400" />
 <span className="text-sm font-bold text-theme-text">Export to Excel</span>
 </div>
 <button onClick={() => setOpen(false)} className="text-theme-muted hover:text-theme-text transition-colors">
 <X size={14} />
 </button>
 </div>

 <div className="p-4 flex flex-col gap-4">

 {/* Plant info */}
 <div className="text-[10px] text-theme-muted uppercase tracking-widest">
 Plant: <span className="text-theme-text normal-case font-bold">{plantName}</span>
 </div>

 {/* Date Range */}
 <div className="flex flex-col gap-2">
 <div className="flex items-center gap-1 text-[10px] text-theme-muted uppercase font-bold tracking-widest">
 <Calendar size={10} /> Date Range
 </div>
 <div className="flex gap-2">
 <div className="flex-1">
 <label className="text-[10px] text-theme-muted mb-1 block">From</label>
 <input
 type="date"
 value={dateFrom}
 onChange={e => setDateFrom(e.target.value)}
 className="w-full bg-theme-panel border border-theme-border text-theme-text px-2 py-1.5 rounded text-xs focus:outline-none focus:border-emerald-500"
 />
 </div>
 <div className="flex-1">
 <label className="text-[10px] text-theme-muted mb-1 block">To</label>
 <input
 type="date"
 value={dateTo}
 onChange={e => setDateTo(e.target.value)}
 className="w-full bg-theme-panel border border-theme-border text-theme-text px-2 py-1.5 rounded text-xs focus:outline-none focus:border-emerald-500"
 />
 </div>
 </div>
 </div>

 {/* Sheet Selection */}
 <div className="flex flex-col gap-1.5">
 <div className="text-[10px] text-theme-muted uppercase font-bold tracking-widest mb-1">Include Sheets</div>
 {SHEET_OPTIONS.map(opt => (
 <label key={opt.key} className="flex items-start gap-2.5 cursor-pointer group">
 <div
 onClick={() => toggleSheet(opt.key)}
 className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
 selected.includes(opt.key)
 ? 'bg-emerald-600 border-emerald-500'
 : 'bg-transparent border-slate-300 dark:border-slate-600 group-hover:border-slate-400'
 }`}
 >
 {selected.includes(opt.key) && (
 <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
 <path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
 </svg>
 )}
 </div>
 <div onClick={() => toggleSheet(opt.key)} className="flex flex-col">
 <span className="text-xs text-theme-text font-medium group-hover:text-theme-text transition-colors">{opt.label}</span>
 <span className="text-[10px] text-theme-muted">{opt.desc}</span>
 </div>
 </label>
 ))}
 </div>

 {/* Export Button */}
 {done ? (
 <div className="flex items-center justify-center gap-2 py-2 text-emerald-700 dark:text-emerald-400 text-sm font-bold">
 <CheckCircle2 size={16} /> Downloaded successfully!
 </div>
 ) : (
 <button
 onClick={handleExport}
 disabled={exporting || selected.length === 0}
 className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-theme-muted text-theme-text font-bold text-sm rounded-lg transition-colors"
 >
 {exporting ? (
 <>
 <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
 Generating...
 </>
 ) : (
 <>
 <Download size={14} />
 Download {selected.length} Sheet{selected.length !== 1 ? 's' : ''}
 </>
 )}
 </button>
 )}

 <p className="text-[10px] text-theme-muted text-center">
 File saves to your Downloads folder as .xlsx
 </p>
 </div>
 </div>
 )}
 </div>
 );
}
