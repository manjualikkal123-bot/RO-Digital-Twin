import { useState, useEffect } from 'react';
import { Settings, Shield, Link as LinkIcon, AlertTriangle, RefreshCw, CheckCircle2, History, User, Activity, X, Trash2, Loader2, Database } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import GlobalAlarmBanner from '../components/GlobalAlarmBanner';
import plantConfig from '../config/plant_config.json';
import toast from 'react-hot-toast';

export default function SettingsConfig() {
 const { userRole, selectedFacility, alarmLimits, setAlarmLimits, telemetry, configLastModified, configChangeLog, updateConfigLogs } = useAppStore();
 const [activeTab, setActiveTab] = useState('thresholds');
 
 // Lifted state for staging changes before saving
 const [stagedLimits, setStagedLimits] = useState(alarmLimits);
 
 // Save Modal State
 const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
 const [saveReason, setSaveReason] = useState('');
 const [safetyPin, setSafetyPin] = useState('');
 
 // Re-sync staged limits if global limits change externally (rare)
 useEffect(() => {
 setStagedLimits(alarmLimits);
 }, [alarmLimits]);

 // Compute diffs
 const diffs = Object.keys(stagedLimits).filter(key => stagedLimits[key] !== alarmLimits[key]);
 const hasChanges = diffs.length > 0;

 const tabs = [
 { id: 'thresholds', name: 'System Thresholds', icon: <Settings size={16} /> },
 { id: 'api', name: 'API & Integration', icon: <LinkIcon size={16} /> },
 { id: 'fleet', name: 'Fleet Sync', icon: <RefreshCw size={16} /> },
 { id: 'account', name: 'Account Security', icon: <Shield size={16} /> }
 ];

 const handleUpdateStagedLimit = (key, value) => {
 setStagedLimits(prev => ({ ...prev, [key]: value }));
 };

 const handleSaveClick = () => {
 if (hasChanges) {
 setIsSaveModalOpen(true);
 setSaveReason('');
 setSafetyPin('');
 }
 };

 const handleConfirmSave = () => {
 if (safetyPin === '8899') {
 const changedKeys = Object.keys(stagedLimits).filter(k => stagedLimits[k] !== alarmLimits[k]);
 if (changedKeys.length > 0) {
 const logEntries = changedKeys.map(k => ({
 date: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
 user: userRole === 'admin' ? 'SYS_ADMIN_774' : 'OP_LEAD',
 change: `Updated ${k} ${alarmLimits[k]} → ${stagedLimits[k]}`
 }));
 updateConfigLogs(logEntries);
 }
 setAlarmLimits(stagedLimits);
 setIsSaveModalOpen(false);
 toast.success("Settings saved successfully.");
 console.log(`AUDIT: Limits updated. Reason: ${saveReason}. Approver PIN: ${safetyPin}`);
 } else {
 toast.error('Invalid Safety Officer PIN');
 }
 };

 return (
 <div className="flex-1 bg-theme-main text-slate-100 p-6 font-sans select-none flex flex-col">
 
 {/* HEADER & SESSION INFO */}
 <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-850 mb-6 shrink-0 gap-4">
 <div>
 <h1 className="text-2xl font-bold tracking-tight text-theme-text flex items-center gap-2">
 <Settings className="text-cyan-700 dark:text-cyan-500" /> Settings & Configuration
 </h1>
 <p className="text-xs text-theme-muted mt-0.5">Administrator control deck and baseline threshold management.</p>
 </div>
 <div className="flex flex-col items-end gap-2">
 <div className="flex items-center gap-4">
 <div className="flex items-center gap-2 bg-theme-panel border border-theme-border px-3 py-1.5 rounded-lg text-xs font-bold text-theme-text">
 Active Role: <span className={userRole === 'admin' ? 'text-emerald-700 dark:text-emerald-400' : 'text-theme-muted'}>{userRole === 'admin' ? 'Plant Administrator' : 'Standard Operator'}</span>
 </div>
 {userRole !== 'admin' && (
 <div className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-xs font-bold rounded-lg flex items-center gap-2">
 <AlertTriangle size={14} /> View Only Mode (Admin Required)
 </div>
 )}
 </div>
 <div className="text-[10px] text-theme-muted font-mono flex items-center gap-2 bg-theme-panel px-2 py-1 rounded border border-theme-border">
 <User size={12} className="text-cyan-700 dark:text-cyan-500" /> Account: {userRole === 'admin' ? 'SYS_ADMIN_774' : 'OP_LEAD_02'} | Session expires: 28 min
 </div>
 </div>
 </header>

 {/* GLOBAL ALARM BANNER INJECTION REMOVED: Already rendered in App.jsx */}
 
 {/* 25/75 LAYOUT GRID */}
 <div className="flex flex-col lg:flex-row gap-8 flex-1">
 
 {/* LEFT NAV (25%) */}
 <div className="w-full lg:w-1/4 shrink-0 flex flex-col gap-2">
 {tabs.map(tab => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id)}
 className={`
 flex items-center gap-3 px-4 py-3 rounded-r-lg border-l-4 text-sm font-bold transition-all duration-300 w-full text-left
 ${activeTab === tab.id 
 ? 'border-l-cyan-500 bg-theme-panel text-cyan-700 dark:text-cyan-400 shadow-[inset_0_0_10px_rgba(6,182,212,0.05)]' 
 : 'border-l-transparent text-theme-muted hover:bg-slate-100 dark:bg-slate-800 hover:text-theme-text'}
 `}
 >
 {tab.icon} {tab.name}
 </button>
 ))}
 </div>

 {/* RIGHT WORKSPACE (75%) */}
 <div className="w-full lg:w-3/4 flex flex-col bg-theme-panel border border-theme-border/80 rounded-xl overflow-hidden shadow-xl premium-card">
 
 <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
 {activeTab === 'thresholds' && (
 <SystemThresholds 
 stagedLimits={stagedLimits} 
 updateLimit={handleUpdateStagedLimit} 
 telemetry={telemetry}
 userRole={userRole}
 />
 )}
 {activeTab === 'api' && <ApiIntegration />}
 {activeTab === 'fleet' && <FleetSync selectedFacility={selectedFacility} />}
 {activeTab === 'account' && <AccountSecurity />}
 </div>

 {/* WORKSPACE PERSISTENT FOOTER */}
 <div className="border-t border-theme-border/80 p-4 bg-theme-panel flex justify-end items-center gap-4 shrink-0 sticky bottom-0 z-10">
 {(!hasChanges) && (
 <span className="text-xs text-theme-muted italic mr-2">No unsaved changes</span>
 )}
 {userRole !== 'admin' && (
 <span className="text-xs text-red-700 dark:text-red-500 italic mr-2">Admin privileges required to save</span>
 )}
 <button 
 onClick={() => setStagedLimits(alarmLimits)}
 disabled={!hasChanges}
 className="px-5 py-2 text-sm font-bold text-theme-muted hover:text-theme-text transition-colors disabled:opacity-50"
 >
 Discard Changes
 </button>
 <button 
 disabled={userRole !== 'admin' || !hasChanges}
 onClick={handleSaveClick}
 className="px-6 py-2 text-sm font-bold bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-900 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all"
 >
 Save Settings
 </button>
 </div>

 </div>
 </div>

 {/* THREE-STEP SAVE MODAL */}
 {isSaveModalOpen && (
 <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/80 backdrop-blur-sm">
 <div className="w-full max-w-xl bg-theme-panel border border-cyan-500/50 rounded-xl p-6 shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col gap-6 animate-in zoom-in-95 duration-200 premium-card">
 
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Shield className="text-cyan-700 dark:text-cyan-400" size={24} />
 <h2 className="text-lg font-bold text-theme-text tracking-wide">Authorise Configuration Change</h2>
 </div>
 <button onClick={() => setIsSaveModalOpen(false)} className="text-theme-muted hover:text-theme-text">
 <X size={20} />
 </button>
 </div>

 {/* STEP 1: DIFF PREVIEW */}
 <div>
 <h3 className="text-xs font-bold text-theme-muted uppercase tracking-widest mb-2 border-b border-theme-border pb-1">Step 1: Diff Preview</h3>
 <div className="bg-theme-main border border-theme-border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
 {diffs.map(key => (
 <div key={key} className="flex items-center justify-between text-sm">
 <span className="text-theme-text font-medium">{key}</span>
 <div className="flex items-center gap-2 font-mono">
 <span className="text-red-700 dark:text-red-400 line-through">{alarmLimits[key]}</span>
 <span className="text-theme-muted">→</span>
 <span className="text-emerald-700 dark:text-emerald-400 font-bold">{stagedLimits[key]}</span>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* STEP 2: JUSTIFICATION */}
 <div>
 <h3 className="text-xs font-bold text-theme-muted uppercase tracking-widest mb-2 border-b border-theme-border pb-1">Step 2: Justification</h3>
 <textarea 
 value={saveReason}
 onChange={(e) => setSaveReason(e.target.value)}
 placeholder="Enter engineering justification for these threshold changes..."
 className="w-full bg-theme-main border border-theme-border text-sm text-theme-text rounded-lg p-3 outline-none focus:border-cyan-500 min-h-[80px]"
 />
 </div>

 {/* STEP 3: DUAL APPROVAL */}
 <div>
 <h3 className="text-xs font-bold text-theme-muted uppercase tracking-widest mb-2 border-b border-theme-border pb-1">Step 3: Safety Officer Approval</h3>
 <div className="flex flex-col sm:flex-row gap-4 items-end">
 <div className="w-full sm:w-1/2 flex flex-col gap-1">
 <label className="text-xs text-theme-muted">Authorisation PIN</label>
 <input 
 type="password" 
 value={safetyPin}
 onChange={(e) => setSafetyPin(e.target.value)}
 placeholder="Enter 4-digit PIN"
 className="bg-theme-main border border-theme-border text-sm text-center text-theme-text rounded-lg p-2.5 outline-none focus:border-cyan-500 font-mono tracking-widest"
 />
 </div>
 <div className="w-full sm:w-1/2 flex flex-col gap-1">
 <p className="text-[10px] text-amber-700 dark:text-amber-500 font-medium leading-tight mb-1">
 By confirming, these thresholds will be immediately written to the active interlock logic engine.
 </p>
 <button 
 onClick={handleConfirmSave}
 disabled={!saveReason.trim() || safetyPin.length < 4}
 className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-theme-text text-sm font-bold rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
 >
 Confirm & Commit
 </button>
 </div>
 </div>
 </div>

 </div>
 </div>
 )}

 </div>
 );
}

// --- SUB-SECTIONS ---

function SystemThresholds({ stagedLimits, updateLimit, telemetry, userRole }) {
 const { assetGeometry } = useAppStore();

 return (
 <div className="flex flex-col gap-8 pb-10">
 
 {/* Alarm Thresholds */}
 <div>
 <div className="mb-6 border-b border-theme-border pb-2">
 <h2 className="text-lg font-bold text-theme-text flex items-center gap-2">
 <Activity className="text-amber-700 dark:text-amber-500" size={18} /> Hardware Protection Interlocks
 </h2>
 <p className="text-xs text-theme-muted mt-1">Operational safety bounds linked to the SCADA trip logic. Absolute Maximums are hardcoded equipment limits.</p>
 </div>

 <div className="space-y-6">
 <ValidationThresholdRow 
 label="Feed Pressure Max Limit" 
 paramKey="feedPressure"
 maxVal={stagedLimits.feedPressureMax} 
 marginVal={stagedLimits.feedPressureWarningMargin} 
 unit="bar"
 liveValue={telemetry?.feed_pressure}
 absoluteMax={80.0}
 updateLimit={updateLimit}
 userRole={userRole}
 />
 <ValidationThresholdRow 
 label="Membrane Delta P Max Limit" 
 paramKey="deltaP"
 maxVal={stagedLimits.deltaPMax} 
 marginVal={stagedLimits.deltaPWarningMargin} 
 unit="bar"
 liveValue={telemetry?.differential_pressure}
 absoluteMax={3.0}
 updateLimit={updateLimit}
 userRole={userRole}
 />
 </div>
 </div>

 <div className="mt-4">
 <div className="mb-6 border-b border-theme-border pb-2">
 <h2 className="text-lg font-bold text-theme-text flex items-center gap-2">
 <Shield className="text-emerald-700 dark:text-emerald-500" size={18} /> Compliance & Effluent Thresholds
 </h2>
 <p className="text-xs text-theme-muted mt-1">Regulatory bounds governing automated diversion and reporting flags.</p>
 </div>

 <div className="space-y-6">
 <ValidationThresholdRow 
 label="Electrical Conductivity (EC)" 
 paramKey="ec"
 maxVal={stagedLimits.ecMax} 
 marginVal={stagedLimits.ecWarningMargin} 
 unit="µS/cm"
 liveValue={telemetry?.conductivity}
 absoluteMax={10000}
 updateLimit={updateLimit}
 userRole={userRole}
 />
 <ValidationThresholdRow 
 label="Total Dissolved Solids (Est. = EC × 0.65)" 
 paramKey="tds"
 maxVal={stagedLimits.tdsMax} 
 marginVal={stagedLimits.tdsWarningMargin} 
 unit="mg/L"
 liveValue={telemetry?.conductivity ? telemetry.conductivity * 0.65 : null}
 absoluteMax={5000}
 updateLimit={updateLimit}
 userRole={userRole}
 />
 <ValidationThresholdRow 
 label="Chemical Oxygen Demand (COD)" 
 paramKey="cod"
 maxVal={stagedLimits.codMax} 
 marginVal={stagedLimits.codWarningMargin} 
 unit="mg/L"
 liveValue={null}
 absoluteMax={250}
 updateLimit={updateLimit}
 userRole={userRole}
 />
 <ValidationThresholdRow 
 label="Permeate pH" 
 paramKey="ph"
 maxVal={stagedLimits.phMax} 
 marginVal={stagedLimits.phWarningMargin} 
 unit=""
 liveValue={telemetry?.pH}
 absoluteMax={14.0}
 updateLimit={updateLimit}
 userRole={userRole}
 />
 </div>
 </div>

 {/* Asset Geometry */}
 <div className="border-t border-theme-border pt-8 mt-4">
 <h2 className="text-lg font-bold text-theme-text mb-1">Asset Profile & Membrane Array Geometry</h2>
 <p className="text-xs text-theme-muted mb-6">Master dimensional logic for normalization and efficiency telemetry generation.</p>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <GeometryInput label="Stage 1 Vessels" value={assetGeometry.stage1Vessels} />
 <GeometryInput label="Stage 2 Vessels" value={assetGeometry.stage2Vessels} />
 <GeometryInput label="Elements per Vessel" value={assetGeometry.elementsPerVessel} />
 <GeometryInput label="Element Area (m²)" value={assetGeometry.elementAreaM2} />
 </div>
 </div>

 </div>
 );
}

function ValidationThresholdRow({ label, paramKey, maxVal, marginVal, unit, liveValue, absoluteMax, updateLimit, userRole }) {
 const [showHistory, setShowHistory] = useState(false);
 const { configLastModified, configChangeLog } = useAppStore();
 
 // Validation Logic
 const isInvalidMargin = maxVal <= marginVal;
 const isInvalidCeiling = maxVal > absoluteMax;
 const isInvalid = isInvalidMargin || isInvalidCeiling;

 const displayLive = liveValue !== undefined && liveValue !== null ? liveValue.toFixed(1) : '--';

 return (
 <div className={`
 flex flex-col rounded-lg border transition-all duration-300 overflow-hidden
 ${isInvalid ? 'bg-red-950/20 border-red-500/50 shadow-[inset_0_0_20px_rgba(239,68,68,0.1)]' : 'bg-theme-main border-theme-border'}
 `}>
 <div className="p-4">
 <div className="flex justify-between items-center mb-4 border-b border-theme-border/50 pb-2">
 <h3 className={`text-sm font-bold ${isInvalid ? 'text-red-700 dark:text-red-400' : 'text-theme-text'}`}>{label}</h3>
 <div className="flex items-center gap-4">
 <span className="text-[10px] font-mono font-medium text-theme-muted bg-theme-panel px-2 py-1 rounded">
 Current Live: <span className="text-cyan-700 dark:text-cyan-400">{displayLive} {unit}</span>
 </span>
 {isInvalid ? (
 <span className="text-[10px] font-bold text-red-700 dark:text-red-500 uppercase tracking-widest flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
 <AlertTriangle size={12} /> {isInvalidCeiling ? `Exceeds Equipment Max (${absoluteMax} ${unit})` : 'Margin must be < Trip Limit'}
 </span>
 ) : (
 <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-500 uppercase tracking-widest flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
 <CheckCircle2 size={12} /> Valid bounds
 </span>
 )}
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <div className="flex flex-col gap-1.5">
 <label className="text-[10px] font-bold uppercase tracking-widest text-theme-muted">Trip / Max Limit</label>
 <div className="relative">
 <input 
 type="number" 
 value={maxVal}
 disabled={userRole !== 'admin'}
 onChange={(e) => updateLimit(`${paramKey}Max`, parseFloat(e.target.value) || 0)}
 className={`
 w-full bg-theme-panel text-sm font-bold rounded-md px-3 py-2 outline-none border transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
 ${isInvalidCeiling || isInvalidMargin ? 'border-red-500 text-red-700 dark:text-red-400' : 'border-theme-border text-theme-text focus:border-cyan-500'}
 ${userRole !== 'admin' && 'opacity-50 cursor-not-allowed'}
 `}
 />
 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-theme-muted pointer-events-none">{unit}</span>
 </div>
 <span className="text-[9px] text-theme-muted">Equip Rated Max: {absoluteMax} {unit}</span>
 </div>
 
 <div className="flex flex-col gap-1.5">
 <label className="text-[10px] font-bold uppercase tracking-widest text-theme-muted">Warning Margin (Below Max)</label>
 <div className="relative">
 <input 
 type="number" 
 value={marginVal}
 disabled={userRole !== 'admin'}
 onChange={(e) => updateLimit(`${paramKey}WarningMargin`, parseFloat(e.target.value) || 0)}
 className={`
 w-full bg-theme-panel text-sm font-bold rounded-md px-3 py-2 outline-none border transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
 ${isInvalidMargin ? 'border-red-500 text-red-700 dark:text-red-400' : 'border-theme-border text-amber-700 dark:text-amber-500 focus:border-cyan-500'}
 ${userRole !== 'admin' && 'opacity-50 cursor-not-allowed'}
 `}
 />
 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-theme-muted pointer-events-none">{unit}</span>
 </div>
 <span className="text-[9px] text-theme-muted">Triggers Warning State</span>
 </div>

 {/* Escalation Config */}
 <div className="flex flex-col gap-1.5">
 <label className="text-[10px] font-bold uppercase tracking-widest text-theme-muted">Escalation Notification</label>
 <select title="Escalation Notification Level" className="w-full bg-theme-panel text-xs text-theme-text rounded-md px-3 py-2.5 outline-none border border-theme-border focus:border-cyan-500 cursor-pointer">
 <option title="Level 1 (Duty Operator SMS)">L1: Duty Op SMS</option>
 <option title="Level 2 (Plant Manager Email)">L2: Plant Mgr Email</option>
 <option title="Level 3 (Corporate API Webhook)">L3: Corp Webhook</option>
 </select>
 </div>
 </div>
 </div>
 
 {/* Footer / Change History Toggle */}
 <div className="bg-theme-panel border-t border-theme-border p-2 px-4 flex justify-between items-center">
 <button 
 onClick={() => setShowHistory(!showHistory)}
 className="text-[10px] font-bold text-cyan-700 dark:text-cyan-500/80 hover:text-cyan-700 dark:text-cyan-400 uppercase tracking-widest flex items-center gap-1.5"
 >
 <History size={12} /> {showHistory ? 'Hide Change Log' : 'View Change Log'}
 </button>
 <span className="text-[10px] text-theme-muted font-mono">Last modified: {configLastModified}</span>
 </div>

 {showHistory && (
 <div className="bg-theme-panel p-4 text-xs font-mono border-t border-theme-border">
 <ul className="space-y-2">
 {(configChangeLog || []).map((log, i) => (
 <li key={i} className="flex gap-4">
 <span className="text-theme-muted whitespace-nowrap">{log.date}</span>
 <span className="text-cyan-700 dark:text-cyan-400 whitespace-nowrap w-24">{log.user}</span>
 <span className="text-theme-text">{log.change}</span>
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>
 );
}

function GeometryInput({ label, value }) {
 const { userRole } = useAppStore();
 return (
 <div className="flex flex-col gap-1.5 p-4 rounded-lg bg-theme-main border border-theme-border">
 <label className="text-xs font-bold text-theme-muted">{label}</label>
 <input 
 type="number" 
 value={value}
 disabled={userRole !== 'admin'}
 className={`w-full bg-theme-panel text-sm font-bold rounded-md px-3 py-2 outline-none border border-theme-border text-theme-text ${userRole !== 'admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
 readOnly
 />
 </div>
 );
}

function ApiIntegration() {
 return (
 <div className="flex flex-col gap-6">
 <div>
 <h2 className="text-lg font-bold text-theme-text mb-1">API & Integration Nodes</h2>
 <p className="text-xs text-theme-muted">Manage external data pipelines, SCADA uplinks, and webhook connections.</p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Node 1 */}
 <div className="bg-theme-main border border-theme-border rounded-lg p-5">
 <div className="flex justify-between items-start mb-4">
 <div>
 <h3 className="text-sm font-bold text-theme-text">Local SCADA Uplink</h3>
 <p className="text-xs text-theme-muted">WebSocket / MQTT Broker</p>
 </div>
 <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
 <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Connected</span>
 </div>
 </div>
 <div className="flex items-end justify-between mt-6">
 <div>
 <div className="text-[10px] text-theme-muted uppercase tracking-widest mb-1">Uptime</div>
 <div className="text-xl font-bold text-theme-text">99.98%</div>
 </div>
 <button className="text-xs font-bold text-theme-muted hover:text-cyan-700 dark:text-cyan-400 border border-theme-border hover:border-cyan-500/50 px-3 py-1.5 rounded transition-colors">
 Rotate Keys
 </button>
 </div>
 </div>

 {/* Node 2 */}
 <div className="bg-theme-main border border-theme-border rounded-lg p-5">
 <div className="flex justify-between items-start mb-4">
 <div>
 <h3 className="text-sm font-bold text-theme-text">ERP Sync (SAP)</h3>
 <p className="text-xs text-theme-muted">REST API Webhook</p>
 </div>
 <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
 <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Connected</span>
 </div>
 </div>
 <div className="flex items-end justify-between mt-6">
 <div>
 <div className="text-[10px] text-theme-muted uppercase tracking-widest mb-1">Uptime</div>
 <div className="text-xl font-bold text-theme-text">100.0%</div>
 </div>
 <button className="text-xs font-bold text-theme-muted hover:text-cyan-700 dark:text-cyan-400 border border-theme-border hover:border-cyan-500/50 px-3 py-1.5 rounded transition-colors">
 Rotate Keys
 </button>
 </div>
 </div>
 </div>
 </div>
 );
}

function FleetSync({ selectedFacility }) {
 return (
 <div className="flex flex-col gap-6">
 <div>
 <h2 className="text-lg font-bold text-theme-text mb-1">Fleet Sync Target</h2>
 <p className="text-xs text-theme-muted">Configure global model deployments across multiple physical facilities.</p>
 </div>
 <div className="bg-theme-main border border-theme-border rounded-lg p-8 flex flex-col items-center justify-center text-center">
 <RefreshCw size={32} className="text-theme-muted mb-4" />
 <h3 className="text-sm font-bold text-theme-text">Fleet Deployment Locked</h3>
 <p className="text-xs text-theme-muted mt-2 max-w-sm">
 Active facility <strong className="text-cyan-700 dark:text-cyan-400">{plantConfig[selectedFacility]?.display_name || selectedFacility}</strong> is currently governed by the central ML model. Local parameter overwrites are disabled to maintain fleet-wide consistency.
 </p>
 </div>

 <AmnesiaSwitch />
 </div>
 );
}

function AmnesiaSwitch() {
 const { purgeModelMemory } = useAppStore();
 const [isOpen, setIsOpen] = useState(false);
 const [confirmText, setConfirmText] = useState('');
 const [isPurging, setIsPurging] = useState(false);
 const [purgeStep, setPurgeStep] = useState(0); // 0: input, 1: DB, 2: Files, 3: Engine

 const handlePurge = async () => {
 if (confirmText !== 'DELETE') return;
 
 setIsPurging(true);
 setPurgeStep(1); // Dropping Database Records
 
 // Simulate steps for UI feedback
 setTimeout(() => setPurgeStep(2), 1000); // Deleting Weight Files
 setTimeout(() => setPurgeStep(3), 2000); // Reverting to Physics Engine

 try {
 const response = await purgeModelMemory();
 toast.success(response.message);
 } catch (e) {
 toast.error("Failed to purge model memory");
 } finally {
 setIsPurging(false);
 setIsOpen(false);
 setConfirmText('');
 setPurgeStep(0);
 }
 };

 return (
 <div className="mt-8 border-t border-theme-border pt-8">
 <div>
 <h2 className="text-lg font-bold text-red-700 dark:text-red-500 mb-1 flex items-center gap-2">
 <AlertTriangle size={18} /> Danger Zone
 </h2>
 <p className="text-xs text-theme-muted mb-4">Destructive administrative actions.</p>
 </div>

 <div className="bg-red-950/20 border border-red-500/30 rounded-lg p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
 <div>
 <h3 className="text-sm font-bold text-red-700 dark:text-red-400">Purge Model Memory & Wipe Fake Data</h3>
 <p className="text-xs text-theme-muted mt-1">
 Completely purge synthetic/fake training data from the PostgreSQL database and wipe trained model weights from the server. Reverts system back to the physics-only baseline (v0.0.0).
 </p>
 </div>
 <button 
 onClick={() => setIsOpen(true)}
 className="shrink-0 px-4 py-2 bg-red-600 hover:bg-red-500 text-theme-text text-sm font-bold rounded shadow-lg transition-colors"
 >
 Amnesia Switch
 </button>
 </div>

 {isOpen && (
 <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/80 backdrop-blur-sm">
 <div className="w-full max-w-md bg-theme-panel border border-red-500/50 rounded-xl p-6 shadow-[0_0_50px_rgba(239,68,68,0.15)] flex flex-col gap-6 animate-in zoom-in-95 duration-200 premium-card">
 <div className="flex items-center gap-3 border-b border-theme-border pb-3">
 <Trash2 className="text-red-700 dark:text-red-500" size={24} />
 <h2 className="text-lg font-bold text-theme-text tracking-wide">Confirm Data Purge</h2>
 </div>
 
 {!isPurging ? (
 <>
 <p className="text-sm text-theme-text">
 This action is irreversible. All synthetic tracks in <code className="text-red-700 dark:text-red-400 bg-red-950/50 px-1 rounded">batch_runs</code> will be dropped and active weight serialization files will be deleted.
 </p>
 <div className="flex flex-col gap-2">
 <label className="text-xs text-theme-muted font-bold uppercase tracking-widest">
 Type "DELETE" to confirm
 </label>
 <input 
 type="text" 
 value={confirmText}
 onChange={(e) => setConfirmText(e.target.value)}
 placeholder="DELETE"
 className="w-full bg-theme-main border border-theme-border focus:border-red-500 text-sm text-theme-text font-mono rounded-lg p-3 outline-none transition-colors"
 />
 </div>
 <div className="flex gap-3 justify-end mt-2">
 <button 
 onClick={() => { setIsOpen(false); setConfirmText(''); }}
 className="px-4 py-2 text-sm font-bold text-theme-muted hover:text-theme-text"
 >
 Cancel
 </button>
 <button 
 onClick={handlePurge}
 disabled={confirmText !== 'DELETE'}
 className="px-5 py-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-theme-muted text-theme-text text-sm font-bold rounded-lg transition-colors"
 >
 Execute Purge
 </button>
 </div>
 </>
 ) : (
 <div className="flex flex-col items-center py-6 gap-6">
 <Loader2 size={40} className="text-red-700 dark:text-red-500 animate-spin" />
 <div className="w-full space-y-3">
 <div className={`flex items-center justify-between text-sm ${purgeStep >= 1 ? 'text-red-700 dark:text-red-400' : 'text-theme-muted'}`}>
 <span className="flex items-center gap-2"><Database size={16}/> Dropping Database Records...</span>
 {purgeStep > 1 && <CheckCircle2 size={16} className="text-emerald-700 dark:text-emerald-500" />}
 </div>
 <div className={`flex items-center justify-between text-sm ${purgeStep >= 2 ? 'text-red-700 dark:text-red-400' : 'text-theme-muted'}`}>
 <span className="flex items-center gap-2"><Settings size={16}/> Deleting Weight Files...</span>
 {purgeStep > 2 && <CheckCircle2 size={16} className="text-emerald-700 dark:text-emerald-500" />}
 </div>
 <div className={`flex items-center justify-between text-sm ${purgeStep >= 3 ? 'text-red-700 dark:text-red-400' : 'text-theme-muted'}`}>
 <span className="flex items-center gap-2"><Activity size={16}/> Reverting to Physics Engine...</span>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 );
}

function AccountSecurity() {
 return (
 <div className="flex flex-col gap-6">
 <div>
 <h2 className="text-lg font-bold text-theme-text mb-1">User Profile Registry</h2>
 <p className="text-xs text-theme-muted">Manage identity, organization linking, and permission roles.</p>
 </div>
 <div className="bg-theme-main border border-theme-border rounded-lg p-5">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <ProfileInput label="First Name" defaultValue="Senior" />
 <ProfileInput label="Last Name" defaultValue="Operator" />
 <ProfileInput label="Organization Node" defaultValue="Permionics" disabled />
 <ProfileInput label="Role Profile" defaultValue="Plant Admin" disabled />
 </div>
 </div>
 </div>
 );
}

function ProfileInput({ label, defaultValue, disabled }) {
 return (
 <div className="flex flex-col gap-1.5">
 <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">{label}</label>
 <input 
 type="text" 
 defaultValue={defaultValue} 
 disabled={disabled}
 className={`
 w-full bg-theme-panel text-sm rounded-md px-3 py-2 outline-none border transition-colors
 ${disabled ? 'border-theme-border text-theme-muted cursor-not-allowed opacity-70' : 'border-theme-border text-theme-text focus:border-cyan-500'}
 `}
 />
 </div>
 );
}
 
 
 
 
