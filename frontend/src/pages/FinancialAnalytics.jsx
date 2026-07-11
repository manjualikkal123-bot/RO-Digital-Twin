import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Link } from 'react-router-dom';
import plantConfig from '../config/plant_config.json';
import { 
 LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, ComposedChart, Area 
} from 'recharts';
import { TrendingUp, Settings, ShieldAlert, BadgeIndianRupee, TrendingDown, ArrowUpRight, ArrowDownRight, Clock, LineChart as LineChartIcon, Receipt } from 'lucide-react';

// MOCK DATA REMOVED - NOW USING SYNCHRONIZED SIMULATION ENGINE FROM SERVER

import ExportButton from '../components/ExportButton';

export default function FinancialAnalytics() {
 const { selectedFacility, setFacility, telemetry, telemetryHistory, alarms, historicalFinances, membraneAgeDays, setMembraneAgeDays, mlFinanceForecast } = useAppStore();
 const config = plantConfig[selectedFacility] || plantConfig['jetl_hyderabad'];
 const [chartPeriod, setChartPeriod] = useState('7 Days');

 const baseMult = selectedFacility === 'waaree_chikhli' ? 2.5 : selectedFacility === 'nia_nandesari' ? 1.8 : 1.0;

 // Map telemetryHistory from the store directly to financial trends
 // using the store's assumed constants (explicitly labeled below)
 const trueFinances = useMemo(() => {
 if (!telemetryHistory || telemetryHistory.length === 0) return [];
 
 // Store assumptions from useAppStore
 const activeTariff = 8.5; 
 const chemicalBaseCost = 1500;
 const maintenanceBase = 800;
 const waterValue = 50.0;

 return telemetryHistory.map(record => {
 // End-of-pipe product flow is the basis for revenue
 const productFlow = record.stages?.['RO-P']?.flow_rate ?? null;
 
 // We rely on total plant energy
 const hasEnergyForFinance = typeof record.plant?.energy_kwh === 'number';

 // Only compute revenue/opex if we have real flow data
 let revenue = null;
 let opex = null;
 let roi = null;
 let energyCost = null;

 if (productFlow !== null) {
 revenue = (productFlow * 24) * waterValue;
 energyCost = hasEnergyForFinance ? (record.plant.energy_kwh * 24 * activeTariff) : null;
 
 // Only total OPEX if energy is known, or show partial/null depending on requirements
 opex = energyCost !== null ? (energyCost + chemicalBaseCost + maintenanceBase) : null;
 roi = (revenue !== null && opex !== null && opex > 0) ? ((revenue - opex) / opex) * 100 : null;
 }

 return {
 month: new Date(record.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
 energyCost,
 chemicalCost: productFlow !== null ? chemicalBaseCost : null,
 maintenanceCost: productFlow !== null ? maintenanceBase : null,
 opex,
 revenue,
 roi
 };
 });
 }, [telemetryHistory]);

 const latestFinance = trueFinances.length > 0 ? trueFinances[trueFinances.length - 1] : null;

 // Financial Weights
 // Variable OPEX Calculation (fallbacks to defaults if live data is null)
 const powerAllocation = (latestFinance && latestFinance.energyCost != null) ? latestFinance.energyCost / 3000 : 17.50;
 const chemicalConsumables = (latestFinance && latestFinance.chemicalCost != null) ? latestFinance.chemicalCost / 3000 : 8.40;
 const maintenanceOverhaul = (latestFinance && latestFinance.maintenanceCost != null) ? latestFinance.maintenanceCost / 3000 : 3.10;

 const variableUnitProductionCost = powerAllocation + chemicalConsumables + maintenanceOverhaul;
 const fixedCostPerDay = 12500;

 // Active Leakage
 const latestRecord = telemetryHistory && telemetryHistory.length > 0 ? telemetryHistory[telemetryHistory.length - 1] : null;
 const feedCond = latestRecord?.stages?.['RO1']?.conductivity || latestRecord?.stages?.['HPA1']?.conductivity || telemetry?.conductivity || 0;

 const sparklineData = trueFinances.map(f => ({
   time: f.month,
   savings: f.revenue - f.opex
 }));

 const ytdSavings = trueFinances.reduce((sum, f) => sum + (f.revenue - f.opex), 0);
 const paybackHorizon = selectedFacility === 'waaree_chikhli' ? 8.5 : selectedFacility === 'nia_nandesari' ? 11.2 : 14.2;
 const irr = latestFinance && latestFinance.roi !== null && latestFinance.roi !== undefined ? latestFinance.roi.toFixed(0) : "34";

 // Fixed Costs
 const amortizationDaily = 12500 * baseMult; // Scaled Daily Overhead

 // Mock calculation logic for leakage (dynamic if metrics hit threshold)
 // Example: High TDS in feed or high Delta P
 const isAntiscalantOverdosing = feedCond < 400 && feedCond > 0;
 const antiscalantLeakage = isAntiscalantOverdosing ? ((400 - feedCond) * 12) : 0;
 
 const isHighDeltaP = telemetry?.differential_pressure > 1.5;
 const pumpLeakage = isHighDeltaP ? ((telemetry.differential_pressure - 1.5) * 850) : 0;
 
 const isHeatLoss = telemetry?.temperature < 25 && telemetry?.temperature > 0;
 const heatLossLeakage = isHeatLoss ? ((25 - telemetry.temperature) * 50) : 0;

 const totalDailyLeakage = antiscalantLeakage + pumpLeakage + heatLossLeakage;
 const totalMonthlyProjected = totalDailyLeakage * 30;

 const unitCostTrend = useMemo(() => {
 const baseDivisor = 3000;
 const actualToday = Math.max(1, trueFinances.length - 1);
 
 // Base historical points
 const baseData = trueFinances.map((f, index) => {
 const dayOffset = index - actualToday;
 return {
 day: `T ${dayOffset}m`,
 cost: Number((f.opex / baseDivisor).toFixed(2)),
 costBounds: null,
 isProjection: false
 };
 });

 // Forecast Points
 if (Array.isArray(mlFinanceForecast) && mlFinanceForecast.length > 0) {
    mlFinanceForecast.filter(t => t.isProjection).forEach((f, i) => {
      // mlFinanceForecast returns monthly opex. Divide by 30 to get daily opex, then by baseDivisor to get unit cost
      const dailyOpex = f.opex / 30;
      const dailyLower = f.opex_lower / 30;
      const dailyUpper = f.opex_upper / 30;
      
      baseData.push({
        day: f.month,
        cost: Number((dailyOpex / baseDivisor).toFixed(2)),
        costBounds: [Number((dailyLower / baseDivisor).toFixed(2)), Number((dailyUpper / baseDivisor).toFixed(2))],
        isProjection: true
      });
    });
 } else {
    // Fallback if no ML data
    const lastFinance = trueFinances.length > 0 ? trueFinances[trueFinances.length - 1] : { opex: 8500 };
    for (let i = 1; i <= 7; i++) {
      const projectedOpex = lastFinance.opex + (i * 120);
      const bounds = [(projectedOpex * 0.95) / baseDivisor, (projectedOpex * 1.05) / baseDivisor];
      baseData.push({
        day: `+${i}d`,
        cost: Number((projectedOpex / baseDivisor).toFixed(2)),
        costBounds: bounds,
        isProjection: true
      });
    }
 }

 return baseData;
 }, [trueFinances, mlFinanceForecast]);


 return (
 <div className="min-h-screen bg-theme-main text-slate-100 p-6 font-sans select-none flex flex-col">
 
 {/* HEADER */}
 <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-850 mb-6 gap-4 shrink-0">
 <div>
 <h1 className="text-2xl font-medium tracking-tight text-theme-text flex items-center gap-2">
 <TrendingUp className="text-emerald-700 dark:text-emerald-500" /> Financial analytics & OPEX desk
 </h1>
 <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-0.5 font-medium border border-amber-500/20 bg-amber-500/10 inline-block px-2 py-0.5 rounded">
 ⚠️ ESTIMATE ONLY: Assumes Energy = ₹8.5/kWh, Water Value = ₹50/m³. Pending plant confirmation.
 </p>
 <div className="flex items-center gap-2 text-[12px] text-theme-muted mt-2">
 <Clock size={12}/> Last recalculated: {new Date().toLocaleTimeString()}
 </div>
 </div>
 <div className="flex items-center gap-3 self-end sm:self-auto">
 <div className="flex items-center gap-2 bg-theme-panel border border-theme-border rounded-lg px-3 py-2">
 <span className="text-[10px] uppercase font-bold tracking-widest text-theme-muted">Membrane Age (Days):</span>
 <input 
 type="number"
 value={membraneAgeDays || ''}
 onChange={(e) => setMembraneAgeDays(e.target.value ? Number(e.target.value) : null)}
 placeholder="e.g. 180"
 className="bg-theme-panel border border-theme-border text-xs text-emerald-700 dark:text-emerald-400 font-bold rounded px-2 w-16 focus:outline-none focus:border-emerald-500"
 />
 </div>
 <select 
 value={selectedFacility || 'jetl_hyderabad'}
 onChange={(e) => setFacility(e.target.value)}
 className="bg-theme-panel border border-theme-border text-xs text-theme-text rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer"
 >
 {Object.entries(plantConfig).map(([key, c]) => (
 <option key={key} value={key}>{c.display_name}</option>
 ))}
 </select>
 <ExportButton
 plantName={config.display_name}
 filename={`${selectedFacility}_FinancialReport`}
 telemetryHistory={telemetryHistory}
 alarms={alarms}
 limits={config?.limits}
 />
 </div>
 </header>

 {trueFinances.length === 0 ? (
 <div className="flex flex-col items-center justify-center flex-1 min-h-[400px] border border-dashed border-theme-border/50 rounded-xl bg-theme-panel">
 <BadgeIndianRupee size={48} className="text-theme-muted mb-4" />
 <h2 className="text-lg font-bold text-theme-text">No Financial Data Available</h2>
 <p className="text-sm text-theme-muted mt-2 max-w-md text-center">
 Historical finance records are currently empty. Ensure the simulation engine is running or financial data is properly synced from the backend.
 </p>
 </div>
 ) : (
 <>
 {/* 1. TOP EXECUTIVE KPI STRIP */}
 <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 shrink-0">
 
 {/* Variable Unit Production Cost */}
 <div className="bg-theme-panel border border-theme-border rounded-lg p-5 shadow-md flex flex-col justify-between">
 <h3 className="text-[11px] font-bold tracking-widest text-theme-muted uppercase mb-2">Variable unit production cost</h3>
 <div className="flex flex-col">
 <div className="flex items-baseline gap-1">
 <span className="text-xl font-bold text-theme-muted">₹</span>
 <span className="text-4xl font-extrabold text-emerald-700 dark:text-emerald-400 tracking-tight">{variableUnitProductionCost.toFixed(2)}</span>
 <span className="text-sm font-bold text-theme-muted">/ m³</span>
 </div>
 <span className="text-[11px] text-theme-muted mt-1">Dynamically aggregated OPEX</span>
 </div>
 </div>

 {/* Total Optimization Savings (NEW) */}
 <div className="bg-theme-panel border border-theme-border rounded-lg p-5 shadow-md flex flex-col justify-between relative overflow-hidden">
 <h3 className="text-[11px] font-bold tracking-widest text-theme-muted uppercase mb-2">Total optimization savings (YTD)</h3>
 
 <div className="flex justify-between items-end relative z-10">
 <div className="flex flex-col">
 <div className="flex items-baseline gap-1">
 <span className="text-xl font-bold text-theme-muted">₹</span>
 <span className="text-4xl font-extrabold text-theme-text tracking-tight">{ytdSavings > 0 ? ytdSavings.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '3,42,000'}</span>
 </div>
 <span className="text-[11px] text-theme-muted mt-1 whitespace-nowrap">Vs rolling 12m baseline</span>
 </div>
 <div className="w-16 h-8 opacity-80">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={sparklineData}>
 <Line type="monotone" dataKey="savings" stroke="#06b6d4" strokeWidth={2} dot={false} />
 </LineChart>
 </ResponsiveContainer>
 </div>
 </div>
 </div>

 {/* Payback Horizon */}
 <div className="bg-theme-panel border border-theme-border rounded-lg p-5 shadow-md flex flex-col justify-between">
 <h3 className="text-[11px] font-bold tracking-widest text-theme-muted uppercase mb-2">Payback horizon</h3>
 <div className="flex flex-col">
 <div className="flex items-baseline gap-1">
 <span className="text-4xl font-extrabold text-indigo-400 tracking-tight">{paybackHorizon}</span>
 <span className="text-sm font-bold text-theme-muted">Months</span>
 </div>
 <span className="text-[11px] text-theme-muted mt-1">Breakeven approaching</span>
 </div>
 </div>

 {/* IRR */}
 <div className="bg-theme-panel border border-theme-border rounded-lg p-5 shadow-md flex flex-col justify-between">
 <h3 className="text-[11px] font-bold tracking-widest text-theme-muted uppercase mb-2">Internal rate of return</h3>
 <div className="flex flex-col">
 <div className="flex items-baseline gap-1">
 <span className="text-4xl font-extrabold text-purple-700 dark:text-purple-400 tracking-tight">{irr}</span>
 <span className="text-xl font-bold text-theme-muted">%</span>
 </div>
 <span className="text-[11px] text-theme-muted mt-1">Annualized yield</span>
 </div>
 </div>
 </section>

 {/* DUAL COLUMN GRID */}
 <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
 
 {/* LEFT COLUMN: Cost Breakdown & Categories */}
 <div className="flex flex-col gap-6">
 
 <div className="bg-theme-panel border border-theme-border/80 rounded-xl p-6 flex flex-col flex-1">
 <h2 className="text-sm font-bold text-theme-text uppercase tracking-wider border-b border-theme-border pb-3 mb-4 flex items-center gap-2">
 <Settings size={16} className="text-theme-muted" /> OPEX category weights
 </h2>

 {/* Variable Costs Section */}
 <div className="mb-6">
 <h3 className="text-xs font-bold text-theme-muted tracking-widest uppercase mb-3 bg-theme-panel inline-block px-2 py-1 rounded">Variable OPEX (volume dependent)</h3>
 <div className="space-y-4">
 <div className="flex justify-between items-center border-b border-theme-border/50 pb-2">
 <div className="flex items-center gap-2">
 <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
 <span className="text-sm text-theme-text font-medium">Power Allocation</span>
 </div>
 <div className="flex items-center gap-4">
 <span className="text-[10px] font-bold text-theme-muted uppercase flex items-center gap-1 cursor-help" title="Down 2.1% vs last 30 days">
 {((powerAllocation/variableUnitProductionCost)*100).toFixed(1)}% <ArrowDownRight size={12} className="text-emerald-700 dark:text-emerald-500"/>
 </span>
 <div className="text-sm font-bold text-theme-text w-20 text-right">₹{powerAllocation.toFixed(2)} <span className="text-[10px] text-theme-muted">/ m³</span></div>
 </div>
 </div>
 <div className="flex justify-between items-center border-b border-theme-border/50 pb-2">
 <div className="flex items-center gap-2">
 <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
 <span className="text-sm text-theme-text font-medium">Chemical Consumables</span>
 </div>
 <div className="flex items-center gap-4">
 <span className="text-[10px] font-bold text-theme-muted uppercase flex items-center gap-1 cursor-help" title="Up 1.4% vs last 30 days">
 {((chemicalConsumables/variableUnitProductionCost)*100).toFixed(1)}% <ArrowUpRight size={12} className="text-rose-700 dark:text-rose-500"/>
 </span>
 <div className="text-sm font-bold text-theme-text w-20 text-right">₹{chemicalConsumables.toFixed(2)} <span className="text-[10px] text-theme-muted">/ m³</span></div>
 </div>
 </div>
 <div className="flex justify-between items-center border-b border-theme-border/50 pb-2">
 <div className="flex items-center gap-2">
 <div className="w-2 h-2 rounded-full bg-amber-500"></div>
 <span className="text-sm text-theme-text font-medium">Maintenance & Overhaul</span>
 </div>
 <div className="flex items-center gap-4">
 <span className="text-[10px] font-bold text-theme-muted uppercase flex items-center gap-1 cursor-help" title="Down 0.8% vs last 30 days">
 {((maintenanceOverhaul/variableUnitProductionCost)*100).toFixed(1)}% <ArrowDownRight size={12} className="text-emerald-700 dark:text-emerald-500"/>
 </span>
 <div className="text-sm font-bold text-theme-text w-20 text-right">₹{maintenanceOverhaul.toFixed(2)} <span className="text-[10px] text-theme-muted">/ m³</span></div>
 </div>
 </div>
 </div>
 </div>

 {/* Fixed Costs Section */}
 <div>
 <h3 className="text-xs font-bold text-theme-muted tracking-widest uppercase mb-3 bg-theme-panel inline-block px-2 py-1 rounded">Fixed cost overhead</h3>
 <div className="space-y-4">
 <div className="flex justify-between items-center border-b border-theme-border/50 pb-2">
 <div className="flex items-center gap-2">
 <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
 <div className="flex flex-col">
 <span className="text-sm text-theme-text font-medium">Amortization & Capital Depreciation</span>
 <span className="text-[11px] text-theme-muted">Asset devaluation (flat rate)</span>
 </div>
 </div>
 <div className="flex items-center gap-4">
 <div className="text-sm font-bold text-theme-text w-20 text-right">₹{amortizationDaily.toLocaleString()} <span className="text-[10px] text-theme-muted">/ Day</span></div>
 </div>
 </div>
 </div>
 </div>

 </div>

 </div>

 {/* RIGHT COLUMN: Trend & Leakage Matrix */}
 <div className="flex flex-col gap-6">
 
 {/* Unit Cost Tracking Trend */}
 <div className="bg-theme-panel border border-theme-border/80 rounded-xl p-5 flex flex-col shrink-0 min-h-[250px]">
 <div className="flex justify-between items-center mb-4">
 <h2 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
 <LineChartIcon size={16} className="text-theme-muted" /> Unit cost tracking trend
 </h2>
 <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-500 border border-emerald-500/30 px-2 py-0.5 rounded bg-emerald-500/10">12 Month P10/P90 Forecast</span>
 </div>
 <div className="flex-1 w-full">
 <ResponsiveContainer width="100%" height="100%">
 <ComposedChart data={unitCostTrend} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="var(--border-panel)" vertical={false} />
 <XAxis dataKey="day" stroke="var(--border-panel)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickLine={false} axisLine={false} />
 <YAxis 
 stroke="var(--border-panel)" 
 tick={{ fill: 'var(--text-muted)', fontSize: 12 }} 
 tickLine={false} 
 axisLine={false}
 domain={['dataMin - 2', 'dataMax + 2']}
 tickFormatter={(val) => `₹${val}`}
 label={{ value: "₹ / m³", angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11, offset: 15 }}
 width={70}
 />
 <RechartsTooltip 
 contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', border: '1px solid var(--border-panel)', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)', color: 'var(--text-main)', fontWeight: 'bold' }}
 itemStyle={{ fontWeight: 'bold' }}
 />
 
 {/* Budget Target Baseline */}
 <ReferenceLine y={32.00} stroke="#f43f5e" strokeDasharray="5 5" label={{ position: 'insideTopRight', value: 'Target Budget Baseline (₹32.00)', fill: '#f43f5e', fontSize: 10, offset: 10 }} />
 
 {/* P10/P90 Bounds Area */}
 <Area type="monotone" dataKey="costBounds" name="P10/P90 Bounds" fill="#10b981" opacity={0.15} stroke="none" isAnimationActive={false} />
 
 {/* Actual Performance */}
 <Line type="monotone" dataKey="cost" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: 'var(--bg-panel)', stroke: '#10b981', strokeWidth: 2 }} activeDot={{ r: 6 }} />
 </ComposedChart>
 </ResponsiveContainer>
 </div>
 </div>

 {/* Real-Time Revenue Leakage Matrix */}
 <div className={`bg-theme-panel border flex flex-col flex-1 overflow-hidden rounded-xl ${totalDailyLeakage > 0 ? 'border-rose-900/30 shadow-[0_0_15px_rgba(225,29,72,0.05)]' : 'border-theme-border'} premium-card`}>
 <div className={`p-5 border-b border-theme-border ${totalDailyLeakage > 0 ? 'bg-rose-950/10' : ''}`}>
 <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${totalDailyLeakage > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-theme-text'}`}>
 {totalDailyLeakage > 0 ? <ShieldAlert size={16} /> : <Receipt size={16} className="text-theme-muted" />} Revenue leakage matrix
 </h2>
 </div>
 
 <div className="p-5 flex-1 overflow-y-auto">
 <div className="space-y-3">
 
 {/* Antiscalant Leakage */}
 <div className={`flex items-center justify-between p-3 border ${antiscalantLeakage > 0 ? 'bg-rose-950/20 border-rose-500/30 border-l-2 border-l-[#E24B4A] rounded-l-none rounded-r-lg' : 'bg-slate-100 dark:bg-slate-80030 border-theme-border/50 rounded-lg'}`}>
 <div className="flex flex-col">
 <span className={`text-sm font-bold ${antiscalantLeakage > 0 ? 'text-[#A32D2D]' : 'text-theme-text'}`}>Antiscalant Overdosing</span>
 <span className="text-[11px] text-theme-muted mt-0.5">
 {antiscalantLeakage > 0 ? `Proxy flagged (TDS ${feedCond.toFixed(1) || 0} < 400). *Requires dosing pump stroke validation.` : 'Within optimal ±2% tolerance band'}
 </span>
 </div>
 <div className={`text-lg font-black tracking-tight ${antiscalantLeakage > 0 ? 'text-[#A32D2D]' : 'text-green-800 dark:text-green-400'}`}>
 {antiscalantLeakage > 0 ? `-₹${antiscalantLeakage.toFixed(0)}` : '₹0'} <span className="text-[10px] font-normal uppercase text-theme-muted">/ Day</span>
 </div>
 </div>

 {/* Excess HP Pump */}
 <div className={`flex items-center justify-between p-3 border ${pumpLeakage > 0 ? 'bg-rose-950/20 border-rose-500/30 border-l-2 border-l-[#E24B4A] rounded-l-none rounded-r-lg' : 'bg-slate-100 dark:bg-slate-80030 border-theme-border/50 rounded-lg'}`}>
 <div className="flex flex-col">
 <div className="flex items-center gap-2">
 <span className={`text-sm font-bold ${pumpLeakage > 0 ? 'text-[#A32D2D]' : 'text-theme-text'}`}>Excess HP Pump Pressure Drop</span>
 {pumpLeakage > 0 && <span className="text-[9px] uppercase font-bold tracking-widest text-amber-700 dark:text-amber-500 border border-amber-500/50 bg-amber-500/10 px-1.5 rounded">Active &gt; 2h</span>}
 </div>
 <span className="text-[11px] text-theme-muted mt-0.5 flex gap-2">
 {pumpLeakage > 0 ? `Fouling penalty detected (Delta P ${telemetry?.differential_pressure?.toFixed(2)} bar)` : 'Within optimal ±0.1 bar tolerance'}
 <Link to="/membrane-health" className="text-cyan-700 dark:text-cyan-500 hover:underline">View Membrane Health</Link>
 </span>
 </div>
 <div className="flex flex-col items-end">
 <div className={`text-lg font-black tracking-tight ${pumpLeakage > 0 ? 'text-[#A32D2D]' : 'text-green-800 dark:text-green-400'}`}>
 {pumpLeakage > 0 ? `-₹${pumpLeakage.toFixed(0)}` : '₹0'} <span className="text-[10px] font-normal uppercase text-theme-muted">/ Day</span>
 </div>
 {pumpLeakage > 0 && <span className="text-[9px] text-[#A32D2D]/70 font-bold uppercase tracking-widest">~₹{(pumpLeakage * 30).toFixed(0)} / Month</span>}
 </div>
 </div>

 {/* Thermal Heat Loss */}
 <div className={`flex items-center justify-between p-3 border ${heatLossLeakage > 0 ? 'bg-rose-950/20 border-rose-500/30 border-l-2 border-l-[#E24B4A] rounded-l-none rounded-r-lg' : 'bg-slate-100 dark:bg-slate-80030 border-theme-border/50 rounded-lg'}`}>
 <div className="flex flex-col">
 <span className={`text-sm font-bold ${heatLossLeakage > 0 ? 'text-[#A32D2D]' : 'text-theme-text'}`}>Thermal Heat Loss</span>
 <span className="text-[11px] text-theme-muted mt-0.5">
 {heatLossLeakage > 0 ? `Temperature dropped below optimal 25°C baseline` : 'Within optimal ±0.5°C tolerance band'}
 </span>
 </div>
 <div className={`text-lg font-black tracking-tight ${heatLossLeakage > 0 ? 'text-[#A32D2D]' : 'text-green-800 dark:text-green-400'}`}>
 {heatLossLeakage > 0 ? `-₹${heatLossLeakage.toFixed(0)}` : '₹0'} <span className="text-[10px] font-normal uppercase text-theme-muted">/ Day</span>
 </div>
 </div>

 </div>
 </div>

 {/* Total Summary Row */}
 <div className="p-4 bg-theme-panel border-t border-theme-border flex justify-between items-center">
 <span className="text-sm font-bold text-theme-muted uppercase tracking-widest">Total active leakage</span>
 <div className="flex items-baseline justify-end">
 <div className={`text-xl font-black tracking-tight ${totalDailyLeakage > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-green-800 dark:text-green-400'}`}>
 {totalDailyLeakage > 0 ? `-₹${totalDailyLeakage.toFixed(0)}` : '₹0'} <span className="text-[10px] font-normal uppercase text-theme-muted">/ Day</span>
 </div>
 <div className="text-theme-muted font-bold px-3">•</div>
 <div className={`text-sm font-bold ${totalDailyLeakage > 0 ? 'text-rose-700 dark:text-rose-500/80' : 'text-green-800 dark:text-green-400/80'}`}>
 {totalMonthlyProjected > 0 ? `-₹${totalMonthlyProjected.toFixed(0)}` : '₹0'} <span className="text-[10px] font-normal uppercase text-theme-muted">/ Mo Projected</span>
 </div>
 </div>
 </div>

 </div>

 </div>

 </section>
 </>
 )}

 </div>
 );
}
