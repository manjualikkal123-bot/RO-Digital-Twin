import React, { useState, useEffect, useMemo } from 'react';
import { ShieldAlert, AlertTriangle, Filter, Calendar, Search, ChevronDown, ChevronUp, Clock, User, Wrench, Activity, CheckCircle2, ChevronLeft, ChevronRight, Info, BarChart2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import plantConfig from '../config/plant_config.json';
import ExportButton from '../components/ExportButton';

const formatIST = (dateString) => {
 if (!dateString) return 'N/A';
 return new Date(dateString).toLocaleString('en-IN', { 
 timeZone: 'Asia/Kolkata', 
 day: '2-digit', month: 'short', year: 'numeric',
 hour: '2-digit', minute: '2-digit', second: '2-digit',
 hour12: true
 }) + ' IST';
};

const extractTimeIST = (dateString) => {
 if (!dateString) return 'N/A';
 return new Date(dateString).toLocaleTimeString('en-IN', { 
 timeZone: 'Asia/Kolkata', 
 hour: '2-digit', minute: '2-digit', second: '2-digit',
 hour12: true
 }) + ' IST';
};

const extractDateIST = (dateString) => {
 if (!dateString) return 'N/A';
 return new Date(dateString).toLocaleDateString('en-IN', { 
 timeZone: 'Asia/Kolkata', 
 day: '2-digit', month: 'short', year: 'numeric'
 });
};

// ── Severity Breakdown Horizontal Bar ─────────────────────────────────────────
function SeverityBreakdown({ alarms, openCritical }) {
 const total = alarms.length || 1;
 const counts = {
 CRITICAL: alarms.filter(a => a.severity === 'CRITICAL').length,
 WARNING: alarms.filter(a => a.severity === 'WARNING').length,
 INFO: alarms.filter(a => a.severity === 'INFO').length,
 };
 const openCounts = {
 CRITICAL: openCritical,
 };
 const bars = [
 { label: 'Critical', key: 'CRITICAL', color: 'bg-red-500', text: 'text-red-700 dark:text-red-400', showOpen: true },
 { label: 'Warning', key: 'WARNING', color: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400', showOpen: false },
 { label: 'Info', key: 'INFO', color: 'bg-cyan-500', text: 'text-cyan-700 dark:text-cyan-400', showOpen: false },
 ];
 return (
 <div className="bg-theme-panel border border-theme-border rounded-xl p-4 shadow-lg flex flex-col justify-between premium-card">
 <span className="text-theme-muted text-[10px] uppercase tracking-widest mb-3 flex items-center gap-1">
 <BarChart2 size={12}/> Severity Breakdown
 <span className="ml-auto text-[9px] text-theme-muted font-normal normal-case tracking-normal">of {total} events</span>
 </span>
 <div className="flex flex-col gap-2">
 {bars.map(({ label, key, color, text, showOpen }) => {
 const pct = total > 0 ? (counts[key] / total) * 100 : 0;
 const openLabel = showOpen && openCounts[key] !== undefined
 ? ` (${openCounts[key]} open)`
 : '';
 return (
 <div key={key} className="flex items-center gap-2" title={`${counts[key]} total${openLabel}`}>
 <span className={`text-[10px] font-bold w-14 shrink-0 ${text}`}>{label}</span>
 <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
 <div
 className={`${color} h-2 rounded-full transition-all duration-700`}
 style={{ width: `${pct}%` }}
 />
 </div>
 <span className={`text-[11px] font-bold w-auto text-right shrink-0 ${text}`}>
 {counts[key]}
 {showOpen && openCounts[key] > 0 && (
 <span className="text-theme-muted font-normal ml-1">/{openCounts[key]}↑</span>
 )}
 </span>
 </div>
 );
 })}
 </div>
 <p className="text-[9px] text-theme-muted mt-2 font-normal">Critical: total / open ↑</p>
 </div>
 );
}

// ── 30-Day Alarm Frequency Sparkline ──────────────────────────────────────────
function AlarmSparkline({ alarms, isFiltered }) {
 // Build last-30-day buckets from whatever alarms actually exist in the
 // store right now.
 const now = Date.now();
 const buckets = useMemo(() => {
 const b = Array.from({ length: 30 }, (_, i) => ({ day: 29 - i, count: 0, hasCritical: false }));
 alarms.forEach(alarm => {
 const daysAgo = Math.floor((now - new Date(alarm.date).getTime()) / 86400000);
 if (daysAgo >= 0 && daysAgo < 30) {
 b[daysAgo].count += 1;
 if (alarm.severity === 'CRITICAL') b[daysAgo].hasCritical = true;
 }
 });
 return b.reverse(); // day 0 = 30 days ago, day 29 = today
 }, [alarms]);

 const max = Math.max(...buckets.map(b => b.count), 1);
 const svgH = 40;
 const svgW = 200;
 const barW = (svgW / 30) - 1;

 // FIXED: this used to always say "Low activity → Fouling accelerating →
 // Critical spike" no matter what the real data showed — a fabricated
 // narrative written for the old mockAlarms.js demo story, which is no
 // longer wired into the store (useAppStore.js only populates `alarms`
 // from real setTelemetry() threshold trips + sensor faults + e-stops now).
 // Caption below is derived from the actual buckets instead.
 const totalCount = buckets.reduce((s, b) => s + b.count, 0);
 const anyCritical = buckets.some(b => b.hasCritical);
 const trendCaption = totalCount === 0
 ? 'No alarms logged in the last 30 days'
 : anyCritical
 ? `${totalCount} event${totalCount !== 1 ? 's' : ''} logged — includes critical activity`
 : `${totalCount} event${totalCount !== 1 ? 's' : ''} logged — no criticals`;

 return (
 <div className="bg-theme-panel border border-theme-border rounded-xl p-4 shadow-lg flex flex-col justify-between col-span-2 premium-card">
 <span className="text-theme-muted text-[10px] uppercase tracking-widest mb-3 flex items-center gap-1">
 <Activity size={12}/> Alarm Frequency — Last 30 Days
 <span className="ml-auto text-[9px] text-theme-muted font-normal normal-case tracking-normal">
 {isFiltered
 ? <span className="text-cyan-600/70">Showing full 30-day history — unaffected by filter</span>
 : trendCaption
 }
 </span>
 </span>
 <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" preserveAspectRatio="none" style={{ height: 44 }}>
 {buckets.map((b, i) => {
 const barH = b.count > 0 ? Math.max(3, (b.count / max) * svgH) : 1;
 const x = i * (barW + 1);
 const y = svgH - barH;
 const fill = b.hasCritical ? '#ef4444' : b.count > 1 ? '#f59e0b' : b.count === 1 ? '#06b6d4' : '#1e293b';
 return (
 <rect key={i} x={x} y={y} width={barW} height={barH} fill={fill} rx="1" opacity={b.count === 0 ? 0.3 : 1}>
 <title>{`Day ${i + 1}: ${b.count} alarm${b.count !== 1 ? 's' : ''}`}</title>
 </rect>
 );
 })}
 </svg>
 <div className="flex justify-between text-[9px] text-theme-muted mt-1 font-mono">
 <span>30d ago</span>
 <span>Today</span>
 </div>
 </div>
 );
}

export default function AlarmLedger() {
 const { alarms, commandLog, selectedFacility } = useAppStore();
 const config = plantConfig[selectedFacility] || plantConfig['jetl_hyderabad'];
 
 const [activeTab, setActiveTab] = useState('alarms');
 
 const [horizon, setHorizon] = useState(30);
 const [severityFilter, setSeverityFilter] = useState('ALL');
 const [facilityFilter, setFacilityFilter] = useState('ALL');
 const [lifecycleFilter, setLifecycleFilter] = useState('ALL');
 const [searchTerm, setSearchTerm] = useState('');
 
 const [customStartDate, setCustomStartDate] = useState('');
 const [customEndDate, setCustomEndDate] = useState('');
 const [isCustomRange, setIsCustomRange] = useState(false);

 const [expandedRows, setExpandedRows] = useState({});
 const [lastSync, setLastSync] = useState('');

 const [currentPage, setCurrentPage] = useState(1);
 const itemsPerPage = 12;

 useEffect(() => {
 setLastSync(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' IST');
 }, []);

 const toggleRow = (id) => {
 setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
 };

 const handleAssignOperator = (e, alarmId) => {
 e.stopPropagation();
 alert(`Dispatching assignment notification for ${alarmId} to on-duty operational team...`);
 };

 // Advanced Filtering — safe property access guards prevent silent crashes
 const filteredAlarms = (alarms || []).filter(alarm => {
 if (!alarm || !alarm.date) return false;
 const alarmDate = new Date(alarm.date);
 
 let isWithinHorizon = true;
 if (isCustomRange && customStartDate && customEndDate) {
 isWithinHorizon = alarmDate >= new Date(customStartDate) && alarmDate <= new Date(customEndDate + 'T23:59:59');
 } else {
 const cutoffDate = new Date();
 cutoffDate.setDate(cutoffDate.getDate() - horizon);
 isWithinHorizon = alarmDate >= cutoffDate;
 }
 
 const matchesSeverity = severityFilter === 'ALL' || alarm.severity === severityFilter;
 const matchesFacility = facilityFilter === 'ALL' || alarm.facility === facilityFilter;
 const matchesLifecycle = lifecycleFilter === 'ALL' || alarm.lifecycleStatus === lifecycleFilter;
 
 const s = searchTerm.toLowerCase();
 const matchesSearch = !s || 
 (alarm.description || '').toLowerCase().includes(s) || 
 (alarm.facility || '').toLowerCase().includes(s) ||
 (alarm.id || '').toLowerCase().includes(s) ||
 (alarm.equipmentTag || '').toLowerCase().includes(s) ||
 (alarm.acknowledgedBy || '').toLowerCase().includes(s) ||
 (alarm.lifecycleStatus || '').toLowerCase().includes(s);

 return isWithinHorizon && matchesSeverity && matchesFacility && matchesLifecycle && matchesSearch;
 });

 // SLA thresholds
 const SLA_CRITICAL_MINS = 15;
 const SLA_WARNING_MINS = 60;
 
 const processedAlarms = filteredAlarms.map(a => {
 const elapsedMins = (Date.now() - new Date(a.date).getTime()) / 60000;
 let isEscalated = false;
 let slaBreached = false;
 
 if (a.lifecycleStatus === 'Active') {
 if (a.severity === 'CRITICAL' && elapsedMins > SLA_CRITICAL_MINS) { isEscalated = true; slaBreached = true; }
 if (a.severity === 'WARNING' && elapsedMins > SLA_WARNING_MINS) { isEscalated = true; slaBreached = true; }
 }
 
 return { ...a, displayStatus: isEscalated ? 'Escalated' : a.lifecycleStatus, slaBreached };
 });

 // KPI Calculations
 const totalEvents = processedAlarms.length;
 const openCritical = processedAlarms.filter(a => a.severity === 'CRITICAL' && a.lifecycleStatus === 'Active').length;
 
 const calculateAvgRes = (severity) => {
 const resolved = processedAlarms.filter(a => a.severity === severity && a.lifecycleStatus === 'Resolved');
 if (resolved.length === 0) return null; // null = no data, distinct from 0
 const total = resolved.reduce((acc, a) => acc + parseInt(a.resolutionTime?.replace('m', '') || '0', 10), 0);
 return Math.round(total / resolved.length);
 };
 
 const avgCritRes = calculateAvgRes('CRITICAL');
 const avgWarnRes = calculateAvgRes('WARNING');

 // Ack Rate — show N/A when only Active alarms are in view (all would be 0%, misleading)
 const isActiveOnlyFilter = lifecycleFilter === 'Active';
 const ackRate = (processedAlarms.length > 0 && !isActiveOnlyFilter)
 ? Math.round((processedAlarms.filter(a => a.lifecycleStatus !== 'Active').length / processedAlarms.length) * 100) 
 : null; // null = not meaningful for this filter

 // Pagination
 const totalPages = Math.ceil(processedAlarms.length / itemsPerPage);
 const paginatedAlarms = processedAlarms.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

 // Export CSV
 const handleExportCSV = () => {
 let csvContent = "data:text/csv;charset=utf-8,";
 csvContent += "Date (IST),Alarm ID,Facility,Equipment Tag,Severity,Description,Lifecycle Status,Acknowledged By,Resolution Time,Duration\n";
 processedAlarms.forEach(alarm => {
 const dateStr = formatIST(alarm.date);
 const desc = `"${(alarm.description || '').replace(/"/g, '""')}"`;
 csvContent += `${dateStr},${alarm.id},${alarm.facility},${alarm.equipmentTag},${alarm.severity},${desc},${alarm.displayStatus},${alarm.acknowledgedBy || 'N/A'},${alarm.resolutionTime || 'N/A'},${alarm.duration}\n`;
 });
 const link = document.createElement("a");
 link.setAttribute("href", encodeURI(csvContent));
 link.setAttribute("download", `Alarm_Ledger_Export_${new Date().toISOString().split('T')[0]}.csv`);
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 };

 // Unique facilities from alarms for filter dropdown
 const facilities = [...new Set((alarms || []).map(a => a.facility).filter(Boolean))];

 return (
 <div className="flex flex-col gap-6 p-6 bg-theme-main text-theme-text min-h-full font-sans select-none">
 
 {/* HEADER */}
 <header className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-theme-border pb-5 gap-4">
 <div>
 <h1 className="text-3xl font-bold flex items-center gap-3 tracking-tight">
 {activeTab === 'alarms' ? (
 <><ShieldAlert className="text-cyan-700 dark:text-cyan-500" size={32} /> Alarm &amp; Event Ledger</>
 ) : (
 <><Activity className="text-purple-700 dark:text-purple-500" size={32} /> Command Log Ledger</>
 )}
 </h1>
 <p className="text-theme-muted text-sm mt-2">Alarm management system — Timezone: Asia/Kolkata (IST)</p>
 </div>
 <div className="flex gap-4 items-center">
 <div className="flex bg-theme-panel border border-theme-border rounded-lg p-1">
 <button 
 onClick={() => { setActiveTab('alarms'); setCurrentPage(1); }}
 className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${activeTab === 'alarms' ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border border-cyan-500/50' : 'text-theme-muted hover:text-theme-text'}`}
 >
 ALARM LEDGER
 </button>
 <button 
 onClick={() => { setActiveTab('commands'); setCurrentPage(1); }}
 className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${activeTab === 'commands' ? 'bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-500/50' : 'text-theme-muted hover:text-theme-text'}`}
 >
 COMMAND LOG
 </button>
 </div>
 <ExportButton
 plantName={config.display_name}
 filename={`${selectedFacility}_AlarmLedger`}
 telemetryHistory={[]}
 alarms={alarms}
 limits={config?.limits}
 />
 </div>
 </header>

 {/* KPI SUMMARY STRIP */}
 {activeTab === 'alarms' ? (
 <>
 {/* Row 1: Core KPIs */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="bg-theme-panel border border-theme-border rounded-xl p-4 flex flex-col justify-center shadow-lg premium-card">
 <span className="text-theme-muted text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1"><Activity size={12}/> Total Events</span>
 <span className="text-3xl font-bold text-theme-text">{totalEvents}</span>
 </div>
 <div className={`bg-theme-panel border ${openCritical > 0 ? 'border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-theme-border'} rounded-xl p-4 flex flex-col justify-center shadow-lg transition-all premium-card`}>
 <span className="text-theme-muted text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1"><AlertTriangle size={12} className={openCritical > 0 ? "text-red-700 dark:text-red-500" : ""} /> Open Critical</span>
 <span className={`text-3xl font-bold ${openCritical > 0 ? 'text-red-700 dark:text-red-500 animate-pulse' : 'text-emerald-700 dark:text-emerald-500'}`}>{openCritical}</span>
 </div>
 <div className="bg-theme-panel border border-theme-border rounded-xl p-4 flex flex-col justify-center shadow-lg premium-card">
 <span className="text-theme-muted text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1"><Clock size={12}/> Avg Resolution SLA</span>
 <div className="flex items-center gap-4 mt-1">
 <div className="flex flex-col">
 <span className={`text-lg font-bold ${
 avgCritRes === null ? 'text-theme-muted' :
 avgCritRes > SLA_CRITICAL_MINS ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'
 }`}>
 {avgCritRes === null ? 'N/A' : `${avgCritRes}m`}
 </span>
 <span className="text-[9px] text-theme-muted uppercase tracking-widest">CRITICAL</span>
 </div>
 <div className="flex flex-col border-l border-theme-border pl-4">
 <span className={`text-lg font-bold ${
 avgWarnRes === null ? 'text-theme-muted' :
 avgWarnRes > SLA_WARNING_MINS ? 'text-amber-700 dark:text-amber-400' : 'text-cyan-700 dark:text-cyan-400'
 }`}>
 {avgWarnRes === null ? 'N/A' : `${avgWarnRes}m`}
 </span>
 <span className="text-[9px] text-theme-muted uppercase tracking-widest">WARNING</span>
 </div>
 </div>
 </div>
 <div className="bg-theme-panel border border-theme-border rounded-xl p-4 flex flex-col justify-center shadow-lg relative overflow-hidden premium-card">
 <span className="text-theme-muted text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1"><CheckCircle2 size={12}/> Ack Rate</span>
 {ackRate === null ? (
 <div className="flex flex-col">
 <span className="text-xl font-bold text-theme-muted">N/A</span>
 <span className="text-[9px] text-theme-muted mt-0.5">Active filter — no resolved alarms in view</span>
 </div>
 ) : (
 <div className="flex items-baseline gap-1">
 <span className="text-3xl font-bold text-emerald-700 dark:text-emerald-500">{ackRate}</span>
 <span className="text-xs text-emerald-700 dark:text-emerald-500 font-bold">%</span>
 </div>
 )}
 <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-700" style={{ width: `${ackRate ?? 0}%` }}></div>
 </div>
 </div>
 {/* Row 2: Charts */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <SeverityBreakdown alarms={processedAlarms} openCritical={openCritical} />
 {/* Always pass raw alarms (unfiltered) so sparkline always shows full 30-day history */}
 <AlarmSparkline alarms={alarms || []} isFiltered={lifecycleFilter !== 'ALL' || severityFilter !== 'ALL'} />
 </div>
 </>
 ) : (
 <div className="grid grid-cols-2 gap-4">
 <div className="bg-theme-panel border border-theme-border rounded-xl p-4 flex flex-col justify-center shadow-lg premium-card">
 <span className="text-theme-muted text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1"><Activity size={12}/> Total Commands Logged</span>
 <span className="text-3xl font-bold text-purple-700 dark:text-purple-400">{commandLog?.length || 0}</span>
 </div>
 <div className="bg-theme-panel border border-theme-border rounded-xl p-4 flex flex-col justify-center shadow-lg premium-card">
 <span className="text-theme-muted text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1"><User size={12}/> Authorized Operators</span>
 <span className="text-3xl font-bold text-theme-text">1</span>
 </div>
 </div>
 )}

 {/* FILTER CONTROLS */}
 <div className="flex flex-col lg:flex-row justify-between items-center bg-theme-panel border border-theme-border p-4 rounded-xl gap-4 shadow-lg premium-card">
 
 {/* Horizon Toggles & Custom Date */}
 <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto">
 <div className="flex items-center bg-theme-panel rounded-lg p-1 border border-theme-border shrink-0">
 <button 
 onClick={() => { setHorizon(30); setIsCustomRange(false); setCurrentPage(1); }}
 className={`px-4 py-1.5 rounded-md text-xs font-bold tracking-wider transition-colors whitespace-nowrap ${!isCustomRange && horizon === 30 ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border border-cyan-500/50' : 'text-theme-muted hover:text-theme-text'}`}
 >
 30 DAYS
 </button>
 <button 
 onClick={() => { setHorizon(90); setIsCustomRange(false); setCurrentPage(1); }}
 className={`px-4 py-1.5 rounded-md text-xs font-bold tracking-wider transition-colors whitespace-nowrap ${!isCustomRange && horizon === 90 ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border border-cyan-500/50' : 'text-theme-muted hover:text-theme-text'}`}
 >
 90 DAYS
 </button>
 <button 
 onClick={() => setIsCustomRange(true)}
 className={`px-4 py-1.5 rounded-md text-xs font-bold tracking-wider transition-colors whitespace-nowrap min-w-[90px] text-center ${isCustomRange ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border border-cyan-500/50' : 'text-theme-muted hover:text-theme-text'}`}
 >
 CUSTOM
 </button>
 </div>
 
 {isCustomRange && (
 <div className="flex items-center gap-2 bg-theme-panel rounded-lg px-2 border border-theme-border shrink-0">
 <input type="date" value={customStartDate} onChange={e => { setCustomStartDate(e.target.value); setCurrentPage(1); }} className="bg-transparent text-xs text-theme-text focus:outline-none p-1.5 " />
 <span className="text-theme-muted">—</span>
 <input type="date" value={customEndDate} onChange={e => { setCustomEndDate(e.target.value); setCurrentPage(1); }} className="bg-transparent text-xs text-theme-text focus:outline-none p-1.5 " />
 </div>
 )}
 </div>

 <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
 {activeTab === 'alarms' && (
 <div className="flex items-center gap-2 bg-theme-panel border border-theme-border rounded-lg px-3 py-1.5 shrink-0">
 <select value={lifecycleFilter} onChange={(e) => { setLifecycleFilter(e.target.value); setCurrentPage(1); }} className="bg-transparent border-none text-xs text-theme-text font-semibold focus:outline-none cursor-pointer ">
 <option value="ALL">All Statuses</option>
 <option value="Active">Active</option>
 <option value="Acknowledged">Acknowledged</option>
 <option value="Resolved">Resolved</option>
 </select>
 </div>
 )}

 {activeTab === 'alarms' && (
 <div className="flex items-center gap-2 bg-theme-panel border border-theme-border rounded-lg px-3 py-1.5 shrink-0">
 <select value={facilityFilter} onChange={(e) => { setFacilityFilter(e.target.value); setCurrentPage(1); }} className="bg-transparent border-none text-xs text-theme-text font-semibold focus:outline-none cursor-pointer ">
 <option value="ALL">All Facilities</option>
 {facilities.map(f => (
 <option key={f} value={f}>{plantConfig[f]?.display_name || f}</option>
 ))}
 </select>
 </div>
 )}

 {activeTab === 'alarms' && (
 <div className="flex items-center gap-2 bg-theme-panel border border-theme-border rounded-lg px-3 py-1.5 shrink-0">
 <Filter size={14} className="text-theme-muted" />
 <select value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setCurrentPage(1); }} className="bg-transparent border-none text-xs text-theme-text font-semibold focus:outline-none cursor-pointer ">
 <option value="ALL">All Severities</option>
 <option value="CRITICAL">Critical Only</option>
 <option value="WARNING">Warning Only</option>
 <option value="INFO">Info Only</option>
 </select>
 </div>
 )}

 <div className="flex items-center gap-2 bg-theme-panel border border-theme-border rounded-lg px-3 py-1.5 w-full lg:w-64">
 <Search size={14} className="text-theme-muted shrink-0" />
 <input 
 type="text" 
 placeholder="Search ID, tag, operator..." 
 value={searchTerm}
 onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
 className="bg-transparent border-none text-xs text-theme-text focus:outline-none w-full placeholder-slate-500"
 />
 </div>
 </div>
 </div>

 {/* DATA TABLE */}
 <div className="bg-theme-panel border border-theme-border rounded-xl shadow-lg overflow-hidden flex flex-col min-h-[400px] premium-card">
 <div className="overflow-x-auto flex-1">
 <table className="w-full text-left text-sm whitespace-nowrap">
 {activeTab === 'alarms' ? (
 <thead className="bg-theme-main border-b border-theme-border text-xs font-bold text-theme-muted uppercase tracking-widest sticky top-0 z-10 backdrop-blur-md">
 <tr>
 <th className="px-6 py-4 w-10"></th>
 <th className="px-4 py-4">Triggered At (IST)</th>
 <th className="px-4 py-4">Alarm ID</th>
 <th className="px-4 py-4">Facility &amp; Tag</th>
 <th className="px-4 py-4">Severity</th>
 <th className="px-4 py-4">Status</th>
 <th className="px-4 py-4">Ack'd By</th>
 <th className="px-4 py-4">Event Description</th>
 </tr>
 </thead>
 ) : (
 <thead className="bg-theme-main border-b border-theme-border text-xs font-bold text-purple-700 dark:text-purple-400/80 uppercase tracking-widest sticky top-0 z-10 backdrop-blur-md">
 <tr>
 <th className="px-6 py-4">Timestamp (IST)</th>
 <th className="px-4 py-4">Command ID</th>
 <th className="px-4 py-4">Operator</th>
 <th className="px-4 py-4">Target Tag</th>
 <th className="px-4 py-4">Previous Value</th>
 <th className="px-4 py-4">Commanded Value</th>
 <th className="px-4 py-4 min-w-[200px]">Justification</th>
 </tr>
 </thead>
 )}
 <tbody className="divide-y divide-slate-800/50">
 {activeTab === 'alarms' ? (
 paginatedAlarms.length > 0 ? paginatedAlarms.map((alarm) => {
 const isExpanded = expandedRows[alarm.id];
 
 let statusColor = 'text-red-700 dark:text-red-500 border-red-500/30 bg-red-500/10';
 let statusDot = 'bg-red-500 animate-pulse';
 
 if (alarm.displayStatus === 'Escalated') {
 statusColor = 'text-rose-700 dark:text-rose-500 border-rose-500/50 bg-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.3)] font-black animate-pulse';
 statusDot = 'bg-rose-500';
 } else if (alarm.displayStatus === 'Acknowledged') { 
 statusColor = 'text-amber-700 dark:text-amber-400 border-amber-500/30 bg-amber-500/10'; 
 statusDot = 'bg-amber-400'; 
 } else if (alarm.displayStatus === 'Resolved') { 
 statusColor = 'text-emerald-700 dark:text-emerald-500 border-emerald-500/30 bg-emerald-500/10'; 
 statusDot = 'bg-emerald-500'; 
 }

 const rowClass = alarm.slaBreached && alarm.displayStatus !== 'Resolved'
 ? 'bg-red-950/20 border-l-2 border-red-500'
 : 'hover:bg-slate-100 dark:hover:bg-slate-800 border-l-2 border-transparent';

 // Facility display name
 const facilityName = plantConfig[alarm.facility]?.display_name || alarm.facility || '—';

 return (
 <React.Fragment key={alarm.id}>
 <tr 
 onClick={() => toggleRow(alarm.id)}
 className={`${rowClass} transition-colors cursor-pointer group ${isExpanded ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
 >
 <td className="px-6 py-4 text-theme-muted group-hover:text-cyan-700 dark:text-cyan-400 transition-colors">
 {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
 </td>
 <td className="px-4 py-4">
 <div className="flex flex-col">
 <span className="font-medium text-theme-text">{extractDateIST(alarm.date)}</span>
 <span className="text-theme-muted text-[11px] font-mono mt-0.5">{extractTimeIST(alarm.date)}</span>
 </div>
 </td>
 <td className="px-4 py-4 font-bold text-cyan-700 dark:text-cyan-500 tracking-wider font-mono">
 {/* Normalize AL-XXXX → ALM-XXXX for display consistency */}
 {(alarm.id || '').startsWith('AL-') && !(alarm.id || '').startsWith('ALM-')
 ? alarm.id.replace('AL-', 'ALM-')
 : (alarm.id || '—')}
 {alarm.slaBreached && alarm.displayStatus !== 'Resolved' && (
 <span className="ml-2 px-1.5 py-0.5 bg-red-500/20 text-red-700 dark:text-red-400 text-[9px] rounded uppercase">SLA</span>
 )}
 </td>
 <td className="px-4 py-4">
 <div className="flex flex-col">
 <span className="font-semibold text-theme-text text-xs">{facilityName}</span>
 <span className="text-theme-muted text-[10px] font-mono mt-0.5 uppercase">{alarm.equipmentTag}</span>
 </div>
 </td>
 <td className="px-4 py-4">
 {alarm.severity === 'CRITICAL' ? (
 <span className="flex items-center gap-1.5 text-red-700 dark:text-red-400 font-bold bg-red-500/10 px-2 py-1 rounded border border-red-500/20 text-[10px] tracking-wider w-fit">
 <AlertTriangle size={12} /> CRITICAL
 </span>
 ) : alarm.severity === 'WARNING' ? (
 <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 text-[10px] tracking-wider w-fit">
 <AlertTriangle size={12} /> WARNING
 </span>
 ) : (
 <span className="flex items-center gap-1.5 text-cyan-700 dark:text-cyan-400 font-bold bg-cyan-500/10 px-2 py-1 rounded border border-cyan-500/20 text-[10px] tracking-wider w-fit">
 <Info size={12} /> INFO
 </span>
 )}
 </td>
 {/* STATUS column */}
 <td className="px-4 py-4">
 <span className={`flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-full border text-[10px] tracking-wider w-fit uppercase ${statusColor}`}>
 <div className={`w-1.5 h-1.5 rounded-full ${statusDot}`}></div> {alarm.displayStatus}
 </span>
 </td>
 {/* ACK'D BY column */}
 <td className="px-4 py-4">
 <span className="text-xs font-mono text-cyan-700 dark:text-cyan-400">
 {alarm.acknowledgedBy || <span className="text-theme-muted italic">Pending</span>}
 </span>
 </td>
 {/* DESCRIPTION — full text in title tooltip */}
 <td className="px-4 py-4 text-theme-text max-w-xs" title={alarm.description}>
 <div className="whitespace-normal break-words line-clamp-2">
 {alarm.description}
 </div>
 </td>
 </tr>
 
 {isExpanded && (
 <tr className="bg-theme-panel border-b border-theme-border/80 shadow-inner">
 <td colSpan="8" className="px-6 py-6">
 <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 ml-10">
 <div className="flex flex-col gap-1 col-span-1 lg:col-span-2">
 <span className="text-[10px] uppercase tracking-widest text-theme-muted font-bold flex items-center gap-1"><Search size={12}/> Root Cause Analysis</span>
 <span className="text-sm text-theme-text mt-1 leading-relaxed whitespace-normal break-words">{alarm.rootCause}</span>
 <span className="text-[10px] uppercase tracking-widest text-theme-muted font-bold flex items-center gap-1 mt-4"><Wrench size={12}/> Recommended SOP &amp; Corrective Actions</span>
 <span className="text-sm text-theme-text mt-1 leading-relaxed whitespace-normal break-words">{alarm.recommendedAction}</span>
 {alarm.resolutionNotes && (
 <div className="mt-4 p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-lg">
 <span className="text-[10px] uppercase tracking-widest text-emerald-700 dark:text-emerald-500 font-bold">Resolution Notes</span>
 <p className="text-sm text-emerald-100/80 mt-1">{alarm.resolutionNotes}</p>
 </div>
 )}
 </div>
 
 <div className="flex flex-col gap-3 border-l border-theme-border pl-6">
 <span className="text-[10px] uppercase tracking-widest text-theme-muted font-bold flex items-center gap-1"><Activity size={12}/> Frozen Sensor Telemetry at Trigger</span>
 <div className="bg-theme-main border border-theme-border rounded p-3 flex flex-col gap-2">
 <div className="flex justify-between items-center text-xs">
 <span className="text-theme-muted">Differential Pressure</span>
 <span className="font-bold font-mono text-theme-text">{alarm.triggerValues?.differential_pressure ?? 'N/A'} bar</span>
 </div>
 <div className="flex justify-between items-center text-xs">
 <span className="text-theme-muted">Feed Pressure</span>
 <span className="font-bold font-mono text-theme-text">{alarm.triggerValues?.feed_pressure ?? 'N/A'} bar</span>
 </div>
 <div className="flex justify-between items-center text-xs border-t border-theme-border pt-2 mt-1">
 <span className="text-theme-muted">Flow Rate</span>
 <span className="font-bold font-mono text-cyan-700 dark:text-cyan-400">{alarm.triggerValues?.flow_rate ?? 'N/A'} m³/h</span>
 </div>
 </div>
 {alarm.lifecycleStatus !== 'Resolved' && (
 <button 
 onClick={(e) => handleAssignOperator(e, alarm.id)}
 className="mt-2 w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 border border-cyan-500/30 text-cyan-700 dark:text-cyan-400 text-xs font-bold uppercase tracking-widest rounded transition-colors"
 >
 Assign to Operator
 </button>
 )}
 </div>
 
 <div className="flex flex-col gap-3 border-l border-theme-border pl-6">
 <span className="text-[10px] uppercase tracking-widest text-theme-muted font-bold flex items-center gap-1 mb-1"><User size={12}/> Audit Trail</span>
 <div className="flex justify-between items-center">
 <span className="text-[10px] text-theme-muted">Acknowledged By</span>
 <span className="text-xs font-mono text-cyan-700 dark:text-cyan-400">{alarm.acknowledgedBy || 'Pending'}</span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-[10px] text-theme-muted">Acknowledged At</span>
 <span className="text-xs font-mono text-theme-text">{extractTimeIST(alarm.acknowledgedAt) || '--'}</span>
 </div>
 <div className="flex justify-between items-center pt-2 border-t border-theme-border">
 <span className="text-[10px] text-theme-muted">Resolved By</span>
 <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400">{alarm.resolvedBy || '--'}</span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-[10px] text-theme-muted">Resolution Time</span>
 <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400">{alarm.resolutionTime || 'Pending'}</span>
 </div>
 <div className="flex justify-between items-center pt-2 border-t border-theme-border">
 <span className="text-[10px] text-theme-muted">Active Duration</span>
 <span className="text-xs font-mono text-theme-muted">{alarm.duration}</span>
 </div>
 </div>
 </div>
 </td>
 </tr>
 )}
 </React.Fragment>
 );
 }) : (
 <tr>
 <td colSpan="7" className="px-6 py-16 text-center">
 <div className="flex flex-col items-center justify-center text-theme-muted">
 <ShieldAlert size={48} className="mb-4 opacity-20" />
 <span className="font-medium">No alarms match your current filters.</span>
 <span className="text-xs mt-1">Try expanding the date horizon or clearing the search term.</span>
 </div>
 </td>
 </tr>
 )
 ) : (
 commandLog && commandLog.length > 0 ? commandLog.map((cmd) => (
 <tr key={cmd.id} className="hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-l-2 border-transparent hover:border-purple-500">
 <td className="px-6 py-4">
 <div className="flex flex-col">
 <span className="font-medium text-theme-text">{extractDateIST(cmd.timestamp)}</span>
 <span className="text-theme-muted text-[11px] font-mono mt-0.5">{extractTimeIST(cmd.timestamp)}</span>
 </div>
 </td>
 <td className="px-4 py-4 font-bold text-purple-700 dark:text-purple-400 tracking-wider font-mono">{cmd.id}</td>
 <td className="px-4 py-4 text-theme-text font-semibold">{cmd.operator}</td>
 <td className="px-4 py-4 text-cyan-700 dark:text-cyan-400 font-mono text-xs">{cmd.tagId}</td>
 <td className="px-4 py-4 text-theme-muted font-mono">{cmd.previousValue} {cmd.unit}</td>
 <td className="px-4 py-4 text-emerald-700 dark:text-emerald-400 font-bold font-mono">{cmd.commandedValue} {cmd.unit}</td>
 <td className="px-4 py-4 text-theme-text italic whitespace-normal max-w-sm">{cmd.reason}</td>
 </tr>
 )) : (
 <tr>
 <td colSpan="7" className="px-6 py-16 text-center">
 <div className="flex flex-col items-center justify-center text-theme-muted">
 <Activity size={48} className="mb-4 opacity-20" />
 <span className="font-medium">No commands have been logged yet.</span>
 <span className="text-xs mt-1">Commands are logged when operators adjust parameters via the Command Panel.</span>
 </div>
 </td>
 </tr>
 )
 )}
 </tbody>
 </table>
 </div>
 
 {/* PAGINATION & FOOTER */}
 <div className="p-3 border-t border-theme-border bg-theme-main flex flex-col sm:flex-row justify-between items-center gap-4">
 <span className="flex items-center gap-2 text-[10px] text-theme-muted font-bold uppercase tracking-wider">
 <Activity size={12} className={activeTab === 'alarms' ? "text-cyan-700 dark:text-cyan-500" : "text-purple-700 dark:text-purple-500"} /> 
 Showing {activeTab === 'alarms' ? paginatedAlarms.length : (commandLog?.length || 0)} of {activeTab === 'alarms' ? totalEvents : (commandLog?.length || 0)} Event{activeTab === 'alarms' && totalEvents !== 1 ? 's' : ''}
 </span>

 {totalPages > 1 && (
 <div className="flex items-center gap-3">
 <button 
 onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
 disabled={currentPage === 1}
 className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-theme-text disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-theme-border"
 >
 <ChevronLeft size={16} />
 </button>
 <span className="text-xs font-bold text-theme-muted font-mono">
 Page <span className="text-theme-text">{currentPage}</span> of {totalPages}
 </span>
 <button 
 onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
 disabled={currentPage === totalPages}
 className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-theme-text disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-theme-border"
 >
 <ChevronRight size={16} />
 </button>
 </div>
 )}

 <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-500/80">
 <Clock size={12} /> Last Event Sync: {lastSync}
 </span>
 </div>
 </div>
 
 </div>
 );
}

