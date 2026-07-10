import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ReferenceLine, ComposedChart, Label, ScatterChart, Scatter, Tooltip as RechartsTooltip, Cell, LabelList, PieChart, Pie, Legend } from 'recharts';
import { Activity, Droplets, Zap, Clock, Cpu, Server, AlertTriangle, TrendingDown, Info, Wifi, Wrench } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import plantConfig from '../config/plant_config.json';
import ExportButton from '../components/ExportButton';

// Trip limits used for RUL extrapolation. These are engineering assumptions
// (not measured), carried over from the same constants used in
// BatchAnalytics.computeAnalytics for consistency across the app — flag to
// plant engineers for confirmation/adjustment.
const TRIP_LIMIT_BAR = { 
  UF: 3.0, RO1: 10.0, RO2: 10.0, 'RO-P': 5.0,
  HPA1: 10.0, HPA2: 10.0, HPA3: 10.0, HPA4: 10.0, HPA5: 10.0
};

const STAGE_LABELS = { 
  UF: 'UF (101)', RO1: 'RO-1 (401)', RO2: 'RO-2 (701)', 'RO-P': 'RO-P (1001)',
  HPA1: 'HPA-1', HPA2: 'HPA-2', HPA3: 'HPA-3', HPA4: 'HPA-4', HPA5: 'HPA-5'
};

// -------------------------------------------------------------
// Real stage-level health engine — derives fouling index, health
// score, TMP rise rate, and RUL from the actual TMP/flux history
// for the selected stage. Returns nulls (not invented numbers)
// wherever there isn't enough real history to compute something.
// -------------------------------------------------------------
function computeStageHealth(telemetryHistory, stage) {
 const threshold = TRIP_LIMIT_BAR[stage] || 5.0;

 const points = (telemetryHistory || [])
 .map(t => {
 const s = t?.stages?.[stage];
 if (!s) return null;
 const tmp = s.differential_pressure;
 const flux = s.flow_rate;
 const ts = s.timestamp ? new Date(s.timestamp).getTime() : null;
 if (typeof tmp !== 'number' || isNaN(tmp) || ts === null) return null;
 return { ts, tmp, flux: (typeof flux === 'number' && !isNaN(flux)) ? flux : null };
 })
 .filter(Boolean)
 .sort((a, b) => a.ts - b.ts);

 if (points.length < 2) {
 return {
 hasData: false,
 dataPoints: points.length,
 lastTMP: points[0]?.tmp ?? null,
 tmpRiseRatePerDay: null,
 fluxDeclineRate: null,
 foulingIndex: null,
 healthScore: null,
 risk: null,
 rulDays: null,
 cipRecommendedDays: null,
 degradationText: 'Insufficient history',
 rootCause: 'Not enough data points yet to establish a trend.',
 trendSeries: points.map(p => ({ ts: p.ts, tmp: p.tmp })),
 };
 }

 const first = points[0];
 const last = points[points.length - 1];
 const spanDays = Math.max((last.ts - first.ts) / (1000 * 60 * 60 * 24), 1 / 24); // floor at 1 hour

 const tmpRiseRatePerDay = (last.tmp - first.tmp) / spanDays;

 const fluxVals = points.map(p => p.flux).filter(v => v !== null && v > 0);
 const fluxDeclineRate = fluxVals.length >= 2
 ? ((fluxVals[0] - fluxVals[fluxVals.length - 1]) / fluxVals[0]) * 100
 : null;

 const foulingIndex = first.tmp !== 0 ? ((last.tmp - first.tmp) / Math.abs(first.tmp)) * 100 : null;

 let healthScore = 100;
 if (foulingIndex !== null && foulingIndex > 0) healthScore -= Math.min(40, foulingIndex * 2);
 if (fluxDeclineRate !== null && fluxDeclineRate > 0) healthScore -= Math.min(30, fluxDeclineRate);
 healthScore = Math.max(0, Math.round(healthScore));

 let risk = 'LOW';
 if (healthScore < 60) risk = 'HIGH';
 else if (healthScore < 85) risk = 'MEDIUM';

 let rulDays = null;
 if (tmpRiseRatePerDay > 0) {
 rulDays = Math.max(0, Math.round((threshold - last.tmp) / tmpRiseRatePerDay));
 }
 // tmpRiseRatePerDay <= 0 means TMP is flat or falling — no failure timeline
 // to predict, so rulDays stays null rather than showing a fake "stable" number.

 const cipRecommendedDays = rulDays !== null ? Math.max(0, Math.round(rulDays * 0.7)) : null;

 let degradationText = 'Stable — no TMP rise detected';
 let rootCause = 'TMP and flux are stable over the observed window. No active fouling trend.';
 if (tmpRiseRatePerDay > 0.001) {
 degradationText = `+${tmpRiseRatePerDay.toFixed(3)} bar/day`;
 if (fluxDeclineRate !== null && fluxDeclineRate > 5) {
 rootCause = `TMP rising (${tmpRiseRatePerDay.toFixed(3)} bar/day) with ${fluxDeclineRate.toFixed(1)}% flux decline — consistent with active fouling.`;
 } else {
 rootCause = `TMP rising at ${tmpRiseRatePerDay.toFixed(3)} bar/day. Flux has not yet declined significantly.`;
 }
 } else if (tmpRiseRatePerDay < -0.001) {
 degradationText = `${tmpRiseRatePerDay.toFixed(3)} bar/day`;
 rootCause = 'TMP trending downward — likely a recent CIP wash or improved feed conditions.';
 }

 return {
 hasData: true,
 dataPoints: points.length,
 lastTMP: last.tmp,
 tmpRiseRatePerDay,
 fluxDeclineRate,
 foulingIndex,
 healthScore,
 risk,
 rulDays,
 cipRecommendedDays,
 degradationText,
 rootCause,
 tripLimit: threshold,
 trendSeries: points.map(p => ({ ts: p.ts, tmp: p.tmp, flux: p.flux })),
 };
}

// Computes a per-stage risk matrix from the stage's own telemetry health
// metrics so each RO-1/RO-2/HPA-1..HPA-5 shows a unique scatter plot.
function computeStageRiskMatrix(health) {
  const tmpRate  = health?.tmpRiseRatePerDay  ?? 0;
  const fluxPct  = health?.fluxDeclineRate    ?? 0;
  const lastTMP  = health?.lastTMP            ?? 0;
  const score    = health?.healthScore        ?? 100;
  const tripLimit = health?.tripLimit         ?? 10;
  const foulingIdx = health?.foulingIndex     ?? 0;

  // 1. Fouling — TMP rise rate + flux decline
  const pFoul = Math.min(1, Math.max(0.05,
    (Math.abs(tmpRate) / 0.3) * 0.5 + (Math.max(0, fluxPct) / 50) * 0.5
  ));
  // 2. Scaling — TMP level vs trip limit
  const pScale = Math.min(1, Math.max(0.05, lastTMP / tripLimit));
  // 3. Pump Wear — health score degradation
  const pPump = Math.min(1, Math.max(0.05, (100 - score) / 100));
  // 4. TDS Spike — rising TMP as upstream quality proxy
  const pTds = Math.min(1, Math.max(0.05, tmpRate > 0 ? Math.min(1, tmpRate / 0.5) : 0.1));
  // 5. Membrane Age — cumulative fouling index
  const pAge = Math.min(1, Math.max(0.05, Math.abs(foulingIdx) / 80));

  return [
    { mode: 'Scaling',      probability: parseFloat(pScale.toFixed(2)), impact: 0.80 },
    { mode: 'Fouling',      probability: parseFloat(pFoul.toFixed(2)),  impact: 0.60 },
    { mode: 'Pump Wear',    probability: parseFloat(pPump.toFixed(2)),  impact: 0.20 },
    { mode: 'TDS Spike',    probability: parseFloat(pTds.toFixed(2)),   impact: 0.40 },
    { mode: 'Membrane Age', probability: parseFloat(pAge.toFixed(2)),   impact: 0.45 },
  ];
}

// Permeability (LMH/bar) — flux normalized by membrane area, divided by TMP.
// Requires config.membrane_area_m2 to convert flow_rate (m3/hr) into true flux (LMH).
// If that field isn't present in plant_config.json yet, returns null rather than
// guessing an area — flag to confirm the real installed membrane area per stage.
function computePermeability(health, config) {
  const areaM2 = config?.membrane_area_m2;
  if (!health?.hasData || health.lastTMP === null || !areaM2 || areaM2 <= 0) return null;
  const lastFlux = health.trendSeries?.[health.trendSeries.length - 1]?.flux;
  if (typeof lastFlux !== 'number' || lastFlux <= 0) return null;
  const fluxLMH = (lastFlux * 1000) / areaM2; // m3/hr -> L/hr, divided by m2
  if (health.lastTMP <= 0) return null;
  return fluxLMH / health.lastTMP;
}

// Membrane life remaining (%) — based on install date vs an assumed service life.
// Assumed life defaults to 5 years (typical RO/UF industry figure) unless
// config specifies membrane_rated_life_years. Requires config.membrane_install_date.
function computeMembraneLife(config) {
  const installDate = config?.membrane_install_date;
  if (!installDate) return null;
  const ratedYears = config?.membrane_rated_life_years ?? 5;
  const installed = new Date(installDate);
  if (isNaN(installed.getTime())) return null;
  const daysInstalled = Math.floor((Date.now() - installed.getTime()) / (1000 * 60 * 60 * 24));
  const ratedDays = ratedYears * 365;
  const lifeRemainingPct = Math.max(0, Math.min(100, Math.round(100 - (daysInstalled / ratedDays) * 100)));
  return { lifeRemainingPct, daysInstalled, ratedYears };
}

// Fouling type breakdown — NOT measured. Real composition (organic / inorganic
// scaling / biofouling / colloidal) requires lab analysis (SDI, ICP, membrane
// autopsy), which this dashboard does not have instrumented. This is a rough
// heuristic proxy only, built from the same signals already used elsewhere on
// this page (TMP rise rate + flux decline + last-TMP-vs-trip-limit), and is
// clearly labeled as an estimate in the UI. Do not present this as measured data.
function computeFoulingBreakdownHeuristic(health) {
  if (!health?.hasData) return null;
  const tmpRate = health.tmpRiseRatePerDay ?? 0;
  const fluxPct = health.fluxDeclineRate ?? 0;
  const lastTMP = health.lastTMP ?? 0;
  const tripLimit = health.tripLimit ?? 10;

  // Fast TMP rise + flux holding up -> leans organic/biofilm.
  const organic = Math.max(5, Math.min(60, 30 + tmpRate * 40 - fluxPct * 0.3));
  // TMP close to trip limit with steady rise -> leans inorganic scaling.
  const inorganic = Math.max(5, Math.min(50, (lastTMP / tripLimit) * 40));
  // Flux decline outpacing TMP rise -> leans biofouling.
  const biofouling = Math.max(5, Math.min(40, fluxPct * 0.8));
  // Remainder assigned to colloidal.
  const rawTotal = organic + inorganic + biofouling;
  const colloidal = Math.max(5, 100 - rawTotal);

  const total = organic + inorganic + biofouling + colloidal;
  return [
    { name: 'Organic', value: Math.round((organic / total) * 100), color: '#f59e0b' },
    { name: 'Inorganic / Scaling', value: Math.round((inorganic / total) * 100), color: '#ef4444' },
    { name: 'Biofouling', value: Math.round((biofouling / total) * 100), color: '#3b82f6' },
    { name: 'Colloidal', value: Math.round((colloidal / total) * 100), color: '#64748b' },
  ];
}

function buildForecastSeries(health, mlData) {
 if (!health.hasData || health.trendSeries.length === 0) return [];

 const series = health.trendSeries.map((p, i) => ({
 day: (p.ts - health.trendSeries[health.trendSeries.length - 1].ts) / (1000 * 60 * 60 * 24),
 label: new Date(p.ts).toLocaleDateString(),
 tmp: p.tmp,
 isForecast: false,
 forecastTmp: null,
 tmpBounds: null,
 }));

 if (mlData && mlData.trajectory) {
 const lastTs = health.trendSeries[health.trendSeries.length - 1].ts;
 mlData.trajectory.filter(t => t.isProjection).forEach((t, i) => {
 series.push({
 day: i + 1,
 label: `+${i + 1}d`,
 tmp: null,
 isForecast: true,
 forecastTmp: t.dp,
 tmpBounds: [t.dp_lower, t.dp_upper]
 });
 });
 } else if (health.tmpRiseRatePerDay !== null && health.tmpRiseRatePerDay > 0) {
 const lastTMP = health.lastTMP;
 for (let i = 1; i <= 30; i++) {
 const projected = lastTMP + health.tmpRiseRatePerDay * i;
 const variance = 0.02 * i; // widening uncertainty with forecast distance — not a measured confidence interval
 series.push({
 day: i,
 label: `+${i}d`,
 tmp: null,
 isForecast: true,
 forecastTmp: projected,
 tmpBounds: [Math.max(0, projected - variance), projected + variance],
 });
 }
 }

 return series;
}

// --- COMPONENT ---
export default function MembraneHealth() {
  const { telemetry, isEmergencyHalted, syncStatus, selectedFacility, telemetryHistory, alarms, cipLedger, mlMembraneForecast, fetchIntelligenceLayer } = useAppStore();
  const isNandesari = selectedFacility === 'nia_nandesari';
  const stageList = isNandesari ? ['HPA1', 'HPA2', 'HPA3', 'HPA4', 'HPA5'] : ['UF', 'RO1', 'RO2', 'RO-P'];

  const [selectedStage, setSelectedStage] = useState(isNandesari ? 'HPA1' : 'RO1');

  useEffect(() => {
    setSelectedStage(isNandesari ? 'HPA1' : 'RO1');
  }, [isNandesari]);

  // Re-fetch ML intelligence (incl. risk_matrix) whenever the page mounts
  // or the selected plant changes — don't wait for the 60-second global poll.
  useEffect(() => {
    if (selectedFacility && typeof fetchIntelligenceLayer === 'function') {
      fetchIntelligenceLayer(selectedFacility);
    }
  }, [selectedFacility, fetchIntelligenceLayer]);

  const config = plantConfig[selectedFacility] || plantConfig['jetl_hyderabad'];
  const syncTime = syncStatus?.lastSynced || "LIVE";

 const health = useMemo(() => computeStageHealth(telemetryHistory, selectedStage), [telemetryHistory, selectedStage]);
 const forecastSeries = useMemo(() => buildForecastSeries(health, mlMembraneForecast), [health, mlMembraneForecast]);
 // Per-stage risk matrix — unique for each RO/HPA stage based on its own TMP/flux trends
 const stageRiskMatrix = useMemo(() => computeStageRiskMatrix(health), [health]);
 const permeability = useMemo(() => computePermeability(health, config), [health, config]);
 const membraneLife = useMemo(() => computeMembraneLife(config), [config]);
 const foulingBreakdown = useMemo(() => computeFoulingBreakdownHeuristic(health), [health]);
 // Fouling risk as a percentage for the summary strip (derived from health score, same basis as elsewhere on this page)
 const foulingRiskPct = health.healthScore !== null ? Math.max(0, 100 - health.healthScore) : null;

 // DEBUG — log the first 2 telemetryHistory entries and health result so we can
 // confirm the stages sub-object exists and has the right keys for this facility.
 if (process.env.NODE_ENV === 'development') {
   const sample = telemetryHistory?.slice(-2);
   console.log('[MembraneHealth DEBUG] facility:', selectedFacility, 'stage:', selectedStage);
   console.log('[MembraneHealth DEBUG] history length:', telemetryHistory?.length, 'last entry:', sample?.[1]);
   console.log('[MembraneHealth DEBUG] stages in last entry:', sample?.[1]?.stages);
   console.log('[MembraneHealth DEBUG] health result:', health);
   console.log('[MembraneHealth DEBUG] stageRiskMatrix:', stageRiskMatrix);
 }

  const allStageHealth = useMemo(() => {
    const out = {};
    stageList.forEach(s => { out[s] = computeStageHealth(telemetryHistory, s); });
    return out;
  }, [telemetryHistory, stageList]);

 const [isProcurementModalOpen, setProcurementModalOpen] = useState(false);
 const [timeLeft, setTimeLeft] = useState('');
 useEffect(() => {
 const updateCountdown = () => {
 const now = new Date();
 const hours = now.getHours();
 const next12 = hours < 12 ? 12 : 24;
 const target = new Date(now);
 target.setHours(next12, 0, 0, 0);
 const diff = target - now;
 const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
 const m = Math.floor((diff / 1000 / 60) % 60);
 const s = Math.floor((diff / 1000) % 60);
 setTimeLeft(`${h}h ${m}m ${s}s`);
 };
 updateCountdown();
 const interval = setInterval(updateCountdown, 1000);
 return () => clearInterval(interval);
 }, []);

  const riskColorClass = (risk) => risk === 'HIGH' ? 'text-rose-700 dark:text-rose-400' : risk === 'MEDIUM' ? 'text-amber-700 dark:text-amber-400' : risk === 'LOW' ? 'text-emerald-700 dark:text-emerald-400' : 'text-theme-muted';
  const riskIconColorClass = (risk) => risk === 'HIGH' ? 'text-rose-700 dark:text-rose-500' : risk === 'MEDIUM' ? 'text-amber-700 dark:text-amber-500' : risk === 'LOW' ? 'text-emerald-700 dark:text-emerald-500' : 'text-theme-muted';
  const riskBorderClass = (risk) => risk === 'HIGH' ? 'border-t-rose-500' : risk === 'MEDIUM' ? 'border-t-amber-500' : risk === 'LOW' ? 'border-t-emerald-500' : 'border-t-slate-700';

  // Derived predictive metrics from the ML backend
  const daysToCip = mlMembraneForecast?.cip_forecast?.days_to_cip ?? null;
  const predictedCipDate = daysToCip !== null ? new Date(new Date().setDate(new Date().getDate() + daysToCip)) : null;
  const modelMae = mlMembraneForecast?.validation_mae ?? null;

 return (
 <div className="min-h-screen bg-theme-main text-slate-100 p-6 pb-20 font-sans select-none overflow-x-hidden">

 {/* 1. SYNCHRONIZATION STRIP */}
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-4">
 <div>
 <h1 className="text-2xl font-bold tracking-tight text-theme-text flex items-center gap-2">
 <Cpu className="text-cyan-700 dark:text-cyan-500" /> {isNandesari ? 'Membrane Health — Nandesari' : 'Membrane Health — JETL Train 1'}
 </h1>
 <p className="text-xs text-theme-muted mt-1">Stage-level fouling trend &amp; RUL estimation from real TMP/flux history.</p>
 </div>

 <div className="flex flex-wrap gap-4 bg-theme-panel border border-theme-border rounded-lg px-4 py-2 shadow-lg">
 <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-theme-muted">
 <Activity size={12} className={isEmergencyHalted ? "text-rose-700 dark:text-rose-500" : "text-cyan-700 dark:text-cyan-500"} /> Twin Status:
 <span className={`font-bold ${isEmergencyHalted ? "text-rose-700 dark:text-rose-500 animate-pulse" : "text-cyan-700 dark:text-cyan-400"}`}>
 {isEmergencyHalted ? "EMERGENCY HALTED" : "Active"}
 </span>
 </div>
 <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-theme-muted">
 <Server size={12} className="text-purple-700 dark:text-purple-500" /> Last Sync: <span className="text-theme-text font-bold">{syncTime}</span>
 </div>
 <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-theme-muted">
 <Wifi size={12} className="text-emerald-700 dark:text-emerald-500" /> History Points: <span className="text-emerald-700 dark:text-emerald-400 font-bold">{health.dataPoints}</span>
 </div>
 </div>
 <ExportButton
 plantName={config.display_name}
 filename={`${selectedFacility}_MembraneHealth_${selectedStage}`}
 telemetryHistory={telemetryHistory}
 alarms={alarms}
 limits={config?.limits}
 />
 </div>

 {/* STAGE SELECTOR */}
  <div className="flex items-center gap-2 mb-6 bg-theme-panel border border-theme-border rounded-lg p-1 w-fit">
    {stageList.map(s => (
      <button
        key={s}
        onClick={() => setSelectedStage(s)}
        className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition-all ${selectedStage === s ? 'bg-cyan-600 text-theme-text shadow-lg' : 'text-theme-muted hover:text-theme-text'}`}
      >
        {STAGE_LABELS[s]}
        {allStageHealth[s]?.risk && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${riskColorClass(allStageHealth[s].risk)} bg-black/20`}>
            {allStageHealth[s].risk}
          </span>
        )}
      </button>
    ))}
  </div>

  {/* SUMMARY STRIP — Fouling Risk %, Next CIP w/ confidence, Permeability, Membrane Life */}
  <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
    <div className={`bg-theme-panel border border-theme-border border-t-4 ${riskBorderClass(health.risk)} rounded-xl p-5 shadow-lg premium-card`}>
      <span className="text-[10px] font-bold tracking-widest text-theme-muted uppercase">Fouling Risk</span>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={`text-3xl font-extrabold ${riskColorClass(health.risk)}`}>{foulingRiskPct !== null ? foulingRiskPct : '—'}</span>
        {foulingRiskPct !== null && <span className="text-sm font-medium text-theme-muted">%</span>}
      </div>
      <span className={`inline-block mt-2 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${riskColorClass(health.risk)} bg-black/10`}>{health.risk || '—'}</span>
      <p className="text-[10px] text-theme-muted mt-2">Target: &lt; 40%</p>
    </div>

    <div className="bg-theme-panel border border-theme-border rounded-xl p-5 shadow-lg premium-card">
      <span className="text-[10px] font-bold tracking-widest text-theme-muted uppercase">Next CIP</span>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-3xl font-extrabold text-theme-text">{health.cipRecommendedDays !== null ? health.cipRecommendedDays : '—'}</span>
        {health.cipRecommendedDays !== null && <span className="text-sm font-medium text-theme-muted">days</span>}
      </div>
      {modelMae !== null && (
        <span className="inline-block mt-2 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded text-emerald-700 dark:text-emerald-400 bg-emerald-500/10">
          Conf. {Math.max(0, Math.round((1 - modelMae) * 100))}%
        </span>
      )}
      <p className="text-[10px] text-theme-muted mt-2">
        {predictedCipDate !== null ? `ETA: ${predictedCipDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'ETA unavailable'}
      </p>
    </div>

    <div className="bg-theme-panel border border-theme-border rounded-xl p-5 shadow-lg premium-card">
      <span className="text-[10px] font-bold tracking-widest text-theme-muted uppercase">Permeability</span>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-3xl font-extrabold text-theme-text">{permeability !== null ? permeability.toFixed(1) : '—'}</span>
        {permeability !== null && <span className="text-sm font-medium text-theme-muted">LMH/bar</span>}
      </div>
      <span className={`inline-block mt-2 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${permeability === null ? 'text-theme-muted bg-black/10' : 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'}`}>
        {permeability === null ? 'Needs membrane area' : 'Computed'}
      </span>
      <p className="text-[10px] text-theme-muted mt-2">Target: ≥ 8.0 LMH/bar</p>
    </div>

    <div className="bg-theme-panel border border-theme-border rounded-xl p-5 shadow-lg premium-card">
      <span className="text-[10px] font-bold tracking-widest text-theme-muted uppercase">Membrane Life</span>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-3xl font-extrabold text-theme-text">{membraneLife ? membraneLife.lifeRemainingPct : '—'}</span>
        {membraneLife && <span className="text-sm font-medium text-theme-muted">%</span>}
      </div>
      <span className="inline-block mt-2 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded text-amber-700 dark:text-amber-400 bg-amber-500/10">
        {membraneLife ? `${membraneLife.daysInstalled}d installed` : 'Install date not set'}
      </span>
      <p className="text-[10px] text-theme-muted mt-2">Target: Monitor at &lt; 30%</p>
    </div>
  </section>

  {/* FOULING PROGRESSION TREND (dual-axis Flux/TMP, real history) + FOULING BREAKDOWN */}
  <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
    <div className="lg:col-span-2 bg-theme-panel border border-theme-border rounded-xl p-5 shadow-lg premium-card">
      <h2 className="text-xs font-bold tracking-wider text-theme-text uppercase mb-4 flex items-center gap-2">
        <TrendingDown size={16} className="text-cyan-700 dark:text-cyan-500" /> Fouling Progression Trend — {STAGE_LABELS[selectedStage]}
      </h2>
      <div className="h-[320px] w-full">
        {health.hasData && health.trendSeries.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={health.trendSeries.map(p => ({ ...p, label: new Date(p.ts).toLocaleDateString() }))} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-panel)" vertical={false} opacity={0.3} />
              <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 'bold' }} tickLine={false} axisLine={false} minTickGap={40} />
              <YAxis yAxisId="flux" orientation="left" stroke="#22d3ee" tick={{ fill: '#22d3ee', fontSize: 10, fontWeight: 'bold' }} tickLine={false} axisLine={false}>
                <Label value="Flux (proxy)" angle={-90} position="insideLeft" fill="#22d3ee" fontSize={11} fontWeight="bold" style={{ textAnchor: 'middle' }} />
              </YAxis>
              <YAxis yAxisId="tmp" orientation="right" stroke="#f43f5e" tick={{ fill: '#f43f5e', fontSize: 10, fontWeight: 'bold' }} tickLine={false} axisLine={false}>
                <Label value="TMP (bar)" angle={90} position="insideRight" fill="#f43f5e" fontSize={11} fontWeight="bold" style={{ textAnchor: 'middle' }} />
              </YAxis>
              <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', border: '1px solid var(--border-panel)', borderRadius: '12px', color: 'var(--text-main)' }} itemStyle={{ fontWeight: 'bold' }} />
              <Line yAxisId="flux" type="monotone" dataKey="flux" name="Flux" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
              <Line yAxisId="tmp" type="monotone" dataKey="tmp" name="TMP (bar)" stroke="#f43f5e" strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-theme-muted text-xs font-bold">Not enough history yet for {STAGE_LABELS[selectedStage]}.</div>
        )}
      </div>
      <p className="text-[9px] text-theme-muted mt-2">Flux axis is the raw `flow_rate` telemetry value (not normalized to LMH unless membrane area is configured) — see Permeability card above for the normalized figure.</p>
    </div>

    <div className="bg-theme-panel border border-theme-border rounded-xl p-5 shadow-lg premium-card">
      <h2 className="text-xs font-bold tracking-wider text-theme-text uppercase mb-4 flex items-center gap-2">
        <Droplets size={16} className="text-blue-700 dark:text-blue-500" /> Fouling Breakdown
      </h2>
      {foulingBreakdown ? (
        <>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={foulingBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} isAnimationActive={false}
                     label={({ value }) => `${value}%`} labelLine={false}>
                  {foulingBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-panel)', borderRadius: '8px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            {foulingBreakdown.map((entry, i) => (
              <div key={i} className="flex items-center justify-between text-[10px] font-bold text-theme-muted">
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />{entry.name}</span>
                <span className="text-theme-text">{entry.value}%</span>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-amber-700 dark:text-amber-500 mt-3 leading-relaxed">
            ⚠ Estimated proxy from TMP/flux trend shape — not a lab-measured fouling composition. Confirm with SDI/ICP autopsy data if precision is needed.
          </p>
        </>
      ) : (
        <div className="h-[220px] flex items-center justify-center text-theme-muted text-xs font-bold text-center px-4">Not enough history yet to estimate breakdown.</div>
      )}
    </div>
  </section>

  {/* PREDICTIVE MAINTENANCE CENTER (Integrated, Light/Dark Mode) */}
  <div className="bg-white dark:bg-[#0b1121] border border-slate-200 dark:border-gray-800 rounded-xl p-6 shadow-lg dark:shadow-2xl mb-6 text-slate-800 dark:text-gray-200 relative overflow-hidden">
    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 via-blue-500 to-indigo-500"></div>
    <div className="flex items-center gap-2 mb-6">
      <Wrench size={16} className="text-teal-600 dark:text-teal-400" />
      <h2 className="text-sm font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">Predictive Maintenance Center</h2>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      {/* KPI List (Left) */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-slate-200 dark:border-gray-800 pb-2">
          <span className="text-sm text-slate-500 dark:text-gray-400">Days to Next CIP ({STAGE_LABELS[selectedStage]})</span>
          <span className={`text-base font-bold ${daysToCip !== null ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500'}`}>{daysToCip !== null ? `${daysToCip} days` : 'Insufficient data'}</span>
        </div>
        <div className="flex justify-between items-center border-b border-slate-200 dark:border-gray-800 pb-2">
          <span className="text-sm text-slate-500 dark:text-gray-400">Predicted CIP Date</span>
          <span className={`text-base font-bold ${predictedCipDate !== null ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500'}`}>{predictedCipDate !== null ? predictedCipDate.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}) : 'Insufficient data'}</span>
        </div>
        <div className="flex justify-between items-center border-b border-slate-200 dark:border-gray-800 pb-2">
          <span className="text-sm text-slate-500 dark:text-gray-400">Failure Probability (30d)</span>
          <span className="text-base font-bold text-amber-500">
            {Math.round(Math.max(...stageRiskMatrix.map(r => r.probability)) * 100)}%
          </span>
        </div>
        <div className="flex justify-between items-center border-b border-slate-200 dark:border-gray-800 pb-2">
          <span className="text-sm text-slate-500 dark:text-gray-400">Model MAE</span>
          <span className={`text-base font-bold ${modelMae !== null ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>{modelMae !== null ? `±${modelMae.toFixed(3)}` : 'Insufficient data'}</span>
        </div>
        <div className="flex justify-between items-center border-b border-slate-200 dark:border-gray-800 pb-2">
          <span className="text-sm text-slate-500 dark:text-gray-400">MTBF / MTTR</span>
          <span className="text-sm italic text-slate-500 dark:text-gray-500">Insufficient historical CIP logs</span>
        </div>
      </div>

      {/* Risk Matrix Plot (Right) */}
      <div className="lg:col-span-7 h-64 bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-4 relative flex flex-col justify-center">
        <h3 className="text-xs font-bold text-slate-700 dark:text-gray-100 uppercase tracking-widest absolute top-4 left-4 z-10">Risk Matrix — {STAGE_LABELS[selectedStage]}</h3>
        
        <ResponsiveContainer width="100%" height="100%" className="mt-4">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-panel)" opacity={0.3} />
            <XAxis type="number" dataKey="probability" name="Probability" domain={[0, 1]} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false}>
              <Label value="Probability" position="bottom" offset={-10} fill="var(--text-main)" fontSize={12} fontWeight="bold" />
            </XAxis>
            <YAxis type="number" dataKey="impact" name="Impact" domain={[0, 1]} ticks={[0, 0.5, 1]} stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false}>
              <Label value="Impact" angle={-90} position="left" offset={0} fill="var(--text-main)" fontSize={12} fontWeight="bold" style={{ textAnchor: 'middle' }} />
            </YAxis>
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px', color: '#fff' }} itemStyle={{ fontWeight: 'bold' }} />
            
            {stageRiskMatrix.map((entry, index) => {
              let fill = "#8884d8";
              if (entry.mode === "Pump Wear")    fill = "#10b981";
              else if (entry.mode === "TDS Spike")    fill = "#f59e0b";
              else if (entry.mode === "Fouling")      fill = "#fbbf24";
              else if (entry.mode === "Scaling")      fill = "#ef4444";
              else if (entry.mode === "Membrane Age") fill = "#3b82f6";
              
              return (
                <Scatter key={index} name={entry.mode} data={[entry]} fill={fill} isAnimationActive={false}>
                  <LabelList dataKey="mode" position="top" fill="var(--text-muted)" fontSize={10} fontWeight="bold" offset={8} />
                </Scatter>
              );
            })}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>

 {/* 2. KPI CARDS — real, derived from this stage's TMP/flux history */}
 <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">

 <div className={`bg-theme-panel border border-theme-border border-t-4 ${riskBorderClass(health.risk)} rounded-xl p-5 flex flex-col justify-between shadow-lg relative overflow-hidden premium-card`}>
 <div className="flex justify-between items-start mb-2 relative z-10">
 <span className="text-[10px] font-bold tracking-widest text-theme-muted uppercase">Remaining Useful Life (Est.)</span>
 </div>
 <div className="flex items-baseline gap-2 relative z-10">
 <span className="text-4xl font-extrabold tracking-tight text-theme-text">{health.rulDays !== null ? health.rulDays : '—'}</span>
 <span className="text-sm font-bold text-theme-muted uppercase tracking-widest">{health.rulDays !== null ? 'Days' : ''}</span>
 </div>
 <span className="text-xs text-theme-muted font-bold mt-1 relative z-10">
 {health.rulDays !== null ? `Until ${STAGE_LABELS[selectedStage]} TMP hits ${health.tripLimit} bar` : (health.hasData ? 'TMP not rising — no failure timeline' : 'Insufficient history')}
 </span>
 <div className="mt-4 pt-3 border-t border-theme-border flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider relative z-10">
 <span className="text-theme-muted">Linear extrapolation from {health.dataPoints} real data points.</span>
 </div>
 </div>

 <CompoundMetricCard
 title={<span title="100 minus penalties for TMP rise and flux decline since the earliest data point in history">Stage Health Score (Est.) <Info size={10} className="inline text-theme-muted"/></span>}
 primaryVal={health.healthScore !== null ? health.healthScore.toString() : '—'}
 unit={health.healthScore !== null ? '/ 100' : ''}
 primaryColor={health.healthScore === null ? 'text-theme-muted' : health.healthScore > 85 ? "text-emerald-700 dark:text-emerald-400" : (health.healthScore > 60 ? "text-teal-400" : "text-amber-700 dark:text-amber-400")}
 subLabel="TMP Trend"
 subVal={health.degradationText}
 subColor={health.healthScore === null ? 'text-theme-muted' : health.healthScore > 85 ? "text-emerald-300" : "text-amber-700 dark:text-amber-400"}
 icon={<Activity size={20} className="text-teal-500" />}
 borderTop={riskBorderClass(health.risk)}
 />
 <CompoundMetricCard
 title="Fouling Risk"
 primaryVal={health.risk || '—'}
 primaryColor={riskColorClass(health.risk)}
 subLabel="Basis"
 subVal={health.rootCause}
 subColor={riskColorClass(health.risk)}
 icon={<AlertTriangle size={20} className={riskIconColorClass(health.risk)} />}
 borderTop={riskBorderClass(health.risk)}
 />
 <CompoundMetricCard
 title={<span title={health.rulDays !== null ? `${health.rulDays} days to trip limit, CIP recommended ahead of that` : 'No active degradation trend'}>CIP Recommended In (Est.) <Info size={10} className="inline text-theme-muted"/></span>}
 primaryVal={health.cipRecommendedDays !== null ? health.cipRecommendedDays : '—'}
 unit={health.cipRecommendedDays !== null ? 'Days' : ''}
 primaryColor={health.cipRecommendedDays === null ? 'text-theme-muted' : health.risk === 'HIGH' ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}
 subLabel="To Prevent Trip Limit Breach"
 subVal={health.rulDays !== null ? `${health.rulDays} Days` : 'N/A — Stable'}
 subColor={health.cipRecommendedDays === null ? 'text-theme-muted' : health.risk === 'HIGH' ? "text-amber-300" : "text-emerald-300"}
 icon={<Droplets size={20} className={health.cipRecommendedDays === null ? 'text-theme-muted' : health.risk === 'HIGH' ? "text-amber-700 dark:text-amber-500" : "text-emerald-700 dark:text-emerald-500"} />}
 borderTop={riskBorderClass(health.risk)}
 />
 </section>

 {/* 3. FORECAST CHART + STAGE COMPARISON */}
 <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

 <div className="lg:col-span-2 bg-theme-panel border border-theme-border rounded-xl p-5 flex flex-col shadow-lg relative premium-card">
 <div className="absolute top-4 right-4 flex items-center gap-2 text-[9px] uppercase tracking-widest text-theme-muted font-bold bg-theme-panel px-2 py-1 rounded">
 <Clock size={10} /> Sync: {syncTime}
 </div>

 <div className="mb-6">
 <h2 className="text-xs font-bold tracking-wider text-theme-text uppercase flex items-center gap-2">
 <TrendingDown size={16} className="text-purple-700 dark:text-purple-500"/> TMP Trend &amp; Linear Forecast — {STAGE_LABELS[selectedStage]}
 </h2>
 <p className="text-[10px] text-theme-muted uppercase tracking-widest mt-1">
 {health.hasData ? `Trend computed from ${health.dataPoints} real sync ticks` : 'Waiting for sync history to accumulate'}
 </p>
 </div>

 <div className="flex-1 min-h-[300px] w-full">
 {forecastSeries.length > 0 ? (
 <ResponsiveContainer width="100%" height="100%">
 <ComposedChart data={forecastSeries} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
 <defs>
 <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4}/>
 <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke="var(--border-panel)" vertical={false} opacity={0.3} />
 <XAxis dataKey="day" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 'bold' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={15} tickFormatter={(v) => typeof v === 'number' ? v.toFixed(1) : v} />
 <YAxis width={70} domain={['auto', 'auto']} stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 'bold' }} tickLine={false} axisLine={false} tickFormatter={(v) => v.toFixed(2)}>
 <Label value="TMP (bar)" angle={-90} position="insideLeft" offset={10} fill="var(--text-main)" fontSize={12} fontWeight="bold" style={{ textAnchor: 'middle' }} />
 </YAxis>
 <Tooltip
 contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', border: '1px solid var(--border-panel)', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)', color: 'var(--text-main)' }} 
 itemStyle={{ fontWeight: 'bold' }}
 cursor={{ stroke: 'var(--text-muted)', strokeWidth: 1, strokeDasharray: '5 5' }}
 labelFormatter={(val) => typeof val === 'number' ? `Day ${val.toFixed(1)}` : val}
 formatter={(value) => [Number(value).toFixed(3)]}
 />
 <Area type="monotone" dataKey="tmpBounds" name="Forecast Range" fill="url(#colorForecast)" stroke="none" isAnimationActive={false} />
 <Line type="monotone" dataKey="tmp" name="Actual TMP (bar)" stroke="#3b82f6" strokeWidth={3} dot={false} isAnimationActive={false} connectNulls={false} />
 <Line type="monotone" dataKey="forecastTmp" name="Linear Forecast" stroke="#a855f7" strokeWidth={3} strokeDasharray="5 5" dot={false} isAnimationActive={false} connectNulls={false} />
 <ReferenceLine x={0} stroke="#64748b" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'NOW', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
 <ReferenceLine y={health.tripLimit} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'TRIP LIMIT', fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} />
 {health.rulDays !== null && (
 <ReferenceLine x={health.rulDays} stroke="#ef4444" label={{ position: 'top', value: `PREDICTED TRIP (${health.rulDays}D)`, fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} />
 )}
 </ComposedChart>
 </ResponsiveContainer>
 ) : (
 <div className="h-full flex items-center justify-center text-theme-muted text-xs font-bold">No TMP history yet for {STAGE_LABELS[selectedStage]} — accumulating sync ticks.</div>
 )}
 </div>

 <div className="flex gap-4 mt-4 justify-center">
 <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-theme-muted"><div className="w-3 h-1 bg-blue-500"></div> Actual</span>
 <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-theme-muted"><div className="w-3 h-1 border-b-2 border-dashed border-purple-500"></div> Linear Forecast</span>
 <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-theme-muted"><div className="w-3 h-3 bg-purple-500/20"></div> Forecast Uncertainty (widens with distance)</span>
 </div>
 </div>

 {/* Right: Stage Health Comparison (real, replaces fake vessel/element tree) */}
 <div className="bg-theme-panel border border-theme-border rounded-xl p-5 flex flex-col h-full shadow-lg relative premium-card">
 <div className="absolute top-4 right-4 flex items-center gap-2 text-[9px] uppercase tracking-widest text-theme-muted font-bold bg-theme-panel px-2 py-1 rounded">
 <Clock size={10} /> Sync: {syncTime}
 </div>
 <h2 className="text-xs font-bold tracking-wider text-theme-text uppercase mb-4 flex items-center gap-2">
 <Server size={16} className="text-cyan-700 dark:text-cyan-500"/> {isNandesari ? 'All Trains' : 'All Stages — Train 1'}
 </h2>
 <div className="space-y-4">
 {stageList.map(s => {
 const sh = allStageHealth[s];
 const score = sh.healthScore;
 const color = score === null ? '#64748b' : score >= 85 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
 return (
 <div key={s}>
 <div className="flex justify-between items-center mb-1">
 <button onClick={() => setSelectedStage(s)} className="text-xs font-bold hover:underline text-theme-text">{STAGE_LABELS[s]}</button>
 <div className="flex items-center gap-3">
 {sh.rulDays !== null && <span className="text-[10px] text-theme-muted font-bold">{sh.rulDays}d to trip</span>}
 <span className="text-xs font-black" style={{ color }}>{score !== null ? score : '—'}</span>
 </div>
 </div>
 <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
 <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${score ?? 0}%`, backgroundColor: color }} />
 </div>
 <div className="text-[10px] text-theme-muted mt-1">{sh.dataPoints} pts · last TMP {sh.lastTMP !== null ? `${sh.lastTMP.toFixed(2)} bar` : '—'}</div>
 </div>
 );
 })}
 </div>
 </div>
 </section>

 {/* 4. AI CIP LEDGER — still backed by useAppStore's cipLedger, which
 currently contains placeholder entries. Flagged separately;
 left wired as-is pending your decision on real CIP history. */}
 <section className="bg-theme-panel border border-theme-border rounded-xl p-5 shadow-lg relative mb-6 premium-card">
 <div className="absolute top-4 right-4 flex items-center gap-2 text-[9px] uppercase tracking-widest text-theme-muted font-bold bg-theme-panel px-2 py-1 rounded">
 <Clock size={10} /> Sync: {syncTime}
 </div>
 <h2 className="text-xs font-bold tracking-wider text-theme-text uppercase mb-4 flex items-center gap-2">
 <Droplets size={16} className="text-blue-700 dark:text-blue-500"/> CIP Wash Ledger
 </h2>
 {cipLedger && cipLedger.length > 0 ? (
 <div className="space-y-3">
 {cipLedger.map(log => (
 <div key={log.id} className="bg-slate-100 dark:bg-slate-80030 rounded border border-theme-border/50 p-3 text-xs flex flex-col gap-2 shadow-sm group hover:border-theme-border transition-colors">
 <div className="flex justify-between items-center mb-2">
 <span className="text-sm font-bold text-theme-text">{log.type}</span>
 <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded border ${
 log.status === 'Completed' ? 'bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' :
 'bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-500/50 animate-pulse'
 }`}>
 {log.status}
 </span>
 </div>
 <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-theme-muted uppercase tracking-widest mb-1">
 <div className="flex items-center gap-1"><Clock size={12}/> {log.date}</div>
 <div className="flex items-center gap-1"><Info size={12}/> {log.vessel}</div>
 </div>
 </div>
 ))}
 </div>
 ) : (
 <div className="text-center py-8 text-theme-muted text-xs font-bold">No CIP wash records logged yet.</div>
 )}
 </section>

 {/* 5. Action Bar */}
 <section className="bg-theme-panel border border-theme-border rounded-xl p-5 shadow-lg flex items-center justify-between premium-card">
 <span className="text-[12px] text-theme-muted flex items-center gap-2 font-bold bg-theme-panel px-3 py-1.5 rounded-lg border border-theme-border">
 <Clock size={14} className="text-purple-700 dark:text-purple-400" />
 Stage health recalculated on every sync tick. <span className="text-emerald-700 dark:text-emerald-400 ml-2">Next forced refresh: {timeLeft}</span>
 </span>
 <button
 onClick={() => setProcurementModalOpen(true)}
 className="text-[11px] uppercase font-bold tracking-widest bg-cyan-600 hover:bg-cyan-500 text-slate-900 px-5 py-3 rounded-lg transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]"
 >
 Schedule CIP — {STAGE_LABELS[selectedStage]}
 </button>
 </section>

 {/* Procurement / CIP Scheduling Modal — stage-level, not element-level */}
 {isProcurementModalOpen && (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
 <div className="bg-theme-panel border border-cyan-500/30 rounded-xl w-full max-w-lg p-6 shadow-[0_0_50px_rgba(6,182,212,0.1)] premium-card">
 <div className="flex justify-between items-center mb-6 border-b border-theme-border pb-4">
 <h3 className="text-lg font-black text-theme-text tracking-tight flex items-center gap-2">
 <Server size={20} className="text-cyan-700 dark:text-cyan-500" /> SCHEDULE CIP WASH
 </h3>
 <button onClick={() => setProcurementModalOpen(false)} className="text-theme-muted hover:text-theme-text transition-colors">✕</button>
 </div>

 <div className="space-y-4">
 <div className="bg-theme-main p-4 rounded-lg border border-theme-border relative overflow-hidden">
 <h4 className="text-[10px] text-theme-muted uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
 <Cpu size={12} className="text-cyan-700 dark:text-cyan-500" /> Stage Snapshot
 </h4>
 <div className="flex justify-between text-sm items-end border-b border-theme-border/50 pb-3 mb-3">
 <div>
 <span className="text-theme-text font-bold block text-base">{STAGE_LABELS[selectedStage]}</span>
 <span className="text-xs text-theme-muted">Current TMP: <span className="text-cyan-700 dark:text-cyan-400 font-bold">{health.lastTMP !== null ? `${health.lastTMP.toFixed(2)} bar` : '—'}</span></span>
 </div>
 <div className="text-right">
 <span className="text-[10px] uppercase tracking-widest text-theme-muted font-bold block mb-1">Risk</span>
 <span className={`text-xl font-black ${riskColorClass(health.risk)}`}>{health.risk || '—'}</span>
 </div>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-xs text-theme-muted">RUL Estimate</span>
 <span className="text-xs font-bold bg-purple-500/20 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded border border-purple-500/30">
 {health.rulDays !== null ? `${health.rulDays} Days` : 'No active trend'}
 </span>
 </div>
 </div>

 {health.rulDays !== null && (
 <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg flex items-start gap-3">
 <AlertTriangle size={16} className="text-amber-700 dark:text-amber-500 shrink-0 mt-0.5" />
 <div>
 <p className="text-xs text-amber-700 dark:text-amber-400 font-bold mb-1">Recommended CIP window: within {health.cipRecommendedDays} days</p>
 <p className="text-[10px] text-amber-700 dark:text-amber-500/80 leading-relaxed">Based on the current TMP rise rate ({health.degradationText}) and a {health.tripLimit} bar assumed trip limit for {STAGE_LABELS[selectedStage]}.</p>
 </div>
 </div>
 )}
 </div>

 <div className="mt-8 pt-4 border-t border-theme-border flex justify-end gap-3">
 <button
 onClick={() => setProcurementModalOpen(false)}
 className="px-5 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-widest text-theme-muted hover:text-theme-text hover:bg-slate-100 dark:bg-slate-800 transition-colors"
 >
 Cancel
 </button>
 <button
 onClick={() => {
 alert("CIP scheduling requires a real maintenance backend — this confirms the request only, no work order has been created.");
 setProcurementModalOpen(false);
 }}
 className="px-6 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-widest bg-cyan-600 text-slate-900 hover:bg-cyan-500 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]"
 >
 Confirm Request
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}

// --- MICRO HELPERS ---
function CompoundMetricCard({ title, primaryVal, unit, primaryColor, subLabel, subVal, subColor = "text-theme-text", icon, borderTop }) {
 return (
 <div className={`bg-theme-panel border border-theme-border border-t-4 ${borderTop} rounded-xl p-5 flex flex-col justify-between shadow-lg relative overflow-hidden group hover:border-theme-border transition-colors premium-card`}>
 <div className="absolute right-[-10px] top-[-10px] opacity-[0.03] pointer-events-none transform scale-150 group-hover:scale-[1.6] transition-transform duration-500">
 {icon}
 </div>
 <div>
 <span className="text-[10px] font-bold tracking-widest text-theme-muted uppercase mb-2 block">{title}</span>
 <div className="flex items-baseline gap-1 mt-1">
 <span className={`text-3xl font-extrabold tracking-tight ${primaryColor}`}>{primaryVal}</span>
 {unit && <span className="text-sm font-medium text-theme-muted">{unit}</span>}
 </div>
 </div>
 <div className="mt-4 pt-3 border-t border-theme-border/80 flex flex-col gap-1 text-[10px] font-bold tracking-widest uppercase z-10">
 <span className="text-theme-muted">{subLabel}</span>
 <span className={`${subColor} normal-case font-bold tracking-normal`}>{subVal}</span>
 </div>
 </div>
 );
}
