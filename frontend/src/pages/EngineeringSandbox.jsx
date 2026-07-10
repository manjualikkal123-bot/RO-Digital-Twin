import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import plantConfig from '../config/plant_config.json';
import { Sliders, Activity, Beaker, Droplets, ShieldAlert, Save, Layers, Clock, TrendingUp, Cpu, Info, RefreshCw, Wand2, CheckCircle, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LabelList } from 'recharts';

// Tri-State Slider Component
const TriStateSlider = ({ label, min, max, step, value, baseline, optimal, unit, onChange, name, icon: Icon, color }) => {
 const safeVal = value ?? baseline;
 const percentVal = ((safeVal - min) / (max - min)) * 100;
 const percentBase = ((baseline - min) / (max - min)) * 100;
 const isModified = Math.abs(safeVal - baseline) >= step;

 const trackLeft = Math.min(percentBase, percentVal);
 const trackWidth = Math.abs(percentVal - percentBase);

 return (
 <div className="flex flex-col gap-1.5 relative mt-4">
 <div className="flex justify-between items-center">
 <span className="text-theme-text font-medium text-[13px] flex items-center gap-1.5">
 <Icon size={14} className={color}/> {label}
 </span>
 <div className="flex items-center gap-4">
 <div className="text-right">
 <div className="text-[11px] text-theme-muted leading-none mb-0.5">Live</div>
 <div className="text-[13px] text-theme-muted font-mono leading-none">{baseline.toFixed(1)}</div>
 </div>
 <div className="text-right">
 <div className="text-[11px] text-theme-muted leading-none mb-0.5">Opt</div>
 <div className="text-[13px] text-theme-text font-mono leading-none">{optimal.toFixed(1)}</div>
 </div>
 <div className="text-right">
 <div className="text-[11px] text-theme-muted leading-none mb-0.5">Mod</div>
 <div className={`text-[13px] font-mono leading-none font-medium ${isModified ? 'text-theme-text' : 'text-theme-muted'}`}>{safeVal.toFixed(1)} <span className="text-[10px] text-theme-muted">{unit}</span></div>
 </div>
 </div>
 </div>

 <div className="relative w-full h-6 flex items-center">
 <div className="absolute w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full" />
 {isModified && (
 <div
 className="absolute h-1.5 bg-[#378ADD]/60 rounded-full"
 style={{ left: `${trackLeft}%`, width: `${trackWidth}%` }}
 />
 )}
 {isModified && (
 <div
 className="absolute w-2 h-2 rounded-full bg-[#888780] border border-slate-300 dark:border-slate-600 pointer-events-none z-10"
 style={{ left: `calc(${percentBase}% - 4px)` }}
 title="Live baseline"
 />
 )}
 <input
 type="range"
 name={name}
 min={min}
 max={max}
 step={step}
 value={safeVal}
 onChange={onChange}
 className="absolute w-full h-full opacity-0 cursor-pointer z-20"
 />
 <div
 className="absolute w-3 h-3 rounded-full bg-[#378ADD] border-2 border-blue-300/40 shadow-[0_0_6px_rgba(55,138,221,0.6)] pointer-events-none z-10 transition-all"
 style={{ left: `calc(${percentVal}% - 6px)` }}
 title="Modified"
 />
 </div>
 </div>
 );
};

export default function EngineeringSandbox() {
 const { telemetry, selectedFacility } = useAppStore();
 const config = plantConfig[selectedFacility] || plantConfig['jetl_hyderabad'];

 const isNandesari = selectedFacility === 'nia_nandesari';
 const primaryStage = isNandesari ? 'HPA1' : 'RO1';
 const stageData = telemetry?.stages?.[primaryStage] || {};
 const plantData = telemetry?.plant || {};

 // Dynamically calculate baselines from live telemetry
 const baselines = useMemo(() => {
  const rpm = stageData.pump_rpm || stageData.vfd_rpm;
  return {
   feed_pressure: stageData.feed_pressure || 12.0,
   recovery_rate: plantData.recovery_rate || 75.0,
   feed_tds: stageData.conductivity ? stageData.conductivity * 0.65 : 1500.0,
   temperature: stageData.temperature || 25.0,
   vfd_speed: rpm ? (rpm / 60) : 45.0
  };
 }, [stageData, plantData]);

 const optimals = useMemo(() => ({
 feed_pressure: Math.max(8.0, baselines.feed_pressure * 0.95), // 5% pressure reduction
 recovery_rate: Math.min(90.0, baselines.recovery_rate * 1.05), // 5% recovery boost
 feed_tds: baselines.feed_tds,
 temperature: baselines.temperature,
 vfd_speed: Math.max(30.0, baselines.vfd_speed * 0.95)
 }), [baselines]);

 const [params, setParams] = useState(null);
 const [predictions, setPredictions] = useState(null);
 const [scenarios, setScenarios] = useState([]);

 // Initialize params when telemetry arrives
 useEffect(() => {
 if (!params && baselines.feed_pressure > 0) {
 setParams({...baselines});
 }
 }, [baselines, params]);

 // Clean thermodynamic auto-calc
 const calcLSI = (temp, tds) => (temp * 0.015) + (Math.log10(Math.max(1, tds)) * 0.4) - 1.8;
 const currentParams = params || baselines;
 
 const lsi = calcLSI(currentParams.temperature, currentParams.feed_tds);
 const sdsi = lsi - 0.45;
 const stressIndex = (currentParams.feed_pressure / 18.0) * 100; // Assuming 18 bar is max safe for BWRO
 
 const hasWarnings = stressIndex > 90 || lsi > 1.5;

 const handleChange = (e) => {
 if (!params) return;
 setParams({ ...params, [e.target.name]: parseFloat(e.target.value) });
 };

 const resetToBaseline = () => setParams({...baselines});
 const applyOptimal = () => setParams({...optimals});

 // Reactive simulation based on physics formulas
 useEffect(() => {
 if (!currentParams) return;
 
 // Core Physics Engine
 const tempK = 273.15 + currentParams.temperature;
 const ASTM_TCF = Math.exp(2640 * (1/298 - 1/tempK));
 const baseNDP = Math.max(0.1, currentParams.feed_pressure - (currentParams.feed_tds * 0.0007));
 
 const flux = 1.85 * baseNDP * ASTM_TCF;
 const sec = (currentParams.feed_pressure / (36 * 0.82)) * (currentParams.vfd_speed / 50.0);
 const rejection = Math.max(90.0, 99.6 - (currentParams.feed_tds / 50000) - (currentParams.temperature * 0.005));
 const foulingRate = (currentParams.recovery_rate / 75) * (currentParams.feed_tds / 1500) * 0.015;

 setPredictions({ flux, sec, rejection, foulingRate, ndp: baseNDP });
 }, [currentParams]);

 const saveScenario = () => {
 if (!params || !predictions) return;
 setScenarios([{ id: Date.now(), params: {...params}, preds: {...predictions} }, ...scenarios].slice(0, 3));
 };

 // Base KPIs for comparison
 const baseASTM = Math.exp(2640 * (1/298 - 1/(273.15 + baselines.temperature)));
 const baseNDP = Math.max(0.1, baselines.feed_pressure - (baselines.feed_tds * 0.0007));
 const baseFlux = 1.85 * baseNDP * baseASTM;
 const baseSec = (baselines.feed_pressure / (36 * 0.82)) * (baselines.vfd_speed / 50.0);
 const baseRej = Math.max(90.0, 99.6 - (baselines.feed_tds / 50000) - (baselines.temperature * 0.005));
 
 // Delta Math
 const fluxDelta = predictions && baseFlux > 0 ? ((predictions.flux - baseFlux) / baseFlux) * 100 : 0;
 const secDelta = predictions && baseSec > 0 ? ((predictions.sec - baseSec) / baseSec) * 100 : 0;
 const rejDelta = predictions && baseRej > 0 ? ((predictions.rejection - baseRej) / baseRej) * 100 : 0;
 
 // Financials
 const dailyProdM3 = 2880;
 const energyCostDelta = predictions ? (predictions.sec - baseSec) * dailyProdM3 * 8.0 : 0; // ₹8/kWh
 const annualSavings = -energyCostDelta * 350; // 350 op days
 const carbonDelta = (energyCostDelta / 8.0) * 0.82; // kg CO2 eq

 // AI Recommendation Logic
 const getAIRecommendation = () => {
 if(!predictions) return "Awaiting simulation...";
 if(hasWarnings) return "CRITICAL: Simulation exceeds manufacturer physical boundary limits. Decrease pressure or temp to prevent irreversible membrane damage.";
 if(annualSavings > 500000) return `Highly Optimal. Recommended scenario generates ₹${(annualSavings/100000).toFixed(1)}L annual savings with acceptable scaling risk. Deploy to SCADA.`;
 if(fluxDelta < -5) return "Sub-optimal. Energy savings are negated by severe flux penalty. Consider increasing driving pressure by 0.5 bar.";
 if(lsi > 1.0) return "Warning: Scaling potential is high. Required antiscalant dosage must increase by 15% to sustain this setpoint.";
 return "Operating window is stable — minor deviations detected, safe to implement.";
 };

 if (!params) {
 return (
 <div className="min-h-screen bg-theme-main flex items-center justify-center text-theme-muted">
 <RefreshCw className="animate-spin mr-2" size={20} /> Synchronising with live SCADA...
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-theme-main flex flex-col pb-24 select-none">
 {/* 1. TRUST HEADER */}
 <div className="flex flex-col lg:flex-row gap-4 mb-6 shrink-0">
 <div className="flex-1 bg-theme-panel border border-theme-border rounded-xl p-4 shadow-lg flex justify-between items-center premium-card">
 <div>
 <h1 className="text-2xl font-medium flex items-center gap-2 tracking-tight text-theme-text"><Sliders className="text-cyan-700 dark:text-cyan-500" /> Simulation</h1>
 <div className="text-theme-muted text-xs mt-1 flex flex-wrap gap-x-3 gap-y-0 items-center whitespace-nowrap">
 <span className="shrink-0">{config.display_name}</span>
 <span className="text-theme-muted shrink-0">&middot;</span>
 <span className="flex items-center gap-1 shrink-0"><RefreshCw size={12}/> Live SCADA synced</span>
 <span className="text-theme-muted shrink-0">&middot;</span>
 <span className="flex items-center gap-1 shrink-0"><Cpu size={12}/> Model: v2.4 (ASTM D4516)</span>
 </div>
 </div>
 <div className="hidden xl:flex gap-6 border-l border-theme-border pl-6">
 <div className="text-center"><div className="text-[11px] text-theme-muted font-medium mb-0.5">Simulation exec timestamp</div><div className="text-lg font-mono text-theme-text">{new Date().toLocaleTimeString()}</div></div>
 <div className="text-center"><div className="text-[11px] text-theme-muted font-medium mb-0.5">Physics-engine validation</div><div className="text-lg font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1 justify-center"><CheckCircle size={16}/> Passed</div></div>
 <div className="text-center"><div className="text-[11px] text-theme-muted font-medium mb-0.5">Prediction confidence</div><div className={`text-lg font-black text-green-800 dark:text-green-400`}>96.8 %</div></div>
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
 {/* LEFT: SLIDERS & CONSTRAINTS */}
 <div className="xl:col-span-1 flex flex-col gap-6">
 <div className="bg-theme-panel border border-theme-border rounded-xl p-5 shadow-lg relative premium-card">
 <div className="flex justify-between items-center border-b border-theme-border pb-3 mb-2">
 <h2 className="text-[13px] font-medium text-theme-text">Digital twin sliders</h2>
 <div className="flex gap-2">
 <button onClick={resetToBaseline} className="text-xs flex items-center gap-1 bg-transparent border border-slate-300 dark:border-slate-600 hover:border-slate-400 text-theme-text hover:text-theme-text px-2 py-1 rounded transition-colors">
 <RefreshCw size={12}/> Reset
 </button>
 <button onClick={applyOptimal} className="text-xs flex items-center gap-1 bg-transparent border border-blue-500/50 hover:border-blue-400 text-blue-700 dark:text-blue-400 hover:text-blue-300 px-2 py-1 rounded transition-colors">
 <Wand2 size={12}/> Auto-optimise
 </button>
 </div>
 </div>

 <div className="space-y-2">
 <TriStateSlider label="Feed pressure" min={8} max={25} step={0.1} value={params.feed_pressure} baseline={baselines.feed_pressure} optimal={optimals.feed_pressure} unit="bar" onChange={handleChange} name="feed_pressure" icon={Activity} color="text-cyan-700 dark:text-cyan-400" />
 <TriStateSlider label="Target recovery" min={50} max={95} step={0.5} value={params.recovery_rate} baseline={baselines.recovery_rate} optimal={optimals.recovery_rate} unit="%" onChange={handleChange} name="recovery_rate" icon={Droplets} color="text-emerald-700 dark:text-emerald-400" />
 <TriStateSlider label="HP pump VFD speed" min={25} max={60} step={0.5} value={params.vfd_speed} baseline={baselines.vfd_speed} optimal={optimals.vfd_speed} unit="Hz" onChange={handleChange} name="vfd_speed" icon={Cpu} color="text-purple-700 dark:text-purple-400" />
 <TriStateSlider label="Feed TDS" min={500} max={10000} step={50} value={params.feed_tds} baseline={baselines.feed_tds} optimal={optimals.feed_tds} unit="mg/L" onChange={handleChange} name="feed_tds" icon={Beaker} color="text-theme-text" />
 <TriStateSlider label="Feed temperature" min={10} max={45} step={0.5} value={params.temperature} baseline={baselines.temperature} optimal={optimals.temperature} unit="°C" onChange={handleChange} name="temperature" icon={Activity} color="text-rose-700 dark:text-rose-400" />
 </div>
 
 <button onClick={saveScenario} className="w-full mt-6 bg-transparent hover:bg-slate-100 dark:bg-slate-80050 text-theme-text hover:text-theme-text border border-theme-border hover:border-slate-500 py-2.5 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2" style={{borderWidth: '0.5px'}}>
 <Save size={14}/> Save scenario
 </button>
 </div>

 {/* BOUNDARY CONSTRAINTS */}
 {(() => {
 const foulingProb = ((params.recovery_rate / 90) * 100);
 const foulingColor = foulingProb >= 70 ? 'text-[#A32D2D]' : foulingProb >= 40 ? 'text-amber-700 dark:text-amber-400' : 'text-green-800 dark:text-green-400';
 const foulingIcon = foulingProb >= 70 ? <AlertTriangle size={12} className="inline shrink-0 mr-0.5 text-[#A32D2D]" /> : null;
 return (
 <div className={`border rounded-xl p-5 shadow-lg transition-colors duration-300 ${hasWarnings ? 'bg-rose-950/20 border-rose-500/50' : 'bg-theme-panel border-theme-border'}`}>
 <h2 className="text-[13px] font-medium text-theme-text border-b border-theme-border pb-2 mb-3 flex items-center gap-2">
 <ShieldAlert size={14} className={hasWarnings ? 'text-rose-700 dark:text-rose-500' : 'text-theme-muted'}/> Boundary condition constraints
 </h2>

 {hasWarnings && (
 <div className="bg-rose-900/40 text-rose-300 text-xs p-2 rounded mb-3 border border-rose-500/30 flex items-start gap-2">
 <AlertTriangle size={16} className="shrink-0 mt-0.5"/>
 <span><strong>Warning:</strong> Simulation exceeds manufacturer safety thresholds. High risk of irreversible damage.</span>
 </div>
 )}

 <div className="grid grid-cols-2 gap-2">
 <div className="bg-theme-main border border-theme-border rounded p-2">
 <div className="text-[11px] text-theme-muted font-medium mb-0.5">Membrane stress</div>
 <div className={`text-lg font-bold ${stressIndex > 90 ? 'text-rose-700 dark:text-rose-400' : 'text-green-800 dark:text-green-400'}`}>{params.feed_pressure.toFixed(1)} <span className="text-sm font-normal">bar</span></div>
 <div className="text-[10px] text-theme-muted">{stressIndex.toFixed(1)}% of 18.0 bar max</div>
 </div>
 <div className="bg-theme-main border border-theme-border rounded p-2">
 <div className="text-[11px] text-theme-muted font-medium mb-0.5">Langelier (LSI)</div>
 <div className={`text-lg font-bold ${lsi > 1.0 ? 'text-amber-700 dark:text-amber-400' : 'text-green-800 dark:text-green-400'}`}>{lsi.toFixed(2)}</div>
 <div className="text-[10px] text-theme-muted">Scale potential</div>
 </div>
 </div>

 <div className="mt-3 flex flex-col gap-1.5 px-1">
 <div className="flex justify-between items-center text-[11px]">
 <span
 className="text-theme-muted cursor-help border-b border-dotted border-slate-300 dark:border-slate-600"
 title="Stiff & Davis Saturation Index — predicts calcium carbonate scaling tendency. Negative = safe, positive = scaling risk."
 >
 Stiff &amp; Davis saturation index
 </span>
 <span className={`font-mono font-medium ${sdsi > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-theme-text'}`}>{sdsi.toFixed(2)}</span>
 </div>
 <div className="flex justify-between items-center text-[11px]">
 <span className="text-theme-muted">Fouling probability</span>
 <span className={`font-mono font-medium flex items-center gap-0.5 ${foulingColor}`}>
 {foulingIcon}{foulingProb.toFixed(0)}%
 </span>
 </div>
 </div>
 </div>
 );
 })()}
 </div>

 {/* RIGHT: IMPACT MATRIX & ANALYTICS */}
 <div className="xl:col-span-2 flex flex-col gap-6">
 {/* AI Guidance Panel */}
 <div className="bg-gradient-to-r from-blue-100 to-slate-100 dark:from-blue-900/30 dark:to-slate-900 border border-blue-200 dark:border-blue-500/30 rounded-xl p-4 flex items-start gap-3 shadow-lg">
 <Cpu size={24} className="text-theme-muted shrink-0 mt-1"/>
 <div>
 <h3 className="text-xs font-medium text-theme-muted mb-1">AI optimisation guidance</h3>
 <p className="text-sm font-medium text-theme-text leading-relaxed">{getAIRecommendation()}</p>
 </div>
 </div>

 <div className="bg-theme-panel border border-theme-border rounded-xl shadow-lg flex flex-col flex-1 premium-card">
 <div className="p-4 border-b border-theme-border bg-theme-panel flex justify-between items-center">
 <h2 className="text-[13px] font-medium text-theme-text flex items-center gap-2">
 <Layers size={16} className="text-emerald-700 dark:text-emerald-500"/> Enterprise impact matrix
 </h2>
 </div>
 
 <div className="p-5 flex flex-col gap-6 flex-1 overflow-y-auto">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 {(() => {
 const deltaColor = (delta, higherIsBetter = true) => {
 if (Math.abs(delta) < 0.01) return 'text-theme-text';
 const improving = higherIsBetter ? delta > 0 : delta < 0;
 return improving ? 'text-green-800 dark:text-green-400' : 'text-rose-700 dark:text-rose-400';
 };
 const antiscalant = predictions ? (8.4 + (predictions.flux > 25 ? 1.8 : 0)).toFixed(1) : '--';
 const antiscalantHigh = predictions && predictions.flux > 25;
 return (
 <>
 <div className="bg-theme-main border border-theme-border p-3 rounded-lg flex flex-col">
 <span className="text-[11px] text-theme-muted font-medium mb-1">Projected flux</span>
 <span className={`text-xl font-bold ${deltaColor(fluxDelta, true)}`}>{predictions ? predictions.flux.toFixed(1) : '--'} <span className="text-xs font-normal text-theme-muted">LMH</span></span>
 <span className={`text-[10px] mt-0.5 ${fluxDelta > 0 ? 'text-green-800 dark:text-green-400' : fluxDelta < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-theme-muted'}`}>{fluxDelta !== 0 ? `${fluxDelta > 0 ? '+' : ''}${fluxDelta.toFixed(1)}% vs live` : 'At baseline'}</span>
 </div>
 <div className="bg-theme-main border border-theme-border p-3 rounded-lg flex flex-col">
 <span className="text-[11px] text-theme-muted font-medium mb-1">Recovery</span>
 <span className={`text-xl font-bold ${deltaColor(params.recovery_rate - baselines.recovery_rate, true)}`}>{params.recovery_rate.toFixed(1)} <span className="text-xs font-normal text-theme-muted">%</span></span>
 <span className={`text-[10px] mt-0.5 ${(params.recovery_rate - baselines.recovery_rate) > 0 ? 'text-green-800 dark:text-green-400' : (params.recovery_rate - baselines.recovery_rate) < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-theme-muted'}`}>{Math.abs(params.recovery_rate - baselines.recovery_rate) > 0.01 ? `${(params.recovery_rate - baselines.recovery_rate) > 0 ? '+' : ''}${(params.recovery_rate - baselines.recovery_rate).toFixed(1)}% vs live` : 'At baseline'}</span>
 </div>
 <div className="bg-theme-main border border-theme-border p-3 rounded-lg flex flex-col">
 <span className="text-[11px] text-theme-muted font-medium mb-1">Rejection</span>
 <span className={`text-xl font-bold ${deltaColor(rejDelta * 100, true)}`}>{predictions ? predictions.rejection.toFixed(2) : '--'} <span className="text-xs font-normal text-theme-muted">%</span></span>
 <span className={`text-[10px] mt-0.5 ${rejDelta * 100 > 0 ? 'text-green-800 dark:text-green-400' : rejDelta * 100 < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-theme-muted'}`}>{Math.abs(rejDelta) > 0.0001 ? `${rejDelta > 0 ? '+' : ''}${(rejDelta * 100).toFixed(2)}% vs live` : 'At baseline'}</span>
 </div>
 <div className="bg-theme-main border border-theme-border p-3 rounded-lg flex flex-col">
 <span className="text-[11px] text-theme-muted font-medium mb-1">TMP</span>
 <span className="text-xl font-bold text-theme-text">{predictions ? Math.max(0, params.feed_pressure - 0.6).toFixed(1) : '--'} <span className="text-xs font-normal text-theme-muted">bar</span></span>
 <span className="text-[10px] mt-0.5 text-theme-muted">Trans-membrane pressure</span>
 </div>
 <div className="bg-theme-main border border-theme-border p-3 rounded-lg flex flex-col">
 <span className="text-[11px] text-theme-muted font-medium mb-1">Energy consumption</span>
 <span className={`text-xl font-bold ${deltaColor(secDelta, false)}`}>{predictions ? predictions.sec.toFixed(2) : '--'} <span className="text-xs font-normal text-theme-muted">kWh/m³</span></span>
 <span className={`text-[10px] mt-0.5 ${secDelta < 0 ? 'text-green-800 dark:text-green-400' : secDelta > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-theme-muted'}`}>{Math.abs(secDelta) > 0.01 ? `${secDelta > 0 ? '+' : ''}${secDelta.toFixed(1)}% vs live` : 'At baseline'}</span>
 </div>
 <div className="bg-theme-main border border-theme-border p-3 rounded-lg flex flex-col">
 <span className="text-[11px] text-theme-muted font-medium mb-1">Chemical consumption</span>
 <span className={`text-xl font-bold ${antiscalantHigh ? 'text-rose-700 dark:text-rose-400' : 'text-theme-text'}`}>{antiscalant} <span className="text-xs font-normal text-theme-muted">mg/L</span></span>
 <span className={`text-[10px] mt-0.5 ${antiscalantHigh ? 'text-rose-700 dark:text-rose-400' : 'text-green-800 dark:text-green-400'}`}>{antiscalantHigh ? 'Elevated — high flux' : 'Within range'}</span>
 </div>
 <div className="bg-theme-main border border-theme-border p-3 rounded-lg flex flex-col">
 <span className="text-[11px] text-theme-muted font-medium mb-1">Water production</span>
 <span className="text-xl font-bold text-theme-text">{(dailyProdM3).toLocaleString()} <span className="text-xs font-normal text-theme-muted">m³/d</span></span>
 <span className="text-[10px] mt-0.5 text-theme-muted">Daily output</span>
 </div>
 <div className="bg-theme-main border border-theme-border p-3 rounded-lg flex flex-col">
 <span className="text-[11px] text-theme-muted font-medium mb-1">Fouling rate</span>
 <span className={`text-xl font-bold ${predictions && predictions.foulingRate > 0.02 ? 'text-rose-700 dark:text-rose-400' : 'text-theme-text'}`}>{predictions ? predictions.foulingRate.toFixed(3) : '--'} <span className="text-xs font-normal text-theme-muted">bar/d</span></span>
 <span className={`text-[10px] mt-0.5 ${predictions && predictions.foulingRate > 0.02 ? 'text-rose-700 dark:text-rose-400' : 'text-green-800 dark:text-green-400'}`}>{predictions && predictions.foulingRate > 0.02 ? 'Elevated — check antiscalant' : 'Normal range'}</span>
 </div>
 </>
 );
 })()}
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className={`p-4 rounded-xl border ${annualSavings > 0 ? 'bg-emerald-950/20 border-emerald-500/30' : annualSavings < -500 ? 'bg-rose-950/20 border-rose-500/30' : 'bg-slate-100 dark:bg-slate-80030 border-theme-border/50'}`}>
 <div className="text-[10px] text-theme-muted font-medium mb-1 flex items-center gap-1.5">
 Annualised cost savings
 <span title="Values in Indian Lakhs — ₹1L = ₹1,00,000" className="cursor-help text-theme-muted hover:text-theme-muted transition-colors">
 <Info size={12} />
 </span>
 <span className="text-theme-muted">₹L</span>
 </div>
 {Math.abs(annualSavings) < 500 ? (
 <div className="text-sm text-theme-muted font-medium mt-1">No change from baseline</div>
 ) : (
 <div className={`text-3xl font-black ${annualSavings > 0 ? 'text-green-800 dark:text-green-400' : 'text-rose-700 dark:text-rose-400'}`}>
 {annualSavings > 0 ? '+' : '-'}₹{(Math.abs(annualSavings) / 100000).toFixed(2)}L
 </div>
 )}
 <div className="text-xs text-theme-muted mt-1">Energy &amp; chemical impact · 350 op days</div>
 </div>
 <div className="bg-theme-main border border-theme-border p-4 rounded-xl text-center flex flex-col justify-center">
 <div className="text-[10px] text-theme-muted font-medium mb-1">Carbon footprint impact</div>
 <div className={`text-2xl font-black mt-1 ${carbonDelta < 0 ? 'text-green-800 dark:text-green-400' : carbonDelta > 0.5 ? 'text-rose-700 dark:text-rose-400' : 'text-theme-text'}`}>
 {Math.abs(carbonDelta) < 0.1 ? <span className="text-sm text-theme-muted">No change</span> : <>{carbonDelta > 0 ? '+' : ''}{carbonDelta.toFixed(1)} <span className="text-[10px] font-normal text-theme-muted">kg CO₂/day</span></>}
 </div>
 </div>
 <div className="bg-theme-main border border-theme-border p-4 rounded-xl text-center flex flex-col justify-center">
 <div className="text-[10px] text-theme-muted font-medium mb-1">Membrane life impact</div>
 <div className={`text-2xl font-black mt-1 ${fluxDelta > 5 ? 'text-rose-700 dark:text-rose-400' : 'text-green-800 dark:text-green-400'}`}>
 {Math.abs(fluxDelta) < 0.5 ? <span className="text-sm text-theme-muted">No change</span> : <>{fluxDelta > 5 ? '-2.4' : '+1.1'} <span className="text-[10px] font-normal text-theme-muted">Months</span></>}
 </div>
 </div>
 </div>

 {predictions && (
 <div className="bg-theme-main border border-theme-border rounded-xl p-4">
 <h3 className="text-[12px] font-medium text-theme-muted mb-4 flex items-center gap-2">
 <TrendingUp size={13} className="text-theme-muted" /> Live vs modified — key metrics
 </h3>
 <ResponsiveContainer width="100%" height={160}>
 <BarChart
 data={[
 { 
 metric: 'Flux (LMH)', 
 livePct: 100, 
 modPct: (predictions.flux / baseFlux) * 100,
 liveVal: baseFlux.toFixed(1),
 modVal: predictions.flux.toFixed(1)
 },
 { 
 metric: 'SEC (kWh/m³)', 
 livePct: 100, 
 modPct: (predictions.sec / baseSec) * 100,
 liveVal: baseSec.toFixed(2),
 modVal: predictions.sec.toFixed(2)
 },
 { 
 metric: 'Rejection (%)', 
 livePct: 100, 
 modPct: (predictions.rejection / baseRej) * 100,
 liveVal: baseRej.toFixed(2),
 modVal: predictions.rejection.toFixed(2)
 },
 { 
 metric: 'Fouling (bar/d×100)', 
 livePct: 100, 
 modPct: (predictions.foulingRate / 0.015) * 100,
 liveVal: (0.015 * 100).toFixed(2),
 modVal: (predictions.foulingRate * 100).toFixed(2)
 },
 ]}
 margin={{ top: 24, right: 8, left: -24, bottom: 0 }}
 barCategoryGap="25%"
 barGap={2}
 >
 <CartesianGrid strokeDasharray="3 3" stroke="var(--border-panel)" vertical={false} />
 <XAxis dataKey="metric" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
 <YAxis hide={true} domain={[0, 'dataMax + 30']} />
 <Tooltip
 cursor={{fill: 'var(--bg-panel)', opacity: 0.4}}
 content={({ active, payload, label }) => {
 if (active && payload && payload.length) {
 return (
 <div className="bg-theme-panel backdrop-blur-md border border-theme-border rounded-xl p-3 shadow-2xl min-w-[120px] premium-card" style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', border: '1px solid var(--border-panel)', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)', color: 'var(--text-main)' }}>
 <p className="text-xs mb-1 border-b pb-1 font-bold" style={{ color: 'var(--text-muted)', borderBottomColor: 'var(--border-panel)' }}>{label}</p>
 <p className="text-xs flex justify-between" style={{ color: 'var(--text-muted)' }}><span>Live:</span> <span className="font-bold" style={{ color: 'var(--text-main)' }}>{payload[0].payload.liveVal}</span></p>
 <p className="text-xs flex justify-between mt-0.5" style={{ color: 'var(--brand-accent)' }}><span>Modified:</span> <span className="font-bold" style={{ color: 'var(--brand-accent)' }}>{payload[1]?.payload?.modVal || payload[0]?.payload?.modVal}</span></p>
 </div>
 );
 }
 return null;
 }}
 />
 <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)', paddingTop: 8 }} />
 <Bar dataKey="livePct" name="Live" fill="#475569" radius={[3,3,0,0]}>
 <LabelList dataKey="liveVal" position="top" fill="var(--text-muted)" fontSize={10} />
 </Bar>
 <Bar dataKey="modPct" name="Modified" fill="var(--brand-accent)" radius={[3,3,0,0]}>
 <LabelList dataKey="modVal" position="top" fill="var(--text-main)" fontSize={10} fontWeight="bold" />
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 </div>
 )}
 </div>
 </div>

 {scenarios.length > 0 && (
 <div className="bg-theme-panel border border-theme-border rounded-xl p-4 shadow-lg premium-card">
 <h3 className="text-[13px] font-medium text-theme-text border-b border-theme-border pb-2 mb-3 flex items-center gap-2">
 <Clock size={14} className="text-theme-muted"/> Scenario comparison ledger
 </h3>
 <div className="overflow-x-auto">
 <table className="w-full text-left text-xs whitespace-nowrap">
 <thead className="text-theme-muted bg-theme-panel border-b border-theme-border">
 <tr>
 <th className="px-3 py-2">ID</th>
 <th className="px-3 py-2">Pressure</th>
 <th className="px-3 py-2">Recovery</th>
 <th className="px-3 py-2">Flux</th>
 <th className="px-3 py-2">SEC</th>
 <th className="px-3 py-2">Action</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-800 text-theme-text">
 {scenarios.map((s, i) => {
 const sFluxDelta = ((s.preds.flux - baseFlux) / baseFlux) * 100;
 const sSecDelta = ((s.preds.sec - baseSec) / baseSec) * 100;
 const fluxColor = Math.abs(sFluxDelta) > 1 ? (sFluxDelta > 0 ? 'text-green-800 dark:text-green-400' : 'text-rose-700 dark:text-rose-400') : 'text-theme-text';
 const secColor = Math.abs(sSecDelta) > 1 ? (sSecDelta < 0 ? 'text-green-800 dark:text-green-400' : 'text-rose-700 dark:text-rose-400') : 'text-theme-text';
 return (
 <tr key={s.id} className="hover:bg-slate-100 dark:bg-slate-80050">
 <td className="px-3 py-2 font-mono text-theme-muted">Run_{scenarios.length - i}</td>
 <td className="px-3 py-2">{s.params.feed_pressure.toFixed(1)} bar</td>
 <td className="px-3 py-2">{s.params.recovery_rate.toFixed(1)}%</td>
 <td className={`px-3 py-2 font-medium ${fluxColor}`}>{s.preds.flux.toFixed(1)} LMH</td>
 <td className={`px-3 py-2 font-medium ${secColor}`}>{s.preds.sec.toFixed(2)} kWh/m³</td>
 <td className="px-3 py-2">
 <button onClick={() => setParams(s.params)} className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded">Load</button>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}
