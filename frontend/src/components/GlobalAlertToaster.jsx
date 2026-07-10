import React, { useState, useEffect, useRef } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { AlertCircle, ArrowRight, X, Bell, BellOff } from 'lucide-react';

const GlobalAlertToaster = () => {
 const alarms = useAppStore((state) => state.alarms);
 const [showToasts, setShowToasts] = useState(true);
 const prevAlarmsLength = useRef(alarms.length);
 const navigate = useNavigate();

 useEffect(() => {
 // Only trigger toast for NEW alarms added to the beginning of the array if notifications are enabled
 if (alarms.length > prevAlarmsLength.current && showToasts) {
 const newAlarmsCount = alarms.length - prevAlarmsLength.current;
 
 // Get the newest alarms (they are unshifted, so at index 0)
 for (let i = 0; i < newAlarmsCount; i++) {
 const alarm = alarms[i];
 
 // Only toast Critical or High severity
 if (alarm.severity === 'CRITICAL' || alarm.severity === 'HIGH' || alarm.severity === 'MEDIUM') {
 // Play an audible alert using Speech Synthesis (highly reliable and industrial)
 try {
 if ('speechSynthesis' in window) {
 const text = alarm.severity === 'CRITICAL' 
 ? `Critical Alarm. ${alarm.equipmentTag}. ${alarm.description}`
 : `Warning. ${alarm.equipmentTag}. ${alarm.description}`;
 
 const msg = new SpeechSynthesisUtterance(text);
 msg.rate = 1.1;
 msg.pitch = alarm.severity === 'CRITICAL' ? 1.2 : 1.0;
 msg.volume = 1.0;
 window.speechSynthesis.speak(msg);
 }
 } catch(e) {
 console.error("Speech synthesis failed", e);
 }

 toast.custom((t) => (
 <div
 className={`${
 t.visible ? 'animate-in fade-in slide-in-from-top-4' : 'animate-out fade-out slide-out-to-top-4'
 } max-w-md w-full bg-theme-panel border border-theme-border shadow-2xl rounded-xl pointer-events-auto flex flex-col overflow-hidden`}
 >
 <div className={`h-1.5 w-full ${alarm.severity === 'CRITICAL' ? 'bg-rose-500' : alarm.severity === 'HIGH' ? 'bg-amber-500' : 'bg-blue-500'}`} />
 <div className="p-4 flex flex-col gap-3">
 <div className="flex items-start gap-3">
 <div className={`mt-0.5 ${alarm.severity === 'CRITICAL' ? 'text-rose-700 dark:text-rose-500' : alarm.severity === 'HIGH' ? 'text-amber-700 dark:text-amber-500' : 'text-blue-700 dark:text-blue-500'}`}>
 <AlertCircle size={24} />
 </div>
 <div className="flex-1">
 <h3 className="text-sm font-bold text-theme-text mb-1">{alarm.description}</h3>
 <p className="text-xs text-theme-muted">
 <span className="font-bold text-theme-text">{alarm.equipmentTag}</span> • {alarm.rootCause}
 </p>
 </div>
 <button 
 onClick={() => toast.dismiss(t.id)}
 className="text-theme-muted hover:text-theme-text transition-colors p-1"
 >
 <X size={16} />
 </button>
 </div>
 
 <div className="flex gap-2 mt-2">
 <button
 onClick={() => {
 toast.dismiss(t.id);
 navigate('/membrane-health');
 }}
 className="flex-1 flex justify-center items-center gap-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-theme-text text-xs font-bold py-2 rounded-lg transition-colors"
 >
 Membrane Health
 </button>
 <button
 onClick={() => {
 toast.dismiss(t.id);
 navigate('/alarm-ledger');
 }}
 className="flex-1 flex justify-center items-center gap-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-theme-text text-xs font-bold py-2 rounded-lg transition-colors"
 >
 Alarm Ledger
 </button>
 </div>
 </div>
 </div>
 ), { duration: 8000, position: 'top-right' });
 }
 }
 }
 
 prevAlarmsLength.current = alarms.length;
 }, [alarms, navigate, showToasts]);

 const toggleToasts = () => {
 if (showToasts) {
 toast.dismiss(); // Clear all current toasts when disabling
 }
 setShowToasts(!showToasts);
 };

 return (
 <>
 <Toaster />
 <button 
 onClick={toggleToasts}
 className={`fixed bottom-6 right-20 z-[9999] px-3 py-2 flex items-center gap-2 rounded-full text-xs font-bold shadow-xl transition-all border ${
 showToasts 
 ? 'bg-slate-100 dark:bg-slate-800 text-theme-text border-theme-border hover:bg-slate-300 dark:hover:bg-slate-700 hover:text-theme-text' 
 : 'bg-rose-500 text-theme-text border-rose-600 hover:bg-rose-600 hover:shadow-[0_0_15px_rgba(244,63,94,0.4)]'
 }`}
 title="Toggle Alarm Notifications"
 >
 {showToasts ? <Bell size={14} /> : <BellOff size={14} />}
 {showToasts ? 'Alerts On' : 'Alerts Muted'}
 </button>
 </>
 );
};

export default GlobalAlertToaster;
