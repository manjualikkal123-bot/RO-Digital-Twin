import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { AlertTriangle } from 'lucide-react';

export default function EmergencyHaltOverlay() {
 const { isEmergencyHalted, alarms } = useAppStore();

 if (!isEmergencyHalted) return null;

 // Find the E-STOP alarm to get the timestamp and operator details
 const eStopAlarm = alarms.find(a => a.id.startsWith('AL-ESTOP-') && a.lifecycleStatus === 'Active');
 const operatorName = eStopAlarm?.acknowledgedBy || 'UNKNOWN';
 const timestamp = eStopAlarm ? new Date(eStopAlarm.date).toLocaleTimeString() : new Date().toLocaleTimeString();

 return (
 <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
 {/* Semi-transparent red overlay */}
 <div className="absolute inset-0 bg-rose-950/20 backdrop-blur-[1px] animate-pulse pointer-events-none" />
 
 {/* Central Banner */}
 <div className="bg-rose-600 border-y-4 border-rose-400 w-full py-6 shadow-[0_0_100px_rgba(225,29,72,0.8)] flex flex-col items-center justify-center relative z-10 pointer-events-auto">
 <div className="flex items-center gap-4 text-theme-text mb-2 animate-bounce">
 <AlertTriangle size={48} className="text-rose-200" />
 <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest text-theme-text drop-shadow-md">
 Emergency Stop Activated
 </h1>
 <AlertTriangle size={48} className="text-rose-200" />
 </div>
 <div className="text-xl md:text-2xl font-bold text-rose-100 uppercase tracking-[0.2em] mb-4">
 Plant Halted
 </div>
 <div className="flex gap-8 text-sm md:text-base font-medium text-rose-200 bg-rose-900/50 px-6 py-2 rounded-full border border-rose-500/50 mb-6">
 <span><strong className="text-theme-text">Time:</strong> {timestamp}</span>
 <span><strong className="text-theme-text">Operator:</strong> {operatorName}</span>
 </div>
 
 {/* Restart Button */}
 <button 
 onClick={() => useAppStore.getState().clearEmergencyStop('Admin')}
 className="bg-theme-panel hover:bg-slate-100 dark:bg-slate-800 text-theme-text px-8 py-3 rounded-lg font-black text-sm uppercase tracking-widest border border-theme-border shadow-xl transition-all hover:scale-105 active:scale-95"
 >
 RESTORE PLANT OPERATIONS
 </button>
 </div>
 </div>
 );
}
