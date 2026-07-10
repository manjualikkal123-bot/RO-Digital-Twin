import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { RefreshCcw, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SyncIndicator() {
 const { syncStatus } = useAppStore();

 if (syncStatus.status === 'Idle' || !syncStatus.lastSynced) return null;

 const isError = syncStatus.status === 'Error';

 return (
 <div className={`fixed bottom-4 left-4 z-[50] px-4 py-2 rounded-full border shadow-2xl flex items-center gap-2 transition-all ${isError ? 'bg-red-950/90 border-red-500/50 text-red-700 dark:text-red-400 animate-pulse' : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-700 dark:text-emerald-400'}`}>
 {isError ? (
 <AlertCircle size={14} className="text-red-700 dark:text-red-500" />
 ) : (
 <CheckCircle2 size={14} className="text-emerald-700 dark:text-emerald-500" />
 )}
 <div className="flex flex-col">
 {isError ? (
 <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Sync Error (Retrying in 5s)</span>
 ) : (
 <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Last Synced: {syncStatus.lastSynced}</span>
 )}
 </div>
 </div>
 );
}
