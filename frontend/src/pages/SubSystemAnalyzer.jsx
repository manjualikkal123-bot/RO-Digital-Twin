import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import PlantScene3D from '../components/topology/PlantScene3D';
import TimeScrubber from '../components/TimeScrubber';
import LiveTelemetryPanel from '../components/LiveTelemetryPanel';
import { AlertTriangle, CheckCircle, Server, Activity, Wifi, ShieldAlert, Zap } from 'lucide-react';
import plantConfig from '../config/plant_config.json';
import { applyModeOverrides } from './modeLogic';
import { DATA_DICTIONARY, injectLiveTelemetry } from './mapTelemetry';

const TABS = {
 UF101: { label: 'UF-101 Pre-Treatment', count: 0 },
 RO401: { label: 'RO-401 Primary Pass', count: 0 },
 RO701: { label: 'RO-701 Sec. Recovery', count: 0 },
 ROP1001: { label: 'RO-1001 Polish', count: 0 },
};

export default function SubSystemAnalyzer() {
 const { telemetry, isPlaybackMode, setPlaybackMode, selectedFacility } = useAppStore();
 const [activeTab, setActiveTab] = useState('UF101'); 
 const [operationMode, setOperationMode] = useState('SERVICE');
 const [overpressureState, setOverpressureState] = useState({ isTripped: false, pressure: 0 });
 const [selectedEquipment, setSelectedEquipment] = useState(null);
 const [isSidebarOpen, setIsSidebarOpen] = useState(false);

 const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
 const [isDragging, setIsDragging] = useState(false);
 const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

 const handlePointerDown = (e) => {
 e.target.setPointerCapture(e.pointerId);
 setIsDragging(true);
 setDragOffset({
 x: e.clientX - panelPos.x,
 y: e.clientY - panelPos.y
 });
 };

 const handlePointerMove = (e) => {
 if (isDragging) {
 setPanelPos({
 x: e.clientX - dragOffset.x,
 y: e.clientY - dragOffset.y
 });
 }
 };

 const handlePointerUp = (e) => {
 setIsDragging(false);
 e.target.releasePointerCapture(e.pointerId);
 };



 // Reset mode to SERVICE when tab changes
 useEffect(() => {
 setOperationMode('SERVICE');
 }, [activeTab]);
 
 const getTelemetryStage = (id) => {
 if (!id || typeof id !== 'string') return null;
 let targetStage = null;
 let unit = null;
 const match = id.match(/-(\d+)/);
 if (match) {
 unit = match[1];
 const num = parseInt(unit, 10);
 if (num >= 100 && num < 400) targetStage = 'UF';
 else if (num >= 400 && num < 700) targetStage = 'RO1';
 else if (num >= 700 && num < 1000) targetStage = 'RO2';
 else if (num >= 1000 && num < 1300) targetStage = 'RO-P';
 }
 return targetStage ? { stage: targetStage, unit } : null;
 };

 const config = plantConfig[selectedFacility] || plantConfig['jetl_hyderabad'];
 
 const stageContext = getTelemetryStage(selectedEquipment);

 // ==========================================================================
 // EXPANDED DATA DICTIONARY (Includes all 19 AVs and 9 Instruments)

 // ==========================================================================
 const stageKey = activeTab.startsWith('UF') ? 'UF' : activeTab.startsWith('RO4') ? 'RO1' : activeTab.startsWith('RO7') ? 'RO2' : 'RO-P';
 const stageData = telemetry?.stages?.[stageKey];
 const data = (stageData || {
 flow_rate: null, differential_pressure: null, pH: null,
 conductivity: null, recovery_rate: null, normalized_flux: null, permeate_conductivity: null,
 differential_pressure_stage1: null, differential_pressure_stage2: null
 });

 // Apply SOP Mode Overrides
 const liveData = injectLiveTelemetry(DATA_DICTIONARY, data);
 const activeData = applyModeOverrides(liveData, activeTab, operationMode);

 if (overpressureState.isTripped) {
 TABS.RO401.count = 2;
 } else {
 TABS.RO401.count = 1;
 }

 useEffect(() => {
 if (data.flow_rate > 55) {
 setOverpressureState({ isTripped: true, pressure: data.flow_rate });
 } else if (overpressureState.isTripped && data.flow_rate < 50) {
 setOverpressureState({ isTripped: false, pressure: data.flow_rate });
 }
 }, [data.flow_rate]);

 return (
 <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 'calc(100vh - 140px)' }} className="select-none text-theme-text">
 <header className="flex items-center justify-between pb-3 border-b border-theme-border mb-3 gap-4 shrink-0">
 <div>
 <h1 className="text-xl font-bold tracking-tight text-theme-text flex items-center gap-2">
 <Server className="text-blue-700 dark:text-blue-500" size={18}/> {config.display_name} - SCADA Twin
 </h1>
 <p className="text-xs text-theme-muted">Live P&ID topology, interactive asset diagnostics, and historical playback.</p>
 </div>
 <div className="flex gap-4 bg-theme-panel border border-theme-border rounded-lg px-4 py-2 shadow-lg">
 <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-theme-muted border-r border-theme-border pr-4">
 <Wifi size={12} className={isPlaybackMode ? 'text-amber-700 dark:text-amber-500' : 'text-emerald-700 dark:text-emerald-500'} />
 Conn: <span className={`font-bold ${isPlaybackMode ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{isPlaybackMode ? 'HISTORIAN' : 'OPC-UA LIVE'}</span>
 </div>
 <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-theme-muted border-r border-theme-border pr-4">
 <Activity size={12} className="text-blue-700 dark:text-blue-500" /> Latency: <span className="text-theme-text font-bold">12ms</span>
 </div>
 <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-theme-muted">
 <Zap size={12} className="text-purple-700 dark:text-purple-500" /> Twin Health: <span className="text-purple-700 dark:text-purple-400 font-bold">99.8%</span>
 </div>
 </div>
 </header>
 
 <TimeScrubber onPlaybackToggle={setPlaybackMode} isPlaybackMode={isPlaybackMode} />
 
 <div className="flex flex-wrap mb-4 gap-2 shrink-0">
 {Object.entries(TABS).map(([key, { label, count }]) => (
 <button
 key={key}
 onClick={() => setActiveTab(key)}
 className={`
 flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all border whitespace-nowrap
 ${activeTab === key 
 ? 'bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-400' 
 : 'bg-theme-panel border-theme-border text-theme-muted hover:border-slate-300 dark:border-slate-600'}
 `}
 >
 {label}
 {count > 0 && (
 <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black ${activeTab === key ? 'bg-rose-500 text-theme-text animate-pulse' : 'bg-rose-900/50 text-rose-700 dark:text-rose-400'}`}>
 <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 shrink-0"></span> {count}
 </span>
 )}
 </button>
 ))}
 </div>

 <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 600 }}>
 <div 
 style={{ 
 flex: '1 1 0', position: 'relative', overflow: 'hidden', 
 background: '#0d1b2a', border: '1px solid #1e293b', 
 borderRadius: 12, boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.4)', minWidth: 0,
 }}
 className={overpressureState.isTripped ? 'shadow-[inset_0_0_60px_rgba(239,68,68,0.8)] animate-pulse' : ''}
 >
 <>
 <PlantScene3D 
 activeTab={activeTab} 
 data={activeData} 
 overpressureState={overpressureState} 
 onEquipmentClick={(id) => {
 setSelectedEquipment(id);
 setIsSidebarOpen(true);
 }}
 />
 
 <div className="absolute top-4 left-4 z-20 text-xs font-bold text-theme-muted uppercase tracking-widest bg-theme-panel px-3 py-1.5 rounded border border-theme-border shadow-md pointer-events-none">
 Interactive 3D Digital Twin (R3F)
 </div>
 
 <div 
 className={`absolute top-4 right-4 z-20 bg-theme-panel p-2 rounded border border-theme-border flex flex-col gap-2 ${isDragging ? 'shadow-2xl opacity-90' : 'shadow-lg'}`}
 style={{
 transform: `translate(${panelPos.x}px, ${panelPos.y}px)`,
 transition: isDragging ? 'none' : 'transform 0.1s ease-out'
 }}
 >
 <div 
 className="flex justify-between items-center mb-1 cursor-grab active:cursor-grabbing px-1 pb-1"
 onPointerDown={handlePointerDown}
 onPointerMove={handlePointerMove}
 onPointerUp={handlePointerUp}
 onPointerCancel={handlePointerUp}
 >
 <div className="text-[10px] font-black text-theme-muted uppercase tracking-widest pointer-events-none select-none">Operational Mode</div>
 <button 
 onClick={() => setIsSidebarOpen(!isSidebarOpen)}
 className="ml-4 bg-blue-600 hover:bg-blue-500 text-theme-text text-[10px] font-bold px-2 py-1 rounded"
 title={isSidebarOpen ? "Hide AI Anomaly Engine" : "Show AI Anomaly Engine"}
 >
 {isSidebarOpen ? 'HIDE PANEL ▶' : '◀ SHOW PANEL'}
 </button>
 </div>
 <div className="flex gap-1">
 {['SERVICE', 'CIP', 'FLUSHING', 'MANUAL'].concat(activeTab.startsWith('UF') ? ['AIR_SCOUR'] : []).map(m => (
 <button 
 key={m}
 onClick={() => setOperationMode(m)}
 className={`px-3 py-1.5 rounded text-[10px] font-bold transition-all ${operationMode === m ? 'bg-blue-600 text-theme-text shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'bg-slate-100 dark:bg-slate-800 text-theme-muted hover:bg-slate-300 dark:hover:bg-slate-700'}`}
 >
 {m.replace('_', ' ')}
 </button>
 ))}
 </div>
 </div>
 </>
 </div>

 {isSidebarOpen && (
 <div style={{
 width: stageContext ? 320 : 280, minWidth: stageContext ? 320 : 280, background: '#0f172a', border: '1px solid #1e293b',
 borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width 0.3s ease'
 }}>
 {stageContext ? (
 <LiveTelemetryPanel stage={stageContext} onClose={() => setSelectedEquipment(null)} />
 ) : (
 <>
 <div className="p-4 border-b border-theme-border bg-theme-panel flex justify-between items-center sticky top-0">
 <h3 className="text-xs font-bold uppercase tracking-widest text-theme-text flex items-center gap-2">
 {selectedEquipment ? <Activity className="text-blue-700 dark:text-blue-500" size={16}/> : <ShieldAlert className="text-purple-700 dark:text-purple-500" size={16}/>} 
 {selectedEquipment ? 'Live Telemetry' : 'AI Anomaly Engine'}
 </h3>
 {selectedEquipment && (
 <button 
 onClick={() => setSelectedEquipment(null)}
 className="text-theme-muted hover:text-theme-text transition-colors"
 >
 ✕
 </button>
 )}
 </div>

 <div className="p-4 space-y-4" style={{ flex: '1 1 0', overflowY: 'auto', paddingBottom: 64 }}>
 {selectedEquipment && activeData[selectedEquipment] ? (
 <div className="bg-blue-950/20 border border-blue-500/30 rounded-lg p-3">
 <span className="text-[10px] font-bold uppercase tracking-widest text-blue-700 dark:text-blue-500 block mb-2">
 {activeData[selectedEquipment].name}
 </span>
 <div className="space-y-2 mt-2 pt-2 border-t border-blue-900/50">
 {activeData[selectedEquipment].tags.map(tag => (
 <div key={tag.id} className="flex flex-col mb-2">
 <span className="text-xs text-theme-muted font-mono">{tag.id}</span>
 <div className="flex justify-between items-end">
 <span className="text-xs text-theme-text">{tag.desc}</span>
 <span className="text-sm font-bold text-theme-text font-mono">{tag.value}</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 ) : null}

 {!selectedEquipment && overpressureState.isTripped && (
 <div className="bg-rose-950/20 border border-rose-500/30 rounded-lg p-3">
 <span className="text-[10px] font-bold uppercase tracking-widest text-rose-700 dark:text-rose-500 flex items-center gap-1 mb-2">
 <AlertTriangle size={12}/> Critical Trip
 </span>
 <p className="text-sm font-bold text-theme-text">HP Pump Discharge Limit Exceeded</p>
 <div className="text-xs text-theme-muted mt-2 font-mono">
 Current: {overpressureState.pressure.toFixed(1)} bar<br/>
 Limit: 55.0 bar
 </div>
 <div className="mt-3 pt-2 border-t border-rose-900/50">
 <span className="text-[10px] font-bold uppercase tracking-widest text-theme-muted block mb-1">RCA Recommendation</span>
 <p className="text-xs text-theme-text">Decrease VFD frequency (Hz) immediately. Check for downstream blockages in PV array.</p>
 </div>
 </div>
 )}

 {!selectedEquipment && !overpressureState.isTripped && (
 <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-3">
 <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-500 flex items-center gap-1 mb-2">
 <CheckCircle size={12}/> Nominal Operation
 </span>
 <p className="text-sm font-bold text-theme-text">Pre-Treatment (UF-101)</p>
 <div className="mt-3 pt-2 border-t border-emerald-900/50">
 <p className="text-xs text-theme-text">All trans-membrane pressures within 95% confidence bounds of baseline design.</p>
 </div>
 </div>
 )}
 
 {!selectedEquipment && (
 <div className="text-[10px] text-theme-muted italic mt-4 text-center">
 Click any 3D asset to view live telemetry.
 </div>
 )}
 </div>
 </>
 )}
 </div>
 )}
 </div>
 </div>
 );
}