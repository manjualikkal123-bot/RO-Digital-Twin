import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import logsheetData from '../data/logsheets.json';
import * as XLSX from 'xlsx';
import {
  BookOpen, ArrowUpRight, ArrowDownRight, Minus,
  TrendingUp, Download, Activity, Info,
  Upload, Trash2, FileSpreadsheet, CheckCircle2,
  AlertCircle, X, Plus, HelpCircle
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';

// ─── Constants ─────────────────────────────────────────────────────────────────
const LS_KEY = 'dt_uploaded_logsheets';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (v) => (v == null ? '—' : v);

const LIVE_FIELD_MAP = {
  feedPump: 'feed_pressure', conductivity: 'conductivity',
  pH: 'ph', totalPermeate: 'permeate_flow',
  reject: 'reject_flow', permeate: 'permeate_flow',
  memb1IL: null, memb1OL: null,
};

function DeltaBadge({ baseline, live }) {
  if (live == null || baseline == null || typeof baseline !== 'number') return null;
  const diff = live - baseline;
  const pct  = baseline !== 0 ? ((diff / baseline) * 100).toFixed(1) : null;
  if (Math.abs(diff) < 0.05) return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-slate-500 dark:text-slate-400 ml-1">
      <Minus size={8} /> SAME
    </span>
  );
  const up = diff > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold ml-1 ${up ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
      {up ? <ArrowUpRight size={8}/> : <ArrowDownRight size={8}/>}
      {pct != null ? `${up?'+':''}${pct}%` : `${up?'+':''}${diff.toFixed(1)}`}
    </span>
  );
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-theme-panel border border-theme-border rounded-lg p-3 shadow-xl text-xs">
      <p className="font-bold text-theme-text mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-theme-muted">{p.name}:</span>
          <span className="font-bold text-theme-text">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Parse uploaded file into a sheet object ───────────────────────────────────
function parseWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb   = XLSX.read(e.target.result, { type: 'array' });
        const wsName = wb.SheetNames[0];
        const ws   = wb.Sheets[wsName];
        const raw  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Find first row where col-0 looks like a time (HH:MM)
        const timeRowIdx = raw.findIndex(r =>
          r.length > 1 && typeof r[0] === 'string' && /^\d{1,2}:\d{2}/.test(String(r[0]).trim())
        );

        if (timeRowIdx < 0) {
          reject(new Error('Could not find time rows. Make sure column A has times like "10:00", "11:00" etc.'));
          return;
        }

        // Header is the row just before data rows
        const headerRow = raw[timeRowIdx - 1] || [];
        const dataRows  = raw.slice(timeRowIdx).filter(r =>
          r.length > 1 && typeof r[0] === 'string' && /^\d{1,2}:\d{2}/.test(String(r[0]).trim())
        );

        const columns = headerRow.map((h, i) => ({
          key:   i === 0 ? 'time' : `col_${i}`,
          label: String(h).trim() || `Col ${i+1}`,
          unit:  '',
        }));

        // ensure first col is "time"
        if (columns.length === 0) {
          reject(new Error('No column headers found in the row above the data.'));
          return;
        }
        columns[0] = { key: 'time', label: 'Time', unit: '' };

        // Safe time formatter — XLSX.SSF was removed from the default SheetJS bundle in v0.18+
        const fmtTime = (raw) => {
          if (typeof raw === 'number') {
            // Excel serial fraction → HH:MM
            const totalMin = Math.round(raw * 1440);
            const h = Math.floor(totalMin / 60) % 24;
            const m = totalMin % 60;
            return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
          }
          return String(raw).trim();
        };

        const rows = dataRows.map(r => {
          const obj = {};
          columns.forEach((col, i) => {
            const rawVal = r[i];
            if (i === 0) {
              obj[col.key] = fmtTime(rawVal);
            } else {
              const n = parseFloat(rawVal);
              obj[col.key] = isNaN(n) ? (rawVal === '' ? null : String(rawVal)) : n;
            }
          });
          return obj;
        });

        const sheet = {
          id:      `upload_${Date.now()}`,
          system:  wsName,
          date:    new Date().toISOString().slice(0, 10),
          label:   `${file.name.replace(/\.[^.]+$/, '')} — ${wsName}`,
          source:  'Uploaded by operator',
          note:    `Uploaded ${new Date().toLocaleString('en-IN')}`,
          columnGroups: [{ label: wsName, span: columns.length - 1 }],
          columns,
          rows,
          uploaded: true,
        };

        resolve(sheet);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Load / Save from localStorage ────────────────────────────────────────────
function loadSaved() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
  catch { return []; }
}
function saveTo(sheets) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(sheets)); } catch {}
}

// ─── Upload Zone Component ─────────────────────────────────────────────────────
function UploadZone({ onUpload }) {
  const inputRef    = useRef(null);
  const [drag, setDrag]       = useState(false);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState(null);
  const [success, setSuccess] = useState(null);

  const handle = useCallback(async (files) => {
    if (!files?.length) return;
    const file = files[0];
    const ext  = file.name.split('.').pop().toLowerCase();
    if (!['xls','xlsx','csv'].includes(ext)) {
      setError('Only .xls, .xlsx or .csv files are accepted.');
      // reset so the same file can be tried again after correction
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setBusy(true); setError(null); setSuccess(null);
    try {
      const sheet = await parseWorkbook(file);
      onUpload(sheet);
      setSuccess(`"${sheet.label}" — ${sheet.rows.length} rows imported ✓`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      // always reset so the same file can be re-uploaded if needed
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [onUpload]);

  // Hidden input sits OUTSIDE the clickable zone so its events
  // never bubble back up and cause a double-trigger loop.
  return (
    <div className="bg-theme-panel border border-theme-border rounded-xl overflow-hidden premium-card">
      {/* Hidden file input — lives outside the drop zone div */}
      <input
        ref={inputRef}
        type="file"
        accept=".xls,.xlsx,.csv"
        style={{ display: 'none' }}
        onChange={e => { handle(e.target.files); }}
      />

      {/* Header */}
      <div className="px-4 py-3 border-b border-theme-border flex items-center gap-2">
        <Upload size={14} className="text-theme-accent" />
        <span className="text-sm font-bold text-theme-text">Upload New Logsheet</span>
        <span className="text-[9px] ml-auto px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-theme-muted font-bold">
          .xlsx · .xls · .csv
        </span>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* Drop zone — click triggers inputRef.current.click() */}
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={e => { e.preventDefault(); setDrag(false); }}
          onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}
          onClick={() => { if (!busy) inputRef.current?.click(); }}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer select-none transition-all ${
            drag
              ? 'border-theme-accent bg-theme-accent/5 scale-[1.01]'
              : busy
              ? 'border-theme-accent/40 bg-theme-accent/3 cursor-wait'
              : 'border-theme-border hover:border-theme-accent/60 hover:bg-slate-50 dark:hover:bg-white/3'
          }`}
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
            drag ? 'bg-theme-accent/20 scale-110' : 'bg-slate-100 dark:bg-slate-800'
          }`}>
            {busy
              ? <div className="w-5 h-5 border-2 border-theme-accent border-t-transparent rounded-full animate-spin" />
              : <FileSpreadsheet size={22} className={drag ? 'text-theme-accent' : 'text-theme-muted'} />
            }
          </div>
          <div className="text-center pointer-events-none">
            <p className="text-sm font-bold text-theme-text">
              {busy ? 'Parsing file…' : drag ? 'Drop to upload' : 'Drag & drop or click to browse'}
            </p>
            <p className="text-[11px] text-theme-muted mt-1">
              Supports Excel (.xlsx / .xls) and CSV
            </p>
          </div>
        </div>

        {/* Format guide */}
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-3 flex gap-2">
          <HelpCircle size={13} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-900 dark:text-amber-300 leading-relaxed font-medium">
            <span className="font-black">Expected format:</span> Column headers in the row above data.
            First column must have times like{' '}
            <code className="bg-amber-200/60 dark:bg-amber-800/40 px-1 rounded">10:00</code>,{' '}
            <code className="bg-amber-200/60 dark:bg-amber-800/40 px-1 rounded">11:00</code> etc.
            Data is stored in your browser only — nothing is sent to a server.
          </div>
        </div>

        {/* Status messages */}
        {success && (
          <div className="flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg px-3 py-2 font-medium">
            <CheckCircle2 size={13} className="shrink-0" />
            {success}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-[11px] text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-500/20 rounded-lg px-3 py-2 font-medium">
            <AlertCircle size={13} className="shrink-0" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function HistoricalLogsheetViewer() {
  const { telemetry, fullHistoricalDataset, selectedFacility } = useAppStore();
  const navigate = useNavigate();

  const [uploadedSheets, setUploadedSheets] = useState(() => loadSaved());
  const [activeSheetId, setActiveSheetId]   = useState(null);
  const [trendKey, setTrendKey]             = useState(null);

  const nandesariSheet = useMemo(() => {
    if (selectedFacility !== 'nia_nandesari' || !fullHistoricalDataset || !fullHistoricalDataset.length) return null;
    
    const rows = fullHistoricalDataset.map(r => {
      const timeStr = r.timestamp ? r.timestamp.split('T')[1].slice(0,5) : '';
      return {
        time: timeStr,
        feed_pressure: r.stages?.HPA1?.feed_pressure,
        reject_pressure: r.stages?.HPA1?.reject_pressure,
        flow_rate: r.stages?.HPA1?.flow_rate,
        reject_flow: r.stages?.HPA1?.reject_flow,
        differential_pressure: r.stages?.HPA1?.differential_pressure,
        pH: r.stages?.HPA1?.pH,
        turbidity: r.stages?.HPA1?.turbidity,
        vfd_rpm: r.stages?.HPA1?.vfd_rpm,
      }
    });

    return {
      id: 'auto_nandesari',
      system: 'Nandesari HPA1',
      date: fullHistoricalDataset[0]?.timestamp || new Date().toISOString(),
      label: 'Nandesari Auto-Loaded',
      source: 'Backend Sync',
      note: 'Auto-populated from active data stream',
      columns: [
        { key: 'time', label: 'Time', unit: '' },
        { key: 'feed_pressure', label: 'Feed Press', unit: 'bar' },
        { key: 'reject_pressure', label: 'Reject Press', unit: 'bar' },
        { key: 'differential_pressure', label: 'Delta P', unit: 'bar' },
        { key: 'flow_rate', label: 'Permeate Flow', unit: 'm3/h' },
        { key: 'reject_flow', label: 'Reject Flow', unit: 'm3/h' },
        { key: 'pH', label: 'pH', unit: '' },
        { key: 'turbidity', label: 'Turbidity', unit: 'NTU' },
        { key: 'vfd_rpm', label: 'VFD RPM', unit: 'rpm' }
      ],
      rows
    };
  }, [selectedFacility, fullHistoricalDataset]);

  const allSheets = useMemo(() => {
    const base = nandesariSheet ? [nandesariSheet] : logsheetData.logsheets;
    return [...base, ...uploadedSheets];
  }, [uploadedSheets, nandesariSheet]);

  const sheet = useMemo(
    () => allSheets.find(s => s.id === activeSheetId) || allSheets[0],
    [activeSheetId, allSheets]
  );

  // Summary stats per column
  const stats = useMemo(() => {
    if (!sheet) return {};
    const result = {};
    sheet.columns.forEach(col => {
      if (col.key === 'time') return;
      const vals = sheet.rows.map(r => r[col.key]).filter(v => typeof v === 'number');
      if (!vals.length) return;
      result[col.key] = {
        min: Math.min(...vals),
        max: Math.max(...vals),
        avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      };
    });
    return result;
  }, [sheet]);

  // Live telemetry crosswalk
  const LIVE_MAP = useMemo(() => {
    if (!telemetry) return {};
    return {
      feedPump:      telemetry.feed_pressure,
      conductivity:  telemetry.conductivity,
      pH:            telemetry.ph,
      totalPermeate: telemetry.permeate_flow,
      reject:        telemetry.reject_flow,
      permeate:      telemetry.permeate_flow,
    };
  }, [telemetry]);

  // Chart data
  const chartData = useMemo(() => {
    if (!trendKey || !sheet) return [];
    return sheet.rows.map(r => ({ time: r.time, value: r[trendKey] }));
  }, [trendKey, sheet]);

  const activeTrendCol = sheet?.columns.find(c => c.key === trendKey);

  // Upload handler
  const handleUpload = useCallback((newSheet) => {
    setUploadedSheets(prev => {
      const next = [...prev, newSheet];
      saveTo(next);
      return next;
    });
    setActiveSheetId(newSheet.id);
    setShowUpload(false);
  }, []);

  // Delete uploaded sheet
  const handleDelete = useCallback((id) => {
    setUploadedSheets(prev => {
      const next = prev.filter(s => s.id !== id);
      saveTo(next);
      return next;
    });
    if (activeSheetId === id) setActiveSheetId(logsheetData.logsheets[0].id);
  }, [activeSheetId]);

  // Cell highlight
  const cellClass = (key, val) => {
    if (typeof val !== 'number') return 'text-theme-muted';
    if (key === 'pH' && (val < 6.5 || val > 8.5)) return 'text-amber-700 dark:text-amber-400 font-bold';
    if (key === 'permeateCond' && val > 200) return 'text-rose-600 dark:text-rose-400 font-bold';
    if (key === 'conductivity' && val > 4000) return 'text-amber-700 dark:text-amber-400 font-bold';
    return 'text-theme-text';
  };

  // CSV export
  const exportCSV = () => {
    if (!sheet) return;
    const header = sheet.columns.map(c => `${c.label}${c.unit ? ' ('+c.unit+')' : ''}`).join(',');
    const rows   = sheet.rows.map(r => sheet.columns.map(c => r[c.key] ?? '').join(',')).join('\n');
    const blob   = new Blob([header + '\n' + rows], { type: 'text/csv' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href = url; a.download = `${sheet.id}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-5 pb-20">

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-theme-text font-black text-xl tracking-tight flex items-center gap-2">
            <BookOpen size={20} className="text-theme-accent" />
            Historical Logsheet Viewer
          </h1>
          <p className="text-theme-muted text-xs mt-1">
            Baseline operational records — JETL, Hyderabad · display only, no ML impact
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
            {allSheets.length} Logsheet{allSheets.length !== 1 ? 's' : ''} Loaded
          </span>
          <button
            onClick={() => navigate('/batch-analytics')}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-all bg-theme-panel border-theme-border text-theme-muted hover:border-theme-accent/50 hover:text-theme-text"
          >
            <Upload size={13} />
            Go to Batch Upload
          </button>
        </div>
      </div>

      {/* ── Sheet Selector Tabs ─────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {/* Baseline group label */}
        <div className="flex items-center gap-2 w-full flex-wrap">
          <span className="text-[9px] font-black text-theme-muted uppercase tracking-widest">Baseline</span>
          {(nandesariSheet ? [nandesariSheet] : logsheetData.logsheets).map(s => (
            <button
              key={s.id}
              onClick={() => { setActiveSheetId(s.id); setTrendKey(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                (activeSheetId === s.id || (!activeSheetId && s.id === allSheets[0].id))
                  ? 'bg-theme-accent text-white border-theme-accent shadow-md shadow-theme-accent/20'
                  : 'bg-theme-panel text-theme-muted border-theme-border hover:border-theme-accent/50 hover:text-theme-text'
              }`}
            >
              {s.system} · {new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </button>
          ))}

          {uploadedSheets.length > 0 && (
            <>
              <span className="text-[9px] font-black text-theme-muted uppercase tracking-widest ml-3">Uploaded</span>
              {uploadedSheets.map(s => (
                <div key={s.id} className="flex items-center gap-1">
                  <button
                    onClick={() => { setActiveSheetId(s.id); setTrendKey(null); }}
                    className={`px-3 py-1.5 rounded-l-lg text-xs font-bold border-y border-l transition-all ${
                      activeSheetId === s.id
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-theme-panel text-theme-muted border-theme-border hover:border-violet-400/60 hover:text-theme-text'
                    }`}
                  >
                    <FileSpreadsheet size={11} className="inline mr-1" />
                    {s.system}
                    {s.date && ` · ${new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    title="Remove this logsheet"
                    className="px-2 py-1.5 rounded-r-lg text-xs border-y border-r border-theme-border text-theme-muted hover:text-rose-500 hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {sheet && (
        <>
          {/* ── Info Banner ──────────────────────────────────────────── */}
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
            <Info size={14} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 dark:text-blue-300 font-medium leading-relaxed">
              <span className="font-black">{sheet.label}</span>
              {sheet.source && <> · {sheet.source}</>}
              {sheet.note && <> · <span className="italic">{sheet.note}</span></>}
            </div>
          </div>

          {/* ── Summary KPI Cards ────────────────────────────────────── */}
          {Object.keys(stats).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              {sheet.columns
                .filter(c => c.key !== 'time' && stats[c.key])
                .slice(0, 6)
                .map(col => {
                  const s    = stats[col.key];
                  const live = LIVE_MAP[col.key];
                  return (
                    <button
                      key={col.key}
                      onClick={() => setTrendKey(trendKey === col.key ? null : col.key)}
                      className={`group bg-theme-panel border rounded-xl p-3 text-left transition-all hover:shadow-lg premium-card ${
                        trendKey === col.key
                          ? 'border-theme-accent ring-1 ring-theme-accent/30'
                          : 'border-theme-border hover:border-theme-accent/40'
                      }`}
                    >
                      <div className="text-[9px] font-black text-theme-muted uppercase tracking-widest mb-1 truncate">
                        {col.label}{col.unit && ` (${col.unit})`}
                      </div>
                      <div className="text-lg font-black text-theme-text leading-none">
                        {s.avg.toFixed(1)}
                        <span className="text-[9px] font-bold text-theme-muted ml-1">avg</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-[9px] text-theme-muted">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">↓ {s.min}</span>
                        <span>·</span>
                        <span className="text-rose-600 dark:text-rose-400 font-bold">↑ {s.max}</span>
                      </div>
                      {live != null && (
                        <div className="mt-1.5 text-[9px] text-theme-muted flex items-center">
                          Live: <span className="font-bold text-theme-text ml-1">{typeof live === 'number' ? live.toFixed(1) : live}</span>
                          <DeltaBadge baseline={s.avg} live={live} />
                        </div>
                      )}
                      <div className={`mt-1 text-[9px] font-bold ${trendKey === col.key ? 'text-theme-accent' : 'text-theme-muted group-hover:text-theme-accent'}`}>
                        {trendKey === col.key ? '▲ Showing trend' : '→ Click to trend'}
                      </div>
                    </button>
                  );
                })}
            </div>
          )}

          {/* ── Trend Chart ──────────────────────────────────────────── */}
          {trendKey && activeTrendCol && (
            <div className="bg-theme-panel border border-theme-border rounded-xl shadow-lg overflow-hidden premium-card">
              <div className="flex items-center justify-between px-4 py-3 border-b border-theme-border">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-theme-accent" />
                  <span className="text-sm font-bold text-theme-text">
                    {activeTrendCol.label}{activeTrendCol.unit ? ` (${activeTrendCol.unit})` : ''} — Hourly Trend
                  </span>
                </div>
                <button onClick={() => setTrendKey(null)}
                  className="text-theme-muted hover:text-theme-text text-xs font-bold px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  Close ×
                </button>
              </div>
              <div className="p-4" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-panel)" vertical={false} opacity={0.4} />
                    <XAxis dataKey="time" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={45} />
                    <Tooltip content={<ChartTooltip />} />
                    {LIVE_MAP[trendKey] != null && (
                      <ReferenceLine y={LIVE_MAP[trendKey]} stroke="#06b6d4" strokeDasharray="4 4"
                        label={{ value: 'Live', fill: '#06b6d4', fontSize: 10, position: 'right' }} />
                    )}
                    <Line type="monotone" dataKey="value" name={activeTrendCol.label}
                      stroke="var(--accent)" strokeWidth={2.5}
                      dot={{ r: 4, fill: 'var(--accent)', strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: 'var(--accent)' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Main Table ───────────────────────────────────────────── */}
          <div className="bg-theme-panel border border-theme-border rounded-xl shadow-lg overflow-hidden premium-card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-theme-border flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-theme-accent" />
                <span className="text-sm font-bold text-theme-text">{sheet.label}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-theme-muted font-bold">
                  {sheet.rows.length} readings
                </span>
                {sheet.uploaded && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30 font-bold">
                    UPLOADED
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-theme-muted">
                  <span className="text-amber-600 dark:text-amber-400 font-bold">●</span> = out-of-range
                </span>
                <button onClick={exportCSV}
                  className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-theme-accent text-white hover:opacity-90 transition-opacity">
                  <Download size={11} /> Export CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  {/* Group header */}
                  {sheet.columnGroups?.length > 0 && (
                    <tr className="border-b border-theme-border">
                      <th className="px-3 py-2 text-center text-[9px] font-black uppercase tracking-widest text-theme-muted bg-slate-100 dark:bg-slate-800/50 border-r border-theme-border">
                        Time
                      </th>
                      {sheet.columnGroups.map((grp, gi) => (
                        <th key={gi} colSpan={grp.span}
                          className="px-3 py-2 text-center text-[9px] font-black uppercase tracking-widest text-theme-muted bg-slate-100 dark:bg-slate-800/50 border-r border-theme-border last:border-r-0">
                          {grp.label}
                        </th>
                      ))}
                    </tr>
                  )}
                  {/* Column headers */}
                  <tr className="border-b border-theme-border bg-slate-50 dark:bg-slate-900/30">
                    {sheet.columns.map(col => (
                      <th key={col.key}
                        className={`px-3 py-2 text-left text-[9px] font-black uppercase tracking-wider whitespace-nowrap ${
                          col.key === 'time'
                            ? 'sticky left-0 z-10 bg-slate-50 dark:bg-slate-900/90 text-theme-muted border-r border-theme-border'
                            : 'text-theme-muted'
                        }`}>
                        <div>{col.label}</div>
                        {col.unit && <div className="text-[8px] font-normal normal-case text-theme-muted/70 mt-0.5">{col.unit}</div>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.map((row, ri) => (
                    <tr key={ri}
                      className="border-b border-theme-border/50 hover:bg-blue-50/50 dark:hover:bg-white/3 transition-colors group">
                      {sheet.columns.map(col => {
                        const val  = row[col.key];
                        const live = LIVE_MAP[col.key];
                        const isTime = col.key === 'time';
                        return (
                          <td key={col.key}
                            className={`px-3 py-2.5 whitespace-nowrap font-mono ${
                              isTime
                                ? 'sticky left-0 z-10 bg-theme-panel group-hover:bg-blue-50/80 dark:group-hover:bg-slate-800 font-black text-theme-text border-r border-theme-border text-center'
                                : cellClass(col.key, val)
                            }`}>
                            {isTime ? (
                              <span className="text-[11px] font-black text-theme-text">{val}</span>
                            ) : (
                              <span>
                                {fmt(val)}
                                {!isTime && live != null && ri === sheet.rows.length - 1 && (
                                  <DeltaBadge baseline={val} live={live} />
                                )}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Average row */}
                  <tr className="bg-gradient-to-r from-slate-100 to-blue-50 dark:from-slate-800/60 dark:to-blue-900/20 border-t-2 border-theme-accent/30">
                    {sheet.columns.map(col => {
                      const s = stats[col.key];
                      return (
                        <td key={col.key}
                          className={`px-3 py-2.5 text-[10px] font-black whitespace-nowrap ${
                            col.key === 'time'
                              ? 'sticky left-0 z-10 bg-slate-100 dark:bg-slate-800/90 text-theme-accent border-r border-theme-border text-center'
                              : 'text-theme-accent'
                          }`}>
                          {col.key === 'time' ? 'AVG' : s ? s.avg.toFixed(1) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-theme-border text-[10px] text-theme-muted">
              Data source: {sheet.source || 'Physical operator logsheet'} · {sheet.date}
              {sheet.uploaded && ' · Stored in browser (localStorage) — no server upload'}
            </div>
          </div>

          {/* ── Live vs Baseline Comparison ──────────────────────────── */}
          {Object.entries(LIVE_MAP).filter(([k, v]) => v != null && stats[k]).length > 0 && (
            <div className="bg-theme-panel border border-theme-border rounded-xl shadow-lg overflow-hidden premium-card">
              <div className="px-4 py-3 border-b border-theme-border flex items-center gap-2">
                <Activity size={14} className="text-cyan-600 dark:text-cyan-400" />
                <span className="text-sm font-bold text-theme-text">Live vs Baseline Comparison</span>
                <span className="text-[9px] text-theme-muted ml-1">(today vs {sheet.date} avg)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-0 divide-x divide-y divide-theme-border">
                {Object.entries(LIVE_MAP)
                  .filter(([k, v]) => v != null && stats[k])
                  .map(([k, live]) => {
                    const col  = sheet.columns.find(c => c.key === k);
                    const base = stats[k]?.avg;
                    if (!col || base == null) return null;
                    const diff = live - base;
                    const isUp = diff > 0;
                    const pct  = base !== 0 ? Math.abs(diff / base * 100).toFixed(1) : null;
                    const same = Math.abs(diff) < 0.05;
                    return (
                      <div key={k} className="p-4 flex flex-col gap-1">
                        <div className="text-[9px] font-black text-theme-muted uppercase tracking-widest">
                          {col.label}{col.unit ? ` (${col.unit})` : ''}
                        </div>
                        <div className="flex items-end gap-3 mt-1">
                          <div>
                            <div className="text-[9px] text-theme-muted">Baseline avg</div>
                            <div className="text-base font-black text-theme-text font-mono">{base.toFixed(1)}</div>
                          </div>
                          <div className="text-theme-muted text-sm">→</div>
                          <div>
                            <div className="text-[9px] text-cyan-600 dark:text-cyan-400">Live</div>
                            <div className="text-base font-black text-cyan-700 dark:text-cyan-400 font-mono">
                              {typeof live === 'number' ? live.toFixed(1) : live}
                            </div>
                          </div>
                        </div>
                        <div className={`text-xs font-bold mt-1 flex items-center gap-1 ${
                          same ? 'text-slate-500' :
                          isUp ? 'text-rose-600 dark:text-rose-400' :
                          'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {same ? <Minus size={12}/> : isUp ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>}
                          {same ? 'No change' : `${isUp?'+':'-'}${pct ? pct+'%' : Math.abs(diff).toFixed(2)}`}
                          {!same && <span className="text-theme-muted font-normal text-[9px]">vs baseline</span>}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
