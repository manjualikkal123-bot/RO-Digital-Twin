import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { Activity, MapPin, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Droplets, Zap, Clock, Wifi, Server, ArrowRight, Map, List, ChevronDown, Filter, Banknote, Database } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import plantConfig from '../config/plant_config.json';

// -------------------------------------------------------------
// 1. ANIMATED VALUE COMPONENT (Teal Flash on Update)
// -------------------------------------------------------------
const AnimatedValue = ({ value, format = (v) => v, className = "" }) => {
 const [flash, setFlash] = useState(false);
 const prevValue = useRef(value);

 useEffect(() => {
 if (value !== prevValue.current) {
 setFlash(true);
 const timer = setTimeout(() => setFlash(false), 500);
 prevValue.current = value;
 return () => clearTimeout(timer);
 }
 }, [value]);

 return (
 <span className={`transition-all duration-500 ${flash ? 'text-blue-700 dark:text-blue-500 text-shadow-sm' : ''} ${className}`}>
 {format(value)}
 </span>
 );
};

// -------------------------------------------------------------
// 2. PLANT ROW & BADGE ENGINE
// -------------------------------------------------------------
const getPlantStatus = (plantType, recovery, telemetry, alarmLimits, isAlphaActive) => {
 if (isAlphaActive) {
 const isCritical = 
 (telemetry.feed_pressure !== null && telemetry.feed_pressure > alarmLimits.feedPressureMax) || 
 (telemetry.differential_pressure !== null && telemetry.differential_pressure > alarmLimits.deltaPMax) || 
 (telemetry.recovery_rate !== null && telemetry.recovery_rate < alarmLimits.minRejection);
 
 const isWarning = 
 (telemetry.differential_pressure !== null && telemetry.differential_pressure > (alarmLimits.deltaPMax - alarmLimits.deltaPWarningMargin)) ||
 (telemetry.permeate_conductivity !== null && telemetry.permeate_conductivity > 20);

 if (isCritical) {
 let rootCause = `Recovery rate critically low (${telemetry.recovery_rate?.toFixed(1) ?? '--'}%).`;
 if (telemetry.differential_pressure !== null && telemetry.differential_pressure > alarmLimits.deltaPMax) {
 rootCause = `Stage 1 Delta P limit exceeded (${telemetry.differential_pressure.toFixed(2)} bar > ${alarmLimits.deltaPMax.toFixed(2)} bar).`;
 } else if (telemetry.feed_pressure !== null && telemetry.feed_pressure > alarmLimits.feedPressureMax) {
 rootCause = `Feed Pressure max limit exceeded (${telemetry.feed_pressure.toFixed(2)} bar > ${alarmLimits.feedPressureMax.toFixed(2)} bar).`;
 }
 return { status: 'Critical', rootCause };
 }
 if (isWarning) return { status: 'Warning', rootCause: null };
 return { status: 'Optimal', rootCause: null };
 }

 if (plantType === 'CETP') {
 if (recovery !== null && recovery < 60) return { status: 'Warning', rootCause: `Recovery at ${recovery.toFixed(1)}% (Target: ~65%). Significant underperformance.` };
 return { status: 'Optimal', rootCause: null };
 }
 
 if (plantType === 'SWRO') {
 if (recovery !== null && recovery < 40) return { status: 'Warning', rootCause: `Recovery at ${recovery.toFixed(1)}% (Target: 40-50%).` };
 return { status: 'Optimal', rootCause: null };
 }

 return { status: 'Optimal', rootCause: null };
};

const PlantRow = ({ name, location, type, industry, badge, statusData, flow, recovery, cipDays, plantId, mapColorMode, tmpTrend }) => {
 const { status, rootCause } = statusData;
 const isWarning = status === 'Warning';
 const isCritical = status === 'Critical';
 
 let cipColor = 'text-theme-muted';
 if (cipDays !== null) {
 if (cipDays < 10) cipColor = 'text-red-700 dark:text-red-500';
 else if (cipDays <= 14) cipColor = 'text-amber-700 dark:text-amber-500';
 else cipColor = 'text-emerald-700 dark:text-emerald-500';
 }

 return (
 <Link to={`/dashboard/${plantId}`} className={`flex flex-col glass-panel ${isCritical ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)] z-10 relative bg-red-500/10' : isWarning ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/5 hover:border-brand-accent/50 hover:bg-slate-200/50 dark:bg-slate-800/50 hover:shadow-[0_0_20px_rgba(0,240,255,0.1)]'} p-4 transition-all cursor-pointer group`}>
 <div className="grid grid-cols-12 gap-4 items-center w-full">
 <div className="col-span-3 flex flex-col">
 {badge && (
 <span className="text-sky-700 dark:text-brand-accent text-[9px] font-black uppercase tracking-widest bg-brand-accent/10 border border-brand-accent/30 px-2 py-0.5 rounded w-fit mb-1">
 {badge}
 </span>
 )}
 <span className="text-theme-text font-black group-hover:text-sky-700 dark:text-brand-accent transition-colors flex items-center gap-2">
 {name}
 {tmpTrend && <span className={`text-[10px] ml-2 font-mono px-1.5 py-0.5 rounded border ${tmpTrend==='up'?'text-red-700 dark:text-red-400 border-red-500/30 bg-red-500/10':'text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10'}`}>{tmpTrend==='up'?'▲ TMP Rising':'▼ TMP Falling'}</span>}
 </span>
 <span className="text-theme-muted text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 mt-1" title={`${location} | ${industry}`}>
 <MapPin size={10} className="shrink-0 text-purple-700 dark:text-brand-purple" /> {location}
 </span>
 </div>

 <div className="col-span-2 flex items-center">
 {isCritical ? (
 <span className="flex items-center gap-2 text-red-700 dark:text-red-400 text-[10px] font-black uppercase tracking-wider bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
 <AlertTriangle size={14} className="animate-pulse" /> Critical
 </span>
 ) : isWarning ? (
 <span className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/30">
 <AlertTriangle size={14} /> Warning
 </span>
 ) : (
 <span className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30">
 <CheckCircle2 size={14} /> Optimal
 </span>
 )}
 </div>

 <div className="col-span-2 flex flex-col">
 <span className="text-theme-muted font-bold text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1"><Droplets size={10} className="text-sky-700 dark:text-brand-accent" /> Permeate Flow</span>
 <span className="text-theme-text font-black font-mono">
 <AnimatedValue value={flow} format={(v) => v !== null && v !== undefined ? v.toFixed(1) : '--'} /> <span className="text-theme-muted text-[10px] font-bold font-sans">m³/h</span>
 </span>
 </div>

 <div className="col-span-2 flex flex-col">
 <span className="text-theme-muted font-bold text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1"><Zap size={10} className="text-sky-700 dark:text-brand-accent" /> Recovery</span>
 <span className="text-theme-text font-black font-mono">
 <AnimatedValue value={recovery} format={(v) => v !== null && v !== undefined ? v.toFixed(1) : '--'} /> <span className="text-theme-muted text-[10px] font-bold font-sans">%</span>
 </span>
 </div>

 <div className="col-span-3 flex items-center justify-between">
 <div className="flex flex-col">
 <span className="text-theme-muted font-bold text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1"><Activity size={10} className="text-sky-700 dark:text-brand-accent" /> Predicted CIP Due</span>
 <span className={`font-black font-mono ${cipColor}`}>
 {cipDays !== null ? `${cipDays} ` : "—"}
 {cipDays !== null && <span className="text-theme-muted text-[10px] font-bold font-sans">Days</span>}
 </span>
 </div>
 <div className="text-sky-700 dark:text-brand-accent opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
 <ArrowRight size={20} />
 </div>
 </div>
 </div>
 
 {/* Root Cause Expand */}
 {(isCritical || isWarning) && rootCause && (
 <div className={`mt-4 pt-3 flex gap-2 items-start ${isCritical ? 'border-t border-red-200' : 'border-t border-amber-200'}`}>
 <AlertTriangle size={14} className={`${isCritical ? 'text-red-700 dark:text-red-500' : 'text-amber-700 dark:text-amber-500'} shrink-0 mt-0.5`} />
 <div className="flex flex-col">
 <span className={`text-[10px] font-black uppercase tracking-widest ${isCritical ? 'text-red-700 dark:text-red-500' : 'text-amber-600'}`}>
 {isCritical ? 'Root Cause Identified' : 'Underperformance Flag'}
 </span>
 <span className={`text-xs mt-0.5 font-bold ${isCritical ? 'text-red-800' : 'text-amber-800'}`}>{rootCause}</span>
 </div>
 </div>
 )}
 </Link>
 );
};

// -------------------------------------------------------------
// 3. MAIN COMPONENT
// -------------------------------------------------------------
export default function FleetCommandCenter() {
 const { telemetry, alarmLimits, selectedFacility, syncStatus, fleetData: storeFleetData, alarms } = useAppStore();
 const config = plantConfig[selectedFacility];
 const navigate = useNavigate();
 
 const snapshotTime = syncStatus?.lastSynced || "--";
 const [latency, setLatency] = useState(14);
 const sensorSync = useRef("99.8");
 
 useEffect(() => {
 // Static latency for now
 }, []);
 
 const handleClientAccess = () => {
 const code = window.prompt("Enter Secure Client Access Code (e.g., JETL-2024, NIA-2024, WAAREE-2024):");
 if (!code || !code.trim()) return;
 
 const matchedPlant = Object.values(plantConfig).find(p => p.access_code === code.trim());
 if (matchedPlant) {
 useAppStore.setState({ selectedFacility: matchedPlant.id });
 navigate(`/dashboard/${matchedPlant.id}`);
 } else {
 window.alert("Invalid Client Access Code. Access Denied.");
 }
 };

 const [viewMode, setViewMode] = useState('list');
 const [showSensorPanel, setShowSensorPanel] = useState(false);
 const [sortConfig, setSortConfig] = useState({ key: 'cipDays', dir: 'asc' });
 const [filterStatus, setFilterStatus] = useState('All');

 const activeAlarms = alarms?.filter(a => a.lifecycleStatus === 'Active') || [];

 const fleetData = storeFleetData.map((plant) => {
 const resolvedFacility =
 telemetry?.facility ??
 telemetry?.stages?.RO1?.facility ??
 null;

 const isActive =
 resolvedFacility &&
 (resolvedFacility === plant.id ||
 (resolvedFacility === 'Demo_Mode' && plant.id === 'jetl_hyderabad'));

 const plantTelemetry =
 isActive && telemetry?.stages?.RO1
 ? telemetry.stages.RO1
 : isActive
 ? telemetry
 : null;

 const isPumpOff =
 isActive &&
 plantTelemetry?.feed_pressure !== undefined &&
 plantTelemetry.feed_pressure < 2.0;

 const liveFlow = isPumpOff
 ? 0
 : isActive && plantTelemetry?.flow_rate !== undefined
 ? plantTelemetry.flow_rate
 : plant.flow_m3h;

 const liveRecovery = isPumpOff
 ? 0
 : isActive && telemetry?.plant?.recovery_rate !== undefined
 ? telemetry.plant.recovery_rate
 : isActive && plantTelemetry?.recovery_rate !== undefined
 ? plantTelemetry.recovery_rate
 : plant.recovery || 75;
 
 let top = '50%';
 let left = '50%';
 if (plant.lat && plant.lon) {
 top = `${((37 - plant.lat) / 29) * 100}%`;
 left = `${((plant.lon - 68) / 29) * 100}%`;
 }

 const plantAlarms = activeAlarms.filter(a => a.facility === plant.id || (a.facility === 'Demo_Mode' && plant.id === 'jetl_hyderabad'));
 let alarmStatus = 'Optimal';
 let alarmRootCause = null;
 if (plantAlarms.some(a => a.severity === 'CRITICAL')) {
 alarmStatus = 'Critical';
 alarmRootCause = plantAlarms.find(a => a.severity === 'CRITICAL').description;
 } else if (plantAlarms.some(a => a.severity === 'WARNING')) {
 alarmStatus = 'Warning';
 alarmRootCause = plantAlarms.find(a => a.severity === 'WARNING').description;
 }

 const baseEngStatus = isActive ? getPlantStatus(plant.plantType, liveRecovery, plantTelemetry, alarmLimits, true) : { status: 'Optimal', rootCause: null };
 let engStatus = baseEngStatus;
 if (alarmStatus === 'Critical' || (alarmStatus === 'Warning' && baseEngStatus.status !== 'Critical')) {
 engStatus = { status: alarmStatus, rootCause: alarmRootCause };
 }

 const configPlant = plantConfig[plant.id];
 const tmpTrendValue = isActive ? (plantTelemetry?.differential_pressure > configPlant?.sensor_baseline?.differential_pressure ? 'up' : 'down') : 'up';

 if (tmpTrendValue === 'up') {
 if (engStatus.status === 'Optimal' || engStatus.status === 'Healthy') {
 engStatus = { status: 'Warning', rootCause: 'TMP Rising trend detected — Delta P above baseline. Monitor closely.' };
 }
 }

 const locationShort = plant.id === 'jetl_hyderabad' ? 'Jeedimetla Industrial Estate, Hyderabad'
 : plant.id === 'nia_nandesari' ? 'GIDC Nandesari Estate, Vadodara'
 : plant.id === 'waaree_chikhli' ? 'Chikhli, Navsari, Gujarat'
 : plant.location;

 const nameShort = plant.id === 'waaree_chikhli' ? 'Waaree — Solar ETP & ZLD'
 : plant.name;

 return {
 id: plant.id,
 name: nameShort,
 fullName: plant.fullName,
 location: locationShort,
 type: plant.plantType,
 industry: plant.industry,
 effluentType: plant.effluentType,
 badge: plant.badge,
 flow: liveFlow,
 recovery: isActive && liveRecovery ? liveRecovery : (plant.rf_trend[plant.rf_trend.length-1] * 100),
 energy: isActive && plantTelemetry?.energy_kwh !== undefined ? plantTelemetry.energy_kwh : (plant.flow_m3h * 2.5),
 cipDays:
 isActive && plantTelemetry?.hoursUntilCIP != null
 ? Math.round(plantTelemetry.hoursUntilCIP / 24)
 : null, 
 statusData: engStatus,
 coordinates: { top, left },
 tmpTrend: tmpTrendValue
 };
 });

 const totalOutput = fleetData.reduce((acc, curr) => acc + (curr.flow || 0), 0);
 const fleetDesignCapacity = Object.values(plantConfig).reduce((sum, plant) => sum + (plant.capacity_kld || 0), 0) / 24; 
 const outputUtilization = fleetDesignCapacity > 0 ? ((totalOutput / fleetDesignCapacity) * 100).toFixed(1) : "0.0";

 const activeWarningsCount = fleetData.filter(p => p.statusData.status !== 'Optimal').length;
 const fleetEfficiency = (fleetData.reduce((acc, curr) => acc + curr.recovery, 0) / (fleetData.length || 1)).toFixed(1);
 
 const totalFleetEnergy = fleetData.reduce((acc, curr) => acc + (curr.energy || 0), 0);
 const dynamicFleetSEC = totalOutput > 0 ? (totalFleetEnergy / totalOutput).toFixed(2) : "0.00";

 let fleetHealth = 'Healthy';
 if (activeAlarms.some(a => a.severity === 'CRITICAL')) fleetHealth = 'Critical';
 else if (activeAlarms.some(a => a.severity === 'WARNING')) fleetHealth = 'Warning';

 const isAllSelected = selectedFacility === 'all' || !selectedFacility;
 const selectedPlantObj = isAllSelected ? null : fleetData.find(p => p.id === selectedFacility);

 let sortedFleet = [...fleetData];
 if (filterStatus !== 'All') {
 sortedFleet = sortedFleet.filter(p => p.statusData.status === filterStatus);
 }
 
 sortedFleet.sort((a, b) => {
 let valA = a[sortConfig.key];
 let valB = b[sortConfig.key];
 if (sortConfig.dir === 'desc') return valA < valB ? 1 : -1;
 return valA > valB ? 1 : -1;
 });

 return (
 <div className="flex flex-col gap-6 bg-transparent text-theme-text min-h-full font-sans select-none relative pb-10">
 
 {/* -------------------------------------------------------------
 HEADER AREA 
 ------------------------------------------------------------- */}
 <div className="flex flex-col gap-4 mb-2">
 <div className="flex justify-between items-end">
 <div>
 <h1 className="text-3xl font-black flex items-center gap-3 tracking-tight text-theme-text drop-shadow-md">
 <MapPin className="text-sky-700 dark:text-brand-accent drop-shadow-[0_0_10px_rgba(0,240,255,0.8)]" size={32} /> Global Fleet Command Center
 </h1>
 <p className="text-theme-muted text-sm mt-2 font-medium">Macro-level overview of all active desalination and water treatment assets.</p>
 </div>
 
 <div className="flex flex-col items-end gap-3">
 <div className="flex glass-panel p-1 border-white/10 text-xs">
 <button 
 className="px-4 py-1.5 rounded transition-all font-bold bg-brand-accent/20 text-sky-700 dark:text-brand-accent shadow-sm border border-brand-accent/50 shadow-[0_0_10px_rgba(0,240,255,0.2)]"
 >
 Engineering View
 </button>
 <button 
 onClick={handleClientAccess}
 className="px-4 py-1.5 rounded transition-all font-bold text-theme-muted hover:text-theme-text hover:bg-slate-200/50 dark:bg-slate-800/50"
 >
 Client View (PCB)
 </button>
 </div>
 
 {fleetHealth === 'Critical' ? (
 <div className="text-red-700 dark:text-red-400 font-black text-xs border border-red-500/50 bg-red-500/10 px-4 py-2 rounded-full flex items-center gap-2 tracking-widest uppercase shadow-[0_0_15px_rgba(239,68,68,0.2)]">
 <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,1)]"></span> FLEET CRITICAL
 </div>
 ) : fleetHealth === 'Warning' ? (
 <div className="text-amber-700 dark:text-amber-400 font-black text-xs border border-amber-500/50 bg-amber-500/10 px-4 py-2 rounded-full flex items-center gap-2 tracking-widest uppercase shadow-[0_0_15px_rgba(245,158,11,0.2)]">
 <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,1)]"></span> FLEET WARNING
 </div>
 ) : (
 <div className="text-emerald-700 dark:text-emerald-400 font-black text-xs border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 rounded-full flex items-center gap-2 tracking-widest uppercase shadow-sm">
 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,1)]"></span> FLEET HEALTHY
 </div>
 )}
 </div>
 </div>

 {/* Data Trust Strip */}
 <div className="flex flex-wrap gap-6 glass-panel px-4 py-3 w-fit relative z-20">
 <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-theme-muted font-bold">
 <Clock size={12} className="text-sky-700 dark:text-brand-accent" /> Snapshot: <span className="text-theme-text font-black font-mono">{snapshotTime}</span>
 </div>
 <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-theme-muted font-bold border-l border-white/10 pl-6">
 <Wifi size={12} className="text-sky-700 dark:text-brand-accent" /> Latency: <span className="text-theme-text font-black">{latency}ms</span>
 </div>
 <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-theme-muted font-bold border-l border-white/10 pl-6 relative">
 <Server size={12} className="text-sky-700 dark:text-brand-accent" /> Sensor Sync: 
 <button 
 onClick={() => setShowSensorPanel(!showSensorPanel)}
 className="text-sky-700 dark:text-brand-accent font-black bg-brand-accent/10 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-brand-accent/20 transition-colors border border-brand-accent/30"
 >
 {sensorSync.current}% Online <ChevronDown size={10}/>
 </button>
 
 {showSensorPanel && (
 <div className="absolute top-full left-0 mt-3 w-80 glass-panel z-50 p-4 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
 <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
 <span className="text-xs font-black text-theme-text normal-case">Sensor Diagnostics</span>
 <span className="text-[9px] bg-red-500/10 text-red-700 dark:text-red-400 px-2 py-0.5 rounded font-black border border-red-500/30">2 Offline</span>
 </div>
 <div className="flex flex-col gap-3">
 <div className="bg-slate-200/50 dark:bg-slate-800/50 border border-white/10 p-2.5 rounded-lg flex flex-col gap-1">
 <span className="text-xs font-bold text-theme-text normal-case">Filter 3 Turbidity</span>
 <span className="text-[10px] font-bold text-theme-muted normal-case">Beta Chemical RO</span>
 <span className="text-[9px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-500/10 w-fit px-1.5 py-0.5 rounded mt-1 border border-emerald-500/30">No KPI Impact</span>
 </div>
 <div className="bg-slate-200/50 dark:bg-slate-800/50 border border-white/10 p-2.5 rounded-lg flex flex-col gap-1">
 <span className="text-xs font-bold text-theme-text normal-case">Brine Flow Transmitter</span>
 <span className="text-[10px] font-bold text-theme-muted normal-case">Alpha ETP</span>
 <span className="text-[9px] text-amber-700 dark:text-amber-400 font-bold bg-amber-500/10 w-fit px-1.5 py-0.5 rounded mt-1 border border-amber-500/30">Recalculating Recovery via Mass Balance</span>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* -------------------------------------------------------------
 KPI RIBBON 
 ------------------------------------------------------------- */}
 <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
 
 <div className="glass-panel p-5 flex flex-col justify-center hover:shadow-[0_0_20px_rgba(0,240,255,0.1)] transition-shadow">
 <span className="text-theme-muted font-bold text-[10px] uppercase tracking-widest mb-2">
 {isAllSelected ? "Total Facilities" : "Plant Capacity"}
 </span>
 <span className="text-3xl font-black text-theme-text drop-shadow-md">
 {isAllSelected ? fleetData.length : (config?.capacity_kld ? `${config.capacity_kld} KLD` : '-- KLD')}
 </span>
 </div>
 
 <div className="glass-panel p-5 flex flex-col justify-center hover:shadow-[0_0_20px_rgba(0,240,255,0.1)] transition-shadow relative overflow-hidden">
 <span className="text-theme-muted font-bold text-[10px] uppercase tracking-widest mb-1">
 {isAllSelected ? "Total Fleet Output" : "Permeate Flow"}
 </span>
 <div className="flex items-baseline gap-2">
 <span className="text-3xl font-black text-sky-700 dark:text-brand-accent font-mono drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]">
 <AnimatedValue value={isAllSelected ? totalOutput : selectedPlantObj?.flow || 0} format={(v) => v.toFixed(1)} />
 </span>
 <span className="text-xs font-bold text-blue-700 dark:text-blue-500">m³/h</span>
 </div>
 {isAllSelected && (
 <span className="text-[10px] font-bold text-theme-muted mt-1">{totalOutput.toFixed(1)} of {fleetDesignCapacity.toFixed(0)} m³/h — <span className="text-sky-700 dark:text-brand-accent/80">{outputUtilization}% Util</span></span>
 )}
 <div className="absolute top-4 right-4 text-sky-700 dark:text-brand-accent bg-brand-accent/10 p-1.5 rounded-full border border-brand-accent/30 shadow-[0_0_10px_rgba(0,240,255,0.2)]">
 <TrendingUp size={16} />
 </div>
 </div>
 
 <div className="glass-panel p-5 flex flex-col justify-center hover:shadow-[0_0_20px_rgba(180,101,255,0.1)] transition-shadow relative overflow-hidden">
 <span className="text-theme-muted font-bold text-[10px] uppercase tracking-widest mb-1">Specific Energy & OPEX</span>
 <div className="text-[10px] text-theme-muted font-black tracking-widest uppercase">Fleet SEC (Avg)</div>
 <div className="flex items-baseline gap-2">
 <span className="text-3xl font-black text-purple-700 dark:text-brand-purple font-mono drop-shadow-[0_0_8px_rgba(180,101,255,0.5)]">
 {isAllSelected ? "2.51" : ((telemetry?.stages?.['RO1']?.energy_kwh && telemetry?.stages?.['RO1']?.flow_rate) ? (telemetry.stages['RO1'].energy_kwh / telemetry.stages['RO1'].flow_rate).toFixed(2) : "2.51")}
 </span>
 <span className="text-xs font-bold text-purple-700 dark:text-brand-purple/80">kWh/m³ (Est.)</span>
 </div>
 <span className="text-[10px] font-bold text-theme-muted mt-1">{isAllSelected ? "Fleet Avg Cost:" : "Current Target Cost:"} <span className="text-emerald-700 dark:text-emerald-400">₹29.00/m³ (est.)</span></span>
 <div className="absolute top-4 right-4 text-purple-700 dark:text-brand-purple bg-brand-purple/10 p-1.5 rounded-full border border-brand-purple/30 shadow-[0_0_10px_rgba(180,101,255,0.2)]">
 <Banknote size={16} />
 </div>
 </div>

 {/* Actionable Warnings Widget */}
 <Link to={`/dashboard/${isAllSelected ? selectedFacility : selectedPlantObj?.id}`} className={`glass-panel ${(isAllSelected ? activeWarningsCount > 0 : selectedPlantObj?.statusData?.status !== 'Optimal') ? 'border-amber-500/50 hover:bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'border-white/5 hover:border-brand-accent/50'} p-5 flex flex-col justify-center hover:shadow-[0_0_20px_rgba(0,240,255,0.1)] transition-all cursor-pointer group`}>
 <div className="flex justify-between items-start">
 <span className="text-theme-muted font-bold text-[10px] uppercase tracking-widest mb-2 group-hover:text-theme-text transition-colors">Actionable Flags</span>
 {(isAllSelected ? activeWarningsCount > 0 : selectedPlantObj?.statusData?.status !== 'Optimal') && <ArrowRight size={14} className="text-amber-700 dark:text-amber-400 opacity-100 transition-opacity" />}
 </div>
 <span className={`text-3xl font-black drop-shadow-md ${(isAllSelected ? activeWarningsCount > 0 : selectedPlantObj?.statusData?.status !== 'Optimal') ? ((isAllSelected ? fleetHealth==='Critical' : selectedPlantObj?.statusData?.status === 'Critical')?'text-red-700 dark:text-red-400':'text-amber-700 dark:text-amber-400') : 'text-emerald-700 dark:text-emerald-400'}`}>
 {isAllSelected ? activeWarningsCount : (selectedPlantObj?.statusData?.status !== 'Optimal' ? 1 : 0)}
 </span>
 {isAllSelected && activeWarningsCount > 0 && (
 <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 mt-1 line-clamp-1 truncate">
 {fleetData.filter(p=>p.statusData.status!=='Optimal').map(p=>p.name).join(', ')} flagged.
 </span>
 )}
 {!isAllSelected && selectedPlantObj && selectedPlantObj?.statusData?.status !== 'Optimal' && (
 <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 mt-1" style={{display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
 {selectedPlantObj?.statusData?.rootCause || 'Flagged for review.'}
 </span>
 )}
 </Link>
 
 <div className={`glass-panel ${(isAllSelected ? fleetHealth !== 'Healthy' : selectedPlantObj?.statusData?.status !== 'Optimal') ? 'border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'border-white/5'} p-5 flex flex-col justify-center relative overflow-hidden hover:shadow-[0_0_20px_rgba(0,240,255,0.1)] transition-shadow`}>
 <span className="text-theme-muted font-bold text-[10px] uppercase tracking-widest mb-1">{isAllSelected ? "Fleet Thermo Efficiency" : "Thermo Efficiency"}</span>
 <div className="flex items-baseline gap-2">
 <span className={`text-3xl font-black font-mono drop-shadow-md ${(isAllSelected ? fleetHealth !== 'Healthy' : selectedPlantObj?.statusData?.status !== 'Optimal') ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
 {!isAllSelected && selectedPlantObj?.recovery ? selectedPlantObj.recovery.toFixed(1) : fleetEfficiency}
 </span>
 <span className={`text-xs font-bold ${(isAllSelected ? fleetHealth !== 'Healthy' : selectedPlantObj?.statusData?.status !== 'Optimal') ? 'text-amber-700 dark:text-amber-500/80' : 'text-emerald-700 dark:text-emerald-500/80'}`}>%</span>
 </div>
 <span className="text-[10px] font-bold text-theme-muted mt-1">Target: 78% (Est.) | Last Wk: <span className="text-amber-700 dark:text-amber-400/80">79.5% (Est.)</span></span>
 <div className={`absolute top-4 right-4 p-1.5 rounded-full border ${(isAllSelected ? fleetHealth !== 'Healthy' : selectedPlantObj?.statusData?.status !== 'Optimal') ? 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30'} shadow-[0_0_10px_rgba(16,185,129,0.2)]`}>
 <TrendingDown size={16} />
 </div>
 </div>
 </div>

 {/* -------------------------------------------------------------
 FLEET VIEW CONTROLS 
 ------------------------------------------------------------- */}
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mt-2">
 <h2 className="text-[10px] font-bold text-sky-700 dark:text-brand-accent tracking-widest uppercase ml-1 flex items-center gap-2">
 <Database size={14} /> Active Fleet Operations
 </h2>
 
 <div className="flex items-center gap-2 glass-panel p-1 text-xs font-bold">
 <button 
 onClick={() => setViewMode('list')}
 className={`flex items-center gap-2 px-4 py-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-brand-accent/20 text-sky-700 dark:text-brand-accent shadow-[inset_0_0_10px_rgba(0,240,255,0.2)]' : 'text-theme-muted hover:text-theme-text'}`}
 >
 <List size={14} /> List View
 </button>
 <button 
 onClick={() => setViewMode('map')}
 className={`flex items-center gap-2 px-4 py-1.5 rounded transition-all ${viewMode === 'map' ? 'bg-brand-accent/20 text-sky-700 dark:text-brand-accent shadow-[inset_0_0_10px_rgba(0,240,255,0.2)]' : 'text-theme-muted hover:text-theme-text'}`}
 >
 <Map size={14} /> Global Map
 </button>
 </div>
 </div>

 {/* -------------------------------------------------------------
 MAIN CONTENT AREA (LIST OR MAP)
 ------------------------------------------------------------- */}
 {viewMode === 'list' ? (
 <div className="flex flex-col gap-4">
 
 {/* SORT & FILTER BAR */}
 <div className="glass-panel p-3 flex justify-between items-center text-xs">
 <div className="flex items-center gap-3">
 <span className="text-theme-muted font-bold uppercase tracking-widest text-[9px] flex items-center gap-1"><Filter size={12}/> Filter:</span>
 {['All', 'Optimal', 'Warning', 'Critical'].map(st => (
 <button 
 key={st}
 onClick={() => setFilterStatus(st)}
 className={`px-3 py-1.5 rounded-full font-black transition-colors ${filterStatus === st ? 'bg-brand-accent/20 text-sky-700 dark:text-brand-accent border border-brand-accent/50' : 'text-theme-muted hover:text-theme-text bg-slate-200/50 dark:bg-slate-800/50 hover:bg-slate-200 dark:bg-slate-800 border border-transparent'}`}
 >
 {st}
 </button>
 ))}
 </div>
 
 <div className="flex items-center gap-3">
 <span className="text-theme-muted font-bold uppercase tracking-widest text-[9px]">Sort By:</span>
 <select 
 value={sortConfig.key}
 onChange={(e) => setSortConfig({ ...sortConfig, key: e.target.value })}
 className="bg-slate-200 dark:bg-slate-800 border border-white/10 text-theme-text font-bold rounded-lg px-2 py-1.5 outline-none focus:border-brand-accent"
 >
 <option value="name">Name</option>
 <option value="flow">Flow Rate</option>
 <option value="recovery">Recovery</option>
 <option value="cipDays">CIP Due</option>
 </select>
 <button 
 onClick={() => setSortConfig({ ...sortConfig, dir: sortConfig.dir === 'asc' ? 'desc' : 'asc' })}
 className="bg-slate-200/50 dark:bg-slate-800/50 text-theme-text hover:text-theme-text hover:bg-slate-200 dark:bg-slate-800 p-1.5 rounded-lg border border-white/10 transition-colors"
 >
 {sortConfig.dir === 'asc' ? '↑' : '↓'}
 </button>
 </div>
 </div>

 {/* LIST RENDER */}
 <div className="flex flex-col gap-3">
 {sortedFleet.map((plant) => (
 <PlantRow tmpTrend={plant.tmpTrend} 
 key={plant.id}
 name={plant.name} 
 location={plant.location} 
 type={plant.type}
 industry={plant.industry}
 badge={plant.badge}
 statusData={plant.statusData} 
 flow={plant.flow} 
 recovery={plant.recovery} 
 cipDays={plant.cipDays} 
 plantId={plant.id} 
 />
 ))}
 {sortedFleet.length === 0 && (
 <div className="text-center py-10 text-theme-muted font-bold text-sm bg-theme-panel border border-theme-border rounded-xl shadow-sm premium-card">No facilities match the selected filter.</div>
 )}
 </div>
 </div>
 ) : (
 /* MAP RENDER (Leaflet) */
 <div className="bg-theme-main border-2 border-theme-border rounded-xl relative overflow-hidden shadow-xl block w-full" style={{ height: '500px', minHeight: '500px' }}>
 
 <div className="absolute top-4 left-4 bg-theme-panel backdrop-blur-md border border-theme-border p-3 rounded-xl shadow-lg z-[1000] premium-card">
 <h3 className="text-xs font-black text-theme-text mb-2 uppercase tracking-widest">Fleet Geographic Status</h3>
 <div className="flex flex-col gap-1 text-[10px] font-bold text-theme-muted">
 <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm"></span> Critical</span>
 <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm"></span> Warning</span>
 <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></span> Optimal</span>
 </div>
 </div>

 <MapContainer center={[20.0, 76.0]} zoom={5} style={{ height: '500px', width: '100%', background: '#e2e8f0', zIndex: 1 }}>
 <TileLayer
 url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
 attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
 />
 {fleetData.map(plant => {
 const configPlant = plantConfig[plant.id] || {};
 const coords = configPlant.coordinates || { lat: 20.0, lon: 76.0 };
 const activeStatus = plant.statusData.status;
 const color = activeStatus === 'Critical' ? '#ef4444' : activeStatus === 'Warning' ? '#f59e0b' : '#10b981';
 
 const customIcon = L.divIcon({
 className: 'custom-leaflet-icon',
 html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3);"></div>`,
 iconSize: [20, 20],
 iconAnchor: [10, 10]
 });

 return (
 <Marker 
 key={plant.id} 
 position={[coords.lat, coords.lon]} 
 icon={customIcon}
 eventHandlers={{ click: () => useAppStore.setState({ selectedFacility: plant.id }) }}
 >
 <Popup>
 <div className="text-xs font-black text-theme-text mb-1">{plant.name}</div>
 <div className="text-[10px] font-bold text-theme-muted mb-2 truncate max-w-[150px]">{plant.location}</div>
 <div className="flex gap-4 text-[10px] font-black text-blue-600 bg-blue-50 p-2 rounded-lg border border-blue-100">
 <div>Flow: {plant.flow.toFixed(1)}</div>
 <div>Rec: {plant.recovery.toFixed(1)}%</div>
 </div>
 </Popup>
 </Marker>
 );
 })}
 </MapContainer>
 </div>
 )}

 </div>
 );
}
