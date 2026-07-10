import React from 'react';
import { Zap, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function OperatorCommandButton({ tagId, label, currentValue, unit, range, aiRecommendation = null, className = '' }) {
 const { sensorFaults, openCommandPanel, isEmergencyHalted } = useAppStore();
 
 const isFault = sensorFaults[tagId]?.isFault;

 const handleClick = (e) => {
 e.stopPropagation(); // prevent card clicks
 if (isFault || isEmergencyHalted) return;
 openCommandPanel({ tagId, label, currentValue, unit, range, aiRecommendation });
 };

 if (isFault) {
 return (
 <button 
 disabled
 className={`flex items-center gap-1.5 px-2 py-1 rounded bg-amber-900/30 border border-amber-500/50 text-amber-700 dark:text-amber-500 text-[9px] uppercase tracking-widest font-bold cursor-not-allowed opacity-80 ${className}`}
 title="SENSOR FAULT: Commands Disabled"
 >
 <AlertTriangle size={12} /> Fault
 </button>
 );
 }

 return (
 <button 
 onClick={handleClick}
 disabled={isEmergencyHalted}
 className={`flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-cyan-900/50 border border-theme-border hover:border-cyan-500/50 text-cyan-700 dark:text-cyan-400 hover:text-cyan-300 transition-colors text-[9px] uppercase tracking-widest font-bold disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
 title={isEmergencyHalted ? "Commands disabled during E-STOP" : "Manual Override / Command"}
 >
 <Zap size={12} className={!isEmergencyHalted ? "animate-pulse" : ""} /> Cmd
 </button>
 );
}
