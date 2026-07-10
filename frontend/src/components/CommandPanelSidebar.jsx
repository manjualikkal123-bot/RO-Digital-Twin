import React, { useState, useEffect } from 'react';
import { X, Cpu, Send, Info, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function CommandPanelSidebar() {
 const { activeCommandPanel, closeCommandPanel, logCommand } = useAppStore();
 const [newValue, setNewValue] = useState('');
 const [reason, setReason] = useState('');
 const [operator, setOperator] = useState('AdminUser'); // Mocked operator
 const [error, setError] = useState('');

 // Reset form when panel opens with new data
 useEffect(() => {
 if (activeCommandPanel) {
 setNewValue('');
 setReason('');
 setError('');
 }
 }, [activeCommandPanel]);

 if (!activeCommandPanel) return null;

 const { tagId, label, currentValue, unit, range, aiRecommendation } = activeCommandPanel;

 const handleAcceptAI = () => {
 // Extract a number from the AI recommendation string if possible, or just mock it.
 // E.g. "Reduce feed pressure to 14.5 bar"
 const match = aiRecommendation?.match(/([0-9.]+)/);
 if (match) {
 setNewValue(match[1]);
 }
 setReason('Accepted AI Recommendation');
 };

 const handleSubmit = () => {
 if (!newValue || isNaN(newValue)) {
 setError('Please enter a valid numeric setpoint.');
 return;
 }
 const val = parseFloat(newValue);
 if (range && (val < range[0] || val > range[1])) {
 setError(`Value must be between ${range[0]} and ${range[1]} ${unit}.`);
 return;
 }
 if (!reason.trim()) {
 setError('A justification/reason is required for all manual overrides.');
 return;
 }

 logCommand({
 operator,
 tagId,
 previousValue: currentValue,
 commandedValue: val,
 unit,
 reason
 });

 closeCommandPanel();
 };

 return (
 <>
 {/* Backdrop */}
 <div 
 className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity" 
 onClick={closeCommandPanel}
 />

 {/* Sidebar */}
 <div className="fixed top-0 right-0 h-full w-[400px] bg-theme-panel border-l border-theme-border shadow-2xl z-50 flex flex-col transform transition-transform duration-300">
 <div className="flex justify-between items-center p-4 border-b border-theme-border bg-theme-panel">
 <h2 className="text-sm font-black text-cyan-700 dark:text-cyan-400 uppercase tracking-widest flex items-center gap-2">
 <Cpu size={16} /> Operator Command
 </h2>
 <button onClick={closeCommandPanel} className="text-theme-muted hover:text-theme-text transition-colors">
 <X size={20} />
 </button>
 </div>

 <div className="flex-1 overflow-y-auto p-6 space-y-6">
 {/* Header Info */}
 <div>
 <div className="text-[10px] text-theme-muted uppercase tracking-widest font-bold mb-1">Target Tag / Equipment</div>
 <div className="text-lg font-mono text-theme-text">{label} <span className="text-theme-muted text-sm">({tagId})</span></div>
 </div>

 {/* Current State */}
 <div className="bg-theme-main border border-theme-border rounded-lg p-4 flex justify-between items-center">
 <div>
 <div className="text-[10px] text-theme-muted uppercase tracking-widest font-bold mb-1">Current Value</div>
 <div className="text-2xl font-black text-theme-text">{currentValue} <span className="text-sm font-normal text-theme-muted">{unit}</span></div>
 </div>
 {range && (
 <div className="text-right">
 <div className="text-[10px] text-theme-muted uppercase tracking-widest font-bold mb-1">Allowed Range</div>
 <div className="text-sm font-mono text-theme-muted">{range[0]} - {range[1]} {unit}</div>
 </div>
 )}
 </div>

 {/* AI Recommendation */}
 {aiRecommendation && (
 <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
 <div className="flex items-start gap-2 mb-3">
 <Cpu size={16} className="text-purple-700 dark:text-purple-400 shrink-0 mt-0.5" />
 <div>
 <div className="text-[10px] text-purple-700 dark:text-purple-400 uppercase tracking-widest font-bold mb-1">AI Suggests</div>
 <div className="text-sm text-purple-200">{aiRecommendation}</div>
 </div>
 </div>
 <button 
 onClick={handleAcceptAI}
 className="w-full bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/50 text-purple-300 py-1.5 rounded text-xs font-bold uppercase tracking-widest transition-colors"
 >
 Accept AI Recommendation
 </button>
 </div>
 )}

 {/* Command Form */}
 <div className="space-y-4 pt-4 border-t border-theme-border">
 <div>
 <label className="block text-[10px] text-theme-muted uppercase tracking-widest mb-1 font-bold">New Setpoint / Commanded Value</label>
 <div className="relative">
 <input 
 type="number"
 value={newValue}
 onChange={(e) => setNewValue(e.target.value)}
 className="w-full bg-theme-main border border-theme-border rounded p-2.5 text-theme-text font-mono text-lg focus:border-cyan-500 focus:ring-1 ring-cyan-500 outline-none"
 placeholder={`e.g. ${range ? (range[0] + (range[1]-range[0])/2).toFixed(1) : '50.0'}`}
 />
 <span className="absolute right-3 top-3 text-theme-muted font-bold">{unit}</span>
 </div>
 </div>

 <div>
 <label className="block text-[10px] text-theme-muted uppercase tracking-widest mb-1 font-bold">Reason / Justification <span className="text-rose-700 dark:text-rose-400">*</span></label>
 <textarea 
 value={reason}
 onChange={(e) => setReason(e.target.value)}
 className="w-full bg-theme-main border border-theme-border rounded p-2.5 text-theme-text text-sm focus:border-cyan-500 focus:ring-1 ring-cyan-500 outline-none h-24 resize-none"
 placeholder="Enter mandatory justification for the ledger..."
 />
 </div>
 </div>

 {error && (
 <div className="flex items-start gap-2 bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-500/30 p-3 rounded-lg text-xs font-bold">
 <AlertTriangle size={14} className="shrink-0 mt-0.5" />
 {error}
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="p-4 border-t border-theme-border bg-theme-panel flex gap-3">
 <button 
 onClick={closeCommandPanel}
 className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-theme-text py-3 rounded font-bold uppercase tracking-widest text-xs transition-colors"
 >
 Cancel
 </button>
 <button 
 onClick={handleSubmit}
 className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-theme-text py-3 rounded font-black uppercase tracking-widest text-xs transition-colors shadow-lg shadow-cyan-900/50 flex items-center justify-center gap-2"
 >
 <Send size={14} /> Execute
 </button>
 </div>
 </div>
 </>
 );
}
