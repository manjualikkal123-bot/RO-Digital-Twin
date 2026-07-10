import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
 ComposedChart, Line, Area, ScatterChart, Scatter,
 XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea, Label
} from 'recharts';
import { Activity, Database, AlertCircle, Sliders, ArrowRight, Play, Bot, Lock, ChevronDown, X as XIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function fmtTime(iso) {
 if (!iso) return '—';
 const d = new Date(iso);
 if (Number.isNaN(d.getTime())) return '—';
 return d.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function fmtNum(v, digits = 2) {
 return typeof v === 'number' && !Number.isNaN(v) ? v.toFixed(digits) : '—';
}

const FORECAST_POINTS = 14;

const CustomTooltip = ({ active, payload, label }) => {
 if (active && payload && payload.length) {
 return (
 <div className="bg-theme-panel border border-theme-border p-2 rounded shadow-xl text-xs">
 <p className="text-theme-muted mb-1 font-bold">{fmtTime(label)}</p>
 {payload.map((p, i) => (
 <p key={i} style={{ color: p.color }}>
 {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : '—'}
 </p>
 ))}
 </div>
 );
 }
 return null;
};

const ChartTrustHeader = ({ title, source, updated, extra = null }) => (
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 border-b border-theme-border pb-2 gap-2">
 <div className="flex items-center gap-2">
 <h2 className="text-xs font-bold text-theme-text uppercase tracking-widest">{title}</h2>
 {extra}
 </div>
 <div className="flex flex-wrap gap-3 text-[9px] uppercase tracking-widest text-theme-muted font-bold bg-theme-panel px-2 py-1 rounded">
 <span className="flex items-center gap-1"><Database size={10} className="text-blue-700 dark:text-blue-400"/> {source}</span>
 <span className="text-theme-muted">LAST POINT: {fmtTime(updated)}</span>
 </div>
 </div>
);

const JETL_STAGES = [
 { id: 'UF', label: 'UF-101', hasRejection: false },
 { id: 'RO1', label: 'RO-401', hasRejection: true },
 { id: 'RO2', label: 'RO-701', hasRejection: true },
 { id: 'RO-P', label: 'ROP-1001', hasRejection: true },
];

const NANDESARI_STAGES = [
 { id: 'HPA1', label: 'HPA-1', hasRejection: true },
 { id: 'HPA2', label: 'HPA-2', hasRejection: true },
 { id: 'HPA3', label: 'HPA-3', hasRejection: true },
 { id: 'HPA4', label: 'HPA-4', hasRejection: true },
 { id: 'HPA5', label: 'HPA-5', hasRejection: true },
];

function pearsonR(xs, ys) {
 const pairs = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => typeof x === 'number' && typeof y === 'number');
 const n = pairs.length;
 if (n < 5) return null;
 const xm = pairs.reduce((s, [x]) => s + x, 0) / n;
 const ym = pairs.reduce((s, [, y]) => s + y, 0) / n;
 let num = 0, dx2 = 0, dy2 = 0;
 for (const [x, y] of pairs) { const dx = x - xm, dy = y - ym; num += dx * dy; dx2 += dx * dx; dy2 += dy * dy; }
 const den = Math.sqrt(dx2 * dy2);
 return den === 0 ? null : num / den;
}

function linearTrend(values) {
 const pts = values.map((v, i) => [i, v]).filter(([, v]) => typeof v === 'number');
 const n = pts.length;
 if (n < 5) return null;
 const xm = pts.reduce((s, [x]) => s + x, 0) / n;
 const ym = pts.reduce((s, [, y]) => s + y, 0) / n;
 let num = 0, den = 0;
 for (const [x, y] of pts) { num += (x - xm) * (y - ym); den += (x - xm) ** 2; }
 const slope = den === 0 ? 0 : num / den;
 const intercept = ym - slope * xm;
 const residuals = pts.map(([x, y]) => y - (slope * x + intercept));
 const variance = residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, n - 2);
 return { slope, intercept, stdDev: Math.sqrt(variance), n };
}

// -------------------------------------------------------------
// Correlation Heatmap — built entirely from the SAME real dataset
// (activeDataset) already driving the rest of this page (Live sync
// buffer or a selected historical day from fullHistoricalDataset).
// No synthetic/random data. Variables:
//   flux_lmh, tmp_bar, salt_rejection  -> selected stage (stageMeta.id)
//   sec                                -> per-record SEC, same fallback
//                                          logic used elsewhere in the app
//                                          (energy_kwh/flow -> feed_pressure
//                                          proxy -> plant.sec)
//   dp_stage1 / dp_stage2               -> differential_pressure of the
//                                          first two stages in the fleet
//                                          (RO-1/RO-2 for JETL, HPA-1/HPA-2
//                                          for Nandesari), independent of
//                                          which stage is currently selected
// Cells with fewer than 5 valid paired points show null (blank), same
// "insufficient data" honesty rule used by pearsonR elsewhere in this file.
// -------------------------------------------------------------
function computeCorrelationMatrix(activeDataset, stageMeta, currentStages) {
  if (!activeDataset || activeDataset.length === 0) return null;

  const dpStageA = currentStages[0]?.id;
  const dpStageB = currentStages[1]?.id;

  const rows = activeDataset.map(record => {
    const sel = record.stages?.[stageMeta.id] || {};
    const stageA = record.stages?.[dpStageA] || {};
    const stageB = record.stages?.[dpStageB] || {};
    const plant = record.plant || {};

    let sec = null;
    if (typeof sel.energy_kwh === 'number' && sel.flow_rate > 0) {
      sec = sel.energy_kwh / sel.flow_rate;
    } else if (typeof sel.feed_pressure === 'number' && sel.feed_pressure > 0) {
      sec = sel.feed_pressure / 28.8; // same thermodynamic estimate used elsewhere in the app
    } else if (typeof plant.sec === 'number') {
      sec = plant.sec;
    }

    return {
      flux_lmh: typeof sel.flow_rate === 'number' ? sel.flow_rate : null,
      tmp_bar: typeof sel.differential_pressure === 'number' ? sel.differential_pressure : null,
      salt_rejection: typeof sel.salt_rejection === 'number' ? sel.salt_rejection : null,
      sec,
      dp_stage1: typeof stageA.differential_pressure === 'number' ? stageA.differential_pressure : null,
      dp_stage2: typeof stageB.differential_pressure === 'number' ? stageB.differential_pressure : null,
    };
  });

  const vars = ['flux_lmh', 'tmp_bar', 'salt_rejection', 'sec', 'dp_stage1', 'dp_stage2'];
  const series = {};
  vars.forEach(v => { series[v] = rows.map(r => r[v]); });

  const matrix = vars.map(rowVar =>
    vars.map(colVar => {
      if (rowVar === colVar) return 1;
      return pearsonR(series[rowVar], series[colVar]);
    })
  );

  return { vars, matrix, dpStageA, dpStageB, n: rows.length };
}

// Diverging blue -> white -> red scale, matching the reference screenshot.
function correlationColor(v) {
  if (v === null || Number.isNaN(v)) return 'transparent';
  const clamped = Math.max(-1, Math.min(1, v));
  if (clamped >= 0) {
    const t = clamped; // 0 -> white, 1 -> deep red
    const r = 255;
    const g = Math.round(255 - t * 195);
    const b = Math.round(255 - t * 225);
    return `rgb(${r},${g},${b})`;
  } else {
    const t = -clamped; // 0 -> white, 1 -> deep blue
    const r = Math.round(255 - t * 215);
    const g = Math.round(255 - t * 135);
    const b = 255;
    return `rgb(${r},${g},${b})`;
  }
}

const CorrelationHeatmapSection = ({ activeDataset, stageMeta, currentStages }) => {
  const result = computeCorrelationMatrix(activeDataset, stageMeta, currentStages);

  return (
    <div className="mt-10 bg-theme-panel border border-theme-border rounded-2xl p-6 shadow-2xl">
      <h2 className="text-xs font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-widest mb-1 flex items-center gap-2">
        🔥 Advanced: Correlation Heatmap
      </h2>
      <p className="text-[10px] text-theme-muted uppercase tracking-widest mb-5">
        {result ? `Pearson r across ${result.n} real logged points (${stageMeta.label} + ${result.dpStageA}/${result.dpStageB})` : 'Real logsheet / live sync data'}
      </p>

      {!result || result.n < 5 ? (
        <div className="py-10 text-center text-xs text-theme-muted">Not enough logged points yet to compute correlations (need at least 5).</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-collapse text-[11px]">
            <tbody>
              {result.vars.map((rowVar, ri) => (
                <tr key={rowVar}>
                  <td className="pr-3 py-1 text-right font-bold text-theme-muted whitespace-nowrap">{rowVar}</td>
                  {result.vars.map((colVar, ci) => {
                    const v = result.matrix[ri][ci];
                    const dark = v !== null && Math.abs(v) > 0.55;
                    return (
                      <td
                        key={colVar}
                        title={`${rowVar} vs ${colVar}`}
                        className="w-24 h-16 text-center font-bold border border-black/10"
                        style={{ backgroundColor: correlationColor(v), color: v === null ? 'var(--text-muted)' : (dark ? '#fff' : '#1e293b') }}
                      >
                        {v === null ? '—' : v.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td />
                {result.vars.map(colVar => (
                  <td key={colVar} className="pt-2 text-center font-bold text-theme-muted whitespace-nowrap">{colVar}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[9px] text-theme-muted mt-4">
        dp_stage1 / dp_stage2 = real differential pressure from {result?.dpStageA ?? '—'} and {result?.dpStageB ?? '—'}, independent of the currently selected stage tab above. SEC uses the same fallback logic (energy/flow → pressure proxy → plant.sec) used elsewhere in this app.
      </p>
    </div>
  );
};



// REPLACED: this used to be "Predictive Water Quality" — a BarChart fed by
// PREDICTIVE_MOCK_DATA (5 fake timestamps millisecond-apart, jittered around
// one real number) plus invented "mae"/"pred" fields nothing ever computed,
// labeled "Live" and "AI-driven forward projections". None of that was real.
//
// What's actually true: Copy_of_Trial_Commissioning_Log_sheet...xlsx →
// "Analysis Form" sheet is a ONE-TIME lab analysis of the feed water taken
// during the Aug 2025 trial commissioning — a single sample, not a time
// series. There is nothing to forecast from one point, so this is now an
// honest lab-report card instead of a fabricated live predictor. Parameters
// the lab marked '---' / '----' (not tested) show "Not Tested", not 0 —
// 0 would falsely claim e.g. zero turbidity, perfectly neutral pH, etc.
const FEED_WATER_ANALYSIS = {
  sampledOn: '17–18 Aug 2025 (Trial Commissioning)',
  source: 'Lab Analysis Form',
  parameters: [
    { label: 'Colour', unit: '', value: 'Light Yellow' },
    { label: 'Turbidity', unit: 'NTU', value: null },
    { label: 'pH (at 32°C)', unit: 'pH', value: null },
    { label: 'Conductivity', unit: 'µS/cm', value: 7700 },
    { label: 'Total Dissolved Salts', unit: 'mg/l', value: 4510 },
    { label: 'Suspended Solids', unit: 'mg/l', value: null },
    { label: 'Calcium (as Ca)', unit: 'mg/l', value: 220 },
    { label: 'Magnesium (as Mg)', unit: 'mg/l', value: null },
    { label: 'Ph. Alkalinity (as CaCO3)', unit: 'mg/l', value: null },
    { label: 'M.O. Alkalinity (as CaCO3)', unit: 'mg/l', value: null },
    { label: 'Sulphate (as SO4)', unit: 'mg/l', value: 360 },
    { label: 'Chlorides (as Cl)', unit: 'mg/l', value: 1350 },
    { label: 'Silica (as SiO2)', unit: 'mg/l', value: 66 },
    { label: 'Bicarbonates (as CaCO3)', unit: 'mg/l', value: 396 },
    { label: 'COD', unit: 'mg/l', value: null },
    { label: 'Total Hardness (as CaCO3)', unit: 'mg/l', value: 1150 },
  ],
};

const FeedWaterQualitySection = () => (
  <div className="mt-10 flex flex-col gap-6 animate-fade-in">
    <div className="bg-theme-panel backdrop-blur-2xl border border-theme-border rounded-2xl p-6 shadow-2xl flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-theme-border pb-4">
        <div>
          <h2 className="text-xl font-black text-theme-text flex items-center gap-2">
            <Database className="text-blue-700 dark:text-blue-500" /> Feed Water Quality — Lab Snapshot
          </h2>
          <p className="text-theme-muted text-xs mt-1">
            {FEED_WATER_ANALYSIS.source} · sampled {FEED_WATER_ANALYSIS.sampledOn} · single point-in-time sample, not a live feed
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {FEED_WATER_ANALYSIS.parameters.map((p) => (
          <div key={p.label} className="bg-theme-main border border-theme-border rounded-xl p-4 flex flex-col gap-1">
            <span className="text-[10px] text-theme-muted uppercase tracking-widest font-bold">{p.label}</span>
            {p.value === null ? (
              <span className="text-sm font-bold text-theme-muted">Not Tested</span>
            ) : (
              <span className="text-xl font-black text-theme-text">
                {p.value}{p.unit ? <span className="text-xs text-theme-muted ml-1 font-medium">{p.unit}</span> : null}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default function AdvancedAnalytics() {
 const {
 selectedFacility, targetStage, setTargetStage,
 telemetry, telemetryHistory, fullHistoricalDataset, selectedHistoryDay, setSelectedHistoryDay,
 isPlaybackMode, exitPlaybackMode, derivedKPIs, syncStatus,
 } = useAppStore();

 const availableDays = useMemo(() => {
   if (!fullHistoricalDataset || fullHistoricalDataset.length === 0) return [];
   const days = new Set();
   fullHistoricalDataset.forEach(r => {
     if (r.timestamp) days.add(r.timestamp.split('T')[0]);
   });
   return Array.from(days).sort();
 }, [fullHistoricalDataset]);

 const activeDataset = useMemo(() => {
   if (selectedHistoryDay === 'Live') return telemetryHistory;
   if (!fullHistoricalDataset) return [];
   return fullHistoricalDataset.filter(r => r.timestamp && r.timestamp.startsWith(selectedHistoryDay));
 }, [selectedHistoryDay, telemetryHistory, fullHistoricalDataset]);

 const isNandesari = selectedFacility === 'nia_nandesari';
 const currentStages = isNandesari ? NANDESARI_STAGES : JETL_STAGES;

 const navigate = useNavigate();
 const stageMeta = currentStages.find(s => s.id === targetStage) || currentStages[0];

 const stageHistory = useMemo(() => {
 if (!activeDataset) return [];
 return activeDataset.map(record => {
 const stageData = record.stages?.[stageMeta.id] || {};
 return {
 timestamp: record.timestamp,
 differential_pressure: (stageData.differential_pressure !== null && stageData.differential_pressure !== undefined) ? parseFloat(stageData.differential_pressure.toFixed(2)) : null,
 normalized_flux: (stageData.flow_rate !== null && stageData.flow_rate !== undefined) ? parseFloat(stageData.flow_rate.toFixed(2)) : null, // flow_rate acts as flux proxy
 salt_rejection: (stageData.salt_rejection !== null && stageData.salt_rejection !== undefined) ? parseFloat(stageData.salt_rejection.toFixed(2)) : null
 };
 }).filter(t => t.differential_pressure !== null);
 }, [activeDataset, targetStage]);

 const trendData = useMemo(
 () => stageHistory.map(t => ({
 timestamp: t.timestamp,
 dp: t.differential_pressure,
 flux: t.normalized_flux,
 rejection: t.salt_rejection,
 })),
 [stageHistory]
 );

 const forecast = useMemo(() => {
 const trend = linearTrend(trendData.map(d => d.dp));
 if (!trend) return null;
 const base = trendData.map((d, i) => ({ idx: i, actual: d.dp, predicted: null, upper: null, lower: null }));
 const lastIdx = trendData.length - 1;
 const proj = [];
 for (let i = 1; i <= FORECAST_POINTS; i++) {
 const x = lastIdx + i;
 const y = trend.slope * x + trend.intercept;
 const band = trend.stdDev * Math.sqrt(1 + i / trend.n);
 proj.push({ idx: x, actual: null, predicted: y, upper: y + band, lower: y - band });
 }
 return { points: [...base, ...proj], trend };
 }, [trendData]);

 const correlation = useMemo(
 () => pearsonR(trendData.map(d => d.dp), trendData.map(d => d.flux)),
 [trendData]
 );

  const scatterData = useMemo(() => trendData.filter(d => typeof d.flux === 'number' && d.flux > 5), [trendData]);

  const zoneThresholds = useMemo(() => {
    const vals = scatterData.map(d => d.dp).filter(v => typeof v === 'number');
    if (vals.length < 5) return null;
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
    // Pad the min/max slightly so points aren't exactly on the border
    const padding = (Math.max(...vals) - Math.min(...vals)) * 0.1 || 0.1;
    return { mean, warn: mean + sd, critical: mean + 2 * sd, min: Math.min(...vals) - padding, max: Math.max(...vals) + padding };
  }, [scatterData]);

 const latest = stageHistory[stageHistory.length - 1];

 return (
 <div className="flex flex-col h-full select-none">
 <div className="flex flex-col gap-3 mb-5 shrink-0">
 <div className="bg-theme-panel border border-theme-border rounded-xl p-4 shadow-lg flex flex-col lg:flex-row justify-between gap-4 premium-card">
 <div>
 <h1 className="text-2xl font-bold flex items-center gap-2 tracking-tight text-theme-text">
 <Activity className="text-cyan-700 dark:text-cyan-500" /> Twin Analytics — {selectedFacility || 'JETL'}
 </h1>
 {isPlaybackMode ? (
 <div className="flex items-center gap-2 mt-2 bg-purple-900/40 border border-purple-500/50 rounded px-2 py-1 w-fit">
 <Play size={10} className="text-purple-700 dark:text-purple-500" />
 <span className="text-purple-700 dark:text-purple-400 text-[10px] uppercase tracking-widest font-bold">Historical Playback Mode</span>
 <button onClick={exitPlaybackMode} className="text-[9px] uppercase tracking-widest bg-purple-600 hover:bg-purple-500 text-theme-text px-2 py-0.5 rounded ml-2 font-bold transition-colors">
 [Exit to Live]
 </button>
 </div>
 ) : (
 <p className="text-theme-muted text-[10px] uppercase tracking-widest mt-1">
 Sync: {syncStatus?.status || 'Idle'} {syncStatus?.lastSynced ? `· ${syncStatus.lastSynced}` : ''} · {stageHistory.length} points logged this session
 </p>
 )}
 </div>
 </div>
 </div>
          <div className="flex flex-wrap gap-2 items-center">
            {currentStages.map(s => (
              <button key={s.id} onClick={() => setTargetStage(s.id)}
                className={`text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded border ${targetStage === s.id || stageMeta.id === s.id ? 'bg-cyan-600 border-cyan-500 text-theme-text' : 'bg-theme-panel border-theme-border text-theme-muted hover:border-slate-500'}`}>
                {s.id} ({s.label})
 </button>
 ))}

 {availableDays.length > 0 && (
 <div className="ml-auto flex items-center gap-2">
 <span className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">Filter Day:</span>
 <select
 value={selectedHistoryDay}
 onChange={(e) => setSelectedHistoryDay(e.target.value)}
 className="bg-theme-panel border border-theme-border text-theme-text text-xs rounded px-2 py-1 outline-none focus:border-theme-accent"
 >
 <option value="Live">Live Window</option>
 {availableDays.map(d => (
 <option key={d} value={d}>{d}</option>
 ))}
 </select>
 </div>
 )}
 </div>

 <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
 <div className="xl:col-span-3 flex flex-col gap-6">
 <div className="bg-gradient-to-r from-blue-100 to-slate-100 dark:from-blue-900/40 dark:to-slate-900 border border-blue-300 dark:border-blue-500/30 rounded-xl p-4">
 <h3 className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-widest mb-2">Active Anomaly Flags ({stageMeta.label})</h3>
 {derivedKPIs?.anomalyFlags?.length > 0 ? (
 <div className="flex flex-wrap gap-3 text-sm font-bold">
 {derivedKPIs.anomalyFlags.map(f => (
 <span key={f} className="text-rose-700 dark:text-rose-400 bg-rose-200 dark:bg-rose-900/20 border border-rose-400 dark:border-rose-500/30 px-2 py-1 rounded text-xs">{f}</span>
 ))}
 </div>
 ) : (
 <p className="text-sm text-theme-muted">No threshold breaches on the current telemetry point.</p>
 )}
 </div>

 {trendData.length < 5 ? (
 <div className="bg-theme-panel border border-theme-border rounded-xl p-10 text-center text-sm text-theme-muted">
 Not enough {stageMeta.id} points logged yet this session to chart trends — the sync loop is still filling the buffer. ({stageHistory.length} so far)
 </div>
 ) : (
 <>
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 <div className="bg-theme-panel border border-theme-border rounded-xl shadow-lg flex flex-col p-5 premium-card">
 <ChartTrustHeader title="Performance Trend" source="GlobalSyncManager (real logsheet)" updated={latest?.timestamp} />
 <div className="flex-1" style={{ minHeight: 260 }}>
 <ResponsiveContainer width="100%" height="100%">
 <ComposedChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
 <XAxis dataKey="timestamp" tickFormatter={fmtTime} stroke="#8892b0" tick={{ fill: '#8892b0', fontSize: 9 }} tickMargin={8} minTickGap={40} />
 <YAxis yAxisId="left" domain={['auto', 'auto']} stroke="#f59e0b" tick={{ fill: '#f59e0b', fontSize: 9 }}>
 <Label value="Delta P (bar)" angle={-90} position="insideLeft" offset={14} fill="#f59e0b" fontSize={9} />
 </YAxis>
 <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} stroke="#06b6d4" tick={{ fill: '#06b6d4', fontSize: 9 }}>
 <Label value="Flux (LMH)" angle={90} position="insideRight" offset={14} fill="#06b6d4" fontSize={9} />
 </YAxis>
 <Tooltip content={<CustomTooltip />} />
 <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
 <Line yAxisId="left" type="monotone" dataKey="dp" name="Delta P (bar)" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls activeDot={{ r: 4 }} />
 <Line yAxisId="right" type="monotone" dataKey="flux" name="Flux (LMH)" stroke="#06b6d4" strokeWidth={2} dot={false} connectNulls activeDot={{ r: 4 }} />
 {stageMeta.hasRejection && (
 <Line yAxisId="right" type="monotone" dataKey="rejection" name="Salt Rejection (%)" stroke="#22c55e" strokeWidth={2} dot={false} connectNulls />
 )}
 </ComposedChart>
 </ResponsiveContainer>
 </div>
 </div>

 <div className="bg-theme-panel border border-theme-border rounded-xl shadow-lg flex flex-col p-5 premium-card">
 <ChartTrustHeader title="Short-Horizon Trend Projection" source="Linear regression" updated={latest?.timestamp}
 extra={<span className="text-[9px] text-purple-700 dark:text-purple-400 font-bold ml-2 border border-purple-500/30 bg-purple-900/20 px-2 py-0.5 rounded">NOT AN ML MODEL</span>}
 />
 {!forecast ? (
 <div className="flex-1 flex items-center justify-center text-xs text-theme-muted">Not enough points to fit a trend.</div>
 ) : (
 <div className="flex-1" style={{ minHeight: 260 }}>
 <ResponsiveContainer width="100%" height="100%">
 <ComposedChart data={forecast.points} margin={{ top: 15, right: 20, left: 10, bottom: 5 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
 <XAxis dataKey="idx" stroke="#8892b0" tick={{ fill: '#8892b0', fontSize: 9 }} tickFormatter={i => `pt ${i}`} minTickGap={40} />
 <YAxis domain={['auto', 'auto']} stroke="#f59e0b" tick={{ fill: '#f59e0b', fontSize: 9 }}>
 <Label value="Delta P (bar)" angle={-90} position="insideLeft" offset={0} fill="#f59e0b" fontSize={9} />
 </YAxis>
 <Tooltip content={<CustomTooltip />} />
 <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
 <ReferenceLine x={trendData.length - 1} stroke="#a855f7" strokeDasharray="3 3" label={{ position: 'insideTopRight', fill: '#a855f7', fontSize: 9, value: 'Projection starts' }} />
 <Area type="monotone" dataKey="upper" name="Upper bound" fill="#f59e0b" stroke="#f59e0b" fillOpacity={0.1} strokeWidth={1} strokeDasharray="3 3" />
 <Area type="monotone" dataKey="lower" name="Lower bound" fill="#0f172a" stroke="#f59e0b" fillOpacity={1} strokeWidth={1} strokeDasharray="3 3" />
 <Line type="monotone" dataKey="actual" name="Actual Delta P" stroke="#06b6d4" strokeWidth={2} dot={false} connectNulls />
 <Line type="monotone" dataKey="predicted" name="Linear projection" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls />
 </ComposedChart>
 </ResponsiveContainer>
 </div>
 )}
 </div>
 </div>

 <div className="bg-theme-panel border border-theme-border rounded-xl shadow-lg flex flex-col p-5 premium-card">
 <ChartTrustHeader title="Operating Zone Scatter" source="Observed-range statistics" updated={latest?.timestamp} />
 {!zoneThresholds ? (
 <div className="flex-1 flex items-center justify-center text-xs text-theme-muted" style={{ minHeight: 200 }}>Not enough points yet.</div>
 ) : (
 <div className="flex-1" style={{ minHeight: 220 }}>
 <ResponsiveContainer width="100%" height="100%">
 <ScatterChart margin={{ top: 5, right: 20, left: 10, bottom: 30 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
 <XAxis dataKey="dp" type="number" domain={[zoneThresholds.min, zoneThresholds.max]} name="Delta P (bar)" stroke="#8892b0" tick={{ fill: '#8892b0', fontSize: 9 }}>
 <Label value="Delta P (bar)" position="insideBottom" offset={-18} fill="#8892b0" fontSize={9} />
 </XAxis>
 <YAxis dataKey="flux" type="number" domain={['auto', 'auto']} name="Flux (LMH)" stroke="#06b6d4" tick={{ fill: '#06b6d4', fontSize: 9 }}>
 <Label value="Flux (LMH)" angle={-90} position="insideLeft" offset={10} fill="#06b6d4" fontSize={9} />
 </YAxis>
 <Tooltip content={<CustomTooltip />} />
 <ReferenceArea x1={zoneThresholds.min} x2={zoneThresholds.warn} fill="#10b981" fillOpacity={0.07} />
 <ReferenceArea x1={zoneThresholds.warn} x2={zoneThresholds.critical} fill="#f59e0b" fillOpacity={0.07} />
 <ReferenceArea x1={zoneThresholds.critical} x2={zoneThresholds.max} fill="#ef4444" fillOpacity={0.08} />
 <Scatter name="Operating Points" data={scatterData} fill="#0ea5e9" opacity={0.8} />
 </ScatterChart>
 </ResponsiveContainer>
 </div>
 )}
 </div>
 </>
 )}
 </div>

 <div className="xl:col-span-1 flex flex-col gap-6">
 <div className="bg-theme-panel flex-1 border border-theme-border rounded-xl shadow-lg flex flex-col premium-card">
 <div className="p-4 border-b border-theme-border">
 <h2 className="text-sm font-bold text-theme-text uppercase tracking-widest flex items-center gap-2">
 <AlertCircle size={16} className="text-rose-700 dark:text-rose-500"/> Live KPIs ({stageMeta.id})
 </h2>
 </div>
 <div className="p-4 space-y-3 overflow-y-auto invisible-scroll pb-4">
 <ul className="space-y-2">
 <li className="flex justify-between items-center text-[11px]"><span className="text-theme-muted">Salt Rejection</span><span className="font-bold text-cyan-700 dark:text-cyan-400">{derivedKPIs?.saltRejection != null ? `${fmtNum(derivedKPIs.saltRejection,1)}%` : <span className="flex items-center gap-1 text-theme-muted"><Lock size={9}/>no conductivity tag</span>}</span></li>
 <li className="flex justify-between items-center text-[11px]"><span className="text-theme-muted">Specific Energy (SEC)</span><span className="font-bold text-amber-700 dark:text-amber-400">{derivedKPIs?.activeSEC != null ? `${fmtNum(derivedKPIs.activeSEC)} kWh/m³` : <span className="flex items-center gap-1 text-theme-muted"><Lock size={9}/>no energy meter</span>}</span></li>
 <li className="flex justify-between items-center text-[11px]"><span className="text-theme-muted">Health Score</span><span className="font-bold text-emerald-700 dark:text-emerald-400">{derivedKPIs?.healthScore != null ? `${fmtNum(derivedKPIs.healthScore,0)}` : '—'}</span></li>
 <li className="flex justify-between items-center text-[11px]"><span className="text-theme-muted">Delta P vs Flux corr. (r)</span><span className="font-bold text-purple-700 dark:text-purple-400">{correlation == null ? 'n/a' : correlation.toFixed(2)}</span></li>
 </ul>
 <div className="bg-amber-100 dark:bg-amber-900/10 border border-amber-300 dark:border-amber-500/20 rounded-lg p-3 text-[10px] text-amber-900 dark:text-amber-300/90 leading-relaxed mt-3 font-medium">
 Root-cause attribution requires labeled failure history this plant doesn't have yet — this panel only shows directly computed statistics.
 </div>
 <button
 onClick={() => navigate('/ai-assistant', { state: { autoPrompt: `Review the real logged trend for JETL ${stageMeta.label}. Current Delta P: ${fmtNum(telemetry?.differential_pressure)} bar, correlation with flux: ${correlation == null ? 'n/a' : correlation.toFixed(2)}. Suggest what's needed to support a real RCA model.` } })}
 className="w-full flex justify-center items-center gap-1 text-[10px] font-bold tracking-widest uppercase bg-blue-600 hover:bg-blue-500 text-theme-text py-3 rounded-lg transition-colors shadow-lg shadow-blue-900/20"
 >
 <Bot size={14} /> Ask AI About This Stage
 </button>
 </div>
 </div>

 <div className="bg-gradient-to-br from-blue-50 via-slate-100 to-purple-50 dark:from-blue-900/20 dark:via-[#0f172a] dark:to-purple-900/20 border border-blue-200 dark:border-blue-500/20 rounded-xl shadow-lg overflow-hidden flex flex-col">
 <div className="flex flex-col gap-6 px-6 py-6 flex-1">
 <div className="flex flex-col items-start gap-4 flex-1">
 <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl shrink-0"><Sliders size={28} className="text-blue-700 dark:text-blue-400" /></div>
 <div>
 <h2 className="text-base font-bold text-theme-text tracking-tight mb-2">Simulation Engine</h2>
 <p className="text-xs text-theme-muted leading-relaxed">Run scenarios against the physics model using {stageMeta.label}'s real operating range.</p>
 </div>
 </div>
 <button onClick={() => navigate('/engineering-sandbox')} className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-theme-text font-bold text-sm px-6 py-3 rounded-xl shadow-lg shadow-blue-900/30 transition-all mt-auto">
 Open Simulator <ArrowRight size={16} />
 </button>
 </div>
 </div>
 </div>
 </div>

 {/* Correlation Heatmap — real, built from activeDataset */}
 <CorrelationHeatmapSection activeDataset={activeDataset} stageMeta={stageMeta} currentStages={currentStages} />

 {/* Feed Water Quality Lab Snapshot (Injected below grids) */}
 <FeedWaterQualitySection />
 </div>
 );
}
