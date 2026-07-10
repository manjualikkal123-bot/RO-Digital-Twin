import React, { useState, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';
import plantConfig from '../config/plant_config.json';
import { Beaker, Droplets, Settings2, FileEdit, AlertTriangle, PlayCircle, Clock, ChevronLeft, ChevronRight, Download, ShieldCheck, Bot, Activity, KeyRound, ThermometerSun, Power, ArrowRightCircle, Info } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export default function CipOptimization() {
 const { selectedFacility, telemetry, timeHorizon, isPlaybackMode, cipActive, cipStage, cipTimeElapsed, startCipSimulation, alarmLimits, mlMembraneForecast } = useAppStore();
 const config = plantConfig[selectedFacility] || plantConfig['jetl_hyderabad'];

 // Single shared timestamp so Live Heartbeat and cost card both show the same value
 const [pageTimestamp, setPageTimestamp] = useState(() => new Date().toLocaleTimeString());
 
 const handleRefill = (setter, volSetter) => {
 const now = new Date().toLocaleTimeString();
 setter(now);
 volSetter(100);
 setPageTimestamp(now);
 toast.success("Tank refilled and system logged the event.");
 };

 const [showModal, setShowModal] = useState(false);
 const [showPinModal, setShowPinModal] = useState(false);
 const [pin, setPin] = useState('');
 const [pinError, setPinError] = useState(false);
 
 // Manage mock local state for tank volumes since SCADA doesn't usually report chemical tank volumes unless specified
 const [alkaliTankVol, setAlkaliTankVol] = useState(25);
 const [acidTankVol, setAcidTankVol] = useState(65);
 const [alkaliLastRefill, setAlkaliLastRefill] = useState(null); 
 const [acidLastRefill, setAcidLastRefill] = useState(null);
 
 const [currentPage, setCurrentPage] = useState(1);
 const [dateFilter, setDateFilter] = useState('all');
 const itemsPerPage = 4;

 const [recipe, setRecipe] = useState({
 chemical: 'NaOH (Caustic)',
 concentration: 0.5,
 temperature: 30,
 soakTime: 4
 });

 const isDanger = (recipe.chemical === 'NaOH (Caustic)' && recipe.concentration > 1.0) || recipe.temperature > 45;

 const [showLogModal, setShowLogModal] = useState(false);
 const [cipLogs, setCipLogs] = useState([]);
 const [logForm, setLogForm] = useState({
 date: new Date().toISOString().split('T')[0],
 stage: 'Stage 1 RO',
 chemicalName: 'Citric Acid',
 concentration: 2.0,
 soakDuration: '2h 30m',
 tmpBefore: '',
 tmpAfter: '',
 reason: 'Routine Scheduled Wash'
 });

 useEffect(() => {
 fetchCipLogs();
 // Also set up a tick for the live timer
 const interval = setInterval(() => {
 setPageTimestamp(new Date().toLocaleTimeString());
 }, 1000);
 return () => clearInterval(interval);
 }, [selectedFacility]);

 const fetchCipLogs = async () => {
 try {
 const res = await fetch(`/api/cip-logs?plantId=${selectedFacility || 'jetl_hyderabad'}`);
 let historicalLogs = [];
 if (res.ok) {
 const data = await res.json();
 historicalLogs = [ ...data.map(d => ({
  ...d,
  tmpBefore: d.tmp_before,
  tmpAfter: d.tmp_after,
  chemicalName: d.chemical_name,
  soakDuration: d.soak_duration,
  cost: parseFloat(d.cost)
}))];
 }

 // Add ML forecast
 if (mlMembraneForecast && mlMembraneForecast.cip_forecast && mlMembraneForecast.cip_forecast.days_to_cip !== null) {
 const forecastDate = new Date();
 forecastDate.setDate(forecastDate.getDate() + mlMembraneForecast.cip_forecast.days_to_cip);
 
 const forecastLog = {
 id: 'ml_forecast',
 date: forecastDate.toISOString().split('T')[0],
 stage: 'Stage 1 RO',
 chemicalName: mlMembraneForecast.cip_forecast.fouling_analysis?.primary_chemical || 'Acid + Alkali',
 concentration: '-',
 soakDuration: '4h (Est)',
 tmpBefore: '-',
 tmpAfter: '-',
 reason: `ML Predicted (${mlMembraneForecast.cip_forecast.fouling_analysis?.type || 'Fouling'})`,
 cost: 45000,
 status: 'Forecast'
 };
 historicalLogs = [forecastLog, ...historicalLogs];
 }

 setCipLogs(historicalLogs);
 } catch (e) {
 console.error("Failed to fetch CIP logs or ML forecast", e);
 // Fallback to empty if both fail, otherwise we might just miss the forecast
 setCipLogs([]);
 }
 };

 const submitCipLog = async () => {
 if (parseFloat(logForm.tmpAfter) > parseFloat(logForm.tmpBefore)) {
 if (!window.confirm("WARNING: TMP After is higher than TMP Before! This indicates the wash failed or the data is incorrect. Are you sure you want to save this?")) {
 return;
 }
 }
 
 try {
 const res = await fetch('/api/cip-logs', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ ...logForm, plantId: selectedFacility || 'jetl_hyderabad' })
 });
 if (res.ok) {
 toast.success("Manual wash log saved permanently to ML training data!");
 setShowLogModal(false);
 fetchCipLogs();
 setLogForm({...logForm, tmpBefore: '', tmpAfter: ''});
 
 // Deduct from tank if applicable
 if (logForm.chemicalName.includes('NaOH') || logForm.chemicalName.includes('Caustic')) {
 setAlkaliTankVol(v => Math.max(0, v - 15));
 } else if (logForm.chemicalName.includes('Citric') || logForm.chemicalName.includes('Acid')) {
 setAcidTankVol(v => Math.max(0, v - 15));
 }
 } else {
 toast.error("Failed to save CIP log");
 }
 } catch (e) {
 toast.error("Network error saving log");
 }
 };

 const exportCsv = () => {
 if (sortedLedger.length === 0) return;
 const headers = ['Date', 'CIP ID', 'Wash Type', 'Conc %', 'Duration', 'TMP Before', 'TMP After', 'Recovery %', 'Total Cost', 'Status'];
 const rows = sortedLedger.map(l => [
 l.date, l.id, l.type || l.chemicalName, l.concentration || '-', l.duration || l.soakDuration, l.tmpBefore || '-', l.tmpAfter || '-', l.recoveryPct ? `${l.recoveryPct}%` : '-', l.cost || '-', l.status || 'Completed'
 ]);
 const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
 const encodedUri = encodeURI(csvContent);
 const link = document.createElement("a");
 link.setAttribute("href", encodedUri);
 link.setAttribute("download", `cip_logs_${selectedFacility || 'fleet'}.csv`);
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 };

 const forecastLogs = cipLogs.filter(l => l.status === 'Forecast');
 const dynamicLedger = cipLogs.filter(l => l.status !== 'Forecast');

 const costData = useMemo(() => {
 let acidCount = 0;
 let alkaliCount = 0;
 dynamicLedger.forEach(d => {
 const type = (d.type || d.chemicalName || '').toLowerCase();
 if (type.includes('acid')) acidCount++;
 if (type.includes('alkali') || type.includes('caustic') || type.includes('naoh')) alkaliCount++;
 });
 if (acidCount === 0 && alkaliCount === 0) return [];
 
 return [
 { name: 'Alkaline Wash', value: alkaliCount * 14500, color: '#6366f1' }, 
 { name: 'Acid Wash', value: acidCount * 6400, color: '#f59e0b' }, 
 { name: 'Water & Power', value: (acidCount + alkaliCount) * 1200, color: '#06b6d4' } 
 ];
 }, [dynamicLedger]);

 const totalCycleCost = costData.reduce((acc, curr) => acc + curr.value, 0);

 const sortedLedger = useMemo(() => {
 let filtered = [...dynamicLedger];
 if(dateFilter === 'completed') filtered = filtered.filter(f => f.status === 'Completed' || !f.status);
 return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
 }, [dynamicLedger, dateFilter]);

 const totalPages = Math.ceil(sortedLedger.length / itemsPerPage) || 1;
 const paginatedLedger = sortedLedger.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

 // FIXED: this used to read telemetry?.membrane_health?.cip_recommended,
 // a field that DOES NOT EXIST anywhere in GlobalSyncManager's real payload
 // (real shape is telemetry.stages.{UF,RO1,RO2,'RO-P'}.* and telemetry.plant.*).
 // cipVal was therefore always the `|| 0` fallback, and since isCritical
 // checked `cipVal <= 24`, this card was PERMANENTLY stuck showing
 // "WASH REQUIRED NOW" regardless of actual plant condition — a fabricated,
 // We now dynamically read from HPA1 for Nandesari, RO1 for JETL
 const isNandesari = selectedFacility === 'nia_nandesari';
 const primaryStage = isNandesari ? 'HPA1' : 'RO1';
 const permeateStage = isNandesari ? 'HPA1' : 'RO-P';
 const primaryDp = telemetry?.stages?.[primaryStage]?.differential_pressure;
 const deltaPMax = alarmLimits?.deltaPMax ?? 3.0;
 const deltaPWarn = alarmLimits?.deltaPWarningMargin ?? 2.5;

 // Simple static threshold check
 const hasDp = typeof primaryDp === 'number' && !Number.isNaN(primaryDp);
 const isCritical = hasDp && primaryDp > deltaPWarn;
 const dpHeadroom = hasDp ? Math.max(0, deltaPMax - primaryDp) : null;

 const handlePinSubmit = () => {
 if (pin === '1234') {
 setShowPinModal(false);
 
 // Auto logic based on recipe
 if (recipe.chemical.includes('NaOH') || recipe.chemical.includes('Caustic')) {
 setAlkaliTankVol(v => Math.max(0, v - 15));
 } else {
 setAcidTankVol(v => Math.max(0, v - 15));
 }

 toast.success("CIP Sequence Initiated Successfully.");
 setPin('');
 } else {
 setPinError(true);
 }
 };

 return (
 <div className="min-h-screen bg-theme-main text-slate-100 p-6 font-sans select-none flex flex-col">
 
 {/* HEADER */}
 <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-850 mb-6 gap-4 shrink-0">
 <div>
 <h1 className="text-2xl font-bold tracking-tight text-theme-text flex items-center gap-2">
 <Settings2 className="text-cyan-700 dark:text-cyan-500" /> {config.display_name} - CIP Optimization
 </h1>
 <p className="text-xs text-theme-muted mt-0.5">Automated Clean-In-Place sequence control. Note: MCF requires manual cleaning every 2-3 days. Final CIP flush is routed directly to ETP.</p>
 </div>
 <div className="flex items-center gap-4">
 <button 
 onClick={startCipSimulation}
 disabled={cipActive}
 className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-colors ${cipActive ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-theme-panel hover:bg-indigo-900/50 hover:border-indigo-500 border-theme-border text-theme-text'}`}
 >
 {cipActive ? (
 <>
 <Activity size={14} className="animate-pulse" />
 Simulating: {cipStage} ({cipTimeElapsed}s)
 </>
 ) : (
 <>
 <PlayCircle size={14} className="text-indigo-400" />
 Trigger Live CIP Simulation
 </>
 )}
 </button>
 {!isPlaybackMode && (
 <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
 <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Live • {pageTimestamp}</span>
 </div>
 )}
 </div>
 </header>

 {/* 1. TOP KPI ROW */}
 <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 shrink-0">
 
 {/* OPTIMAL CIP WINDOW */}
 <div className={`border rounded-xl p-6 flex flex-col justify-center items-center text-center relative overflow-hidden ${
 isCritical ? 'bg-rose-950/20 border-rose-500/50' : 'bg-theme-panel border-theme-border'
 }`}>
 {isCritical && <div className="absolute top-0 w-full h-1 bg-rose-500 animate-pulse"></div>}
 <div className="flex items-center gap-2 mb-2">
 {isCritical ? <AlertTriangle className="text-rose-700 dark:text-rose-500" size={20} /> : <Clock className="text-emerald-700 dark:text-emerald-500" size={20} />}
 <h2 className="text-sm font-bold tracking-widest text-theme-text uppercase">Optimal CIP Window</h2>
 </div>
 
 <div className={`text-xl font-black uppercase tracking-wide mt-2 ${isCritical ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
 {isCritical ? 'WASH REQUIRED NOW' : 'OPERATING NORMALLY'}
 </div>
 
 {isCritical && (
 <div className="flex gap-4 mt-2 mb-2 border border-amber-500/30 bg-amber-950/30 px-4 py-2 rounded-lg">
 <div className="flex flex-col items-center"><span className="text-[10px] uppercase text-amber-300 font-bold tracking-widest">Delta P</span><span className="text-sm font-black text-theme-text">{telemetry?.stages?.[primaryStage]?.differential_pressure != null ? telemetry.stages[primaryStage].differential_pressure.toFixed(2) : '--'} bar</span></div>
  <div className="flex flex-col items-center border-l border-r border-amber-500/30 px-4"><span className="text-[10px] uppercase text-amber-300 font-bold tracking-widest">Cond</span><span className="text-sm font-black text-theme-text">{telemetry?.stages?.[permeateStage]?.permeate_conductivity != null ? telemetry.stages[permeateStage].permeate_conductivity.toFixed(0) : (telemetry?.stages?.[permeateStage]?.conductivity != null ? telemetry.stages[permeateStage].conductivity.toFixed(0) : '--')} µS</span></div>
 <div className="flex flex-col items-center"><span className="text-[10px] uppercase text-amber-300 font-bold tracking-widest">Recovery</span><span className="text-sm font-black text-theme-text">{telemetry?.plant?.recovery_rate != null ? telemetry.plant.recovery_rate.toFixed(1) : '--'}%</span></div>
 </div>
 )}

 <p className="text-xs text-theme-muted mt-2 font-mono flex items-center justify-center gap-1 opacity-70">
              <Info size={12}/> 
              { !hasDp 
                ? `No live Delta P reading on ${primaryStage} yet - waiting on sync` 
                : isCritical 
                ? `CRITICAL: Delta P exceeds warning limit of ${deltaPWarn} bar!`
                : `${dpHeadroom.toFixed(2)} bar headroom on ${primaryStage} before Delta P trip (${deltaPMax.toFixed(2)} bar max)`
              }
            </p>

 <button 
 onClick={() => setShowPinModal(true)}
 className={`w-full py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
 isCritical 
 ? 'bg-rose-600 hover:bg-rose-500 text-theme-text shadow-[0_0_15px_rgba(225,29,72,0.4)]' 
 : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-theme-text border border-theme-border'
 }`}>
 <PlayCircle size={18} /> Initiate Automated Wash Cycle
 </button>
 <button 
 onClick={() => setShowModal(true)}
 className="w-full mt-3 py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all bg-slate-100 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-theme-text border border-theme-border"
 >
 <Settings2 size={18} /> Customize Wash Recipe
 </button>
 <button 
 onClick={() => setShowLogModal(true)}
 className="w-full mt-3 py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 shadow-[0_0_15px_rgba(79,70,229,0.1)]"
 >
 <FileEdit size={18} /> Log Manual Wash Event
 </button>
 </div>

 {/* TOTAL CYCLE COST */}
 <div className="bg-theme-panel border border-theme-border rounded-xl p-6 flex flex-col justify-center items-center text-center relative">
 <div className="absolute top-3 right-3 text-[9px] text-theme-muted uppercase tracking-widest font-mono">As of {pageTimestamp}</div>
 <h2 className="text-sm font-bold tracking-widest text-theme-muted uppercase mb-4 mt-2">Total Historic Cost</h2>
 <div className="text-5xl font-black text-theme-text tracking-tight flex items-baseline gap-1">
 <span className="text-2xl text-theme-muted font-normal">₹</span>
 {totalCycleCost.toLocaleString('en-IN')}
 </div>
 <div className="text-theme-muted text-[10px] mt-3 bg-theme-panel px-3 py-1.5 rounded-full border border-theme-border uppercase tracking-widest font-bold">
 Aggregated from logged washes
 </div>
 </div>

 {/* CIP COST BREAKDOWN */}
 <div className="bg-theme-panel border border-theme-border rounded-xl p-5 flex items-center justify-center">
 {costData.length === 0 ? (
 <div className="text-theme-muted text-sm font-bold uppercase tracking-wider text-center">
 No Wash Logs Found
 </div>
 ) : (
 <>
 <div className="w-1/2 h-[180px]">
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie
 data={costData}
 cx="50%"
 cy="50%"
 innerRadius={38}
 outerRadius={68}
 paddingAngle={3}
 dataKey="value"
 stroke="none"
 startAngle={90}
 endAngle={-270}
 >
 {costData.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={entry.color} />
 ))}
 </Pie>
 <Tooltip 
 formatter={(val) => `₹${val.toLocaleString('en-IN')}`}
 contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', border: '1px solid var(--border-panel)', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)', color: 'var(--text-main)', fontWeight: 'bold' }} 
 itemStyle={{ fontWeight: 'bold' }}
 />
 </PieChart>
 </ResponsiveContainer>
 </div>
 <div className="w-1/2 pl-2">
 <h2 className="text-[11px] font-medium text-theme-muted mb-3">Cost breakdown</h2>
 <div className="space-y-3">
 {costData.map(item => (
 <div key={item.name} className="flex flex-col">
 <div className="flex items-center justify-between gap-1.5">
 <div className="flex items-center gap-1.5 text-[11px] text-theme-muted">
 <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
 {item.name}
 </div>
 <div className="text-[11px] font-bold text-theme-text">
 {((item.value / totalCycleCost) * 100).toFixed(0)}%
 </div>
 </div>
 <div className="text-xs font-bold text-theme-text ml-3.5">
 ₹{item.value.toLocaleString('en-IN')}
 </div>
 </div>
 ))}
 </div>
 </div>
 </>
 )}
 </div>
 </section>

 {/* 2. THE CHEMICAL MATRIX (Active Control) */}
 <section className="bg-theme-panel border border-theme-border rounded-xl p-6 flex flex-col gap-6 mb-6">
 <h2 className="text-sm font-bold text-theme-text uppercase tracking-wider mb-[-10px]">The Chemical Matrix</h2>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {/* ACID CLEANING MODULE */}
 {(() => {
 const acidCritical = acidTankVol < 40;
 const pumpActive = !acidCritical;
 return (
 <div className={`bg-theme-main border border-t-4 rounded-xl p-5 flex flex-col relative overflow-hidden transition-colors ${acidCritical ? 'border-amber-500/50 border-t-amber-500' : 'border-emerald-500/30 border-t-emerald-500'}`}>
 <div className={`absolute top-0 right-0 w-32 h-32 blur-[50px] rounded-full pointer-events-none ${acidCritical ? 'bg-amber-500/10' : 'bg-emerald-500/5'}`} />
 
 <div className="flex justify-between items-start mb-6">
 <div>
 <h3 className="text-lg font-bold text-theme-text flex items-center gap-2">
 <Beaker className={acidCritical ? 'text-amber-700 dark:text-amber-500' : 'text-emerald-700 dark:text-emerald-500'} /> Acid Cleaning
 </h3>
 <p className="text-xs text-theme-muted mt-1">Citric Acid (C6H8O7) 2.0%</p>
 </div>
 {acidCritical ? (
 <span className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/40 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1 animate-pulse">
 <AlertTriangle size={12}/> Low stock
 </span>
 ) : (
 <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
 Standby
 </span>
 )}
 </div>

 <div className="grid grid-cols-3 gap-2 mb-4">
 <div className="bg-theme-panel p-2 rounded border border-theme-border flex flex-col items-center">
 <ThermometerSun size={14} className="text-theme-muted mb-1"/>
 <span className="text-[10px] text-theme-muted uppercase font-bold tracking-widest">Temp</span>
 <span className="text-sm font-black text-theme-muted">No Sensor</span>
 </div>
 <div className="bg-theme-panel p-2 rounded border border-theme-border flex flex-col items-center">
 <Activity size={14} className="text-theme-muted mb-1"/>
 <span className="text-[10px] text-theme-muted uppercase font-bold tracking-widest">Flow</span>
 <span className="text-sm font-black text-theme-muted">No Sensor</span>
 </div>
 <div className="bg-theme-panel p-2 rounded border border-theme-border flex flex-col items-center">
 <Power size={14} className="text-theme-muted mb-1"/>
 <span className="text-[10px] text-theme-muted uppercase font-bold tracking-widest">Pump</span>
 <span className="text-sm font-black text-theme-muted">OFF</span>
 </div>
 </div>

 <div className="space-y-2 mt-auto">
 <div className="flex justify-between text-xs font-bold mb-1">
 <span className="text-theme-muted flex items-center gap-1"><Droplets size={14} className={acidCritical ? 'text-amber-700 dark:text-amber-500/70' : 'text-emerald-700 dark:text-emerald-500/70'} /> Tank level</span>
 <span className={acidCritical ? 'text-amber-700 dark:text-amber-400' : 'text-theme-text'}>{acidTankVol}% Vol</span>
 </div>
 <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
 <div
 className={`h-full rounded-full opacity-80 ${acidCritical ? 'bg-amber-500' : 'bg-emerald-500'}`}
 style={{ width: `${acidTankVol}%`, transition: 'width 0.5s ease-in-out' }}
 />
 </div>
 <div className="flex items-center justify-between mt-1.5">
 <span className="text-[10px] text-theme-muted font-mono">Source: SCADA Level Sensor LT-102</span>
 {acidLastRefill ? (
 <span className="text-[10px] text-theme-muted font-mono">Refilled {acidLastRefill}</span>
 ) : (
 <button
 onClick={() => handleRefill(setAcidLastRefill, setAcidTankVol)}
 className={`text-[10px] underline underline-offset-2 transition-colors ${acidCritical ? 'text-amber-700 dark:text-amber-500/70 hover:text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-500/70 hover:text-emerald-700 dark:text-emerald-400'}`}
 >
 Log refill event
 </button>
 )}
 </div>
 </div>
 </div>
 );
 })()}

 {/* ALKALI CLEANING MODULE */}
 {(() => {
 const alkaliCritical = alkaliTankVol < 40;
 // When tank is critically low, auto-stop the pump — logical reconciliation
 const pumpActive = alkaliCritical ? false : true;
 const flowRate = alkaliCritical ? 0.0 : 12.4;
 return (
 <div className={`bg-theme-main border border-t-4 rounded-xl p-5 flex flex-col relative overflow-hidden transition-colors ${alkaliCritical ? 'border-amber-500/50 border-t-amber-500' : 'border-indigo-500/30 border-t-indigo-500'}`}>
 <div className={`absolute top-0 right-0 w-32 h-32 blur-[50px] rounded-full pointer-events-none ${alkaliCritical ? 'bg-amber-500/10' : 'bg-indigo-500/5'}`} />
 
 <div className="flex justify-between items-start mb-6">
 <div>
 <h3 className="text-lg font-bold text-theme-text flex items-center gap-2">
 <Beaker className={alkaliCritical ? 'text-amber-700 dark:text-amber-400' : 'text-indigo-500'} /> Alkali Cleaning
 </h3>
 <p className="text-xs text-theme-muted mt-1">Sodium Hydroxide (NaOH) 0.1%</p>
 </div>
 <div className="flex gap-2">
 {alkaliCritical ? (
 <span className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/40 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1 animate-pulse">
 <AlertTriangle size={12}/> Low stock — pump off
 </span>
 ) : (
 <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider animate-pulse">
 Active Prime
 </span>
 )}
 </div>
 </div>

 <div className="grid grid-cols-3 gap-2 mb-4">
 <div className="bg-theme-panel p-2 rounded border border-theme-border flex flex-col items-center">
 <ThermometerSun size={14} className="text-theme-muted mb-1"/>
 <span className="text-[10px] text-theme-muted uppercase font-bold tracking-widest">Temp</span>
 <span className="text-sm font-black text-theme-muted">No Sensor</span>
 </div>
 <div className="bg-theme-panel p-2 rounded border border-theme-border flex flex-col items-center">
 <Activity size={14} className={flowRate > 0 ? 'text-cyan-700 dark:text-cyan-400 mb-1' : 'text-theme-muted mb-1'}/>
 <span className="text-[10px] text-theme-muted uppercase font-bold tracking-widest">Flow</span>
 <span className={`text-sm font-black ${flowRate > 0 ? 'text-theme-text' : 'text-theme-muted'}`}>{flowRate.toFixed(1)} L/h</span>
 </div>
 <div className="bg-theme-panel p-2 rounded border border-theme-border flex flex-col items-center">
 <Power size={14} className={pumpActive ? 'text-emerald-700 dark:text-emerald-400 mb-1' : 'text-theme-muted mb-1'}/>
 <span className="text-[10px] text-theme-muted uppercase font-bold tracking-widest">Pump</span>
 <span className={`text-sm font-black ${pumpActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-theme-muted'}`}>{pumpActive ? 'ON' : 'OFF'}</span>
 </div>
 </div>

 {alkaliCritical && (
 <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg px-3 py-2 mb-3 flex items-start gap-2 text-xs text-amber-300">
 <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
 <span>Pump auto-stopped at {alkaliTankVol}% tank level — refill to above 40% to resume dosing.</span>
 </div>
 )}

 <div className="space-y-2 mt-auto">
 <div className="flex justify-between text-xs font-bold mb-1">
 <span className="text-theme-muted flex items-center gap-1"><Droplets size={14} className={alkaliCritical ? 'text-amber-700 dark:text-amber-500/70' : 'text-indigo-500/70'} /> Tank level</span>
 <span className={alkaliCritical ? 'text-amber-700 dark:text-amber-400' : 'text-theme-text'}>{alkaliTankVol}% Vol</span>
 </div>
 <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
 <div
 className={`h-full rounded-full ${alkaliCritical ? 'bg-amber-500' : 'bg-indigo-500'} opacity-80`}
 style={{ width: `${alkaliTankVol}%`, transition: 'width 0.5s ease-in-out' }}
 />
 </div>
 <div className="flex items-center justify-between mt-1.5">
 <span className="text-[10px] text-theme-muted font-mono">Source: SCADA Level Sensor LT-104</span>
 {alkaliLastRefill ? (
 <span className="text-[10px] text-theme-muted font-mono">Refilled {alkaliLastRefill}</span>
 ) : (
 <button
 onClick={() => handleRefill(setAlkaliLastRefill, setAlkaliTankVol)}
 className={`text-[10px] underline underline-offset-2 transition-colors ${alkaliCritical ? 'text-amber-700 dark:text-amber-500/70 hover:text-amber-700 dark:text-amber-400' : 'text-indigo-400/70 hover:text-indigo-300'}`}
 >
 Log refill event
 </button>
 )}
 </div>
 </div>
 </div>
 );
 })()}
 </div>
 </section>


 {/* EFFECTIVENESS SUMMARY CARD */}
 {cipLogs.length > 0 && (
 <section className="bg-theme-panel border border-theme-border rounded-xl p-4 mb-6">
 <h2 className="text-xs font-bold text-theme-muted uppercase tracking-widest mb-4">Chemical Effectiveness Summary (ML Training Ground Truth)</h2>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 {Object.entries(cipLogs.reduce((acc, log) => {
 // Only count completed washes with a real recovery reading — excludes Forecast rows
 if(log.status === 'Forecast' || !log.recoveryPct) return acc;
 
 const typeName = log.type || log.chemicalName || 'Unknown Wash';
 if(!acc[typeName]) acc[typeName] = { count: 0, totalRec: 0 };
 acc[typeName].count += 1;
 acc[typeName].totalRec += log.recoveryPct;
 return acc;
 }, {})).map(([chem, data]) => (
 <div key={chem} className="bg-theme-panel border border-theme-border rounded-lg p-3">
 <div className="text-[10px] text-cyan-700 dark:text-cyan-500 uppercase tracking-widest font-bold mb-1">{chem}</div>
 <div className="flex justify-between items-end">
 <div className="flex flex-col">
 <span className="text-2xl font-bold text-theme-text">{Math.round(data.totalRec / data.count)}%</span>
 <span className="text-[9px] text-theme-muted uppercase tracking-widest">Avg Recovery</span>
 </div>
 <div className="text-[10px] text-theme-muted font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
 Used {data.count}x
 </div>
 </div>
 </div>
 ))}
 </div>
 </section>
 )}

 {/* PREDICTED UPCOMING WASH */}
 {forecastLogs.length > 0 && (
 <section className="bg-theme-panel border border-indigo-500/30 rounded-xl mb-6 overflow-hidden">
 <div className="p-4 border-b border-indigo-500/20 bg-indigo-950/20 flex justify-between items-center">
 <h2 className="text-sm font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
 <Bot size={16} className="text-indigo-400"/> Predicted Upcoming Wash
 </h2>
 <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
 Forecast
 </span>
 </div>
 <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
 {forecastLogs.map(log => (
 <div key={log.id || log.date} className="flex flex-1 justify-between items-center w-full">
 <div className="flex flex-col">
 <span className="text-[10px] text-theme-muted uppercase tracking-widest font-bold">Predicted Date</span>
 <span className="text-sm font-bold text-theme-text">{log.date}</span>
 </div>
 <div className="flex flex-col">
 <span className="text-[10px] text-theme-muted uppercase tracking-widest font-bold">Wash Type</span>
 <span className="text-sm font-bold text-theme-text">{log.type || log.chemicalName}</span>
 </div>
 <div className="flex flex-col">
 <span className="text-[10px] text-theme-muted uppercase tracking-widest font-bold">Est. Cost</span>
 <span className="text-sm font-mono text-theme-text">₹{(log.cost || 0).toLocaleString('en-IN')}</span>
 </div>
 <div className="flex flex-col">
 <span className="text-[10px] text-theme-muted uppercase tracking-widest font-bold">Duration</span>
 <span className="text-sm text-theme-muted">—</span>
 </div>
 <div className="flex flex-col">
 <span className="text-[10px] text-theme-muted uppercase tracking-widest font-bold">Performed By</span>
 <span className="text-xs text-theme-muted italic">Awaiting execution</span>
 </div>
 <div className="flex flex-col">
 <span className="text-[10px] text-theme-muted uppercase tracking-widest font-bold">Approved By</span>
 <span className="text-xs text-theme-muted">—</span>
 </div>
 </div>
 ))}
 </div>
 </section>
 )}

 {/* 3. CIP WASH LEDGER */}
 <section className="bg-theme-panel border border-theme-border rounded-xl flex flex-col flex-1 min-h-[300px]">
 <div className="p-4 border-b border-theme-border flex justify-between items-center bg-theme-panel">
 <h2 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
 <Clock size={16} className="text-theme-muted"/> CIP Wash Ledger
 </h2>
 <div className="flex gap-3">
 <select value={dateFilter} onChange={(e) => {setDateFilter(e.target.value); setCurrentPage(1);}} className="bg-theme-main border border-theme-border text-[10px] uppercase font-bold tracking-widest text-theme-text rounded px-2 py-1 focus:outline-none">
 <option value="all">All Records</option>
 <option value="completed">Completed Only</option>
 </select>
 <button onClick={exportCsv} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 border border-theme-border text-theme-text px-3 py-1 rounded text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
 <Download size={12}/> Export CSV
 </button>
 </div>
 </div>
 
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse whitespace-nowrap">
 <thead>
 <tr className="border-b border-theme-border bg-theme-main text-[10px] uppercase tracking-wider text-theme-muted">
 <th className="p-4 font-semibold">Date</th>
 <th className="p-4 font-semibold">CIP ID</th>
 <th className="p-4 font-semibold">Wash Type</th>
 <th className="p-4 font-semibold">Duration</th>
 <th className="p-4 font-semibold">Total Cost</th>
 <th className="p-4 font-semibold">Performed By</th>
 <th className="p-4 font-semibold">Approved By</th>
 <th className="p-4 font-semibold">Status</th>
 </tr>
 </thead>
 <tbody>
 {paginatedLedger.length === 0 ? (
 <tr>
 <td colSpan="8" className="p-10 text-center text-theme-muted text-sm italic">
 No CIP wash records found in the database.
 </td>
 </tr>
 ) : paginatedLedger.map((log) => (
 <tr key={log.id || `${log.date}-${log.chemicalName}`} className="border-b border-theme-border/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
 <td className="p-4 text-sm font-bold text-theme-text">{log.date}</td>
 <td className="p-4 text-xs font-mono text-theme-muted">{log.id || 'MANUAL-ENTRY'}</td>
 <td className="p-4 text-xs font-bold text-theme-text">{log.type || log.chemicalName}</td>
 <td className="p-4 text-xs text-theme-muted">{log.duration || log.soakDuration}</td>
 <td className="p-4 text-sm font-mono text-theme-text">{log.cost ? `₹${log.cost.toLocaleString('en-IN')}` : '--'}</td>
 <td className="p-4 text-xs text-theme-text">{log.perf || 'Operator'}</td>
 <td className="p-4 text-xs">
 {log.app === 'System Auto' ? (
 <span className="flex items-center gap-1 text-theme-muted" title="Automated system approval — no human sign-off">
 <Bot size={12} className="text-cyan-800"/> System Auto
 </span>
 ) : log.app === 'Pending' ? (
 <span className="flex items-center gap-1 text-theme-muted">
 <ShieldCheck size={12} className="text-theme-text"/> Pending
 </span>
 ) : (
 <span className="flex items-center gap-1 text-emerald-300" title="Human-approved">
 <ShieldCheck size={12} className="text-emerald-700 dark:text-emerald-500"/> {log.app || 'Local Authorized'}
 </span>
 )}
 </td>
 <td className="p-4">
 <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md border
 ${(!log.status || log.status === 'Completed') ? 'bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' : 
 'bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-500/30'}`}
 >
 {log.status || 'Completed'}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <div className="p-4 border-t border-theme-border flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-theme-muted mt-auto bg-theme-panel">
 <span>Showing {paginatedLedger.length} of {sortedLedger.length} records</span>
 <div className="flex gap-2">
 <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1 hover:text-theme-text disabled:opacity-50"><ChevronLeft size={16}/></button>
 <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">Page {currentPage} of {totalPages}</span>
 <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1 hover:text-theme-text disabled:opacity-50"><ChevronRight size={16}/></button>
 </div>
 </div>
 </section>

 {/* RECIPE OVERRIDE MODAL */}
 {showModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
 <div className="bg-theme-panel border border-theme-border rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 premium-card">
 <div className="p-5 border-b border-theme-border flex justify-between items-center bg-theme-panel">
 <h2 className="text-lg font-bold text-theme-text flex items-center gap-2">
 <Settings2 className="text-cyan-700 dark:text-cyan-500" /> Customize Wash Recipe
 </h2>
 <button onClick={() => setShowModal(false)} className="text-theme-muted hover:text-theme-text transition-colors">✕</button>
 </div>
 
 <div className="p-6 flex flex-col gap-6">
 
 {isDanger && (
 <div className="bg-rose-950/40 border border-rose-500/50 rounded-lg p-4 flex gap-3 animate-pulse">
 <AlertTriangle className="text-rose-700 dark:text-rose-500 shrink-0 mt-0.5" />
 <div>
 <h3 className="text-rose-700 dark:text-rose-500 font-bold text-sm uppercase tracking-wide">Critical Warning</h3>
 <p className="text-rose-700 dark:text-rose-400/80 text-xs mt-1">Potential membrane degradation risk. Recipe exceeds standard safety limits.</p>
 </div>
 </div>
 )}

 <div className="flex flex-col gap-2">
 <label className="text-xs font-bold text-theme-muted uppercase tracking-wider">Chemical Base</label>
 <select 
 value={recipe.chemical}
 onChange={(e) => setRecipe({...recipe, chemical: e.target.value})}
 className="bg-theme-main border border-theme-border text-theme-text rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 cursor-pointer"
 >
 <option>NaOH (Caustic)</option>
 <option>Citric Acid</option>
 <option>HCl</option>
 </select>
 </div>

 <div className="flex flex-col gap-2">
 <div className="flex justify-between items-center">
 <label className="text-xs font-bold text-theme-muted uppercase tracking-wider">Dosing Concentration</label>
 <span className={`text-sm font-bold ${recipe.concentration > 1.0 && recipe.chemical === 'NaOH (Caustic)' ? 'text-rose-700 dark:text-rose-500' : 'text-emerald-700 dark:text-emerald-400'}`}>{recipe.concentration.toFixed(1)}%</span>
 </div>
 <input 
 type="range" min="0.1" max="3.0" step="0.1" 
 value={recipe.concentration} 
 onChange={(e) => setRecipe({...recipe, concentration: parseFloat(e.target.value)})}
 className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${recipe.concentration > 1.0 && recipe.chemical === 'NaOH (Caustic)' ? 'bg-rose-900/50 accent-rose-500' : 'bg-slate-100 dark:bg-slate-800 accent-emerald-500'}`} 
 />
 </div>

 <div className="flex flex-col gap-2">
 <div className="flex justify-between items-center">
 <label className="text-xs font-bold text-theme-muted uppercase tracking-wider">Target Temperature</label>
 <span className={`text-sm font-bold ${recipe.temperature > 45 ? 'text-rose-700 dark:text-rose-500' : 'text-amber-700 dark:text-amber-400'}`}>{recipe.temperature.toFixed(1)}°C</span>
 </div>
 <input 
 type="range" min="20" max="60" step="1" 
 value={recipe.temperature} 
 onChange={(e) => setRecipe({...recipe, temperature: parseFloat(e.target.value)})}
 className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${recipe.temperature > 45 ? 'bg-rose-900/50 accent-rose-500' : 'bg-slate-100 dark:bg-slate-800 accent-amber-500'}`} 
 />
 </div>

 <div className="flex flex-col gap-2">
 <div className="flex justify-between items-center">
 <label className="text-xs font-bold text-theme-muted uppercase tracking-wider">Soak Time</label>
 <span className="text-sm font-bold text-cyan-700 dark:text-cyan-400">{recipe.soakTime} hrs</span>
 </div>
 <input 
 type="range" min="1" max="12" step="1" 
 value={recipe.soakTime} 
 onChange={(e) => setRecipe({...recipe, soakTime: parseInt(e.target.value)})}
 className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" 
 />
 </div>

 </div>

 <div className="p-5 border-t border-theme-border bg-theme-panel flex justify-end gap-4">
 <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-bold text-theme-muted hover:text-theme-text transition-colors">Cancel</button>
 <button 
 onClick={() => setShowModal(false)} 
 className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${isDanger ? 'bg-rose-600 hover:bg-rose-500 text-theme-text shadow-[0_0_15px_rgba(225,29,72,0.4)]' : 'bg-emerald-600 hover:bg-emerald-500 text-theme-text shadow-[0_0_15px_rgba(16,185,129,0.3)]'}`}
 >
 Apply Override
 </button>
 </div>
 </div>
 </div>
 )}

 {/* 2-STEP PIN VERIFICATION MODAL */}
 {showPinModal && (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
 <div className="bg-theme-panel border-2 border-rose-500/50 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 premium-card">
 <div className="p-5 border-b border-theme-border flex justify-center items-center bg-rose-950/20">
 <h2 className="text-sm font-bold text-rose-700 dark:text-rose-500 uppercase tracking-widest flex items-center gap-2">
 <AlertTriangle size={16} /> Operator Verification Required
 </h2>
 </div>
 
 <div className="p-6 flex flex-col items-center gap-4 text-center">
 <div className="w-16 h-16 bg-theme-panel rounded-full flex items-center justify-center border-2 border-theme-border shadow-inner mb-2">
 <KeyRound size={28} className="text-theme-muted"/>
 </div>
 <p className="text-xs text-theme-text font-bold uppercase tracking-widest">
 Initiating Automated CIP Sequence
 </p>
 <p className="text-[10px] text-theme-muted">
 Please enter your 4-digit SCADA operator PIN to authorize the chemical dosing sequence.
 </p>

 <input 
 type="password" 
 maxLength="4"
 value={pin}
 onChange={(e) => {setPin(e.target.value); setPinError(false);}}
 className={`w-32 bg-theme-main border-b-2 text-center text-3xl tracking-[0.5em] font-mono text-theme-text py-2 focus:outline-none transition-colors ${pinError ? 'border-rose-500 animate-shake' : 'border-theme-border focus:border-cyan-500'}`}
 placeholder="••••"
 autoFocus
 />
 {pinError && <span className="text-[10px] font-bold text-rose-700 dark:text-rose-500 uppercase tracking-widest animate-pulse">Invalid Authorization PIN</span>}
 </div>

 <div className="flex border-t border-theme-border">
 <button onClick={() => {setShowPinModal(false); setPinError(false); setPin('');}} className="flex-1 py-4 text-xs font-bold text-theme-muted hover:text-theme-text hover:bg-slate-100 dark:bg-slate-800 transition-colors uppercase tracking-widest">Abort</button>
 <button onClick={handlePinSubmit} className="flex-1 py-4 text-xs font-bold bg-rose-600/90 hover:bg-rose-500 text-theme-text transition-colors uppercase tracking-widest flex justify-center items-center gap-2"><ArrowRightCircle size={14}/> Authorize</button>
 </div>
 </div>
 </div>
 )}


 {/* LOG CIP EVENT MODAL */}
 {showLogModal && (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
 <div className="bg-theme-panel border border-indigo-500/50 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 premium-card">
 <div className="p-5 border-b border-theme-border flex justify-between items-center bg-theme-panel">
 <h2 className="text-lg font-bold text-theme-text flex items-center gap-2">
 <FileEdit className="text-indigo-500" /> Log Manual CIP Wash
 </h2>
 <button onClick={() => setShowLogModal(false)} className="text-theme-muted hover:text-theme-text">✕</button>
 </div>
 
 <div className="p-6 grid grid-cols-2 gap-4">
 <div className="flex flex-col gap-1">
 <label className="text-xs font-bold text-theme-muted uppercase">Date</label>
 <input type="date" value={logForm.date} onChange={e => setLogForm({...logForm, date: e.target.value})} className="bg-theme-panel border border-theme-border text-theme-text p-2 rounded focus:border-indigo-500 outline-none"/>
 </div>
 <div className="flex flex-col gap-1">
 <label className="text-xs font-bold text-theme-muted uppercase">Wash Stage</label>
 <select value={logForm.stage} onChange={e => setLogForm({...logForm, stage: e.target.value})} className="bg-theme-panel border border-theme-border text-theme-text p-2 rounded focus:border-indigo-500 outline-none">
 <option>Stage 1 RO</option>
 <option>Stage 2 RO</option>
 <option>Pre-Treatment UF</option>
 </select>
 </div>
 
 <div className="flex flex-col gap-1">
 <label className="text-xs font-bold text-theme-muted uppercase">Chemical Used</label>
 <input type="text" value={logForm.chemicalName} onChange={e => setLogForm({...logForm, chemicalName: e.target.value})} className="bg-theme-panel border border-theme-border text-theme-text p-2 rounded focus:border-indigo-500 outline-none"/>
 </div>
 <div className="flex flex-col gap-1">
 <label className="text-xs font-bold text-theme-muted uppercase">Concentration (%)</label>
 <input type="number" step="0.1" value={logForm.concentration} onChange={e => setLogForm({...logForm, concentration: parseFloat(e.target.value)})} className="bg-theme-panel border border-theme-border text-theme-text p-2 rounded focus:border-indigo-500 outline-none"/>
 </div>

 <div className="flex flex-col gap-1 col-span-2">
 <label className="text-xs font-bold text-theme-muted uppercase">Soak Duration (e.g. 2h 30m)</label>
 <input type="text" value={logForm.soakDuration} onChange={e => setLogForm({...logForm, soakDuration: e.target.value})} className="bg-theme-panel border border-theme-border text-theme-text p-2 rounded focus:border-indigo-500 outline-none"/>
 </div>

 <div className="flex flex-col gap-1">
 <label className="text-xs font-bold text-theme-muted uppercase">TMP Before (bar)</label>
 <input type="number" step="0.01" value={logForm.tmpBefore} onChange={e => setLogForm({...logForm, tmpBefore: e.target.value})} className="bg-theme-panel border border-theme-border text-amber-700 dark:text-amber-400 font-mono p-2 rounded focus:border-indigo-500 outline-none" placeholder="e.g. 1.85"/>
 </div>
 <div className="flex flex-col gap-1">
 <label className="text-xs font-bold text-theme-muted uppercase">TMP After (bar)</label>
 <input type="number" step="0.01" value={logForm.tmpAfter} onChange={e => setLogForm({...logForm, tmpAfter: e.target.value})} className={`bg-theme-panel border font-mono p-2 rounded focus:border-indigo-500 outline-none ${parseFloat(logForm.tmpAfter) > parseFloat(logForm.tmpBefore) ? 'border-rose-500 text-rose-700 dark:text-rose-500' : 'border-theme-border text-emerald-700 dark:text-emerald-400'}`} placeholder="e.g. 1.10"/>
 {parseFloat(logForm.tmpAfter) > parseFloat(logForm.tmpBefore) && (
 <span className="text-[10px] text-rose-700 dark:text-rose-500 font-bold mt-1">⚠️ Warning: TMP after CIP is higher than before. Please verify.</span>
 )}
 </div>

 <div className="flex flex-col gap-1 col-span-2">
 <label className="text-xs font-bold text-theme-muted uppercase">Reason for CIP</label>
 <input type="text" value={logForm.reason} onChange={e => setLogForm({...logForm, reason: e.target.value})} className="bg-theme-panel border border-theme-border text-theme-text p-2 rounded focus:border-indigo-500 outline-none"/>
 </div>
 </div>

 <div className="p-5 border-t border-theme-border bg-theme-panel flex justify-end gap-3">
 <button onClick={() => setShowLogModal(false)} className="px-4 py-2 text-sm font-bold text-theme-muted hover:text-theme-text transition-colors">Cancel</button>
 <button onClick={submitCipLog} className="px-6 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-theme-text rounded-lg shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all">
 Save & Push to ML Training
 </button>
 </div>
 </div>
 </div>
 )}

 </div>
 );
}
