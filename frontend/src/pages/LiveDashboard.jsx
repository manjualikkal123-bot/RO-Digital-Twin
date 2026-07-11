import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { LineChart, Line, RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer, YAxis, ReferenceLine } from 'recharts';
import { Activity, Droplets, Zap, Beaker, ShieldAlert, ArrowRight, TrendingUp, TrendingDown, Clock, Wifi, Server, X, Info, Settings, Wrench, ChevronRight, User, AlertTriangle, CheckCircle2, Play, WifiOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import OperatorCommandButton from '../components/OperatorCommandButton';
import ExportButton from '../components/ExportButton';
import plantConfig from '../config/plant_config.json';

const SIM_MINUTES_PER_TICK = 5;

const STAGES_WITHOUT_QUALITY_SENSORS = ['UF'];

const KpiCard = ({ title, value, unit, data, dataKey, color, icon: Icon, referenceLine, trendOverride, countdownMsg, tooltip, unavailable }) => {
 let isAnomaly = false;
 let trend = 0;
 if (trendOverride !== undefined) {
 trend = trendOverride;
 } else if (data && data.length > 0) {
 const startVal = data[0][dataKey];
 const endVal = data[data.length - 1][dataKey];
 if (startVal && endVal) trend = ((endVal - startVal) / Math.abs(startVal)) * 100;
 }

 if (Math.abs(trend) > 15) {
 isAnomaly = true;
 trend = trend > 0 ? 15.0 : -15.0;
 }

 const isUp = trend > 0;

 if (unavailable) {
 return (
 <div className="bg-theme-panel border border-theme-border rounded-xl p-3 flex flex-col relative overflow-hidden h-36 shadow-lg opacity-50 premium-card">
 <div className="flex justify-between items-start mb-1 z-10">
 <span className="text-theme-muted text-[10px] sm:text-[11px] font-bold uppercase tracking-widest leading-tight max-w-[65%]">
 {title}
 </span>
 <Icon size={14} color="#94a3b8" />
 </div>
 <div className="flex items-baseline gap-1 z-10 mt-1">
 <span className="text-2xl font-black text-theme-muted leading-none">N/A</span>
 </div>
 <span className="text-[9px] font-bold text-theme-muted mt-2 uppercase tracking-widest">No sensor</span>
 </div>
 );
 }

 return (
 <div className="bg-theme-panel border border-theme-border rounded-xl p-3 flex flex-col relative overflow-hidden h-36 shadow-lg hover:shadow-xl transition-shadow premium-card">
 <div className="flex justify-between items-start mb-1 z-10" title={tooltip}>
 <span className="text-theme-muted text-[10px] sm:text-[11px] font-bold uppercase tracking-widest flex items-center gap-1 leading-tight max-w-[65%]">
 {title} {tooltip && <Info size={10} className="text-theme-muted shrink-0"/>}
 </span>
 <div className="flex gap-2 items-center shrink-0">
 {dataKey && (
 <OperatorCommandButton
 tagId={dataKey.toUpperCase()}
 label={title}
 currentValue={value}
 unit={unit}
 aiRecommendation={isAnomaly ? `AI Suggests: Review ${title} setpoints immediately due to anomaly detected.` : null}
 />
 )}
 <Icon size={14} color={color} />
 </div>
 </div>

 <div className="flex items-baseline gap-1 z-10 mt-1">
 <span className="text-2xl font-black text-theme-text leading-none">{value}</span>
 <span className="text-[9px] font-bold text-theme-muted uppercase">{unit}</span>
 </div>

 <div className="z-10 flex flex-col gap-0.5 mt-1">
 {trend !== 0 && (
 <div className="flex items-center gap-1">
 {isUp ? <TrendingUp size={12} className={isAnomaly ? 'text-red-700 dark:text-red-500' : 'text-emerald-700 dark:text-emerald-500'} /> : <TrendingDown size={12} className={isAnomaly ? 'text-red-700 dark:text-red-500' : 'text-rose-700 dark:text-rose-500'} />}
 <span className={`text-[9px] font-bold ${isAnomaly ? 'text-red-700 dark:text-red-500' : isUp ? 'text-emerald-700 dark:text-emerald-500' : 'text-rose-700 dark:text-rose-500'}`}>
 {trend > 0 ? '+' : ''}{trend.toFixed(1)}% / hr
 </span>
 {isAnomaly && <span className="text-[8px] font-black uppercase text-red-700 dark:text-red-500 ml-1 bg-red-50 px-1 rounded border border-red-200">[ANOMALY]</span>}
 </div>
 )}
 {countdownMsg && (
 <span className="text-[8px] font-black uppercase tracking-widest text-red-600 bg-red-50 border border-red-200 px-1 py-0.5 rounded w-fit animate-pulse mt-1">
 {countdownMsg}
 </span>
 )}
 </div>

 <div className="absolute bottom-0 left-0 w-full h-12 opacity-20 pointer-events-none">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={data}>
 <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
 <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
 {referenceLine && <ReferenceLine y={referenceLine} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} />}
 </LineChart>
 </ResponsiveContainer>
 </div>
 </div>
 );
};

const GaugeCard = ({ title, value, min, max, unit, color, designVal, tripLimit, tagId, unavailable }) => {
 if (unavailable) {
 return (
 <div className="w-full bg-theme-main border border-theme-border rounded-xl p-4 flex flex-col items-center justify-center relative h-40 shadow-inner opacity-60">
 <div className="absolute top-4 text-[10px] font-bold text-theme-muted uppercase tracking-widest">{title}</div>
 <span className="text-lg font-black text-theme-muted">N/A</span>
 <span className="text-[9px] font-bold uppercase tracking-widest text-theme-muted mt-1">No sensor</span>
 </div>
 );
 }

  const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  const percentage = Math.min(Math.max(((safeValue - min) / (max - min)) * 100, 0), 100) || 0;
  const radius = 40;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
  <div className="w-full bg-theme-panel border border-theme-border rounded-xl p-4 flex flex-col items-center justify-center relative h-40 shadow-lg group hover:shadow-xl transition-shadow">
  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
  <OperatorCommandButton tagId={tagId || title.replace(/\s+/g, '_').toUpperCase()} label={title} currentValue={safeValue} unit={unit} range={[min, max]} />
  </div>
  
  <div className="w-full h-20 absolute top-[55%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 mt-1 z-0 flex justify-center items-center">
    <svg width="80%" height="100%" viewBox="0 0 100 50" className="overflow-visible">
      {/* Background Track */}
      <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" className="dark:stroke-slate-800" />
      {/* Active Value Track */}
      <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={color || '#0ea5e9'} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000 ease-out" />
    </svg>
  </div>

 <div className="absolute bottom-4 flex flex-col items-center w-full z-10 pointer-events-none">
 <span className="text-xl font-black text-theme-text">{value?.toFixed(1) ?? 'N/A'}</span>
 <span className="text-[10px] font-bold text-theme-muted uppercase">{unit}</span>
 </div>
 <div className="absolute top-3 text-[10px] font-bold text-theme-muted uppercase tracking-widest z-10 pointer-events-none">{title}</div>
 <div className="absolute bottom-1 w-full px-4 flex justify-between text-[8px] uppercase tracking-widest text-theme-muted font-mono font-bold pointer-events-none">
 <span>Design: {designVal}</span>
 <span className="text-red-700 dark:text-red-500/80">Trip: {tripLimit}</span>
 </div>
 </div>
 );
};

const FlowNode = ({ label, value, unit, status, accent, onClick }) => {
 const isCritical = status === 'Critical';
 const isWarning = status === 'Warning';
 const borderClass = isCritical
 ? 'border-red-500/50 hover:border-red-500'
 : isWarning
 ? 'border-amber-500/50 hover:border-amber-500'
 : accent
 ? 'border-blue-500 hover:border-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
 : 'border-theme-border hover:border-blue-400 hover:shadow-md';
 const bgClass = accent ? 'bg-blue-50' : 'bg-theme-panel';
 const dotClass = isCritical ? 'bg-red-500 animate-pulse' : isWarning ? 'bg-amber-500' : 'bg-emerald-500';
 const labelClass = isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : accent ? 'text-blue-700' : 'text-theme-muted group-hover:text-blue-600';
 const valueClass = isCritical ? 'text-red-600' : 'text-theme-text';
 const hasValue = value !== null && value !== undefined && !Number.isNaN(value);

 return (
 <div
 onClick={onClick}
 className={`${bgClass} border-2 ${borderClass} px-1 lg:px-2 py-2 rounded-xl flex flex-col items-center w-full min-w-[60px] lg:min-w-[85px] shadow-sm cursor-pointer transition-all group relative shrink`}
 >
 {(isCritical || !isWarning) && (
 <span className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${dotClass}`}></span>
 )}
 <span className={`text-[8px] lg:text-[9px] font-black uppercase tracking-widest mb-1 transition-colors text-center ${labelClass}`}>{label}</span>
 <span className={`font-black text-sm lg:text-base whitespace-nowrap ${valueClass}`}>
 {hasValue ? value : '—'} {hasValue && unit && <span className="text-[8px] lg:text-[9px] font-bold font-sans text-theme-muted ml-0.5">{unit}</span>}
 </span>
 </div>
 );
};

export default function LiveDashboard() {
 const { selectedFacility, telemetry, telemetryHistory, syncStatus, derivedKPIs, alarmLimits, alarms, timeHorizon, isPlaybackMode, exitPlaybackMode, targetStage, setTargetStage } = useAppStore();
 const config = plantConfig[selectedFacility] || plantConfig['jetl_hyderabad'];

 const snapshotTime = syncStatus?.lastSynced || "--";
 const isNandesari = selectedFacility === 'nia_nandesari';
 const defaultStage = isNandesari ? 'HPA1' : 'RO1';
 // If stored targetStage doesn't exist in this plant's telemetry, fall back to the plant's default
 const activeStage = (targetStage && telemetry?.stages?.[targetStage]) ? targetStage : defaultStage;

 const history = React.useMemo(() => {
 return (telemetryHistory || []).map(t => {
 const stageData = t.stages && t.stages[activeStage] ? t.stages[activeStage] : t;
 return { ...t, ...stageData };
 });
 }, [telemetryHistory, activeStage]);
 const [role, setRole] = useState("Admin View");
 const [activeAsset, setActiveAsset] = useState(null);
 const navigate = useNavigate();

 const resolvedStageData = telemetry?.stages?.[activeStage] || null;
 const hasLiveData = !!resolvedStageData;

 const baseData = resolvedStageData || {
 feed_pressure: null,
 flow_rate: null,
 recovery_rate: null,
 conductivity: null,
 permeate_conductivity: null,
 pH: null,
 temperature: null,
 differential_pressure: null,
 normalized_flux: null,
 };

 const isPumpOff = baseData.feed_pressure !== null && baseData.feed_pressure < 2.0;
 const data = {
 ...baseData,
 flow_rate: isPumpOff ? 0 : baseData.flow_rate,
 normalized_flux: isPumpOff ? 0 : baseData.normalized_flux,
 recovery_rate: isPumpOff ? 0 : baseData.recovery_rate,
 };

 const stageHasQualitySensors = !STAGES_WITHOUT_QUALITY_SENSORS.includes(activeStage);

 const safeFeedTds = data.conductivity ?? null;
 const safePermTds = data.permeate_conductivity ?? null;
 const calcRejection =
 stageHasQualitySensors && safeFeedTds && safePermTds !== null
 ? ((1 - safePermTds / safeFeedTds) * 100).toFixed(1)
 : null;

 const getVisibleHistory = () => {
 let windowMinutes = 60;
 if (timeHorizon === '1 Hour') windowMinutes = 60;
 if (timeHorizon === '24 Hours') windowMinutes = 24 * 60;
 if (timeHorizon === '7 Days') windowMinutes = 7 * 24 * 60;
 const limit = Math.round(windowMinutes / SIM_MINUTES_PER_TICK);
 return history.slice(-limit);
 };
 const visibleHistory = getVisibleHistory();

 const calculateBreach = (dataKey, limit, isMin) => {
 const windowData = visibleHistory;
 if (windowData.length < 2) return null;
 const current = windowData[windowData.length - 1][dataKey];
 const old = windowData[0][dataKey];
 if (current == null || old == null) return null;

 const timeSpanHours = (windowData.length * SIM_MINUTES_PER_TICK) / 60;
 const ratePerHour = (current - old) / (timeSpanHours || 1);

 if (Math.abs(ratePerHour) < 0.001) return null;

 if (isMin && ratePerHour < 0) {
 const hoursToBreach = (current - limit) / Math.abs(ratePerHour);
 if (hoursToBreach < 0 || hoursToBreach > 12) return null;
 const mins = Math.floor(hoursToBreach * 60);
 return `(Est.) Breach in ~${Math.floor(mins / 60)}h ${mins % 60}m`;
 } else if (!isMin && ratePerHour > 0) {
 const hoursToBreach = (limit - current) / ratePerHour;
 if (hoursToBreach < 0 || hoursToBreach > 12) return null;
 const mins = Math.floor(hoursToBreach * 60);
 return `(Est.) Breach in ~${Math.floor(mins / 60)}h ${mins % 60}m`;
 }
 return null;
 };

 const saltRejectionBreach = stageHasQualitySensors ? calculateBreach('salt_rejection', alarmLimits.minRejection, true) : null;
 const permeateTdsBreach = stageHasQualitySensors ? calculateBreach('permeate_conductivity', 15.0, false) : null;

 const activeAlarms = (alarms || []).filter(a => a.lifecycleStatus === 'Active');

 const stageStatus = (stageKey) => {
 const stageAlarms = activeAlarms.filter(a => a.stage === stageKey);
 if (stageAlarms.some(a => a.severity === 'CRITICAL')) return 'Critical';
 if (stageAlarms.some(a => a.severity === 'WARNING')) return 'Warning';
 return 'Optimal';
 };

 const stageFlow = (stageKey, fallbackKey = 'flow_rate') => {
 const s = telemetry?.stages?.[stageKey];
 return s ? s[fallbackKey] : null;
 };

 const goToCIP = () => {
 navigate('/cip-optimization?stage=1&recipe=emergency_wash');
 };

 const handleAssetClick = (assetName, assetData) => {
 setActiveAsset({ name: assetName, ...assetData });
 };

 return (
 <div className="flex flex-col gap-6 p-6 bg-transparent text-theme-text min-h-full font-sans select-none relative overflow-y-auto custom-scrollbar">

 <div className="flex flex-col gap-4 mb-2">
 <div className="flex justify-between items-end">
 <div>
 <h1 className="text-2xl font-black flex items-center gap-2 tracking-tight text-theme-text"><Activity className="text-blue-700 dark:text-blue-500" /> Live Dashboard - {config.display_name || selectedFacility}</h1>
 <p className="text-theme-muted text-xs mt-1 font-medium">Real-time intelligent decision-support system and digital twin.</p>
 </div>
 <div className="flex items-center gap-3">
 <select
 value={role}
 onChange={(e) => setRole(e.target.value)}
 className="bg-theme-panel border border-theme-border text-xs font-bold text-theme-text rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm"
 >
 <option>Admin View</option>
 <option>Client Operator</option>
 </select>
 <ExportButton
 plantName={config.display_name}
 filename={`${selectedFacility}_LiveDashboard`}
 telemetryHistory={telemetryHistory}
 alarms={alarms}
 limits={config?.limits}
 />
 </div>
 </div>

 {isPlaybackMode ? (
 <div className="flex flex-wrap gap-6 bg-theme-panel border border-[#b0208a]/50 rounded-xl px-4 py-3 w-fit shadow-lg items-center premium-card">
 <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#b0208a] font-black">
 <Play size={12} className="text-[#b0208a]" /> Historical Playback Mode
 </div>
 <button onClick={exitPlaybackMode} className="text-[10px] uppercase tracking-widest bg-[#b0208a] hover:bg-[#901a70] text-theme-text px-4 py-1.5 rounded-full font-bold transition-colors shadow-md">
 Exit to Live
 </button>
 </div>
 ) : !hasLiveData ? (
 <div className="flex flex-wrap gap-6 bg-red-950/30 border border-red-500/40 rounded-xl px-4 py-3 w-fit shadow-lg items-center">
 <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-red-700 dark:text-red-400 font-bold">
 <WifiOff size={12} className="text-red-700 dark:text-red-500" /> No Live Data Available for {activeStage}
 </div>
 {syncStatus?.status === 'Error' && (
 <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-red-600 dark:text-red-400 font-bold">
 <AlertTriangle size={12} className="text-red-600 dark:text-red-500" />
 Sync Error: <span className="text-red-700 dark:text-red-300 font-black normal-case tracking-normal">{syncStatus?.error || 'Unknown error'}</span>
 </div>
 )}
 </div>
 ) : (
 <div className="flex flex-wrap gap-6 bg-theme-panel border border-theme-border rounded-xl px-4 py-3 w-fit shadow-lg text-theme-text premium-card">
 <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-theme-muted font-bold">
 <Clock size={12} className="text-blue-700 dark:text-blue-500" /> Updated: <span className="text-theme-text font-black">{snapshotTime}</span>
 </div>
 <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-theme-muted font-bold">
 <Wifi size={12} className="text-blue-700 dark:text-blue-500" /> SCADA Latency: <span className="text-theme-text font-black">{syncStatus?.latencyMs ?? '—'}ms</span>
 </div>
 <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-theme-muted font-bold">
 <Server size={12} className="text-blue-700 dark:text-blue-500" /> Twin Accuracy: <span className="text-emerald-600 font-black">{derivedKPIs?.twinAccuracy ?? '—'}%</span>
 </div>
 </div>
 )}
 </div>

 <div className="flex flex-col gap-2">
 <h2 className="text-[10px] font-bold text-theme-muted tracking-widest uppercase ml-1">
 Thermodynamic Telemetry ({activeStage}) ({timeHorizon || '1 Hour'} trailing)
 </h2>
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
 <KpiCard
 title={`Membrane Delta P`}
 value={data.differential_pressure?.toFixed(2) ?? '—'}
 unit="bar" data={visibleHistory} dataKey="differential_pressure" color="#ef4444" icon={AlertTriangle} referenceLine={alarmLimits.deltaPMax}
 unavailable={!hasLiveData}
 />
 <KpiCard
 title="Feed Pressure"
 value={data.feed_pressure?.toFixed(1) ?? '—'}
 unit="bar" data={visibleHistory} dataKey="feed_pressure" color="#1b75d0" icon={Activity} referenceLine={alarmLimits.feedPressureMax}
 unavailable={!hasLiveData}
 />
 <KpiCard
 title="Permeate Flow"
 value={data.flow_rate?.toFixed(1) ?? '—'}
 unit="m³/h" data={visibleHistory} dataKey="flow_rate" color="#1b75d0" icon={Droplets}
 unavailable={!hasLiveData}
 />
 <KpiCard
 title="Salt Rejection (Est.)"
 value={calcRejection ?? '—'}
 unit="%" data={visibleHistory} dataKey="salt_rejection" color="#f59e0b" icon={ShieldAlert} referenceLine={alarmLimits.minRejection} countdownMsg={saltRejectionBreach} tooltip="Formula: (1 - Permeate TDS / Feed TDS) * 100"
 unavailable={!hasLiveData || !stageHasQualitySensors}
 />
 <KpiCard
 title="Permeate TDS"
 value={safePermTds !== null ? safePermTds.toFixed(1) : '—'}
 unit="mg/L" data={visibleHistory} dataKey="permeate_conductivity" color="#ef4444" icon={Beaker} countdownMsg={permeateTdsBreach}
 unavailable={!hasLiveData || !stageHasQualitySensors}
 />
 <KpiCard
 title="Feed TDS"
 value={safeFeedTds !== null ? safeFeedTds.toFixed(0) : '—'}
 unit="mg/L" data={visibleHistory} dataKey="conductivity" color="#b0208a" icon={Droplets}
 unavailable={!hasLiveData || !stageHasQualitySensors}
 />
 </div>
 </div>

 <div className="w-full shrink-0 flex flex-col gap-4 pb-2 pt-2 overflow-x-auto custom-scrollbar">
 <div className="flex justify-between items-center px-2">
 <h2 className="text-xs font-black text-theme-text tracking-widest uppercase">Interactive Process Flow (Click Nodes for Details)</h2>
 </div>
 {isNandesari ? (
 <div className="flex items-stretch justify-between w-full gap-0.5 lg:gap-1 pb-4 px-0 lg:px-1 relative z-10 min-w-[750px]">
   <div className="flex flex-col items-center justify-center">
    <FlowNode
     label="Feed Header"
     value={(() => {
      const flows = ['HPA1','HPA2','HPA3','HPA4','HPA5']
       .map(s => telemetry?.stages?.[s]?.flow_rate)
       .filter(v => typeof v === 'number');
      return flows.length ? flows.reduce((a,b) => a+b, 0).toFixed(0) : null;
     })()}
     unit="m³/h"
     status="Optimal"
     onClick={() => handleAssetClick("Common Feed Header", { status: "Optimal" })}
    />
   </div>

   <div className="flex flex-col justify-around py-2 gap-1">
    {['HPA1','HPA2','HPA3','HPA4','HPA5'].map((s) => (
     <div key={s} className="text-theme-muted font-black text-[10px] px-0.5 lg:px-1">➔</div>
    ))}
   </div>

   <div className="flex flex-col gap-3">
    {[
     { key: 'HPA1', color: '#06b6d4' },
     { key: 'HPA2', color: '#10b981' },
     { key: 'HPA3', color: '#3b82f6' },
     { key: 'HPA4', color: '#f59e0b' },
     { key: 'HPA5', color: '#a855f7' },
    ].map(({ key, color }) => {
     const s = telemetry?.stages?.[key];
     const isOff = s?.feed_pressure !== null && s?.feed_pressure !== undefined && s.feed_pressure < 2.0;
     const hasData = !!s?.feed_pressure;
     return (
      <div key={key} className="flex items-center justify-between w-full gap-0.5 lg:gap-1">
       <div
        className="shrink-0 min-w-[45px] text-[8px] lg:text-[10px] font-black uppercase tracking-widest px-1 lg:px-2 py-1 rounded-md border-2 text-center"
        style={{ borderColor: color, color }}
       >
        {key}
       </div>

       {/* TMF / Feed pressure node */}
       <FlowNode
        label="TMF"
        value={s?.tmf_pressure_in?.toFixed(1)}
        unit="bar"
        status={stageStatus(key)}
        onClick={() => handleAssetClick(`${key} — Tube Media Filter`, {
         status: stageStatus(key),
         'TMF In': s?.tmf_pressure_in != null ? `${s.tmf_pressure_in} bar` : '—',
         'TMF Out': s?.tmf_pressure_out != null ? `${s.tmf_pressure_out} bar` : '—',
         'TMF DP': s?.differential_pressure != null ? `${s.differential_pressure?.toFixed(2)} bar` : '—',
        })}
       />
       <div className="text-theme-muted font-black text-[10px] px-0.5 lg:px-1">➔</div>

       {/* HP Array (VFD + RO Arrays 1 & 2) */}
       <FlowNode
        label="HP Array"
        value={isOff ? '0.0' : s?.feed_pressure?.toFixed(1)}
        unit="bar"
        status={stageStatus(key)}
        accent={key === activeStage}
        onClick={() => handleAssetClick(`${key} — HP RO Array`, {
         status: stageStatus(key),
         'Arr1 I/L': s?.feed_pressure != null ? `${s.feed_pressure} bar` : '—',
         'Arr2 O/L': s?.reject_pressure != null ? `${s.reject_pressure} bar` : '—',
         'Delta P': s?.differential_pressure != null ? `${s.differential_pressure?.toFixed(2)} bar` : '—',
         'VFD RPM': s?.vfd_rpm != null ? `${s.vfd_rpm} rpm` : '—',
        })}
       />
       <div className="text-theme-muted font-black text-[10px] px-0.5 lg:px-1">➔</div>

       {/* Permeate flow */}
       <FlowNode
        label="Permeate"
        value={isOff ? '0.0' : s?.flow_rate?.toFixed(1)}
        unit="m³/h"
        status={hasData && !isOff ? 'Optimal' : isOff ? 'Warning' : 'Optimal'}
        onClick={() => handleAssetClick(`${key} — Permeate`, {
         status: stageStatus(key),
         'Perm Flow 1+2': s?.flow_rate != null ? `${s.flow_rate} m³/h` : '—',
         'Perm CDT': s?.conductivity != null ? `${s.conductivity} µS/cm` : '—',
         'DG TDS': s?.tds != null ? `${s.tds} mg/L` : '—',
         'Perm pH': s?.permeate_pH != null ? `${s.permeate_pH}` : '—',
        })}
       />
      </div>
     );
    })}
   </div>

   {/* Merging arrows */}
   <div className="flex flex-col justify-around py-2 gap-1">
    {['HPA1','HPA2','HPA3','HPA4','HPA5'].map((s) => (
     <div key={s} className="text-theme-muted font-black text-[10px] px-0.5 lg:px-1">➔</div>
    ))}
   </div>

   {/* Combined product manifold */}
   <div className="flex flex-col items-center justify-center">
    <FlowNode
     label="Product Manifold"
     value={(() => {
      const flows = ['HPA1','HPA2','HPA3','HPA4','HPA5']
       .map(s => telemetry?.stages?.[s]?.flow_rate)
       .filter(v => typeof v === 'number');
      return flows.length ? flows.reduce((a,b) => a+b, 0).toFixed(0) : null;
     })()}
     unit="m³/h"
     status="Optimal"
     onClick={() => handleAssetClick("Product Water Manifold", { status: "Optimal" })}
    />
   </div>
  </div>

 ) : (
  /* ── JETL topology: sequential UF → HP Pump → RO1 → RO2 → RO-P ──────────── */
  <div className="flex items-center justify-between w-full gap-1 lg:gap-2 pb-4 px-1 lg:px-2 relative z-10">

  <FlowNode
  label="Raw Feed"
  value={stageFlow('UF', 'flow_rate')?.toFixed(1)}
  unit="m³/h"
  status="Optimal"
  onClick={() => handleAssetClick("Raw Feed Tank", { status: "Optimal" })}
  />

  <div className="text-theme-text font-black px-2">➔</div>

  <FlowNode
  label="UF"
  value={telemetry?.stages?.UF?.differential_pressure?.toFixed(2)}
  unit="bar (TMP)"
  status={stageStatus('UF')}
  onClick={() => handleAssetClick("Ultrafiltration", { status: stageStatus('UF') })}
  />

  <div className="text-theme-text font-black px-2">➔</div>

  <FlowNode
  label="HP Pump"
  value={telemetry?.stages?.RO1?.feed_pressure?.toFixed(1)}
  unit="bar"
  status={stageStatus('RO1')}
  accent
  onClick={() => handleAssetClick("High Pressure Pump", { status: stageStatus('RO1') })}
  />

  <div className="text-blue-300 font-black px-2">➔</div>

  <FlowNode
  label="RO1"
  value={telemetry?.stages?.RO1?.normalized_flux?.toFixed(1)}
  unit="LMH"
  status={stageStatus('RO1')}
  onClick={() => handleAssetClick("RO Stage 1 Membrane", { status: stageStatus('RO1') })}
  />

  <div className="text-theme-text font-black px-2">➔</div>

  <FlowNode
  label="RO2"
  value={telemetry?.stages?.RO2?.normalized_flux?.toFixed(1)}
  unit="LMH"
  status={stageStatus('RO2')}
  onClick={() => handleAssetClick("RO Stage 2 Membrane", { status: stageStatus('RO2') })}
  />

  <div className="text-theme-text font-black px-2">➔</div>

  <FlowNode
  label="RO-P"
  value={telemetry?.stages?.['RO-P']?.normalized_flux?.toFixed(1)}
  unit="LMH"
  status={stageStatus('RO-P')}
  onClick={() => handleAssetClick("RO Polishing Membrane", { status: stageStatus('RO-P') })}
  />

  <div className="text-theme-text font-black px-2">➔</div>

  <FlowNode
  label="Product Water"
  value={stageFlow('RO-P', 'flow_rate')?.toFixed(1)}
  unit="m³/h"
  status="Optimal"
  onClick={() => handleAssetClick("Product Water", { status: "Optimal" })}
  />

  </div>
 )}
 </div>


 {(() => {
 const stageList = isNandesari ? ['HPA1', 'HPA2', 'HPA3', 'HPA4', 'HPA5'] : ['UF', 'RO1', 'RO2', 'RO-P'];
 const stageName = activeStage;
 const data = telemetry?.stages?.[stageName];
 const isStageLive = !!data;
 const stageHasQualitySensors = !STAGES_WITHOUT_QUALITY_SENSORS.includes(stageName);
 const safeFeedTds = data?.conductivity ?? null;
 const safePermTds = data?.permeate_conductivity ?? null;
 const calcRej = stageHasQualitySensors && safeFeedTds && safePermTds !== null ? ((1 - safePermTds / safeFeedTds) * 100).toFixed(1) : null;

 return (
 <div className="w-full flex flex-col gap-4">
 <div className="flex justify-between items-center px-2">
 <h2 className="text-xs font-black text-theme-text tracking-widest uppercase">Performance Gauges & Margins — {stageName}</h2>
 <select
 value={stageName}
 onChange={(e) => setTargetStage(e.target.value)}
 className="bg-theme-main border border-theme-border text-[10px] uppercase font-bold text-theme-text rounded-md px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm"
 >
 {stageList.map(s => <option key={s} value={s}>{s}</option>)}
 </select>
 </div>
 {!isStageLive && syncStatus?.status === 'Error' && (
 <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-red-600 dark:text-red-400 font-bold bg-red-950/20 border border-red-500/30 rounded-lg px-3 py-2">
 <AlertTriangle size={12} className="text-red-600 dark:text-red-500 shrink-0" />
 Gauges showing N/A — telemetry sync failed: <span className="text-red-700 dark:text-red-300 font-black normal-case tracking-normal">{syncStatus?.error || 'Unknown error'}</span>
 </div>
 )}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
 <GaugeCard
 title="Feed Press."
 value={data?.feed_pressure ?? 0}
 min={0} max={80} unit="bar"
 color={data?.feed_pressure > alarmLimits.feedPressureMax ? '#ef4444' : '#1b75d0'}
 designVal="14.0" tripLimit={alarmLimits.feedPressureMax.toFixed(1)}
 unavailable={!isStageLive || data?.feed_pressure == null}
 />
 <GaugeCard
 title="Recovery"
 value={data?.recovery_rate ?? 0}
 min={0} max={100} unit="%"
 color={data?.recovery_rate > 70.0 ? '#f59e0b' : '#1b75d0'}
 designVal="65.0" tripLimit="70.0"
 unavailable={!isStageLive || data?.recovery_rate == null}
 />
 <GaugeCard
 title="Perm Flow"
 value={data?.flow_rate ?? 0}
 min={0} max={250} unit="m³/h"
 color={data?.flow_rate > 140.0 ? '#ef4444' : '#1b75d0'}
 designVal="120.0" tripLimit="140.0"
 unavailable={!isStageLive || data?.flow_rate == null}
 />
 <GaugeCard
 title={`TMP (Delta P)`}
 value={data?.differential_pressure ?? 0}
 min={0} max={5.0} unit="bar"
 color={data?.differential_pressure > alarmLimits.deltaPMax ? '#ef4444' : '#10b981'}
 designVal="1.5" tripLimit={alarmLimits.deltaPMax.toFixed(1)}
 unavailable={!isStageLive || data?.differential_pressure == null}
 />
 <GaugeCard
 title="Flux"
 value={data?.normalized_flux ?? 0}
 min={0} max={40} unit="LMH"
 color={data?.normalized_flux > 35 ? '#ef4444' : '#1b75d0'}
 designVal="28.0" tripLimit="35.0"
 unavailable={!isStageLive || data?.normalized_flux == null}
 />
 <GaugeCard
 title="Salt Rejection"
 value={calcRej !== null ? parseFloat(calcRej) : 0}
 min={90} max={100} unit="%"
 color={calcRej !== null && parseFloat(calcRej) < alarmLimits.minRejection ? '#ef4444' : '#1b75d0'}
 designVal="98.5" tripLimit={alarmLimits.minRejection.toFixed(1)}
 unavailable={!isStageLive || calcRej === null}
 />
 <GaugeCard
 title="Permeate TDS"
 value={safePermTds ?? 0}
 min={0} max={500} unit="ppm"
 color={safePermTds > 15 ? '#ef4444' : '#1b75d0'}
 designVal="5.0" tripLimit="15.0"
 unavailable={!isStageLive || safePermTds === null}
 />
 <GaugeCard
 title="Feed TDS"
 value={safeFeedTds ?? 0}
 min={0} max={45000} unit="ppm"
 color={safeFeedTds > 40000 ? '#ef4444' : '#1b75d0'}
 designVal="35000" tripLimit="40000"
 unavailable={!isStageLive || safeFeedTds === null}
 />
 </div>
 </div>
 );
 })()}

 {/* Predictive Alarms — moved to bottom of page per operator workflow */}
 <div className="flex flex-col gap-3">
 {activeAlarms.length > 0 ? (
 activeAlarms.map((alarm) => (
 <div key={alarm.id} className={`border ${alarm.severity === 'CRITICAL' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'} rounded-xl p-5 flex flex-col lg:flex-row gap-6 items-start lg:items-center shadow-lg relative overflow-hidden`}>
 <div className={`absolute top-0 left-0 w-1.5 h-full ${alarm.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
 <div className={`shrink-0 ${alarm.severity === 'CRITICAL' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'} p-3 rounded-full border ${alarm.severity === 'CRITICAL' ? 'border-red-200' : 'border-amber-200'}`}>
 {alarm.severity === 'CRITICAL' ? <Activity size={32} className="animate-pulse" /> : <AlertTriangle size={32} />}
 </div>
 <div className="flex-1 flex flex-col gap-1.5">
 <div className="flex items-center gap-3">
 <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded border ${alarm.severity === 'CRITICAL' ? 'text-red-700 bg-red-100 border-red-200' : 'text-amber-700 bg-amber-100 border-amber-200'}`}>
 {alarm.severity} PREDICTIVE ALERT
 </span>
 <span className="text-[10px] uppercase tracking-widest text-theme-muted font-bold flex items-center gap-1">
 Triggered: <span className="text-theme-text">{new Date(alarm.date).toLocaleTimeString()}</span>
 </span>
 </div>
 <span className={`text-xl font-black tracking-tight ${alarm.severity === 'CRITICAL' ? 'text-red-700' : 'text-amber-700'}`}>
 {alarm.description}
 </span>
 <span className="text-sm text-theme-muted font-medium">{alarm.rootCause || "Monitoring physical thresholds for deterioration."}</span>
 </div>

 <div className="flex flex-col gap-3 w-full lg:w-auto border-t lg:border-t-0 lg:border-l border-theme-border pt-4 lg:pt-0 lg:pl-6">
 <button onClick={() => navigate('/alarm-ledger')} className={`w-full ${alarm.severity === 'CRITICAL' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'} text-theme-text font-black uppercase tracking-widest text-xs px-6 py-3 rounded-full shadow-md transition-all flex items-center justify-center gap-2`}>
 Investigate <ArrowRight size={14} />
 </button>
 </div>
 </div>
 ))
 ) : (
 <div className="border border-emerald-200 bg-theme-panel rounded-xl p-5 flex items-center gap-4 shadow-lg premium-card">
 <CheckCircle2 size={32} className="text-emerald-700 dark:text-emerald-500" />
 <div className="flex flex-col">
 <span className="text-xl font-black text-emerald-600 tracking-tight">System Optimal</span>
 <span className="text-sm text-theme-muted font-medium">No active predictive alerts or critical sensor faults detected.</span>
 </div>
 </div>
 )}

 <div className="flex flex-wrap gap-4 px-2 py-1 text-[9px] font-mono text-theme-muted uppercase tracking-widest font-bold">
 <span>Model: RO-Physics-v3.0.1</span>
 <span>Data Window: {hasLiveData ? 'Live Telemetry' : 'No Live Data'}</span>
 <span>Generated: {snapshotTime}</span>
 <span>Engine: Edge Computing Node</span>
 </div>
 </div>

 <div className={`fixed inset-y-0 right-0 w-96 bg-theme-panel border-l border-theme-border shadow-[0_0_40px_rgba(0,0,0,0.2)] z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${activeAsset ? 'translate-x-0' : 'translate-x-full'}`}>
 <div className="p-6 border-b border-theme-border flex justify-between items-center bg-theme-main">
 <h2 className="text-lg font-black text-theme-text flex items-center gap-2"><Settings className="text-blue-600" size={20}/> {activeAsset?.name}</h2>
 <button onClick={() => setActiveAsset(null)} className="text-theme-muted hover:text-theme-text transition-colors bg-slate-200/50 p-1 rounded-md hover:bg-slate-200">
 <X size={20} />
 </button>
 </div>

 {activeAsset && (
 <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-6">

 <div className="flex flex-col gap-2">
 <span className="text-[10px] uppercase tracking-widest text-theme-muted font-bold">Health Status</span>
 <div className={`px-4 py-3 rounded-lg border-2 font-black flex items-center gap-2 ${activeAsset.status === 'Critical' ? 'bg-red-50 border-red-200 text-red-600' : activeAsset.status === 'Warning' ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
 {activeAsset.status === 'Critical' ? <AlertTriangle size={16}/> : activeAsset.status === 'Warning' ? <AlertTriangle size={16}/> : <CheckCircle2 size={16}/>}
 {activeAsset.status}
 </div>
 </div>

 {activeAsset.limit && (
 <div className="flex flex-col gap-2">
 <span className="text-[10px] uppercase tracking-widest text-theme-muted font-bold">Operating Limits</span>
 <div className="bg-theme-main border-2 border-theme-border rounded-lg p-4 font-mono text-sm font-bold text-amber-600">
 {activeAsset.limit}
 </div>
 </div>
 )}

 <div className="flex flex-col gap-2">
 <span className="text-[10px] uppercase tracking-widest text-theme-muted font-bold">Current Live Values</span>
 <div className="bg-theme-panel border-2 border-theme-border rounded-xl p-4 flex flex-col gap-3 text-sm">
 {Object.entries(activeAsset).filter(([k]) => !['name', 'status', 'limit', 'unit'].includes(k)).map(([key, val]) => (
 <div key={key} className="flex justify-between items-center border-b border-theme-border pb-2 last:border-0 last:pb-0">
 <span className="text-theme-muted capitalize font-medium">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
 <span className="font-black text-theme-text">{val} {activeAsset.unit}</span>
 </div>
 ))}
 </div>
 </div>

 <div className="flex flex-col gap-3 mt-auto">
 <Link to="/maintenance" className="w-full py-3.5 bg-theme-main hover:bg-slate-200 text-theme-text font-black text-sm rounded-full flex items-center justify-center gap-2 transition-colors border-2 border-theme-border shadow-sm">
 <Wrench size={16}/> View Maintenance Ledger
 </Link>
 <button onClick={() => setActiveAsset(null)} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-theme-text font-black text-sm rounded-full transition-colors shadow-md">
 Acknowledge & Close
 </button>
 </div>

 </div>
 )}
 </div>

 {activeAsset && (
 <div className="fixed inset-0 bg-theme-panel z-40 backdrop-blur-sm" onClick={() => setActiveAsset(null)}></div>
 )}

 </div>
 );
}
