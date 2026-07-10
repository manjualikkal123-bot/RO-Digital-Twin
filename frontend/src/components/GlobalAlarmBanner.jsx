import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import plantConfig from '../config/plant_config.json';
import { toast } from 'react-hot-toast';
import { useLocation } from 'react-router-dom';

export default function GlobalAlarmBanner() {
 const { alarms, isPlaybackMode, exitPlaybackMode, userRole, logAuditEvent } = useAppStore();
 const location = useLocation();
 const currentPath = location.pathname;
 const [isAcking, setIsAcking] = useState(false);
 const [reason, setReason] = useState('');
 const [assignee, setAssignee] = useState('Shift Supervisor');
 const [isDismissed, setIsDismissed] = useState(false);
 const [lastAlarmId, setLastAlarmId] = useState(null);

 // We only show active alarms in the banner
 const activeAlarms = alarms?.filter(a => a.lifecycleStatus === 'Active') || [];
 const hasCritical = activeAlarms.some(a => a.severity === 'CRITICAL');
 
 const mostRecentAlarm = activeAlarms[0];
 const triggerTime = mostRecentAlarm 
 ? new Date(mostRecentAlarm.date).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' IST'
 : '';

 const getElapsedDuration = (dateStr) => {
 const ms = Date.now() - new Date(dateStr).getTime();
 const mins = Math.floor(ms / 60000);
 if (mins < 1) return 'Just now';
 if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
 const hrs = Math.floor(mins / 60);
 return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
 };

 const elapsedDuration = mostRecentAlarm ? getElapsedDuration(mostRecentAlarm.date) : '';
 const operatorId = userRole === 'admin' ? 'SYS_ADMIN' : 'OP_LEAD';

 useEffect(() => {
 if (mostRecentAlarm && mostRecentAlarm.id !== lastAlarmId) {
 setIsDismissed(false);
 setLastAlarmId(mostRecentAlarm.id);
 }
 }, [mostRecentAlarm, lastAlarmId]);

 useEffect(() => {
 if (activeAlarms.length === 0 || isDismissed) return;

 let audio;
 if (hasCritical) {
 audio = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
 audio.volume = 1.0;
 audio.loop = true;
 audio.play().catch(e => console.log("Audio play blocked", e));
 } else {
 audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
 audio.volume = 0.8;
 audio.play().catch(e => console.log("Audio play blocked", e));
 }

 return () => {
 if (audio) {
 audio.pause();
 audio.currentTime = 0;
 }
 };
 }, [hasCritical, activeAlarms.length]);

 // Periodically update the elapsed time
 const [ticker, setTicker] = useState(0);
 useEffect(() => {
 const interval = setInterval(() => setTicker(t => t + 1), 60000);
 return () => clearInterval(interval);
 }, []);

 if (isPlaybackMode) {
 return (
 <div className="bg-orange-500/10 border border-orange-500/50 rounded-lg p-3 mb-6 flex items-center justify-between shadow-sm">
 <div className="flex items-center gap-3">
 <Info className="text-orange-500" size={18} />
 <span className="text-sm font-bold text-orange-400">Historical Playback Mode Active</span>
 </div>
 <button
 onClick={exitPlaybackMode}
 className="bg-orange-500 hover:bg-orange-600 text-theme-text text-xs font-bold px-4 py-1.5 rounded transition-colors shadow"
 >
 Exit to Live
 </button>
 </div>
 );
 }

 if (activeAlarms.length === 0) {
 return (
 <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-6 flex items-center gap-3 shrink-0 shadow-sm">
 <Info className="text-emerald-700 dark:text-emerald-500" size={18} />
 <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Live SCADA Status Normal: Hardware parameters currently within safe limits.</span>
 </div>
 );
 }

 if (isDismissed && activeAlarms.length > 0) {
 return (
 <div className="bg-theme-panel border border-theme-border/50 rounded-lg p-3 mb-6 flex items-center justify-between shrink-0 shadow-sm cursor-pointer hover:bg-slate-100 dark:bg-slate-80050 transition-colors" onClick={() => setIsDismissed(false)}>
 <div className="flex items-center gap-3">
 <AlertTriangle className={hasCritical ? "text-red-700 dark:text-red-500" : "text-amber-700 dark:text-amber-500"} size={16} />
 <span className="text-sm font-bold text-theme-text">{activeAlarms.length} Operational Warning{activeAlarms.length > 1 ? 's' : ''} (Hidden)</span>
 </div>
 <span className="text-xs font-bold text-cyan-700 dark:text-cyan-500 hover:text-cyan-700 dark:text-cyan-400 tracking-widest uppercase">Show Alarms</span>
 </div>
 );
 }

 const handleAcknowledge = () => {
 if (reason.trim().length >= 20) {
 const store = useAppStore.getState();
 const updatedAlarms = store.alarms.map(a => {
 if (a.lifecycleStatus === 'Active') {
 return {
 ...a,
 lifecycleStatus: 'Acknowledged',
 acknowledgedBy: operatorId,
 acknowledgedAt: new Date().toISOString()
 };
 }
 return a;
 });
 store.alarms = updatedAlarms;
 useAppStore.setState({ alarms: updatedAlarms });
 
 logAuditEvent('Alarm Acknowledged', `Acknowledged ${activeAlarms.length} alarm(s). Reason: ${reason}. Escalated to: ${assignee}`);
 toast.success(`Alarms Acknowledged. Assigned to ${assignee}.`);

 setIsAcking(false);
 setReason('');
 }
 };

 return (
 <div className={`rounded-lg p-4 mb-6 flex flex-col gap-3 shrink-0 border transition-all ${
 hasCritical ? 'bg-red-950/40 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]' : 
 'bg-amber-950/40 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
 }`}>
 <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
 <div className="flex items-center gap-2 flex-wrap">
 <AlertTriangle className={hasCritical ? 'text-red-700 dark:text-red-500 animate-pulse' : 'text-amber-700 dark:text-amber-500'} size={20} />
 <h3 className={`text-sm font-black capitalize tracking-wider ${hasCritical ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
 {hasCritical ? 'Critical plant alarms active' : 'Operational warnings active'}
 </h3>
 <span className="ml-2 text-[10px] text-theme-muted font-mono border border-theme-border px-2 py-0.5 rounded">
 Triggered: {triggerTime} ({elapsedDuration})
 </span>
 {activeAlarms.some(a => a.description.includes('PV-201')) && (
 <span className="ml-2 text-[10px] bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/40 px-2 py-0.5 rounded font-bold">
 ⚠️ 3rd occurrence this month
 </span>
 )}
 </div>
 
 {!isAcking ? (
 <div className="flex items-center gap-2">
 <button 
 onClick={() => setIsDismissed(true)}
 className="text-xs font-bold capitalize tracking-widest px-3 py-2 rounded transition-colors whitespace-nowrap shadow-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-theme-text"
 >
 Hide
 </button>
 <button 
 onClick={() => setIsAcking(true)}
 className={`text-xs font-bold capitalize tracking-widest px-4 py-2 rounded transition-colors whitespace-nowrap shadow-lg ${hasCritical ? 'bg-red-600 hover:bg-red-500 text-theme-text' : 'bg-amber-600 hover:bg-amber-500 text-theme-text'}`}
 >
 Acknowledge Alarms
 </button>
 </div>
 ) : (
 <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0 w-full xl:w-auto">
 <input 
 type="text" 
 value={operatorId}
 disabled
 className="bg-theme-main border border-theme-border text-xs px-2 py-1.5 rounded focus:outline-none w-full sm:w-28 text-theme-muted font-mono cursor-not-allowed"
 />
 <select
 value={assignee}
 onChange={e => setAssignee(e.target.value)}
 className="bg-theme-main border border-theme-border text-xs px-2 py-1.5 rounded focus:outline-none focus:border-cyan-500 text-theme-text w-full sm:w-40"
 >
 <option value="Shift Supervisor">Shift Supervisor</option>
 <option value="Maintenance Team">Maintenance Team</option>
 <option value="Process Engineer">Process Engineer</option>
 </select>
 <div className="relative w-full sm:w-64">
 <input 
 type="text" 
 placeholder="Mandatory Reason (min 20 chars)" 
 value={reason}
 onChange={(e) => setReason(e.target.value)}
 className="bg-theme-main border border-theme-border text-xs px-2 py-1.5 rounded focus:outline-none focus:border-cyan-500 w-full text-theme-text placeholder:text-theme-muted pr-12"
 />
 <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold ${reason.length >= 20 ? 'text-emerald-700 dark:text-emerald-500' : 'text-theme-muted'}`}>
 {reason.length}/20
 </span>
 </div>
 <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
 <button 
 onClick={handleAcknowledge}
 disabled={reason.trim().length < 20}
 className="flex-1 sm:flex-none text-xs font-bold capitalize tracking-widest px-4 py-1.5 rounded bg-emerald-600 text-theme-text hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-theme-muted disabled:cursor-not-allowed whitespace-nowrap shadow-md transition-colors"
 >
 Confirm
 </button>
 <button 
 onClick={() => setIsAcking(false)}
 className="flex-1 sm:flex-none text-xs font-bold capitalize px-4 py-1.5 rounded bg-slate-700 text-theme-text hover:bg-slate-600 transition-colors"
 >
 Cancel
 </button>
 </div>
 </div>
 )}
 </div>
 
 <ul className="list-disc pl-8">
 {activeAlarms.map((alarm) => {
 const plantName = plantConfig[alarm.facility]?.display_name || alarm.facility || 'Unknown Facility';
 const isPV201 = alarm.description.includes('PV-201');
 
 let descriptionHtml = alarm.description;
 if (isPV201) {
 descriptionHtml = descriptionHtml.replace('PV-201 Stage 2', '<a href="/membrane-health" class="text-cyan-700 dark:text-cyan-400 hover:text-cyan-300 underline underline-offset-2 decoration-cyan-500/50">PV-201 Stage 2</a>');
 }

 return (
 <li key={alarm.id} className={`text-sm font-bold mb-3 flex flex-col gap-1 ${alarm.severity === 'CRITICAL' ? 'text-red-300' : 'text-amber-300'}`}>
 <div className="flex items-start gap-2">
 <span>{alarm.severity} [{plantName}]: <span dangerouslySetInnerHTML={{ __html: descriptionHtml }} /></span>
 </div>
 {isPV201 && (() => {
 // Context-aware action buttons — adapt to the page the operator is already on
 const onCIP = currentPath.includes('cip');
 const onMembrane = currentPath.includes('membrane');
 const onAssetRegister = currentPath.includes('asset-register');
 return (
 <div className="flex flex-wrap gap-3 mt-1 ml-4">
 {onCIP ? (
 // User is already on the CIP page — direct action is to log or initiate a wash
 <>
 <a href="/cip-optimization" className="flex items-center gap-1.5 text-[11px] bg-theme-panel hover:bg-slate-100 dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded transition-colors shadow-sm capitalize tracking-widest no-underline">
 🧪 Log wash event
 </a>
 <a href="/membrane-health" className="flex items-center gap-1.5 text-[11px] bg-red-900/30 hover:bg-red-800/50 text-red-300 border border-red-500/40 px-3 py-1 rounded transition-colors shadow-sm capitalize tracking-widest no-underline">
 🔍 Inspect PV-201 membrane
 </a>
 </>
 ) : onMembrane ? (
 // User is already inspecting membranes — schedule is the next step
 <>
 <a href="/membrane-health" className="flex items-center gap-1.5 text-[11px] bg-theme-panel hover:bg-slate-100 dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded transition-colors shadow-sm capitalize tracking-widest no-underline">
 🔍 Inspect component
 </a>
 <button onClick={() => alert('Maintenance ticket #TKT-8842 has been automatically generated and assigned to the field service team.')} className="flex items-center gap-1.5 text-[11px] bg-red-900/30 hover:bg-red-800/50 text-red-300 border border-red-500/40 px-3 py-1 rounded transition-colors shadow-sm capitalize tracking-widest">
 📅 Schedule maintenance
 </button>
 </>
 ) : onAssetRegister ? (
 // User is on compliance page
 <>
 <a href="/process-scada" className="flex items-center gap-1.5 text-[11px] bg-theme-panel hover:bg-slate-100 dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded transition-colors shadow-sm capitalize tracking-widest no-underline">
 🔍 Verify SCADA Limits
 </a>
 <button onClick={() => toast.success('Regulatory waiver requested.')} className="flex items-center gap-1.5 text-[11px] bg-amber-900/30 hover:bg-amber-800/50 text-amber-300 border border-amber-500/40 px-3 py-1 rounded transition-colors shadow-sm capitalize tracking-widest">
 🛡️ File compliance waiver
 </button>
 </>
 ) : (
 // Generic page — both actions navigate elsewhere
 <>
 <a href="/membrane-health" className="flex items-center gap-1.5 text-[11px] bg-theme-panel hover:bg-slate-100 dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded transition-colors shadow-sm capitalize tracking-widest no-underline">
 🔍 Inspect component
 </a>
 <a href="/cip-optimization" className="flex items-center gap-1.5 text-[11px] bg-red-900/30 hover:bg-red-800/50 text-red-300 border border-red-500/40 px-3 py-1 rounded transition-colors shadow-sm capitalize tracking-widest no-underline">
 📅 Schedule CIP wash
 </a>
 </>
 )}
 </div>
 );
 })()}
 </li>
 );
 })}
 </ul>
 </div>
 );
}
