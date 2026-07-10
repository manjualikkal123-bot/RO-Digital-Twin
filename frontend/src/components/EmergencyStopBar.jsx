import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertOctagon } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function EmergencyStopBar() {
 const { isEmergencyHalted, triggerEmergencyStop, userRole, logAuditEvent } = useAppStore();
 const [showModal, setShowModal] = useState(false);
 const [password, setPassword] = useState('');
 const [error, setError] = useState('');
 const [scope, setScope] = useState('Entire Plant');
 const [failedAttempts, setFailedAttempts] = useState(0);
 const [lockoutUntil, setLockoutUntil] = useState(0);

 useEffect(() => {
 let interval;
 if (lockoutUntil > Date.now()) {
 interval = setInterval(() => {
 if (Date.now() > lockoutUntil) {
 setLockoutUntil(0);
 setFailedAttempts(0);
 setError('');
 } else {
 setError(`Locked out. Try again in ${Math.ceil((lockoutUntil - Date.now()) / 1000)}s`);
 }
 }, 1000);
 }
 return () => clearInterval(interval);
 }, [lockoutUntil]);

 useEffect(() => {
 const handleKeyDown = (e) => {
 if (e.key === 'Escape' && showModal) {
 setShowModal(false);
 setPassword('');
 setError('');
 }
 };
 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, [showModal]);

 if (isEmergencyHalted) return null; // Overlay takes over

 const operatorId = userRole === 'admin' ? 'SYS_ADMIN' : 'OP_LEAD';

 const handleStop = () => {
 if (lockoutUntil > Date.now()) return;
 
 if (password !== '1234') {
 const newFails = failedAttempts + 1;
 setFailedAttempts(newFails);
 if (newFails >= 3) {
 setLockoutUntil(Date.now() + 30000);
 setError(`Locked out. Try again in 30s`);
 } else {
 setError(`Invalid password. ${3 - newFails} attempts remaining.`);
 }
 return;
 }
 
 triggerEmergencyStop(operatorId, `Manual Override - Scope: ${scope}`);
 logAuditEvent('E-Stop Triggered', `Plant halted by ${operatorId}. Scope: ${scope}. Auth: Password verified.`);
 
 setShowModal(false);
 setPassword('');
 setError('');
 setFailedAttempts(0);
 };

 const handleClose = () => {
 setShowModal(false);
 setPassword('');
 setError('');
 };

 return (
 <>
 <div className="w-full flex-shrink-0 h-12 bg-theme-panel border-b border-rose-900/50 z-40 flex items-center justify-between px-6 shadow-md shadow-rose-900/20 relative">
 <div className="flex items-center gap-4 text-rose-700 dark:text-rose-500 font-bold uppercase tracking-widest text-xs">
 <ShieldAlert size={16} />
 <span>Layer 1: Plant Safety Controls</span>
 </div>
 <button 
 onClick={() => setShowModal(true)}
 className="bg-rose-600 hover:bg-rose-500 text-theme-text px-6 py-1.5 rounded-sm font-black text-sm capitalize tracking-widest flex items-center gap-2 shadow-[0_0_15px_rgba(225,29,72,0.6)] transition-all hover:scale-105 active:scale-95 border border-rose-400"
 >
 <AlertOctagon size={18} />
 Emergency Stop
 </button>
 </div>

 {showModal && (
 <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm">
 <div 
 className="bg-theme-panel border-2 border-rose-500 rounded-xl max-w-md w-full p-6 shadow-[0_0_50px_rgba(225,29,72,0.4)] premium-card"
 onClick={(e) => e.stopPropagation()} // Prevent any clicks inside from bubbling if we ever added an outer listener
 >
 <div className="flex items-center gap-3 text-rose-700 dark:text-rose-500 mb-4">
 <AlertOctagon size={32} />
 <h2 className="text-xl font-black capitalize tracking-widest">Initiate E-Stop</h2>
 </div>
 
 <p className="text-sm text-theme-text mb-6 font-medium">
 You are about to initiate a plant halt. This will trip main breakers and close automated isolation valves for the selected scope.
 </p>

 <div className="space-y-4 mb-6">
 <div className="bg-rose-950/30 p-3 rounded border border-rose-900/50 flex flex-col gap-3">
 
 <div>
 <label className="block text-[10px] text-rose-700 dark:text-rose-400 capitalize tracking-widest mb-1 font-bold">
 Target Scope
 </label>
 <select 
 value={scope}
 onChange={e => setScope(e.target.value)}
 className="w-full bg-rose-950/50 border border-rose-500 rounded p-2 text-theme-text text-sm font-bold outline-none focus:ring-2 ring-rose-500"
 >
 <option value="Entire Plant">Entire Plant (Global Halt)</option>
 <option value="RO Stage 1">RO Stage 1</option>
 <option value="RO Stage 2">RO Stage 2</option>
 <option value="UF Skids">UF Skids</option>
 </select>
 </div>

 <div>
 <label className="block text-[10px] text-rose-700 dark:text-rose-400 capitalize tracking-widest mb-1 font-bold">
 Operator Identity
 </label>
 <input 
 type="text" 
 value={operatorId}
 disabled
 className="w-full bg-theme-panel border border-theme-border rounded p-2 text-theme-muted text-sm font-black outline-none cursor-not-allowed"
 />
 </div>

 <div>
 <label className="block text-[10px] text-rose-700 dark:text-rose-400 capitalize tracking-widest mb-1 font-bold">
 Enter Password to authorize
 </label>
 <input 
 type="password" 
 value={password}
 onChange={e => setPassword(e.target.value)}
 disabled={lockoutUntil > Date.now()}
 className="w-full bg-rose-950/50 border border-rose-500 rounded p-2 text-theme-text text-sm font-black text-center tracking-widest outline-none focus:ring-2 ring-rose-500 disabled:opacity-50"
 />
 </div>
 </div>
 </div>

 {error && <div className="text-rose-700 dark:text-rose-400 text-xs font-bold mb-4">{error}</div>}

 <div className="flex gap-3">
 <button 
 onClick={handleClose}
 className="flex-1 bg-slate-600 hover:bg-theme-main0 text-theme-text py-2.5 rounded font-bold capitalize tracking-widest text-sm transition-colors"
 >
 Cancel
 </button>
 <button 
 onClick={handleStop}
 disabled={!password || lockoutUntil > Date.now()}
 className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-900 disabled:text-rose-700 dark:text-rose-400/50 text-theme-text py-2.5 rounded font-black capitalize tracking-widest text-sm transition-colors shadow-lg shadow-rose-900/50"
 >
 Execute Stop
 </button>
 </div>
 </div>
 </div>
 )}
 </>
 );
}
