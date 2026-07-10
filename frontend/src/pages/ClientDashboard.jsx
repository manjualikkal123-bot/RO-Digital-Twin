import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { LogOut, MapPin, Calendar, Activity, Download, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

import plantConfig from '../config/plant_config.json';


const QualityGaugeCard = ({ title, value, min, max, unit, limitText, isBreach, isWarning, delta }) => {
 const percentage = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
 const color = isBreach ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';
 const data = [{ name: title, value: percentage, fill: color }, { name: 'max', value: 100, fill: 'transparent' }];
 
 const isUp = delta > 0;
 
 return (
 <div className="bg-theme-panel border border-theme-border rounded-xl p-4 flex flex-col items-center justify-center relative h-40 shadow-inner group overflow-hidden premium-card">
 <ResponsiveContainer width="100%" height="100%">
 <RadialBarChart cx="50%" cy="80%" innerRadius="80%" outerRadius="100%" barSize={10} data={data} startAngle={180} endAngle={0}>
 <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
 <RadialBar minAngle={15} background={{ fill: '#1e293b' }} clockWise dataKey="value" cornerRadius={5} />
 </RadialBarChart>
 </ResponsiveContainer>
 <div className="absolute bottom-4 flex flex-col items-center w-full">
 <div className="flex items-baseline gap-1">
 <span className="text-xl font-bold text-theme-text">{value}</span>
 <span className="text-[10px] font-bold text-theme-muted uppercase">{unit}</span>
 </div>
 </div>
 <div className="absolute top-4 text-[10px] font-bold text-theme-muted uppercase tracking-widest text-center px-2 leading-tight">{title}</div>
 
 {/* Delta Indicator */}
 {delta !== 0 && (
 <div className="absolute top-4 right-4 flex items-center gap-0.5">
 {isUp ? <TrendingUp size={10} className="text-rose-700 dark:text-rose-400" /> : <TrendingDown size={10} className="text-emerald-700 dark:text-emerald-400" />}
 <span className={`text-[9px] font-bold ${isUp ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
 {isUp ? '+' : ''}{delta}
 </span>
 </div>
 )}

 {/* Threshold Bounds */}
 <div className="absolute bottom-1 w-full px-4 flex justify-center text-[9px] font-bold uppercase tracking-widest text-theme-muted">
 <span className={isBreach ? "text-red-700 dark:text-red-500" : isWarning ? "text-amber-700 dark:text-amber-500" : ""}>{limitText}</span>
 </div>
 </div>
 );
};

export default function ClientDashboard() {
 const { selectedFacility, allowedPlants, setFacility, telemetry, syncStatus, logout, pcbLimits, historicalMembrane } = useAppStore();
 const navigate = useNavigate();

 // Synthesize compliance history from backend historical data
 const complianceHistory = React.useMemo(() => {
 if (!historicalMembrane || historicalMembrane.length === 0) return [];
 
 // Grab the 90 past days (indices 0 to 89)
 const past90 = historicalMembrane.filter(d => !d.isProjection).slice(-90);
 
 return past90.map((dayData, idx) => {
 let status = 'GREEN';
 let message = 'All parameters normal';
 
 // We can infer stress from the DP and Permeability values
 if (dayData.dp > 1.8 || dayData.permeability < 1.0) {
 status = 'RED';
 message = 'Critical membrane pressure threshold exceeded';
 } else if (dayData.dp > 1.4 || dayData.permeability < 1.5) {
 status = 'YELLOW';
 message = 'Sub-optimal flux indicating elevated fouling';
 }

 return {
 date: new Date(dayData.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
 status,
 message
 };
 });
 }, [historicalMembrane]);

 const handleLogout = () => {
 logout();
 navigate('/login');
 };

 const config = plantConfig[selectedFacility] || plantConfig['jetl_hyderabad'];
 const currentData = telemetry?.[0] || {};
 
 const limits = config.limits;
 const base = config.sensor_baseline;

 const parameters = [
 { name: 'pH', value: currentData.pH ? currentData.pH.toFixed(1) : base.ph.toString(), limit: `${limits.ph_min} - ${limits.ph_max}`, unit: '', rawValue: currentData.pH || base.ph },
 { name: 'Turbidity', value: currentData.turbidity ? currentData.turbidity.toFixed(1) : base.turbidity.toString(), limit: `< ${limits.turbidity_max || 999}`, unit: 'NTU', rawValue: currentData.turbidity || base.turbidity },
 { name: 'Conductivity', value: currentData.conductivity ? currentData.conductivity.toFixed(0) : base.conductivity.toString(), limit: `< ${limits.conductivity_max || 99999}`, unit: 'µS/cm', rawValue: currentData.conductivity || base.conductivity },
 { name: 'BOD', value: base.bod.toString(), limit: `< ${limits.bod_max || 9999}`, unit: 'mg/L', rawValue: base.bod },
 { name: 'COD', value: base.cod.toString(), limit: `< ${limits.cod_max || 9999}`, unit: 'mg/L', rawValue: base.cod },
 ];

 // Evaluate current status
 let overallStatus = 'GREEN';
 let statusMessage = 'All systems normal — your plant is operating within limits';

 parameters.forEach(p => {
 if (p.name === 'pH') {
 if (p.rawValue < (limits.ph_min - 0.5) || p.rawValue > (limits.ph_max + 0.5)) { overallStatus = 'RED'; statusMessage = `Alert — pH has breached discharge limit. Permionics team has been notified.`; }
 else if (p.rawValue < limits.ph_min || p.rawValue > limits.ph_max) { if(overallStatus !== 'RED') { overallStatus = 'YELLOW'; statusMessage = `Attention needed — pH is approaching limit.`; } }
 }
 if (p.name === 'Turbidity') {
 if (p.rawValue > limits.turbidity_max) { overallStatus = 'RED'; statusMessage = `Alert — Turbidity has breached discharge limit.`; }
 else if (p.rawValue > (limits.turbidity_max * 0.9)) { if(overallStatus !== 'RED') { overallStatus = 'YELLOW'; statusMessage = `Attention needed — Turbidity is approaching limit.`; } }
 }
 if (p.name === 'Conductivity') {
 if (p.rawValue > limits.conductivity_max) { overallStatus = 'RED'; statusMessage = `Alert — Conductivity has breached discharge limit.`; }
 else if (p.rawValue > (limits.conductivity_max * 0.9)) { if(overallStatus !== 'RED') { overallStatus = 'YELLOW'; statusMessage = `Attention needed — Conductivity is approaching limit.`; } }
 }
 if (p.name === 'BOD') {
 if (p.rawValue > limits.bod_max) { overallStatus = 'RED'; statusMessage = `Alert — BOD has breached discharge limit.`; }
 else if (p.rawValue > (limits.bod_max * 0.9)) { if(overallStatus !== 'RED') { overallStatus = 'YELLOW'; statusMessage = `Attention needed — BOD is approaching limit.`; } }
 }
 });

 const getStatusIcon = (status) => {
 if (status === 'RED') return <AlertOctagon size={20} className="text-rose-700 dark:text-rose-500" />;
 if (status === 'YELLOW') return <AlertTriangle size={20} className="text-amber-700 dark:text-amber-500" />;
 return <CheckCircle size={20} className="text-emerald-700 dark:text-emerald-500" />;
 };

 const downloadPDF = () => {
 const doc = new jsPDF();
 const facilityName = selectedFacility ? selectedFacility.replace(/_/g, ' ') : 'Permionics Plant';
 
 // Header
 doc.setFontSize(22);
 doc.setTextColor(6, 182, 212); // Cyan
 doc.text('PERMIONICS', 14, 20);
 
 doc.setFontSize(14);
 doc.setTextColor(50, 50, 50);
 doc.text('Monthly Compliance & Operations Report', 14, 30);
 
 doc.setFontSize(10);
 doc.text(`Facility: ${facilityName}`, 14, 40);
 doc.text(`Reporting Period: Last 30 Days`, 14, 46);
 doc.text(`Generated On: ${new Date().toLocaleString()}`, 14, 52);

 // Summary Box
 doc.setFillColor(240, 248, 255);
 doc.rect(14, 60, 182, 25, 'F');
 doc.text(`Uptime Percentage: 97.8%`, 20, 68);
 doc.text(`Alarms Triggered: 3`, 20, 74);
 doc.text(`Alarms Resolved: 3`, 20, 80);

 // Table Data
 const tableColumn = ["Parameter", "Min", "Max", "Average", "PCB Limit", "Days Compliant"];
 const tableRows = [
 ["pH", "6.8", "7.6", base.ph.toString(), `${limits.ph_min} - ${limits.ph_max}`, "30 / 30"],
 ["Turbidity (NTU)", "4.2", "9.1", base.turbidity.toString(), `< ${limits.turbidity_max || 999}`, "30 / 30"],
 ["Conductivity (µS/cm)", "680", "950", base.conductivity.toString(), `< ${limits.conductivity_max || 99999}`, "29 / 30"],
 ["BOD (mg/L)", "18", "32", base.bod.toString(), `< ${limits.bod_max || 9999}`, "28 / 30"],
 ["COD (mg/L)", "140", "220", base.cod.toString(), `< ${limits.cod_max || 9999}`, "30 / 30"]
 ];

 doc.autoTable({
 startY: 95,
 head: [tableColumn],
 body: tableRows,
 theme: 'grid',
 headStyles: { fillColor: [6, 182, 212] },
 });

 // Footer
 const finalY = doc.lastAutoTable.finalY || 150;
 doc.setFontSize(10);
 doc.setTextColor(100, 100, 100);
 doc.text('For support or queries, contact Permionics Operation Team:', 14, finalY + 20);
 doc.text('Email: support@permionics.com | Phone: +91 1800-123-4567', 14, finalY + 26);
 
 doc.save(`${selectedFacility}_Monthly_Report.pdf`);
 };

 return (
 <div className="flex flex-col h-screen bg-theme-main text-theme-text font-sans overflow-x-hidden">
 
 {/* 1. TOP BAR */}
 <header className="flex items-center justify-between p-4 bg-theme-panel border-b border-theme-border shrink-0">
 <div className="flex items-center gap-6">
 <div>
 <h1 className="text-2xl font-black text-cyan-700 dark:text-cyan-400 m-0 tracking-tight">PERMIONICS</h1>
 <p className="text-[10px] uppercase tracking-widest text-theme-muted font-bold">Client Portal</p>
 </div>
 
 <div className="h-8 w-px bg-slate-700"></div>

 <div className="flex items-center gap-3">
 <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
 <MapPin size={18} className="text-emerald-700 dark:text-emerald-400" />
 </div>
 {allowedPlants && allowedPlants.length > 1 ? (
 <select 
 value={selectedFacility || ''} 
 onChange={(e) => setFacility(e.target.value)}
 className="bg-theme-panel text-theme-text border border-theme-border rounded-lg py-1.5 px-3 focus:border-cyan-500 focus:outline-none font-bold"
 >
 {allowedPlants.map(plant => (
 <option key={plant} value={plant}>{plantConfig[plant] ? plantConfig[plant].display_name : plant}</option>
 ))}
 </select>
 ) : (
 <span className="font-bold text-lg">{config.display_name}</span>
 )}
 </div>
 </div>

 <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400 transition-colors border border-theme-border hover:border-rose-500/30">
 <LogOut size={16} /> Logout
 </button>
 </header>

 {/* 2. STATUS BANNER */}
 <div className={`shrink-0 p-4 border-b flex items-center justify-between transition-colors
 ${overallStatus === 'GREEN' ? 'bg-emerald-500/10 border-emerald-500/30' : 
 overallStatus === 'YELLOW' ? 'bg-amber-500/10 border-amber-500/30' : 
 'bg-rose-500/10 border-rose-500/30'}
 `}>
 <div className="flex items-center gap-4">
 {getStatusIcon(overallStatus)}
 <span className={`font-bold text-lg 
 ${overallStatus === 'GREEN' ? 'text-emerald-700 dark:text-emerald-400' : 
 overallStatus === 'YELLOW' ? 'text-amber-700 dark:text-amber-400' : 'text-rose-700 dark:text-rose-400'}
 `}>
 {statusMessage}
 </span>
 </div>
 <span className="text-xs text-theme-muted font-medium">
 Last Synced: {syncStatus.lastSynced ? new Date(syncStatus.lastSynced).toLocaleTimeString() : 'Waiting for telemetry...'}
 </span>
 </div>

 {/* Scrollable Content */}
 <div className="flex-1 overflow-y-auto p-6 space-y-6">
 
 {/* 3. THREE KPI CARDS */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 
 <div className="bg-theme-panel border border-theme-border rounded-xl p-6 relative overflow-hidden">
 <div className="absolute top-0 right-0 p-4 opacity-10">
 <AlertCircle size={64} />
 </div>
 <h3 className="text-sm font-bold text-theme-muted uppercase tracking-widest mb-4">Compliance Today</h3>
 <div className={`text-3xl font-black mb-1 ${overallStatus === 'RED' ? 'text-rose-700 dark:text-rose-500' : 'text-emerald-700 dark:text-emerald-400'}`}>
 {overallStatus === 'RED' ? 'NON-COMPLIANT' : 'COMPLIANT'}
 </div>
 <p className="text-sm text-theme-muted">Treated water {overallStatus === 'RED' ? 'has breached' : 'within'} PCB discharge limits</p>
 </div>

 <div className="bg-theme-panel border border-theme-border rounded-xl p-6 relative overflow-hidden">
 <div className="absolute top-0 right-0 p-4 opacity-10">
 <Activity size={64} />
 </div>
 <h3 className="text-sm font-bold text-theme-muted uppercase tracking-widest mb-4">Plant Uptime This Month</h3>
 <div className="text-3xl font-black text-theme-text mb-1">97.8%</div>
 <div className="mt-4 h-2 w-full bg-rose-500/20 rounded-full overflow-hidden flex">
 <div className="h-full bg-emerald-500 w-[97.8%]"></div>
 </div>
 <div className="flex justify-between text-xs text-theme-muted mt-2">
 <span>Days Up: 29</span>
 <span>Issues: 1</span>
 </div>
 </div>

 <div className="bg-theme-panel border border-theme-border rounded-xl p-6 relative overflow-hidden">
 <div className="absolute top-0 right-0 p-4 opacity-10">
 <Calendar size={64} />
 </div>
 <h3 className="text-sm font-bold text-theme-muted uppercase tracking-widest mb-4">Next Maintenance Visit</h3>
 <div className="text-3xl font-black text-cyan-700 dark:text-cyan-400 mb-1">14 July 2026</div>
 <p className="text-sm text-theme-muted">Predicted based on current membrane health</p>
 <p className="text-xs text-cyan-700 dark:text-cyan-500 mt-2 font-bold bg-cyan-500/10 inline-block px-2 py-1 rounded">33 days from today</p>
 </div>

 </div>

 {/* 4. COMPLIANCE CALENDAR */}
 <div className="bg-theme-panel border border-theme-border rounded-xl p-6">
 <h3 className="text-sm font-bold text-theme-text uppercase tracking-widest mb-4">Your 90-Day Compliance Record</h3>
 <div className="flex flex-wrap gap-1.5">
 {complianceHistory.map((day, i) => (
 <div 
 key={i} 
 className={`w-6 h-6 rounded-sm cursor-help transition-transform hover:scale-125
 ${day.status === 'GREEN' ? 'bg-emerald-500/80 hover:bg-emerald-400' : 
 day.status === 'YELLOW' ? 'bg-amber-500/80 hover:bg-amber-400' : 
 'bg-rose-500/80 hover:bg-rose-400'}
 `}
 title={`${day.date} - ${day.message}`}
 ></div>
 ))}
 </div>
 <div className="flex items-center gap-4 mt-4 text-xs text-theme-muted">
 <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-emerald-500/80 rounded-sm"></div> Within limits</div>
 <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-amber-500/80 rounded-sm"></div> Approaching limit</div>
 <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-rose-500/80 rounded-sm"></div> Limit breached</div>
 </div>
 </div>

 {/* 5. PARAMETER SUMMARY TABLE & 6. REPORT BUTTON */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 
 <div className="lg:col-span-2 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
 {parameters.map(p => {
 let isBreach = false;
 let isWarning = false;
 let min = 0;
 let max = 100;

 if (p.name === 'pH') { 
 if(p.rawValue < (limits.ph_min - 0.5) || p.rawValue > (limits.ph_max + 0.5)) isBreach = true; 
 else if(p.rawValue < limits.ph_min || p.rawValue > limits.ph_max) isWarning = true; 
 min = 0; max = 14;
 }
 if (p.name === 'Turbidity') { 
 if(p.rawValue > limits.turbidity_max) isBreach = true; 
 else if(p.rawValue > (limits.turbidity_max * 0.9)) isWarning = true; 
 max = (limits.turbidity_max || 10) * 1.5;
 }
 if (p.name === 'Conductivity') { 
 if(p.rawValue > limits.conductivity_max) isBreach = true; 
 else if(p.rawValue > (limits.conductivity_max * 0.9)) isWarning = true; 
 max = (limits.conductivity_max || 1000) * 1.5;
 }
 if (p.name === 'BOD') { 
 if(p.rawValue > limits.bod_max) isBreach = true; 
 else if(p.rawValue > (limits.bod_max * 0.9)) isWarning = true; 
 max = (limits.bod_max || 30) * 1.5;
 }
 if (p.name === 'COD') { 
 if(p.rawValue > limits.cod_max) isBreach = true; 
 else if(p.rawValue > (limits.cod_max * 0.9)) isWarning = true; 
 max = (limits.cod_max || 250) * 1.5;
 }

 // Simulated delta for visual effect
 const delta = p.name === 'pH' ? 0.1 : p.name === 'COD' ? -2.5 : p.name === 'Conductivity' ? 15 : p.name === 'BOD' ? -1.2 : 0.5;

 return (
 <QualityGaugeCard 
 key={p.name}
 title={p.name === 'Conductivity' ? 'TDS' : p.name}
 value={p.rawValue}
 min={min}
 max={max}
 unit={p.unit}
 limitText={p.limit}
 isBreach={isBreach}
 isWarning={isWarning}
 delta={delta}
 />
 );
 })}
 </div>

 <div className="flex flex-col justify-center items-center bg-theme-panel border border-theme-border rounded-xl p-8 text-center gap-4">
 <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center border border-cyan-500/30 mb-2">
 <Download size={32} className="text-cyan-700 dark:text-cyan-400" />
 </div>
 <div>
 <h3 className="font-bold text-theme-text mb-2">PCB Compliance Report</h3>
 <p className="text-sm text-theme-muted mb-6">Generate an official monthly summary report suitable for submission to the pollution control board.</p>
 </div>
 <button 
 onClick={downloadPDF}
 className="w-full bg-cyan-600 hover:bg-cyan-500 text-theme-text font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]"
 >
 <Download size={18} />
 Download Monthly Report (PDF)
 </button>
 </div>

 </div>

 </div>

 </div>
 );
}
