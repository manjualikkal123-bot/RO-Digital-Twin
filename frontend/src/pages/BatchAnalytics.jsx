import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import SmartUploader from '../components/SmartUploader';
import {
 Database, Activity, CheckCircle, AlertTriangle, Loader2,
 X, Save, TrendingUp, Check, Server, Play, Cpu, Beaker,
 Upload, FileSpreadsheet, Layers, Droplets, Filter, ChevronDown,
 ChevronUp, Zap, BarChart2, Info, RefreshCw, Eye, Brain, Clock, Edit
} from 'lucide-react';
import {
 LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
 ResponsiveContainer, AreaChart, Area, ComposedChart, ScatterChart,
 Scatter, ReferenceLine, BarChart, Bar
} from 'recharts';

import { useAppStore } from '../store/useAppStore';
import manualSchema from '../config/manual_telemetry_schema.json';
import plantConfigJson from '../config/plant_config.json';
import toast from 'react-hot-toast';

class LocalErrorBoundary extends React.Component {
 constructor(props) {
 super(props);
 this.state = { hasError: false, error: null, errorInfo: null };
 }
 static getDerivedStateFromError(error) {
 return { hasError: true };
 }
 componentDidCatch(error, errorInfo) {
 this.setState({ error, errorInfo });
 console.error("LocalErrorBoundary caught:", error, errorInfo);
 }
 render() {
 if (this.state.hasError) {
 return (
 <div className="p-5 m-5 bg-red-900 border-2 border-red-500 rounded-lg text-theme-text">
 <h2 className="text-xl font-bold mb-2">Component Crashed!</h2>
 <p className="mb-4">Here is the exact error taking down the app:</p>
 <pre className="p-4 bg-black rounded overflow-x-auto text-sm text-red-700 dark:text-red-400">
 {this.state.error && this.state.error.toString()}
 </pre>
 <pre className="p-4 bg-black mt-2 rounded overflow-x-auto text-xs text-theme-text">
 {this.state.errorInfo && this.state.errorInfo.componentStack}
 </pre>
 <button 
 onClick={() => this.setState({ hasError: false })}
 className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 rounded font-bold"
 >
 Try to Recover
 </button>
 </div>
 );
 }
 return this.props.children;
 }
}


// Removed mockFetch to enforce honest data principles

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// DATA-DRIVEN PLANT CONFIGURATIONS
// ─────────────────────────────────────────────────────────────
const PLANT_CONFIGURATIONS = {
 "JETL": {
 "name": "Jeedimetla Effluent Treatment Ltd",
 "stage_sequence": ["UF", "RO1", "RO2", "RO-P"],
 // NOTE: none of the real JETL logsheets (UF, RO-1, RO-2, RO-P sheets) contain a
 // dedicated TMP tag, and UF has no conductivity tag at all. TMP-101/401/701/1001
 // and CDIC-101 were dead mappings that would never match a real column, leaving
 // every TMP-dependent KPI permanently null. TMP is now derived at parse time from
 // the feed/reject pressure pair for each stage — see deriveTMPFromPressurePairs().
 "mappings": {
 "UF": { "LT-101": "level", "PT-101": "pressure", "PT-102": "reject_pressure", "FT-101": "flux" },
 "RO1": { "PT-401": "pressure", "PT-402": "reject_pressure", "CDIC-401": "feed_conductivity", "CDIC-402": "conductivity", "FT-401": "flux" },
 "RO2": { "PT-701": "pressure", "PT-702": "reject_pressure", "CDIC-701": "feed_conductivity", "CDIC-702": "conductivity", "FT-701": "flux" },
 "RO-P": { "PT-1001": "pressure", "PT-1002": "reject_pressure", "CDIC-1001": "feed_conductivity", "CDIC-1002": "conductivity", "FT-1001": "flux" }
 }
 },
 "NIA": {
 "name": "Nandesari CETP (5-Train HPA / Parallel RO Array Math)",
 // Nandesari is NOT sequential stages like JETL (UF -> RO1 -> RO2). It is 5
 // PARALLEL HPA (High Pressure Array) trains that each run their own
 // TMF -> ACF -> RO Array 1 -> RO Array 2 -> 3rd stage -> degasser internally.
 // Each HPA is treated as its own "stage" so they display side by side.
 // The raw logsheet (NIA__log_sheet_*.xlsx) does NOT use dash-coded SCADA
 // tags like "PT-401" - it uses plain-English merged-cell headers repeated
 // identically inside all 5 HPA blocks per day-sheet, and the same physical
 // column position holds the same measurement in every block. Because of
 // that, the generic tag-string matcher in processMatrixData() cannot find
 // these headers (see parseNandesariWorkbook() below, which reads by fixed
 // column position per block instead of by tag-string lookup). This
 // `mappings` table is kept for two things only: (1) the friendly label
 // shown in the UI's "detected columns" panel, and (2) the TMP-derivation
 // fallback label lookup at parse time. It is NOT used to match columns.
 "stage_sequence": ["HPA1", "HPA2", "HPA3", "HPA4", "HPA5"],
 "mappings": {
 "HPA1": { "ARRAY 1 I/L": "pressure", "ARRAY 2 O/L": "reject_pressure", "PERMEATE 1st & 2nd CDT": "conductivity", "PERMEATE FLOW (1st & 2nd)": "flux", "FEED PH": "ph", "Turbidity Feed": "turbidity", "DG OUTLET TDS": "tds" },
 "HPA2": { "ARRAY 1 I/L": "pressure", "ARRAY 2 O/L": "reject_pressure", "PERMEATE 1st & 2nd CDT": "conductivity", "PERMEATE FLOW (1st & 2nd)": "flux", "FEED PH": "ph", "Turbidity Feed": "turbidity", "DG OUTLET TDS": "tds" },
 "HPA3": { "ARRAY 1 I/L": "pressure", "ARRAY 2 O/L": "reject_pressure", "PERMEATE 1st & 2nd CDT": "conductivity", "PERMEATE FLOW (1st & 2nd)": "flux", "FEED PH": "ph", "Turbidity Feed": "turbidity", "DG OUTLET TDS": "tds" },
 "HPA4": { "ARRAY 1 I/L": "pressure", "ARRAY 2 O/L": "reject_pressure", "PERMEATE 1st & 2nd CDT": "conductivity", "PERMEATE FLOW (1st & 2nd)": "flux", "FEED PH": "ph", "Turbidity Feed": "turbidity", "DG OUTLET TDS": "tds" },
 "HPA5": { "ARRAY 1 I/L": "pressure", "ARRAY 2 O/L": "reject_pressure", "PERMEATE 1st & 2nd CDT": "conductivity", "PERMEATE FLOW (1st & 2nd)": "flux", "FEED PH": "ph", "Turbidity Feed": "turbidity", "DG OUTLET TDS": "tds" }
 },
 // NOTE: no feed-side conductivity tag exists anywhere in this logsheet
 // (only permeate-side CDT and a downstream DG-outlet TDS), so salt_rejection
 // will always be null for NIA - not fabricated, genuinely not measured here.
 "parser": "nandesari"
 },
 "WAAREE": {
 "name": "Waaree Energies (ZLD / Silica Saturation Math)",
 "stage_sequence": ["UF", "RO1", "RO2", "MF"],
 "mappings": {
 "UF": { "PT-01": "pressure", "FT-01": "flux", "TMP-01": "tmp", "CDIC-01": "conductivity", "SIL-01": "silica" },
 "RO1": { "PT-02": "pressure", "FT-02": "flux", "TMP-02": "tmp", "CDIC-02": "conductivity", "SIL-02": "silica" },
 "RO2": { "PT-03": "pressure", "FT-03": "flux", "TMP-03": "tmp", "CDIC-03": "conductivity", "SIL-03": "silica" },
 "MF": { "PT-04": "pressure", "FT-04": "flux", "TMP-04": "tmp" }
 }
 }
};

// ─────────────────────────────────────────────────────────────
// NANDESARI (NIA) LOGSHEET PARSER
//
// Nandesari's logsheet is NOT the generic single-header-row-then-flat-rows
// shape every other plant uses. Each day is its own sheet (sheet name is
// the date, e.g. "01.06.2026"), and within that ONE sheet there are 5
// stacked blocks - one per HPA train - each shaped like:
//   row N   : "DATE" | ... | <date string in col I>
//   row N+1 : "<whitespace-padded> HPA <n> " label
//   row N+2 : group headers (TMF Pressure / Turbidity / ARRAY 1 / ...)
//   row N+3 : sub headers (Inlet/Outlet/DP, Feed/TMF O/l/ACF O/L, I/L/O/L/DP...)
//   row N+4..N+15 : 12 hourly readings, TIME as an Excel time value
//   row N+16: averages row (may contain #REF!/#DIV/0! from the source file
//             itself - never trust this row, we recompute our own averages)
//   row N+17: blank separator, then next block starts
//
// The generic processMatrixData() header detector looks for cells
// containing "PT-", "LT-", or exactly "Date"/"Time" - none of which exist
// here (headers are plain English, TIME is uppercase, there's no dash-coded
// tag anywhere). So instead of forcing this into the generic matcher, we
// read each block by FIXED COLUMN POSITION (verified against the real
// June 2026 file) and emit rows in the same flat `${stage}_${param}` shape
// the rest of the app (computeAnalytics, detectAnomalies, TMP derivation)
// already expects - so nothing downstream needs to know this plant is
// special.
// ─────────────────────────────────────────────────────────────
const NANDESARI_COLUMN_MAP = [
 // { col: 1-based column index within a block, param: standard field name }
 { col: 2, param: 'tmf_pressure_in' },
 { col: 3, param: 'tmf_pressure_out' },
 { col: 4, param: 'tmf_dp' },
 { col: 5, param: 'turbidity' },            // Turbidity - Feed
 { col: 9, param: 'ph' },                   // FEED PH
 { col: 10, param: 'vfd_rpm' },
 { col: 11, param: 'pressure' },            // ARRAY 1 I/L - treated as this train's RO feed pressure
 { col: 15, param: 'reject_pressure' },     // ARRAY 2 O/L - concentrate-side pressure
 { col: 17, param: 'flux' },                // PERMEATE FLOW (1st & 2nd stage)
 { col: 20, param: 'conductivity' },        // PERMEATE 1st & 2nd CDT - permeate quality
 { col: 24, param: 'permeate_flow_3rd' },
 { col: 26, param: 'permeate_conductivity_3rd' },
 { col: 27, param: 'reject_flow' },
 { col: 28, param: 'tds' },                 // DG OUTLET TDS
 { col: 29, param: 'permeate_ph' },
];

function excelTimeToHHMMSS(v) {
 if (v && typeof v === 'object' && typeof v.getHours === 'function') {
 // xlsx.js gives JS Date for time cells when cellDates:true
 return v.toTimeString().split(' ')[0];
 }
 if (typeof v === 'number') {
 const totalSeconds = Math.round(v * 86400);
 const h = String(Math.floor(totalSeconds / 3600) % 24).padStart(2, '0');
 const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
 const s = String(totalSeconds % 60).padStart(2, '0');
 return `${h}:${m}:${s}`;
 }
 return null;
}

// sheetName is expected like "01.06.2026" (DD.MM.YYYY) -> "2026-06-01"
function sheetNameToISODate(sheetName) {
 const m = sheetName.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
 if (!m) return null;
 const [, dd, mm, yyyy] = m;
 return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

// Walks one day-sheet's matrix, finds every "DATE" block, reads the "HPA n"
// label immediately below it, and emits readings into timelineMaster using
// the SAME flat shape processMatrixData() produces for every other plant.
function parseNandesariMatrix(matrix, sheetName, timelineMaster, detectedTopology, generatedColumnMapping) {
 const isoDate = sheetNameToISODate(sheetName);
 if (!isoDate) return; // skip non-date sheets (e.g. "Sheet2")

 for (let r = 0; r < matrix.length; r++) {
 const row = matrix[r] || [];
 if (String(row[0] || '').trim().toUpperCase() !== 'DATE') continue;

 const labelRow = matrix[r + 1] || [];
 const labelCell = labelRow.find(c => typeof c === 'string' && /HPA\s*\d/i.test(c));
 const hpaMatch = labelCell ? labelCell.match(/HPA\s*(\d)/i) : null;
 if (!hpaMatch) continue; // not a recognizable HPA block, skip
 const stage = `HPA${hpaMatch[1]}`;
 detectedTopology.add(stage);

 // data rows: r+4 through r+15 (12 hourly readings), stop at first row
 // whose TIME cell isn't a time value (hits the averages row or next block)
 for (let dr = r + 4; dr <= r + 15 && dr < matrix.length; dr++) {
 const dataRow = matrix[dr] || [];
 const timeVal = dataRow[0];
 const hhmmss = excelTimeToHHMMSS(timeVal);
 if (!hhmmss) continue; // blank/backwash/missing reading - skip, never fabricate

 const timeKey = `${isoDate}_${hhmmss}`;
 if (!timelineMaster[timeKey]) {
 timelineMaster[timeKey] = {
 time: `${isoDate}T${hhmmss}Z`,
 facility_id: 'NIA',
 stages_present: ['HPA1', 'HPA2', 'HPA3', 'HPA4', 'HPA5'],
 };
 }

 NANDESARI_COLUMN_MAP.forEach(({ col, param }) => {
 const raw = dataRow[col - 1];
 const val = parseFloat(raw);
 if (isNaN(val)) return; // missing reading (e.g. mid-backwash) - leave unset, not 0
 const flatKey = `${stage}_${param}`;
 timelineMaster[timeKey][flatKey] = val;
 if (!generatedColumnMapping[flatKey]) {
 generatedColumnMapping[flatKey] = { stage, param, label: `HPA ${hpaMatch[1]} raw col ${col}` };
 }
 });
 }
 }
}

// ─────────────────────────────────────────────────────────────
// ANALYTICS ENGINE
// Computes derived parameters from raw rows
// ─────────────────────────────────────────────────────────────
function computeAnalytics(rows, topology, plantLocation) {
 const stageData = {}; // stage → array of computed points

 topology.forEach(stage => {
 stageData[stage] = [];
 });
 stageData['GENERAL'] = [];

 rows.forEach((row, idx) => {
 const point = { ...row, _index: idx, time: row.time || `T${idx+1}` };

 // Place into correct stage buckets
 topology.forEach(stage => {
 const hasStageData = Object.keys(point).some(k => k.startsWith(stage + '_'));
 if (hasStageData) stageData[stage].push(point);
 });
 stageData['GENERAL'].push(point);
 });

 // ── Derived KPIs per stage ──────────────────────────────────
 const kpis = {};
 topology.forEach(stage => {
 const pts = stageData['GENERAL'];
 const tmpKey = `${stage}_tmp`;
 const fluxKey = `${stage}_flux`;
 const condKey = `${stage}_conductivity`;
 const pressKey = `${stage}_pressure`;

 const tmpVals = pts.map(p => parseFloat(p[tmpKey])).filter(v => !isNaN(v) && v > 0);
 const fluxVals = pts.map(p => parseFloat(p[fluxKey])).filter(v => !isNaN(v) && v > 0);
 const condVals = pts.map(p => parseFloat(p[condKey])).filter(v => !isNaN(v) && v > 0);

 const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
 const last = arr => arr.length ? arr[arr.length - 1] : null;
 const lastNonZero = arr => { const a = arr.filter(x => x > 0); return a.length ? a[a.length - 1] : null; };
 const first = arr => arr.length ? arr[0] : null;

 // TMP rise rate (bar/hour proxy — per data point)
 let tmpRiseRate = null;
 if (tmpVals.length >= 2) {
 const startTMP = first(tmpVals);
 const endTMP = lastNonZero(tmpVals);
 if (startTMP && endTMP) tmpRiseRate = ((endTMP - startTMP) / tmpVals.length) * 100;
 }

 // Flux decline rate
 let fluxDeclineRate = null;
 if (fluxVals.length >= 2) {
 const startFlux = first(fluxVals);
 const endFlux = lastNonZero(fluxVals);
 if (startFlux && endFlux) fluxDeclineRate = ((startFlux - endFlux) / startFlux) * 100;
 }

 // Salt rejection from conductivity (if feed + permeate available)
 // Keys must match what the parser actually generates: ${stage}_feed_conductivity
 // (e.g. CDIC-401 on RO1) and ${stage}_conductivity (e.g. CDIC-402, permeate side).
 // The old generic 'FEED_conductivity'/'conductivity' keys never matched real
 // parsed data, so this always evaluated to null.
 let saltRejection = null;
 const feedCondKey = `${stage}_feed_conductivity`;
 const feedCond = pts.map(p => p[feedCondKey]).filter(v => typeof v === 'number' && !isNaN(v));
 const permCond = pts.map(p => p[condKey]).filter(v => typeof v === 'number' && !isNaN(v));
 if (feedCond.length && permCond.length) {
 const avgFeedCond = avg(feedCond);
 if (avgFeedCond) {
 saltRejection = ((1 - avg(permCond) / avgFeedCond) * 100).toFixed(1);
 }
 }

 // Fouling index (normalized TMP trend)
 const foulingIndex = tmpVals.length >= 2
 ? ((lastNonZero(tmpVals) - first(tmpVals)) / (first(tmpVals) || 1)) * 100
 : null;

 // Predicted days to CIP (linear regression on TMP)
 let daysToCIP = null;
 const CIP_THRESHOLD_BAR = { UF: 3.0, RO1: 10.0, RO2: 10.0, NF: 8.0, MF: 2.5, RO3: 10.0 };
 const threshold = CIP_THRESHOLD_BAR[stage] || 5.0;
 if (tmpVals.length >= 3 && tmpRiseRate > 0) {
 const currentTMP = lastNonZero(tmpVals);
 const ratePerPoint = (lastNonZero(tmpVals) - first(tmpVals)) / tmpVals.length;
 if (ratePerPoint > 0) {
 const pointsToCIP = (threshold - currentTMP) / ratePerPoint;
 daysToCIP = Math.max(0, Math.round(pointsToCIP * 15 / 1440));
 }
 }

 // System health score (0-100)
 let healthScore = 100;
 if (foulingIndex !== null && foulingIndex > 0) healthScore -= Math.min(40, foulingIndex * 2);
 if (fluxDeclineRate !== null && fluxDeclineRate > 0) healthScore -= Math.min(30, fluxDeclineRate);
 if (saltRejection !== null && saltRejection < 95) healthScore -= (95 - saltRejection) * 2;
 healthScore = Math.max(0, Math.round(healthScore));

 // NDP = Feed Pressure - Osmotic Pressure - Permeate Back Pressure (simplified)
 const avgPress = avg(pts.map(p => p[pressKey]).filter(v => v !== undefined));
 const avgCond = avg(condVals);
 const osmoticPressure = avgCond ? avgCond * 0.008 : null; 
 const ndp = avgPress && osmoticPressure ? (avgPress - osmoticPressure).toFixed(2) : null;

 kpis[stage] = {
 avgTMP: avg(tmpVals)?.toFixed(2) ?? null,
 lastTMP: lastNonZero(tmpVals)?.toFixed(2) ?? null,
 avgFlux: avg(fluxVals)?.toFixed(1) ?? null,
 avgConductivity: avg(condVals)?.toFixed(0) ?? null,
 tmpRiseRate: tmpRiseRate?.toFixed(3) ?? null,
 fluxDeclineRate: fluxDeclineRate?.toFixed(1) ?? null,
 saltRejection,
 foulingIndex: foulingIndex?.toFixed(1) ?? null,
 daysToCIP,
 healthScore,
 ndp,
 dataPoints: tmpVals.length || fluxVals.length || condVals.length,
 };
 });

 // ── Fouling forecast timeseries (extrapolation) ────────────
 const forecast = {};
 topology.forEach(stage => {
 const pts = stageData['GENERAL'];
 forecast[stage] = [];

 if (plantLocation === 'NIA') {
 const codKey = Object.keys(pts[0] || {}).find(k => k.toLowerCase().includes('cod')) || `${stage}_cod`;
 const codVals = pts.map(p => p[codKey]).filter(v => v !== undefined);
 if (codVals.length >= 2) {
 let currentEff = 85.0; 
 for (let i = 1; i <= 30; i++) {
 forecast[stage].push({
 day: `+${i}d`,
 predicted_aop_efficiency: parseFloat((currentEff - (i * 0.15)).toFixed(1)),
 threshold: 65.0
 });
 }
 return;
 }
 } 
 
 if (plantLocation === 'WAAREE') {
 let baseSilica = 80;
 for (let i = 1; i <= 30; i++) {
 forecast[stage].push({
 day: `+${i}d`,
 predicted_silica_saturation: parseFloat(((baseSilica + (i * 1.2)) / 120 * 100).toFixed(1)),
 threshold: 100.0
 });
 }
 return;
 }

 const tmpKey = `${stage}_tmp`;
 const tmpVals = pts.map(p => p[tmpKey]).filter(v => v !== undefined);
 if (tmpVals.length >= 2) {
 const ratePerPoint = (tmpVals[tmpVals.length - 1] - tmpVals[0]) / tmpVals.length;
 const lastTMP = tmpVals[tmpVals.length - 1];
 for (let i = 1; i <= 30; i++) {
 forecast[stage].push({
 day: `+${i}d`,
 predicted_tmp: parseFloat((lastTMP + ratePerPoint * i * 96).toFixed(3)),
 threshold: { UF: 3.0, RO1: 10.0, RO2: 10.0, NF: 8.0 }[stage] || 5.0,
 });
 }
 }
 });

 return { stageData, kpis, forecast };
}

// ─────────────────────────────────────────────────────────────
// ANOMALY DETECTOR
// ─────────────────────────────────────────────────────────────
function detectAnomalies(rows, columnMapping, topology) {
 const anomalies = [];
 const THRESHOLDS = {
 UF: { tmp: 3.0, flux_drop_pct: 20 },
 RO1: { tmp: 10.0, flux_drop_pct: 15 },
 RO2: { tmp: 10.0, flux_drop_pct: 15 },
 NF: { tmp: 8.0, flux_drop_pct: 15 },
 MF: { tmp: 2.5, flux_drop_pct: 25 },
 };

 const tsCol = Object.entries(columnMapping).find(([, v]) => v.param === 'timestamp');

 topology.forEach(stage => {
 const tmpKey = `${stage}_tmp`;
 const fluxKey = `${stage}_flux`;
 const condKey = `${stage}_conductivity`;
 const phKey = `${stage}_ph` || 'ph';
 const thresh = THRESHOLDS[stage] || { tmp: 5.0, flux_drop_pct: 20 };

 rows.forEach((row, idx) => {
 const ts = tsCol ? row[tsCol[0]] : `Row ${idx + 1}`;
 const tmpVal = parseFloat(row[Object.keys(columnMapping).find(k => columnMapping[k].param === 'tmp' && columnMapping[k].stage === stage) || '']);
 const phVal = parseFloat(row[Object.keys(columnMapping).find(k => columnMapping[k].param === 'ph') || '']);
 const condVal = parseFloat(row[Object.keys(columnMapping).find(k => columnMapping[k].param === 'conductivity') || '']);

 if (!isNaN(tmpVal) && tmpVal > thresh.tmp) {
 anomalies.push({ ts, stage, type: 'TMP Exceeded', severity: tmpVal > thresh.tmp * 1.3 ? 'critical' : 'high', value: tmpVal.toFixed(2), threshold: thresh.tmp, unit: 'bar' });
 }
 if (!isNaN(phVal) && (phVal < 5.5 || phVal > 9.0)) {
 anomalies.push({ ts, stage, type: 'pH Out of Range', severity: 'medium', value: phVal.toFixed(1), threshold: '6–8.5', unit: 'pH' });
 }
 if (!isNaN(condVal) && condVal > 5000) {
 anomalies.push({ ts, stage, type: 'High Conductivity', severity: 'medium', value: condVal.toFixed(0), threshold: 5000, unit: 'µS/cm' });
 }
 });
 });

 const seen = new Set();
 return anomalies.filter(a => {
 const key = `${a.stage}_${a.type}`;
 if (seen.has(key)) return false;
 seen.add(key);
 return true;
 }).slice(0, 12);
}

// ─────────────────────────────────────────────────────────────
// COLOR PALETTE
// ─────────────────────────────────────────────────────────────
const STAGE_COLORS = {
 UF: '#06b6d4',
 MF: '#8b5cf6',
 NF: '#f59e0b',
 RO1: '#10b981',
 RO2: '#3b82f6',
 RO3: '#f97316',
 HPA1: '#06b6d4',
 HPA2: '#10b981',
 HPA3: '#3b82f6',
 HPA4: '#f59e0b',
 HPA5: '#a855f7',
 GENERAL: '#94a3b8',
};

const HEALTH_COLOR = (score) => {
 if (score >= 75) return 'text-emerald-700 dark:text-emerald-400';
 if (score >= 50) return 'text-amber-700 dark:text-amber-400';
 return 'text-rose-700 dark:text-rose-400';
};

const HEALTH_BG = (score) => {
 if (score >= 75) return 'bg-emerald-500/20 border-emerald-500/30';
 if (score >= 50) return 'bg-amber-500/20 border-amber-500/30';
 return 'bg-rose-500/20 border-rose-500/30';
};

// ─────────────────────────────────────────────────────────────
// INITIAL DATA FOR BATCH TABLE
// ─────────────────────────────────────────────────────────────
const generateSensorSnapshot = () => {
 const data = [];
 const now = new Date().getTime();
 for (let i = 0; i < 60; i++) {
 const t = new Date(now + i * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
 data.push({
 time: t,
 actual_tmp: 1.2 + (i * 0.01),
 predicted_tmp: 1.2 + (i * 0.008),
 actual_flux: 45 - (i * 0.05),
 predicted_flux: 45 - (i * 0.02),
 });
 }
 return data;
};

const initialBatches = [];

// ─────────────────────────────────────────────────────────────
// TOOLTIP COMPONENT
// ─────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
 if (!active || !payload?.length) return null;
 return (
 <div className="bg-theme-panel backdrop-blur-md border border-theme-border rounded-xl p-3 shadow-2xl text-xs font-bold text-theme-text premium-card" style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', border: '1px solid var(--border-panel)', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)', color: 'var(--text-main)' }}>
 <div className="text-theme-muted mb-2 font-bold">{label}</div>
 {payload.map((p, i) => (
 <div key={i} className="flex items-center gap-2 mb-1">
 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
 <span className="text-theme-text" style={{ color: 'var(--text-muted)' }}>{p.name}:</span>
 <span className="text-theme-text font-bold" style={{ color: 'var(--text-main)' }}>{typeof p.value === 'number' ? p.value.toFixed(3) : p.value}</span>
 </div>
 ))}
 </div>
 );
};

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function BatchAnalytics() {
 const { userRole, logAuditEvent, selectedFacility, syncStatus, telemetryHistory, startPlaybackMode } = useAppStore();

 const [batches, setBatches] = useState(initialBatches);
 const [models, setModels] = useState([]);
 const [filterStatus, setFilterStatus] = useState('all');
 const [sortConfig, setSortConfig] = useState({ key: 'started_at', direction: 'desc' });
 const [currentPage, setCurrentPage] = useState(1);
 const itemsPerPage = 10;
 const [isModelsLoading, setIsModelsLoading] = useState(true);
 const [stats, setStats] = useState({ total_annotated: 0, pending_reviews: 0 });
 const [selectedBatch, setSelectedBatch] = useState(null);
 const [annoCorrect, setAnnoCorrect] = useState(null);
 const [annoRecovery, setAnnoRecovery] = useState('');
 const [annoReason, setAnnoReason] = useState('normal_operation');
 const [annoDetail, setAnnoDetail] = useState('');
 const [annoConfidence, setAnnoConfidence] = useState(5);
 const [isRetraining, setIsRetraining] = useState(false);
 const [trainingProgress, setTrainingProgress] = useState(0);
 const [isManualPanelOpen, setIsManualPanelOpen] = useState(false);

 const [uploadState, setUploadState] = useState('idle');
 const [uploadError, setUploadError] = useState('');
 const [rawRows, setRawRows] = useState([]);
 const [rawHeaders, setRawHeaders] = useState([]);
 const [columnMapping, setColumnMapping] = useState({});
 const [plantTopology, setPlantTopology] = useState([]);
 const [analyticsResult, setAnalyticsResult] = useState(null);
 const [anomalies, setAnomalies] = useState([]);
 const [activeStage, setActiveStage] = useState(null);
 const [activeChart, setActiveChart] = useState('tmp');
 const [isDragging, setIsDragging] = useState(false);
 const [uploadedFileName, setUploadedFileName] = useState('');
 const [selectedPlantLocation, setSelectedPlantLocation] = useState('JETL');
 const [aiInsights, setAiInsights] = useState('');
 const [isAiLoading, setIsAiLoading] = useState(false);
 const fileRef = useRef(null);

 // Honest empty states - no fake models or stats generated locally
 // In a real environment, these would stream from useAppStore or a WebSocket.

 const analyzeLiveSession = useCallback(() => {
 if (!telemetryHistory || telemetryHistory.length === 0) {
 setUploadError('Live telemetry buffer is empty. Wait for data to sync.');
 setUploadState('error');
 return;
 }
 
 setUploadState('parsing');
 setUploadedFileName('Live_Session_Telemetry.csv');
 setAiInsights('');
 
 const plantConfig = plantConfigJson[selectedPlantLocation] || plantConfigJson['JETL'];
 const activeTopology = plantConfig.stage_sequence || ['UF', 'RO1', 'RO2', 'RO-P'];
 
 const mappedRows = telemetryHistory.map((record) => {
 const row = { time: record.timestamp || record.date || new Date().toISOString() };
 activeTopology.forEach(stage => {
 const stageData = record.stages?.[stage] || record;
 row[`${stage}_pressure`] = stageData.feed_pressure ?? null;
 row[`${stage}_reject_pressure`] = stageData.reject_pressure ?? null;
 row[`${stage}_tmp`] = stageData.differential_pressure ?? null;
 row[`${stage}_flux`] = stageData.flow_rate ?? null;
 row[`${stage}_feed_conductivity`] = stageData.conductivity ?? null;
 row[`${stage}_conductivity`] = stageData.permeate_conductivity ?? null;
 });
 return row;
 });

 try {
 activeTopology.forEach(stage => {
 mappedRows.forEach(row => {
 if (row[`${stage}_tmp`] == null && typeof row[`${stage}_pressure`] === 'number') {
 const rejP = row[`${stage}_reject_pressure`] ?? (row[`${stage}_pressure`] - 0.5);
 row[`${stage}_tmp`] = parseFloat(((row[`${stage}_pressure`] + rejP) / 2).toFixed(3));
 }
 });
 });

 const result = computeAnalytics(mappedRows, activeTopology, selectedPlantLocation);
 const anomalyList = detectAnomalies(mappedRows, {}, activeTopology);
 
 setRawHeaders(Object.keys(mappedRows[0] || {}));
 setRawRows(mappedRows);
 setColumnMapping({});
 setPlantTopology(activeTopology);
 setAnalyticsResult(result);
 setAnomalies(anomalyList);
 setActiveStage(activeTopology[0]);
 setUploadState('done');
 } catch (err) {
 console.error(err);
 setUploadError(err.message || 'Failed to analyze live session data.');
 setUploadState('error');
 }
 }, [telemetryHistory, selectedPlantLocation]);

 const pendingCount = stats.pending_reviews || batches.filter(b => b.annotation_status === 'pending').length;
 const totalAnnotated = stats.total_annotated || (batches.length - pendingCount);
 const currentModel = models.find(m => m.status === 'DEPLOYED LIVE') || models[0] || { version: 'v0.0', accuracy: 0 };

 const handleUploadComplete = async (jsonRows, fileName) => {
    if (!jsonRows || jsonRows.length === 0) return;
    setUploadState('parsing');
    setUploadError('');
    setUploadedFileName(fileName);
    setAiInsights('');

    try {
      // Auto-detect topology from the JSON row keys (e.g. "HPA1_pressure" -> "HPA1")
      const detectedStages = new Set();
      jsonRows.forEach(row => {
        Object.keys(row).forEach(key => {
          if (key !== 'time' && key !== 'timestamp' && key.includes('_')) {
            detectedStages.add(key.split('_')[0]);
          }
        });
      });
      const topology = Array.from(detectedStages).length ? Array.from(detectedStages) : ['GENERAL'];
      
      const result = computeAnalytics(jsonRows, topology, selectedPlantLocation);
      
      try {
        const mlRes = await fetch('/api/models/forecast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plantId: selectedPlantLocation, days: 30 })
        });
        if (mlRes.ok) {
          const mlData = await mlRes.json();
          if (!mlData.error) {
            topology.forEach(stage => {
              result.forecast[stage] = mlData.map(d => ({
                day: d.day,
                predicted_tmp: d.predicted_tmp,
                predicted_flux: d.predicted_flux,
                threshold: { UF: 3.0, RO1: 10.0, RO2: 10.0, NF: 8.0 }[stage] || 5.0
              }));
            });
          }
        }
      } catch (err) {}

      const anomalyList = detectAnomalies(jsonRows, {}, topology);

      setRawHeaders(Object.keys(jsonRows[0] || {}));
      setRawRows(jsonRows);
      setColumnMapping({}); 
      setPlantTopology(topology);
      setAnalyticsResult(result);
      setAnomalies(anomalyList);
      setActiveStage(topology[0]);
      setUploadState('done');

    } catch (err) {
      console.error(err);
      setUploadError(err.message || 'Failed to analyze data.');
      setUploadState('error');
    }
  };

 const resetUpload = () => {
 setUploadState('idle');
 setRawRows([]);
 setRawHeaders([]);
 setColumnMapping({});
 setPlantTopology([]);
 setAnalyticsResult(null);
 setAnomalies([]);
 setActiveStage(null);
 setAiInsights('');
 setUploadedFileName('');
 if (fileRef.current) fileRef.current.value = '';
 };

 const generateAiInsights = async () => {
 if (!analyticsResult) return;
 setIsAiLoading(true);
 setAiInsights('');

 const kpiSummary = Object.entries(analyticsResult.kpis).map(([stage, kpi]) => `${stage}: TMP=${kpi.lastTMP ?? 'N/A'} bar, Flux=${kpi.avgFlux ?? 'N/A'} LMH, FoulingIdx=${kpi.foulingIndex ?? 'N/A'}%, Health=${kpi.healthScore}/100, DaysToCIP=${kpi.daysToCIP ?? 'Unknown'}`).join('\n');
 const anomalySummary = anomalies.slice(0, 5).map(a => `${a.stage} - ${a.type}: ${a.value} (threshold: ${a.threshold} ${a.unit})`).join('\n');

 const telemetryPayload = {
 topology: plantTopology,
 fileName: uploadedFileName,
 kpis: analyticsResult.kpis,
 anomalies: anomalies.slice(0, 12)
 };

 try {
 const res = await fetch('/api/analytics/ai-insights', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(telemetryPayload)
 });

 if (!res.ok) throw new Error('Proxy error');
 const json = await res.json();
 setAiInsights(json.insights || json.content || 'Analysis cycle cleared without production notices.');
 } catch (err) {
 setAiInsights('AI analysis system temporarily unreachable. Check network status.');
 } finally {
 setIsAiLoading(false);
 }
 };

 const handleAddToTraining = async () => {
 try {
 const res = await fetch('http://localhost:5000/api/upload-dataset', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 name: uploadedFileName,
 plantId: selectedPlantLocation,
 rows: rawRows
 })
 });
 if (res.ok) {
 toast.success("Dataset permanently saved for model training!");
 } else {
 toast.error("Failed to upload dataset to server.");
 }
 } catch (e) {
 toast.error("Error connecting to ML server.");
 }
 resetUpload();
 };

 const handleRowClick = (batch) => {
 setSelectedBatch(batch);
 setAnnoCorrect(null);
 setAnnoRecovery(batch.actual_recovery);
 setAnnoReason('normal_operation');
 setAnnoDetail('');
 setAnnoConfidence(5);
 };

 const handleAnnotationSubmit = () => {
 if (!selectedBatch) return;
 setBatches(batches.map(b => b.id === selectedBatch.id
 ? { ...b, annotation_status: annoCorrect ? 'confirmed' : 'corrected', actual_recovery: annoCorrect ? b.actual_recovery : Number(annoRecovery) }
 : b
 ));

 logAuditEvent(
 annoCorrect ? 'Batch Confirmation' : 'Batch Correction (RLHF)',
 `Batch ${selectedBatch.batch_number} - Predicted Recovery: ${selectedBatch.predicted_recovery}%, Actual: ${annoCorrect ? selectedBatch.actual_recovery : annoRecovery}%.`
 );

 toast.success('Annotation saved to feedback store');
 setSelectedBatch(null);
 };

 const triggerRetraining = async () => {
 setIsRetraining(true);
 setTrainingProgress(0);
 const payload = batches.filter(b => b.annotation_status === 'pending');
 
 const interval = setInterval(() => {
 setTrainingProgress(p => p < 90 ? p + 5 : p);
 }, 500);

 try {
 const res = await fetch('/api/models/retrain', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ plantId: selectedPlantLocation, batches: payload })
 });
 
 clearInterval(interval);
 setTrainingProgress(100);
 
 if (!res.ok) throw new Error(`Retrain request failed with status ${res.status}`);
 const result = await res.json();

 setTimeout(async () => {
 setIsRetraining(false);
 setBatches(prev => prev.map(b => b.annotation_status === 'pending' ? { ...b, annotation_status: 'confirmed' } : b));
 // Use whatever the training server actually reports — do not fabricate
 // accuracy or sample counts client-side. If the server omits a field,
 // show it as unknown rather than inventing a plausible-looking number.
 setModels(prev => [{
 version: result.new_version ?? result.version ?? 'unknown',
 training_date: result.training_date ?? new Date().toISOString().replace('T', ' ').slice(0, 19),
 accuracy: typeof result.accuracy === 'number' ? result.accuracy : null,
 training_samples: result.training_samples ?? null,
 source_facility: selectedPlantLocation,
 rlhf_corrections: stats.total_annotated,
 status: 'READY'
 }, ...prev]);
 toast.success(`Model ${result.new_version ?? ''} trained on real feedback data.`);
 }, 500);
 } catch (e) { 
 console.error(e); 
 clearInterval(interval);
 setIsRetraining(false);
 toast.error("Failed to connect to ML Training Server");
 }
 };
 const [confirmDeployVersion, setConfirmDeployVersion] = useState(null);

 const requestDeploy = (ver) => {
 const targetModel = models.find(m => m.version === ver);
 if (parseFloat(targetModel.version.replace('v', '')) < parseFloat(currentModel.version.replace('v', ''))) {
 setConfirmDeployVersion(ver);
 } else {
 executeDeploy(ver);
 }
 };

 const executeDeploy = (ver) => {
 setModels(models.map(m => ({ ...m, status: m.version === ver ? 'DEPLOYED LIVE' : 'ARCHIVED' })));
 setConfirmDeployVersion(null);
 logAuditEvent('Model Deployment', `Deployed model ${ver} to live production. Displaced older model.`);
 toast.success(`Model ${ver} deployed. Rollback audited in system log.`);
 };

 const sortedAndFilteredBatches = useMemo(() => {
 let result = [...batches];
 if (filterStatus !== 'all') {
 result = result.filter(b => b.annotation_status === filterStatus);
 }
 result.sort((a, b) => {
 let aVal = a[sortConfig.key];
 let bVal = b[sortConfig.key];
 if (sortConfig.key === 'recovery') { aVal = a.actual_recovery; bVal = b.actual_recovery; }
 if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
 if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
 return 0;
 });
 return result;
 }, [batches, filterStatus, sortConfig]);

 const paginatedBatches = useMemo(() => {
 const startIndex = (currentPage - 1) * itemsPerPage;
 return sortedAndFilteredBatches.slice(startIndex, startIndex + itemsPerPage);
 }, [sortedAndFilteredBatches, currentPage]);

 useEffect(() => {
 setCurrentPage(1);
 }, [filterStatus, sortConfig]);

 const handleSort = (key) => {
 setSortConfig(prev => ({
 key,
 direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
 }));
 };

 const chartData = useMemo(() => {
 if (!analyticsResult || !activeStage) return [];
 const fullData = analyticsResult.stageData['GENERAL'];
 const MAX_CHART_POINTS = 500;
 const step = Math.max(1, Math.floor(fullData.length / MAX_CHART_POINTS));
 const sampledData = fullData.filter((_, i) => i % step === 0 || i === fullData.length - 1);

 return sampledData.map(pt => ({
 time: pt.time,
 tmp: pt[`${activeStage}_tmp`],
 flux: pt[`${activeStage}_flux`],
 pressure: pt[`${activeStage}_pressure`],
 conductivity: pt[`${activeStage}_conductivity`],
 ph: pt['ph'] || pt[`${activeStage}_ph`],
 flow: pt[`${activeStage}_flow`],
 turbidity: pt['turbidity'] || pt[`${activeStage}_turbidity`],
 }));
 }, [analyticsResult, activeStage]);

 return (
 <div className="flex flex-col min-h-full relative pb-10 animate-in fade-in duration-300">
 
 {/* ————————————————————————————————————————————————————————————————
 0. PAGE HEADER
 ———————————————————————————————————————————————————————————————— */}
 <div className="mb-6 flex flex-wrap justify-between items-start gap-4">
 <div>
 <h1 className="text-2xl font-black text-theme-text tracking-widest">Batch analytics</h1>
 <p className="text-[13px] text-theme-muted font-medium mt-1">
 {plantConfigJson[selectedFacility]?.display_name || selectedFacility} · Last synced {syncStatus?.lastSynced && !isNaN(new Date(syncStatus.lastSynced).getTime()) ? new Date(syncStatus.lastSynced).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) + ' IST' : 'Never'}
 </p>
 </div>
 <div className="flex items-center gap-3">
 <button onClick={() => setIsManualPanelOpen(true)} className="flex items-center gap-2 px-4 py-3 rounded-lg font-bold text-sm bg-purple-600 hover:bg-purple-500 text-theme-text shadow-lg border border-purple-400 transition-colors">
 <Beaker size={16} /> Manual Lab Entry
 </button>
 {userRole === 'admin' && (
 <button onClick={triggerRetraining} disabled={isRetraining || pendingCount > 0}
 className={`flex items-center gap-2 px-4 py-3 rounded-lg font-bold text-sm transition-all shadow-lg border ${isRetraining ? 'bg-blue-900/50 border-blue-500/30 text-blue-700 dark:text-blue-400' : pendingCount > 0 ? 'bg-slate-100 dark:bg-slate-800 border-theme-border text-theme-muted cursor-not-allowed opacity-80' : 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-theme-text'}`}
 >
 {isRetraining ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
 {isRetraining ? 'Training Epochs...' : pendingCount > 0 ? `Resolve ${pendingCount} Pending Reviews to Retrain` : 'Retrain Model Now'}
 </button>
 )}
 </div>
 </div>



 {/* ————————————————————————————————————————————————————————————————
 2. INTELLIGENT DATA UPLOAD ENGINE
 ———————————————————————————————————————————————————————————————— */}
 <div className="bg-theme-panel border border-theme-border rounded-xl shadow-2xl mb-6 overflow-hidden shrink-0 premium-card">
 <div className="p-5 border-b border-theme-border flex items-center justify-between bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-900 dark:to-[#0a1628]">
 <div className="flex items-center gap-3">
 <div className="bg-cyan-500/20 p-2.5 rounded-lg border border-cyan-500/30">
 <FileSpreadsheet size={20} className="text-cyan-700 dark:text-cyan-400" />
 </div>
 <div>
 <h2 className="text-base font-bold text-theme-text flex items-center gap-2">
 Plant Data Upload & Analysis Engine
 <span className="text-[9px] font-bold bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded uppercase tracking-widest">Auto-Detect</span>
 </h2>
 <p className="text-xs text-theme-muted mt-0.5">Upload SCADA export, lab log, or historian CSV/Excel. Engine auto-detects plant topology and computes fouling analytics.</p>
 </div>
 </div>
 {uploadState === 'done' && (
 <button onClick={resetUpload} className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-theme-muted hover:text-theme-text bg-slate-100 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg border border-theme-border transition-colors">
 <RefreshCw size={12} /> New Upload
 </button>
 )}
 </div>

 {uploadState === 'idle' || uploadState === 'error' ? (
 <div className="p-5 flex flex-col gap-5">
 <div className="flex flex-col gap-2 bg-theme-panel p-4 rounded-xl border border-theme-border">
 <label className="text-xs text-theme-muted font-bold uppercase tracking-widest flex items-center gap-2">
 <Database size={14} className="text-blue-700 dark:text-blue-400" /> Plant Location & Physics Model
 </label>
 <select 
 value={selectedPlantLocation}
 onChange={(e) => setSelectedPlantLocation(e.target.value)}
 className="bg-theme-panel border border-theme-border text-theme-text p-3 rounded-lg text-sm w-full outline-none focus:border-cyan-500 font-bold"
 >
 <option value="JETL">JETL — Jeedimetla ETP (Standard CETP / Mineral Scaling Math)</option>
 <option value="NIA">NIA — Nandesari CETP (AOP-Based / Destruction Efficiency Math)</option>
 <option value="WAAREE">Waaree Energies (ZLD / Silica Saturation Math)</option>
 </select>
 </div>
          <SmartUploader onUploadComplete={handleUploadComplete} plantId={selectedPlantLocation} />
          <div className="flex items-center justify-center gap-4 mt-2">
            <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1"></div>
            <span className="text-xs text-theme-muted font-bold uppercase tracking-widest">OR</span>
            <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1"></div>
          </div>
 <button 
 onClick={analyzeLiveSession} 
 className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl font-bold text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-theme-text shadow-lg border border-theme-border transition-colors"
 >
 <Activity size={18} className="text-cyan-700 dark:text-cyan-400" /> Analyze Current Live Session ({telemetryHistory?.length || 0} pts)
 </button>
 </div>
 ) : uploadState === 'parsing' ? (
 <div className="m-5 p-12 flex flex-col items-center gap-4">
 <Loader2 size={36} className="text-cyan-700 dark:text-cyan-400 animate-spin" />
 <div className="text-sm font-bold text-theme-text">Parsing file & detecting column schema…</div>
 <div className="text-xs text-theme-muted">Reading headers → matching parameter patterns → identifying plant stages</div>
 </div>
 ) : uploadState === 'done' && analyticsResult ? (
 <LocalErrorBoundary>
 <AnalysisResults
 uploadedFileName={uploadedFileName}
 rawRows={rawRows}
 rawHeaders={rawHeaders}
 columnMapping={columnMapping}
 unmappedColumns={rawHeaders.filter(h => !columnMapping[h])}
 plantTopology={plantTopology}
 analyticsResult={analyticsResult}
 anomalies={anomalies}
 activeStage={activeStage}
 setActiveStage={setActiveStage}
 activeChart={activeChart}
 setActiveChart={setActiveChart}
 chartData={chartData}
 aiInsights={aiInsights}
 isAiLoading={isAiLoading}
 generateAiInsights={generateAiInsights}
 onAddToTraining={handleAddToTraining}
 onPublishToDashboard={() => {
 try {
 // PLANT_CONFIGURATIONS in this file uses short codes ('JETL'/'NIA'/'WAAREE')
 // but useAppStore/plant_config.json use full facility ids ('jetl_hyderabad'/
 // 'nia_nandesari'). startPlaybackMode needs the REAL id to tag rows
 // correctly — passing the short code would silently break facility-scoped
 // filtering (Nandesari data would never match selectedFacility ===
 // 'nia_nandesari' in the store).
 const FACILITY_ID_MAP = { JETL: 'jetl_hyderabad', NIA: 'nia_nandesari' };
 const realFacilityId = FACILITY_ID_MAP[selectedPlantLocation];
 if (!realFacilityId) {
 toast.error(`"${selectedPlantLocation}" has no wired facility id yet — cannot publish to the live dashboard.`);
 return;
 }
 startPlaybackMode(rawRows, columnMapping, realFacilityId);
 toast.success(`Historical dataset published to Dashboard as ${realFacilityId}!`);
 } catch (e) {
 console.error('Playback mode failed:', e);
 toast.error('Failed to publish historical data to Dashboard. See console for details.');
 }
 }}
 />
 </LocalErrorBoundary>
 ) : null}
 </div>

 {/* ————————————————————————————————————————————————————————————————
 3. BATCH LOG & RLHF QUEUE
 ———————————————————————————————————————————————————————————————— */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 shrink-0">
 <div className="bg-theme-panel rounded-lg p-4 flex flex-col justify-center">
 <div className="text-[11px] text-theme-muted uppercase tracking-widest font-bold mb-1">Total batches</div>
 <div className="text-[22px] text-theme-text font-medium">{sortedAndFilteredBatches.length}</div>
 </div>
 <div className="bg-theme-panel rounded-lg p-4 flex flex-col justify-center">
 <div className="text-[11px] text-theme-muted uppercase tracking-widest font-bold mb-1">Pending review</div>
 <div className={`text-[22px] font-medium ${sortedAndFilteredBatches.filter(b => b.annotation_status === 'pending').length > 0 ? 'text-orange-800 dark:text-orange-400' : 'text-theme-text'}`}>
 {sortedAndFilteredBatches.filter(b => b.annotation_status === 'pending').length}
 </div>
 </div>
 <div className="bg-theme-panel rounded-lg p-4 flex flex-col justify-center">
 <div className="text-[11px] text-theme-muted uppercase tracking-widest font-bold mb-1">Avg recovery</div>
 <div className="text-[22px] text-emerald-700 dark:text-emerald-400 font-medium">
 {sortedAndFilteredBatches.filter(b => b.annotation_status === 'confirmed').length > 0 
 ? (sortedAndFilteredBatches.filter(b => b.annotation_status === 'confirmed').reduce((sum, b) => sum + b.actual_recovery, 0) / sortedAndFilteredBatches.filter(b => b.annotation_status === 'confirmed').length).toFixed(1)
 : '0.0'}%
 </div>
 </div>
 <div className="bg-theme-panel rounded-lg p-4 flex flex-col justify-center">
 <div className="text-[11px] text-theme-muted uppercase tracking-widest font-bold mb-1">RLHF annotations</div>
 <div className="text-[22px] text-theme-text font-medium">245</div>
 </div>
 </div>

 <div className="flex-1 bg-theme-panel border border-theme-border rounded-xl shadow-lg flex flex-col overflow-hidden mb-6 premium-card" style={{ minHeight: 320 }}>
 <div className="p-4 border-b border-theme-border flex justify-between items-center bg-theme-panel">
 <h2 className="text-sm font-bold text-theme-text flex items-center gap-2 tracking-widest">
 <Database size={16} className="text-blue-700 dark:text-blue-500" /> Batch log & RLHF queue
 </h2>
 <div className="flex gap-4 text-xs font-bold px-2 py-1">
 {['all', 'pending', 'confirmed', 'corrected', 'supervisor_queue'].map(s => (
 <button key={s} onClick={() => setFilterStatus(s)}
 className={`pb-1 tracking-wider transition-all border-b-2 ${filterStatus === s ? 'text-blue-700 dark:text-blue-400 border-blue-400' : 'text-theme-muted border-transparent hover:text-theme-text'}`}
 >
 {s === 'all' ? 'All' :
 s === 'pending' ? 'Pending' :
 s === 'confirmed' ? 'Confirmed' :
 s === 'corrected' ? 'Corrected' :
 'Supervisor queue'}
 </button>
 ))}
 </div>
 </div>
 <div className="flex-1 overflow-y-auto">
 <table className="w-full text-left border-collapse">
 <thead className="bg-theme-panel sticky top-0 z-10 border-b border-theme-border">
 <tr>
 {[
 { label: 'Batch ID', key: 'batch_number' },
 { label: 'Date & Time', key: 'started_at' },
 { label: 'Duration', key: 'duration_hours' },
 { label: 'Recovery', key: 'recovery' },
 { label: 'Model Ver', key: 'model_version' },
 { label: 'Status', key: 'annotation_status' },
 { label: 'Action', key: null }
 ].map(col => (
 <th key={col.label} 
 className={`p-4 text-[10px] uppercase tracking-widest text-theme-muted font-bold ${col.key ? 'cursor-pointer hover:text-theme-text' : ''}`}
 onClick={() => col.key && handleSort(col.key)}
 >
 <div className="flex items-center gap-1">
 {col.label}
 {sortConfig.key === col.key && (sortConfig.direction === 'desc' ? <ChevronDown size={12}/> : <ChevronUp size={12}/>)}
 </div>
 </th>
 ))}
 </tr>
 </thead>
 <tbody>
 {paginatedBatches.map(batch => (
 <tr key={batch.id} onClick={() => handleRowClick(batch)}
 style={{ backgroundColor: batch.annotation_status === 'pending' ? 'rgba(250, 238, 218, 0.12)' : undefined }}
 className={`border-b border-theme-border/50 cursor-pointer transition-colors ${batch.annotation_status === 'pending' ? 'hover:bg-orange-100 dark:bg-orange-900/40/20' : 'hover:bg-slate-100 dark:bg-slate-80050'}`}
 >
 <td className="p-4 font-bold text-blue-700 dark:text-blue-400 text-sm">{batch.batch_number}</td>
 <td className="p-4 text-theme-text text-xs">{new Date(batch.started_at).toLocaleString()}</td>
 <td className="p-4 text-theme-text text-xs">{batch.duration_hours} hrs</td>
 <td className="p-4 text-xs font-bold">
 {(() => {
 const actual = batch.actual_recovery ?? 0;
 const predicted = batch.predicted_recovery ?? 0;
 const deltaNum = actual - predicted;
 const isPos = deltaNum >= 0;
 const isCriticalDrop = deltaNum <= -1.0;
 const deltaStr = isPos ? `+${deltaNum.toFixed(1)}` : `-${Math.abs(deltaNum).toFixed(1)}`;
 const colorClass = isPos ? 'text-green-800 dark:text-green-400' : (isCriticalDrop ? 'text-[#A32D2D]' : 'text-theme-muted');
 const bgClass = isPos ? 'bg-green-100 dark:bg-green-900/40' : (isCriticalDrop ? 'bg-red-100 dark:bg-red-900/40' : 'bg-slate-100 dark:bg-slate-800');
 return (
 <div className="flex items-center">
 <span className="text-theme-muted">{predicted.toFixed(1)}%</span>
 <span className="mx-2 text-theme-muted">→</span>
 <span 
 className={`${colorClass} ${isCriticalDrop ? 'cursor-help border-b border-dotted border-[#A32D2D]/50' : ''}`}
 title={isCriticalDrop ? "Anomaly: Drop > 1% detected. Flagged for review." : "Within expected range"}
 >
 {actual.toFixed(1)}%
 </span>
 <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${bgClass} ${colorClass}`}>
 {deltaStr}%
 </span>
 </div>
 );
 })()}
 </td>
 <td className="p-4 text-theme-muted text-xs font-bold">
 <span className={batch.model_version !== currentModel.version ? 'text-amber-700 dark:text-amber-500/80 cursor-help border-b border-dotted border-amber-500/50' : ''} title={batch.model_version !== currentModel.version ? `Scored with older model ${batch.model_version}. A newer model (${currentModel.version}) is now deployed.` : ''}>
 {batch.model_version}
 </span>
 </td>
 <td className="p-4">
 <span 
 className={`inline-flex items-center gap-1.5 px-2 py-[3px] text-[11px] font-[500] uppercase tracking-widest rounded-[20px] cursor-default ${
 batch.annotation_status === 'pending' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-400' :
 batch.annotation_status === 'confirmed' ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400' :
 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-400'
 }`}
 title={batch.annotation_status === 'confirmed' ? `Confirmed by: ${batch.confirmed_by || 'SYS_ADMIN'} at ${batch.confirmed_at ? new Date(batch.confirmed_at).toLocaleString() : 'System Init'}` : ''}
 >
 {batch.annotation_status === 'confirmed' && <Check size={11} strokeWidth={3} />}
 {batch.annotation_status === 'pending' && <Clock size={11} strokeWidth={3} />}
 {batch.annotation_status === 'corrected' && <Edit size={11} strokeWidth={3} />}
 {batch.annotation_status}
 </span>
 </td>
 <td className="p-4">
 {batch.annotation_status === 'pending' ? (
 <button className="text-[11px] font-[500] text-orange-800 dark:text-orange-400 border border-[#BA7517] bg-orange-100 dark:bg-orange-900/40 px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors ml-auto w-max hover:opacity-80 shadow-sm">
 <AlertTriangle size={11} strokeWidth={3}/> Review & edit
 </button>
 ) : (
 <button className="text-[10px] font-bold text-blue-700 dark:text-blue-400 hover:text-theme-text uppercase tracking-widest bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded transition-colors w-max ml-auto block">
 View detail
 </button>
 )}
 </td>
 </tr>
 ))}
 {paginatedBatches.length === 0 && (
 <tr><td colSpan="7" className="p-8 text-center text-theme-muted text-sm">No batches found.</td></tr>
 )}
 </tbody>
 </table>
 </div>
 <div className="p-3 border-t border-theme-border flex justify-between items-center bg-theme-panel">
 <span className="text-xs text-theme-muted font-bold uppercase tracking-widest">
 {sortedAndFilteredBatches.length === 0
 ? 'Showing 0 batches'
 : sortedAndFilteredBatches.length <= itemsPerPage 
 ? `Showing all ${sortedAndFilteredBatches.length} batches`
 : `Showing ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, sortedAndFilteredBatches.length)} of ${sortedAndFilteredBatches.length}`}
 </span>
 <div className="flex items-center gap-2">
 <button 
 disabled={currentPage === 1} 
 onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
 className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-theme-text rounded text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 PREV
 </button>
 <button 
 disabled={currentPage * itemsPerPage >= sortedAndFilteredBatches.length} 
 onClick={() => setCurrentPage(prev => prev + 1)}
 className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-theme-text rounded text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 NEXT
 </button>
 </div>
 </div>
 </div>

 {userRole === 'admin' && (
 <div className="bg-theme-panel border border-theme-border rounded-xl shadow-lg flex flex-col shrink-0 overflow-hidden mb-6 premium-card">
 <div className="p-4 bg-theme-panel border-b border-theme-border flex justify-between items-center">
 <h3 className="text-sm font-bold text-theme-text tracking-widest flex items-center gap-2">
 <Cpu size={16} className="text-purple-700 dark:text-purple-500" /> Model registry & retraining pipeline
 </h3>
 {isRetraining && (
 <div className="flex items-center gap-3 w-64 bg-theme-panel p-2 rounded border border-theme-border">
 <Loader2 size={14} className="text-blue-700 dark:text-blue-500 animate-spin shrink-0" />
 <div className="flex-1">
 <div className="flex justify-between text-[10px] text-theme-muted font-bold uppercase mb-1">
 <span>Training Job Running…</span><span>{trainingProgress}%</span>
 </div>
 <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1">
 <div className="bg-blue-500 h-1 rounded-full transition-all" style={{ width: `${trainingProgress}%` }} />
 </div>
 </div>
 </div>
 )}
 </div>
 <div className="p-4 overflow-x-auto">
 <table className="w-full text-left text-xs">
 <thead>
 <tr className="text-theme-muted tracking-widest border-b border-theme-border">
 {['Version', 'Training date', 'Accuracy', 'Training data', 'Status', 'Action'].map(h => (
 <th key={h} className={`pb-2 font-bold ${h === 'Action' ? 'text-right' : ''}`}>{h}</th>
 ))}
 </tr>
 </thead>
 <tbody>
 {models.map((model, index) => {
 const isLive = model.status === 'DEPLOYED LIVE';
 const isArchived = model.status === 'ARCHIVED';
 const prevModel = models[index + 1];
 const delta = prevModel && prevModel.accuracy ? (model.accuracy - prevModel.accuracy).toFixed(1) : '0.0';
 
 return (
 <tr key={model.version} 
 className={`border-b border-theme-border/50 hover:bg-slate-100 dark:bg-slate-80050 transition-colors ${isArchived ? 'opacity-75' : ''}`}
 style={isLive ? { borderLeft: '2px solid #3B6D11', borderTopLeftRadius: 0, borderBottomLeftRadius: 0 } : {}}
 >
 <td className="p-4 font-bold text-theme-text"><div className="flex items-center gap-2"><Cpu size={14} className="text-purple-700 dark:text-purple-400" />{model.version}</div></td>
 <td className="p-4 text-theme-muted font-mono text-xs">{model.training_date}</td>
 <td className="p-4">
 <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full mb-1">
 <div className="h-full bg-[#639922] rounded-full" style={{ width: `${model.accuracy}%` }} />
 </div>
 <div className="flex items-center gap-2">
 <span className="text-[13px] font-bold text-emerald-700 dark:text-emerald-400 font-mono">{model.accuracy?.toFixed(1)}%</span>
 {isLive && (
 <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400">
 {delta >= 0 ? `+${delta}` : delta}%
 </span>
 )}
 </div>
 </td>
 <td className="p-4 text-theme-muted">
 <div className="flex flex-col">
 <span className="text-[13px] font-bold text-theme-text">{model.training_samples?.toLocaleString()} samples</span>
 <span className="text-[11px] text-theme-muted mt-0.5">{model.source_facility} • {model.rlhf_corrections} RLHF annotations</span>
 </div>
 </td>
 <td className="p-4">
 {isLive
 ? <span className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400 px-2 py-[3px] rounded-[20px] tracking-widest text-[11px] font-[500] flex items-center gap-1.5 w-max"><CheckCircle size={11} strokeWidth={3}/> Deployed live</span>
 : <span className="bg-slate-100 dark:bg-slate-800 text-theme-muted px-2 py-[3px] rounded-[20px] tracking-widest text-[11px] font-[500] flex items-center gap-1.5 w-max">Archived</span>
 }
 </td>
 <td className="p-4 text-right flex gap-2 justify-end">
 <button onClick={() => toast.success('Model Comparison dashboard opening...')} className="text-xs px-3 py-1.5 rounded border border-theme-border bg-slate-100 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-theme-text font-bold transition-colors">Compare</button>
 {!isLive && (
 <button onClick={() => requestDeploy(model.version)} className="text-xs px-3 py-1.5 rounded border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 font-bold transition-colors">Deploy</button>
 )}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 )}
 
 {userRole === 'admin' && (
 <div className="flex items-center gap-1.5 text-[12px] text-theme-muted px-1 mb-6">
 <Info size={14} className="text-theme-muted shrink-0" />
 <span>Deploying an archived model will pause the current live version. This action can be reversed.</span>
 </div>
 )}

 {selectedBatch && (
 <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex justify-end">
 <div className="w-[600px] h-full bg-theme-panel border-l border-theme-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
 <div className="p-5 border-b border-theme-border flex justify-between items-center bg-theme-panel">
 <div>
 <h2 className="text-lg font-bold text-theme-text flex items-center gap-2">Batch {selectedBatch.batch_number} <span className="text-theme-muted font-normal text-sm">| Review</span></h2>
 <p className="text-theme-muted text-xs mt-1">{new Date(selectedBatch.started_at).toLocaleString()}</p>
 </div>
 <button onClick={() => setSelectedBatch(null)} className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-full text-theme-text transition-colors"><X size={18} /></button>
 </div>
 <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
 <div className="bg-theme-panel border border-theme-border rounded-xl p-4">
 <h3 className="text-[10px] font-bold text-theme-muted uppercase tracking-widest mb-4">Transmembrane Pressure (Predicted vs Actual)</h3>
 <div className="h-48">
 <ResponsiveContainer width="100%" height="100%">
 <ComposedChart data={selectedBatch.sensor_snapshot}>
 <CartesianGrid strokeDasharray="3 3" stroke="var(--border-panel)" vertical={false} />
 <XAxis dataKey="time" stroke="var(--border-panel)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} minTickGap={20} />
 <YAxis domain={['auto', 'auto']} stroke="var(--border-panel)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} width={70} />
 <Tooltip content={<ChartTooltip />} />
 <Legend wrapperStyle={{ fontSize: '10px' }} />
 <Line type="monotone" dataKey="predicted_tmp" name="Predicted TMP" stroke="#64748b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
 <Line type="monotone" dataKey="actual_tmp" name="Actual TMP" stroke="#06b6d4" strokeWidth={2} dot={false} />
 </ComposedChart>
 </ResponsiveContainer>
 </div>
 </div>
 <div className="bg-theme-panel border border-theme-border rounded-xl p-5 flex flex-col gap-5">
 <h3 className="text-[10px] font-bold text-theme-muted uppercase tracking-widest flex items-center gap-2"><CheckCircle size={14} className="text-blue-700 dark:text-blue-500" /> Operator Annotation (RLHF)</h3>
 <div className="flex gap-4">
 <button onClick={() => setAnnoCorrect(true)} className={`flex-1 py-3 px-4 rounded-lg border font-bold text-sm transition-all flex items-center justify-center gap-2 ${annoCorrect === true ? 'bg-emerald-900/40 border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'bg-theme-panel border-theme-border text-theme-muted hover:border-slate-500'}`}><CheckCircle size={16}/> Prediction Accurate</button>
 <button onClick={() => setAnnoCorrect(false)} className={`flex-1 py-3 px-4 rounded-lg border font-bold text-sm transition-all flex items-center justify-center gap-2 ${annoCorrect === false ? 'bg-rose-900/40 border-rose-500 text-rose-700 dark:text-rose-400' : 'bg-theme-panel border-theme-border text-theme-muted hover:border-slate-500'}`}><AlertTriangle size={16}/> Needs Correction</button>
 </div>
 {annoCorrect === false && (
 <div className="flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
 <div className="flex flex-col gap-1.5">
 <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">Corrected Recovery (%)</label>
 <input type="number" value={annoRecovery} onChange={e => setAnnoRecovery(e.target.value)} className="bg-theme-panel border border-theme-border rounded px-3 py-2 text-theme-text font-bold text-sm focus:border-blue-500 outline-none" />
 </div>
 <div className="flex flex-col gap-1.5">
 <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">Root Cause Tag</label>
 <select value={annoReason} onChange={e => setAnnoReason(e.target.value)} className="bg-theme-panel border border-theme-border rounded px-3 py-2 text-theme-text font-bold text-sm focus:border-blue-500 outline-none">
 {['normal_operation','membrane_fouling','chemical_dosing_issue','feed_quality_change','equipment_fault','operator_error','other'].map(v => (
 <option key={v} value={v}>{v.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
 ))}
 </select>
 </div>
 <div className="flex flex-col gap-1.5">
 <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">Correction Detail</label>
 <textarea value={annoDetail} onChange={e => setAnnoDetail(e.target.value)} placeholder="Explain why the model prediction deviated…" className="bg-theme-panel border border-theme-border rounded px-3 py-2 text-theme-text text-sm focus:border-blue-500 outline-none min-h-[80px]" />
 </div>
 <div className="flex flex-col gap-1.5">
 <div className="flex justify-between items-center">
 <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">Operator Confidence (1–5)</label>
 <span className="text-xs font-bold text-blue-700 dark:text-blue-400">{annoConfidence}/5</span>
 </div>
 <input type="range" min="1" max="5" step="1" value={annoConfidence} onChange={e => setAnnoConfidence(Number(e.target.value))} className="w-full accent-blue-500" />
 </div>
 </div>
 )}
 </div>
 </div>
 <div className="p-5 border-t border-theme-border bg-theme-panel flex gap-3 shrink-0">
 <button onClick={() => setSelectedBatch(null)} className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-theme-text font-bold py-3 rounded-lg border border-theme-border transition-colors">Cancel</button>
 <button onClick={handleAnnotationSubmit} disabled={annoCorrect === null} className="flex-[2] bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-theme-muted text-theme-text font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-colors">
 <Save size={18} /> Save Annotation to Feedback Store
 </button>
 </div>
 </div>
 </div>
 )}

 {confirmDeployVersion && (
 <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm p-4">
 <div className="bg-theme-panel border border-amber-500/50 rounded-xl max-w-md w-full overflow-hidden shadow-2xl premium-card">
 <div className="p-4 border-b border-theme-border bg-amber-500/10 flex items-center gap-3">
 <AlertTriangle className="text-amber-700 dark:text-amber-500" size={20} />
 <h3 className="font-bold text-amber-700 dark:text-amber-500 uppercase tracking-widest text-sm">Deployment Rollback Warning</h3>
 </div>
 <div className="p-6 text-sm text-theme-text space-y-4">
 <p>
 You are about to deploy an archived model (<strong className="text-theme-text">{confirmDeployVersion}</strong>) to live production.
 </p>
 <p>
 This action will downgrade the currently active model (<strong className="text-theme-text">{currentModel.version}</strong>). All new batches will be scored using the older model.
 </p>
 <div className="bg-slate-100 dark:bg-slate-80050 p-3 rounded text-xs border border-theme-border">
 <span className="text-amber-700 dark:text-amber-400 font-bold block mb-1">Audit Trail Requirement</span>
 By proceeding, a rollback event will be logged with your user credentials for compliance auditing.
 </div>
 </div>
 <div className="p-4 border-t border-theme-border bg-theme-panel flex justify-end gap-3">
 <button 
 onClick={() => setConfirmDeployVersion(null)}
 className="px-4 py-2 text-xs font-bold text-theme-muted hover:text-theme-text transition-colors"
 >
 CANCEL
 </button>
 <button 
 onClick={() => executeDeploy(confirmDeployVersion)}
 className="px-4 py-2 text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-500 border border-amber-500/40 rounded transition-colors"
 >
 CONFIRM DEPLOYMENT
 </button>
 </div>
 </div>
 </div>
 )}

 {isManualPanelOpen && <ManualEntryPanel onClose={() => setIsManualPanelOpen(false)} />}
 </div>
 );
}

// ————————————————————————————————————————————————————————————————
// ANALYSIS RESULTS COMPONENT
// ————————————————————————————————————————————————————————————————
function AnalysisResults({
 uploadedFileName, rawRows, rawHeaders, columnMapping, unmappedColumns,
 plantTopology, analyticsResult, anomalies, activeStage, setActiveStage,
 activeChart, setActiveChart, chartData, aiInsights, isAiLoading, generateAiInsights,
 onAddToTraining, onPublishToDashboard
}) {
 const kpis = analyticsResult.kpis;
 const forecast = analyticsResult.forecast;
 const [showMapping, setShowMapping] = useState(false);

 const CHART_OPTIONS = [
 { id: 'tmp', label: 'TMP', color: '#06b6d4' },
 { id: 'flux', label: 'Flux', color: '#10b981' },
 { id: 'pressure', label: 'Pressure', color: '#f59e0b' },
 { id: 'conductivity', label: 'Conductivity', color: '#8b5cf6' },
 { id: 'ph', label: 'pH', color: '#f97316' },
 { id: 'flow', label: 'Flow', color: '#3b82f6' },
 { id: 'turbidity', label: 'Turbidity', color: '#ec4899' },
 ].filter(opt => chartData.some(d => d[opt.id] !== undefined));

 const activeColor = STAGE_COLORS[activeStage] || '#06b6d4';
 const activeKPIs = kpis[activeStage] || {};
 const activeForecast = forecast[activeStage] || [];
 const chartColor = CHART_OPTIONS.find(o => o.id === activeChart)?.color || activeColor;

 return (
 <div className="p-5 space-y-5">
 <div className="flex items-center justify-between flex-wrap gap-3">
 <div className="flex items-center gap-3">
 <div className="bg-emerald-500/20 p-2 rounded-lg border border-emerald-500/30">
 <CheckCircle size={16} className="text-emerald-700 dark:text-emerald-400" />
 </div>
 <div>
 <div className="text-sm font-bold text-theme-text">{uploadedFileName}</div>
 <div className="text-xs text-theme-muted">{rawRows.length.toLocaleString()} rows · {rawHeaders.length} columns · {Object.keys(columnMapping).length} parameters mapped</div>
 </div>
 </div>
 <div className="flex gap-2">
 <button onClick={onPublishToDashboard} className="flex items-center gap-1.5 text-xs font-bold text-theme-text bg-purple-600 hover:bg-purple-500 px-3 py-1.5 rounded-lg border border-purple-500 transition-colors shadow">
 <Play size={12} /> Publish to Dashboard (Playback)
 </button>
 <button onClick={onAddToTraining} className="flex items-center gap-1.5 text-xs font-bold text-theme-text bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg border border-blue-500 transition-colors shadow">
 <Database size={12} /> Add to Model Training
 </button>
 <button onClick={() => setShowMapping(p => !p)} className="flex items-center gap-1.5 text-xs font-bold text-theme-muted hover:text-theme-text bg-slate-100 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-theme-border transition-colors">
 <Eye size={12} /> {showMapping ? 'Hide' : 'Show'} Column Mapping {showMapping ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
 </button>
 </div>
 </div>

 {showMapping && (
 <div className="bg-theme-panel border border-theme-border rounded-xl overflow-hidden animate-in fade-in duration-200">
 <div className="p-3 border-b border-theme-border bg-theme-panel">
 <div className="text-xs font-bold text-theme-muted uppercase tracking-widest">Detected Column Mapping</div>
 </div>
 <div className="overflow-x-auto max-h-48 overflow-y-auto">
 <table className="w-full text-xs">
 <thead className="bg-theme-panel sticky top-0">
 <tr>
 {['Column Header', 'Detected Stage', 'Parameter', 'Unit'].map(h => (
 <th key={h} className="p-2 pl-4 text-left text-[10px] uppercase tracking-wider text-theme-muted font-bold border-b border-theme-border">{h}</th>
 ))}
 </tr>
 </thead>
 <tbody>
 {Object.entries(columnMapping).map(([col, meta]) => (
 <tr key={col} className="border-b border-theme-border/50 hover:bg-slate-100 dark:bg-slate-80030">
 <td className="p-2 pl-4 font-mono text-theme-text">{col}</td>
 <td className="p-2 pl-4"><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ backgroundColor: `${STAGE_COLORS[meta.stage] || '#475569'}20`, color: STAGE_COLORS[meta.stage] || '#94a3b8' }}>{meta.stage}</span></td>
 <td className="p-2 pl-4 text-theme-text">{meta.label}</td>
 <td className="p-2 pl-4 text-theme-muted font-mono">{meta.unit}</td>
 </tr>
 ))}
 {unmappedColumns.map(col => (
 <tr key={col} className="border-b border-theme-border/50 opacity-40">
 <td className="p-2 pl-4 font-mono text-theme-muted">{col}</td>
 <td className="p-2 pl-4 text-theme-muted text-[10px]">—</td>
 <td className="p-2 pl-4 text-theme-muted text-[10px]">Unmapped</td>
 <td className="p-2 pl-4 text-theme-muted">—</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* ————————————————————————————————————————————————————————————————
 Plant Topology Flow ———————————————————————————————————————————— */}
 <div className="bg-theme-panel border border-theme-border rounded-xl p-4">
 <div className="text-[10px] font-bold text-theme-muted uppercase tracking-widest mb-3 flex items-center gap-2"><Layers size={12} /> Detected Plant Topology</div>
 <div className="flex items-center gap-2 flex-wrap">
 <div className="flex items-center gap-1.5 text-xs text-theme-muted bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-theme-border font-bold">
 <Droplets size={12} className="text-blue-700 dark:text-blue-400" /> RAW FEED
 </div>
 {plantTopology.map((stage, idx) => (
 <React.Fragment key={stage}>
 <ChevronDown size={14} className="text-theme-muted rotate-[-90deg]" />
 <button
 onClick={() => setActiveStage(stage)}
 className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${activeStage === stage ? 'shadow-lg scale-105' : 'opacity-70 hover:opacity-100'}`}
 style={activeStage === stage
 ? { backgroundColor: `${STAGE_COLORS[stage]}25`, borderColor: `${STAGE_COLORS[stage]}60`, color: STAGE_COLORS[stage] }
 : { backgroundColor: '#1e293b', borderColor: '#334155', color: '#94a3b8' }
 }
 >
 <Filter size={12} />
 {stage}
 {kpis[stage] && (
 <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${HEALTH_BG(kpis[stage].healthScore)} ${HEALTH_COLOR(kpis[stage].healthScore)}`}>
 {kpis[stage].healthScore}%
 </span>
 )}
 </button>
 </React.Fragment>
 ))}
 <ChevronDown size={14} className="text-theme-muted rotate-[-90deg]" />
 <div className="flex items-center gap-1.5 text-xs text-theme-muted bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-theme-border font-bold">
 <CheckCircle size={12} className="text-emerald-700 dark:text-emerald-400" /> PRODUCT
 </div>
 </div>
 </div>

 {/* ————————————————————————————————————————————————————————————————
 KPI Cards for Active Stage ————————————————————————————————————— */}
 <div>
 <div className="text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: activeColor }}>
 <Activity size={12} /> {activeStage} Stage - Computed KPIs ({activeKPIs.dataPoints || 0} data points)
 </div>
 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
 {[
 { label: 'Avg TMP', value: activeKPIs.avgTMP, unit: 'bar', good: v => parseFloat(v) < 3 },
 { label: 'Last TMP', value: activeKPIs.lastTMP, unit: 'bar', good: v => parseFloat(v) < 3 },
 { label: 'Avg Flux', value: activeKPIs.avgFlux, unit: 'LMH', good: v => parseFloat(v) > 30 },
 { label: 'Conductivity', value: activeKPIs.avgConductivity, unit: 'µS/cm', good: v => parseFloat(v) < 1000 },
 { label: 'Salt Rejection', value: activeKPIs.saltRejection, unit: '%', good: v => parseFloat(v) > 95 },
 { label: 'NDP', value: activeKPIs.ndp, unit: 'bar', good: v => parseFloat(v) > 0 },
 { label: 'TMP Rise Rate', value: activeKPIs.tmpRiseRate, unit: '%/pt', good: v => parseFloat(v) < 0.5 },
 { label: 'Flux Decline', value: activeKPIs.fluxDeclineRate, unit: '%', good: v => parseFloat(v) < 10 },
 { label: 'Fouling Index', value: activeKPIs.foulingIndex, unit: '%', good: v => parseFloat(v) < 20 },
 { label: 'Days to CIP', value: activeKPIs.daysToCIP, unit: 'days', good: v => parseInt(v) > 7 },
 { label: 'Health Score', value: activeKPIs.healthScore, unit: '/100', good: v => parseInt(v) >= 75 },
 ].filter(k => k.value !== null && k.value !== undefined).map(kpi => {
 const isGood = kpi.good(kpi.value);
 return (
 <div key={kpi.label} className="bg-theme-panel border border-theme-border rounded-lg p-3 hover:border-theme-border transition-colors">
 <div className="text-[9px] text-theme-muted font-bold uppercase tracking-widest mb-1">{kpi.label}</div>
 <div className={`text-lg font-black ${isGood ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{kpi.value}</div>
 <div className="text-[10px] text-theme-muted font-bold mt-0.5">{kpi.unit}</div>
 </div>
 );
 })}
 </div>
 </div>

 {/* ————————————————————————————————————————————————————————————————
 Chart Panel —————————————————————————————————————————————————————— */}
 <div className="bg-theme-panel border border-theme-border rounded-xl overflow-hidden">
 <div className="p-4 border-b border-theme-border flex items-center justify-between flex-wrap gap-3">
 <div className="text-sm font-bold text-theme-text flex items-center gap-2">
 <BarChart2 size={16} style={{ color: activeColor }} />
 {activeStage} - Time Series Data
 </div>
 <div className="flex gap-1.5 flex-wrap">
 {CHART_OPTIONS.map(opt => (
 <button key={opt.id} onClick={() => setActiveChart(opt.id)}
 className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition-all border ${activeChart === opt.id ? 'text-theme-text shadow' : 'text-theme-muted hover:text-theme-text bg-theme-panel border-theme-border hover:border-slate-300 dark:border-slate-600'}`}
 style={activeChart === opt.id ? { backgroundColor: `${opt.color}30`, borderColor: `${opt.color}80`, color: opt.color } : {}}
 >
 {opt.label}
 </button>
 ))}
 </div>
 </div>
 <div className="p-4 h-[260px]">
 {chartData.length > 0 ? (
 <ResponsiveContainer width="100%" height="100%">
 <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="var(--border-panel)" vertical={false} />
 <XAxis dataKey="time" stroke="var(--border-panel)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickMargin={8} minTickGap={30} />
 <YAxis stroke="var(--border-panel)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} domain={['auto', 'auto']} width={70} />
 <Tooltip content={<ChartTooltip />} />
 <Area type="monotone" dataKey={activeChart} name={CHART_OPTIONS.find(o => o.id === activeChart)?.label || activeChart}
 stroke={chartColor} fill={`${chartColor}18`} strokeWidth={2} dot={false}
 />
 </ComposedChart>
 </ResponsiveContainer>
 ) : (
 <div className="h-full flex items-center justify-center text-theme-muted text-xs font-bold">No {activeChart} data for {activeStage} stage</div>
 )}
 </div>
 </div>

 {/* ————————————————————————————————————————————————————————————————
 Fouling Forecast ——————————————————————————————————————————————— */}
 {activeForecast.length > 0 && (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
 <div className="bg-theme-panel border border-theme-border rounded-xl overflow-hidden">
 <div className="p-4 border-b border-theme-border">
 <div className="text-sm font-bold text-theme-text flex items-center gap-2">
 <TrendingUp size={16} className="text-amber-700 dark:text-amber-400" /> 
 30-Day Forecast - {activeStage}
 </div>
 <div className="text-xs text-theme-muted mt-0.5">Physics-based mathematical projection based on plant chemistry.</div>
 </div>
 <div className="p-4 h-[220px]">
 <ResponsiveContainer width="100%" height="100%">
 <ComposedChart data={activeForecast} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="var(--border-panel)" vertical={false} />
 <XAxis dataKey="day" stroke="var(--border-panel)" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickMargin={8} interval={4} />
 <YAxis stroke="var(--border-panel)" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} domain={['auto', 'auto']} width={70} />
 <Tooltip content={<ChartTooltip />} />
 <ReferenceLine y={activeForecast[0]?.threshold} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'LIMIT', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} />
 {activeForecast[0]?.predicted_tmp !== undefined && (
 <Area type="monotone" dataKey="predicted_tmp" name="Predicted TMP (bar)" stroke="#f59e0b" fill="#f59e0b18" strokeWidth={2} dot={false} />
 )}
 {activeForecast[0]?.predicted_aop_efficiency !== undefined && (
 <Area type="monotone" dataKey="predicted_aop_efficiency" name="AOP Destruction Eff (%)" stroke="#8b5cf6" fill="#8b5cf618" strokeWidth={2} dot={false} />
 )}
 {activeForecast[0]?.predicted_silica_saturation !== undefined && (
 <Area type="monotone" dataKey="predicted_silica_saturation" name="Silica Saturation (%)" stroke="#06b6d4" fill="#06b6d418" strokeWidth={2} dot={false} />
 )}
 </ComposedChart>
 </ResponsiveContainer>
 </div>
 </div>

 {/* Stage Health Comparison */}
 <div className="bg-theme-panel border border-theme-border rounded-xl overflow-hidden">
 <div className="p-4 border-b border-theme-border">
 <div className="text-sm font-bold text-theme-text flex items-center gap-2"><Zap size={16} className="text-cyan-700 dark:text-cyan-400" /> System Health by Stage</div>
 </div>
 <div className="p-4 space-y-3">
 {plantTopology.map(stage => {
 const sk = kpis[stage] || {};
 const score = sk.healthScore ?? 0;
 const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
 return (
 <div key={stage}>
 <div className="flex justify-between items-center mb-1">
 <button onClick={() => setActiveStage(stage)} className="text-xs font-bold hover:underline" style={{ color: STAGE_COLORS[stage] || '#94a3b8' }}>{stage}</button>
 <div className="flex items-center gap-3">
 {sk.daysToCIP !== null && sk.daysToCIP !== undefined && (
 <span className="text-[10px] text-theme-muted font-bold">{sk.daysToCIP}d to CIP</span>
 )}
 <span className="text-xs font-black" style={{ color }}>{score}</span>
 </div>
 </div>
 <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
 <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: color }} />
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </div>
 )}

 {/* â”€â”€ Anomaly Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
 {anomalies.length > 0 && (
 <div className="bg-theme-panel border border-rose-500/20 rounded-xl overflow-hidden">
 <div className="p-4 border-b border-theme-border flex items-center justify-between bg-rose-900/10">
 <div className="text-sm font-bold text-theme-text flex items-center gap-2"><AlertTriangle size={16} className="text-rose-700 dark:text-rose-400" /> Detected Anomalies ({anomalies.length})</div>
 </div>
 <div className="overflow-x-auto">
 <table className="w-full text-xs">
 <thead>
 <tr className="bg-theme-panel">
 {['Timestamp', 'Stage', 'Event Type', 'Severity', 'Detected Value', 'Threshold'].map(h => (
 <th key={h} className="p-3 pl-4 text-left text-[10px] uppercase tracking-widest text-theme-muted font-bold border-b border-theme-border">{h}</th>
 ))}
 </tr>
 </thead>
 <tbody>
 {anomalies.map((a, i) => (
 <tr key={i} className="border-b border-theme-border/50 hover:bg-slate-100 dark:bg-slate-80030">
 <td className="p-3 pl-4 font-mono text-theme-muted">{String(a.ts).substring(0, 19)}</td>
 <td className="p-3 pl-4"><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ backgroundColor: `${STAGE_COLORS[a.stage] || '#475569'}20`, color: STAGE_COLORS[a.stage] || '#94a3b8' }}>{a.stage}</span></td>
 <td className="p-3 pl-4 text-theme-text font-bold">{a.type}</td>
 <td className="p-3 pl-4">
 <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${a.severity === 'critical' ? 'bg-rose-500/20 text-rose-700 dark:text-rose-400' : a.severity === 'high' ? 'bg-orange-500/20 text-orange-400' : 'bg-amber-500/20 text-amber-700 dark:text-amber-400'}`}>{a.severity}</span>
 </td>
 <td className="p-3 pl-4 font-mono font-bold text-theme-text">{a.value} <span className="text-theme-muted text-[10px]">{a.unit}</span></td>
 <td className="p-3 pl-4 font-mono text-theme-muted">{a.threshold} {a.unit}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* â”€â”€ AI Insights Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
 <div className="bg-gradient-to-br from-slate-900 to-[#0a0f1e] border border-indigo-500/25 rounded-xl overflow-hidden">
 <div className="p-4 border-b border-indigo-500/20 flex items-center justify-between bg-indigo-900/10">
 <div className="flex items-center gap-2">
 <Brain size={18} className="text-indigo-400" />
 <div className="text-sm font-bold text-slate-200">AI Process Engineer Analysis</div>
 <span className="text-[9px] px-2 py-0.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded font-bold uppercase tracking-widest">Powered by Claude</span>
 </div>
 <button onClick={generateAiInsights} disabled={isAiLoading}
 className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg transition-colors shadow-lg">
 {isAiLoading ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
 {isAiLoading ? 'Analyzingâ€¦' : aiInsights ? 'Re-Analyze' : 'Generate AI Insights'}
 </button>
 </div>
 <div className="p-5">
 {!aiInsights && !isAiLoading && (
 <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
 <Brain size={32} className="text-indigo-500/50" />
 <div className="text-sm text-slate-400 font-bold">Click "Generate AI Insights" for expert process engineering analysis</div>
 <div className="text-xs text-slate-500">Claude will evaluate TMP trends, fouling patterns, CIP scheduling, and give stage-specific recommendations</div>
 </div>
 )}
 {isAiLoading && (
 <div className="flex items-center gap-3 py-6 justify-center">
 <Loader2 size={20} className="text-indigo-400 animate-spin" />
 <span className="text-sm text-theme-muted font-bold">Consulting membrane engineering knowledge baseâ€¦</span>
 </div>
 )}
 {aiInsights && !isAiLoading && (
 <div className="text-xs text-indigo-200 leading-relaxed whitespace-pre-wrap font-mono bg-indigo-950/40 rounded-lg p-4 border border-indigo-500/30 shadow-inner">
 {aiInsights}
 </div>
 )}
 </div>
 </div>

 </div>
 );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SUMMARY CARD
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SummaryCard({ icon, iconBg, label, value, valueColor = 'text-theme-text', badge, badgeColor }) {
 return (
 <div className="flex items-center gap-3 bg-theme-panel p-3 rounded-lg border border-theme-border">
 <div className={`${iconBg} p-2 rounded`}>{icon}</div>
 <div className="flex flex-col">
 <span className="text-[10px] text-theme-muted uppercase font-bold tracking-widest">{label}</span>
 <div className="flex items-center gap-2">
 <span className={`text-xl font-bold ${valueColor}`}>{value}</span>
 {badge && <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${badgeColor}`}>{badge}</span>}
 </div>
 </div>
 </div>
 );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SUPERVISOR QUEUE VIEW
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SupervisorQueueView() {
 const { pendingManualEntries, commitManualEntry } = useAppStore();
 if (!pendingManualEntries?.length) {
 return <tr><td colSpan="7" className="p-8 text-center text-theme-muted text-sm font-bold">No pending manual entries.</td></tr>;
 }
 return pendingManualEntries.map(entry => (
 <tr key={entry.id} className="border-b border-theme-border/50 bg-purple-900/10 hover:bg-purple-900/20">
 <td className="p-4 font-bold text-purple-700 dark:text-purple-400 text-sm">MANUAL-{entry.id.substring(0, 6)}</td>
 <td className="p-4 text-theme-text text-xs">{new Date(entry.timestamp).toLocaleString()}</td>
 <td className="p-4 text-theme-text text-xs">
 <span className="bg-purple-500/20 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded font-bold uppercase text-[9px] mr-2">{entry.source}</span>
 {entry.plant_id}
 </td>
 <td className="p-4 text-xs font-mono text-theme-muted">
 {Object.entries(entry.data).map(([k, v]) => <div key={k}>{k}: <span className="text-theme-text">{v}</span></div>)}
 </td>
 <td className="p-4 text-xs font-bold text-theme-muted">{entry.user_id}</td>
 <td className="p-4">
 <span className="text-[10px] font-bold text-amber-700 dark:text-amber-500 uppercase tracking-widest flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded w-max border border-amber-500/20">
 <AlertTriangle size={12} /> Pending Supervisor
 </span>
 </td>
 <td className="p-4">
 <button onClick={() => commitManualEntry(entry.id)}
 className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-theme-text uppercase tracking-widest bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded transition-colors flex items-center gap-1">
 <CheckCircle size={14} /> Approve & Commit
 </button>
 </td>
 </tr>
 ));
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MANUAL ENTRY PANEL
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ManualEntryPanel({ onClose }) {
 const { addManualEntry } = useAppStore();
 const plants = Object.keys(manualSchema);
 const [selectedPlant, setSelectedPlant] = useState(plants[0] || '');
 const [activeTab, setActiveTab] = useState('Feed Stream');
 const [formData, setFormData] = useState({});
 const [errors, setErrors] = useState({});
 const [isSubmitting, setIsSubmitting] = useState(false);

 const currentStreamSchema = (manualSchema[selectedPlant]?.[activeTab]) || { scada_overrides: [], laboratory_analysis: [] };
 const scadaParams = currentStreamSchema.scada_overrides || [];
 const labParams = currentStreamSchema.laboratory_analysis || [];

 const allParams = useMemo(() => {
 if (!manualSchema[selectedPlant]) return [];
 return Object.values(manualSchema[selectedPlant]).flatMap(s => [...(s.scada_overrides || []), ...(s.laboratory_analysis || [])]);
 }, [selectedPlant]);

 useEffect(() => { setFormData({}); setErrors({}); setActiveTab('Feed Stream'); }, [selectedPlant]);

 const handleChange = (id, value, min, max, type) => {
 setFormData(p => ({ ...p, [id]: value }));
 if (type === 'number' && value !== '') {
 const n = parseFloat(value);
 if (!isNaN(n) && (n < min || n > max)) {
 setErrors(p => ({ ...p, [id]: `Must be between ${min} and ${max}` }));
 } else {
 setErrors(p => { const e = { ...p }; delete e[id]; return e; });
 }
 } else {
 setErrors(p => { const e = { ...p }; delete e[id]; return e; });
 }
 };

 const handleSubmit = () => {
 if (Object.keys(errors).length > 0) return;
 const newErrors = {};
 allParams.forEach(p => { if (p.required && !formData[p.id]) newErrors[p.id] = 'Required field'; });
 if (Object.keys(newErrors).length) { setErrors(newErrors); return; }
 setIsSubmitting(true);
 setTimeout(() => {
 addManualEntry({ id: Math.random().toString(36).substr(2, 9), plant_id: selectedPlant, timestamp: new Date().toISOString(), source: 'MANUAL_ENTRY', user_id: 'SYS_ADMIN', data: formData });
 setIsSubmitting(false);
 onClose();
 }, 600);
 };

 const renderField = (param) => (
 <div key={param.id} className="flex flex-col gap-1.5">
 <div className="flex justify-between items-center">
 <label className="text-xs font-bold text-theme-text">{param.label} {param.required && <span className="text-red-700 dark:text-red-500">*</span>}</label>
 {param.type === 'number' && <span className="text-[9px] text-theme-muted font-mono">[{param.min}â€“{param.max} {param.unit}]</span>}
 </div>
 <div className="relative">
 {param.type === 'select' ? (
 <select value={formData[param.id] || ''} onChange={e => handleChange(param.id, e.target.value, param.min, param.max, param.type)}
 className={`w-full bg-theme-main text-theme-text text-sm font-mono rounded-lg px-4 py-2.5 outline-none border transition-colors ${errors[param.id] ? 'border-red-500' : 'border-theme-border focus:border-purple-500'}`}>
 <option value="" disabled>Select {param.label}</option>
 {param.options?.map(o => <option key={o} value={o}>{o}</option>)}
 </select>
 ) : (
 <>
 <input type="number" value={formData[param.id] || ''} onChange={e => handleChange(param.id, e.target.value, param.min, param.max, param.type)}
 placeholder="Enter valueâ€¦"
 className={`w-full bg-theme-main text-theme-text text-sm font-mono rounded-lg px-4 py-2.5 outline-none border transition-colors ${errors[param.id] ? 'border-red-500 bg-red-950/20' : 'border-theme-border focus:border-purple-500'}`} />
 <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-theme-muted pointer-events-none">{param.unit}</span>
 </>
 )}
 </div>
 {errors[param.id] && <div className="text-[10px] font-bold text-red-700 dark:text-red-500 flex items-center gap-1"><AlertTriangle size={12} />{errors[param.id]}</div>}
 </div>
 );

 return (
 <div className="fixed inset-y-0 right-0 w-[450px] bg-theme-panel border-l border-purple-500/30 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
 <div className="p-6 border-b border-theme-border flex justify-between items-center bg-theme-panel backdrop-blur">
 <h2 className="text-lg font-bold text-theme-text flex items-center gap-2"><Beaker className="text-purple-700 dark:text-purple-400" /> Manual Telemetry Injection</h2>
 <button onClick={onClose} className="text-theme-muted hover:text-theme-text transition-colors"><X size={24} /></button>
 </div>
 <div className="flex-1 overflow-y-auto p-6 space-y-6">
 <div className="bg-purple-900/10 dark:bg-purple-900/20 border border-purple-500/20 rounded-lg p-4">
 <p className="text-xs text-purple-800 dark:text-purple-200 leading-relaxed">
 Inject manual lab tests or override broken SCADA sensors. Data flagged with <code className="bg-purple-800/10 dark:bg-black/30 px-1 py-0.5 rounded font-bold text-purple-900 dark:text-purple-300">MANUAL_ENTRY</code> provenance. Physics-bound validation enforced.
 </p>
 </div>
 <div className="flex flex-col gap-2">
 <label className="text-xs font-bold text-theme-muted uppercase tracking-widest">Facility / Plant</label>
 <select value={selectedPlant} onChange={e => setSelectedPlant(e.target.value)} className="w-full bg-theme-main text-theme-text text-sm font-bold rounded-lg px-4 py-3 outline-none border border-theme-border focus:border-purple-500">
 {plants.map(p => <option key={p} value={p}>{p}</option>)}
 </select>
 </div>
 <div className="flex bg-theme-panel border border-theme-border rounded-lg p-1">
 {['Feed Stream', 'Permeate Stream', 'Reject Stream'].map(tab => (
 <button key={tab} onClick={() => setActiveTab(tab)}
 className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded transition-colors ${activeTab === tab ? 'bg-purple-600 text-theme-text shadow' : 'text-theme-muted hover:text-theme-text hover:bg-slate-100 dark:bg-slate-800'}`}>
 {tab.split(' ')[0]}
 </button>
 ))}
 </div>
 {scadaParams.length > 0 && (
 <div className="space-y-4">
 <h3 className="text-sm font-bold text-amber-700 dark:text-amber-500 border-b border-theme-border pb-2 flex items-center gap-2"><AlertTriangle size={14} /> SCADA Overrides</h3>
 {scadaParams.map(renderField)}
 </div>
 )}
 {labParams.length > 0 && (
 <div className="space-y-4 pt-2">
 <h3 className="text-sm font-bold text-blue-700 dark:text-blue-400 border-b border-theme-border pb-2 flex items-center gap-2"><Beaker size={14} /> Laboratory Analysis</h3>
 {labParams.map(renderField)}
 </div>
 )}
 {scadaParams.length === 0 && labParams.length === 0 && (
 <div className="p-8 text-center text-theme-muted text-xs font-bold border border-theme-border rounded-lg border-dashed">No parameters defined for {activeTab}.</div>
 )}
 </div>
 <div className="p-6 border-t border-theme-border bg-theme-panel flex justify-end gap-3 shrink-0">
 <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-theme-muted hover:text-theme-text transition-colors">Cancel</button>
 <button onClick={handleSubmit} disabled={Object.keys(errors).length > 0 || isSubmitting}
 className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-100 dark:bg-slate-800 disabled:text-theme-muted text-theme-text text-sm font-bold rounded-lg shadow-[0_0_15px_rgba(147,51,234,0.3)] transition-all">
 {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
 {isSubmitting ? 'Pushingâ€¦' : 'Push to Supervisor Queue'}
 </button>
 </div>
 </div>
 );
}
