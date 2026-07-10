import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Bot, User, ChevronRight, Maximize2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import plantConfig from '../config/plant_config.json';

const fmt = (v, d = 1) => (v != null ? Number(v).toFixed(d) : '--');
const now = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

const ADMIN_CHIPS = [
 'Which plant needs attention right now?',
 'What is the RO differential pressure trend?',
 'Is UF-201 supposed to be on standby?',
 'Summarise the last 24 hours',
 'Which plant has the worst membrane health?',
];

const CLIENT_CHIPS = [
 'Is my plant compliant with PCB limits today?',
 'When is my next maintenance visit?',
 'Why is UF-201 showing as standby?',
 'How has my plant performed this month?',
 'What does differential pressure mean?',
];

function buildSystemPrompt({ config, telemetry, userRole, selectedFacility, alarms }) {
 const ts = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
 const dp = fmt(telemetry?.differential_pressure ?? 0.6, 2);
 const fp = fmt(telemetry?.feed_pressure ?? 11.9, 1);
 const fl = fmt(telemetry?.flow_rate ?? 3.7, 1);
 const uff = fmt(telemetry?.feed_tank_level ?? 70.5, 1);
 const rof = fmt(telemetry?.ro_feed_tank_level ?? 68.9, 1);
 const activeAlarms = alarms?.filter(a => a.lifecycleStatus === 'Active').map(a => a.description).join('; ') || 'None';

 return `You are the Permionics Digital Twin AI Assistant for ETP/RO plants managed by Permionics Membranes Pvt. Ltd., Vadodara, India.

CURRENT USER ROLE: ${userRole ?? 'admin'}
SELECTED PLANT: ${config?.display_name ?? 'JETL — Jeedimetla ETP'} (${selectedFacility})
TIMESTAMP: ${ts} IST

LIVE DATA:
 UF-101: Flow ${fl} M³/HR | DP ${dp} BAR | Feed Tank ${uff}% | RUNNING
 UF-201: STANDBY | UF-301: STANDBY
 RO-401: HP Pressure ${fp} BAR | Feed Tank ${rof}%
 ACTIVE ALARMS: ${activeAlarms}

RULES:
1. Use only the live data above. Never fabricate numbers.
2. Client role = plain language only. Admin role = full technical detail allowed.
3. Keep answers to 3-5 sentences unless asked for more.
4. Cannot control equipment — observation only.
5. End with one helpful follow-up question.`;
}

export default function FloatingAIOrb() {
 const { selectedFacility, telemetry, userRole, alarms, aiMessages, setAiMessages } = useAppStore();
 const config = plantConfig[selectedFacility] || plantConfig['jetl_hyderabad'];
 const chips = userRole === 'client' ? CLIENT_CHIPS : ADMIN_CHIPS;

 const [open, setOpen] = useState(false);
 const [input, setInput] = useState('');
 const [isLoading, setIsLoading] = useState(false);
 const [showChips, setShowChips] = useState(true);
 const panelRef = useRef(null);
 const chatEndRef = useRef(null);
 const inputRef = useRef(null);

 // Close on outside click
 useEffect(() => {
 const handler = (e) => {
 if (open && panelRef.current && !panelRef.current.contains(e.target)) {
 setOpen(false);
 }
 };
 document.addEventListener('mousedown', handler);
 return () => document.removeEventListener('mousedown', handler);
 }, [open]);

 // Auto-scroll
 useEffect(() => {
 chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
 }, [aiMessages, isLoading, open]);

 // Welcome message on first open if no history
 useEffect(() => {
 if (open && (!aiMessages || aiMessages.length === 0)) {
 const fl = fmt(telemetry?.flow_rate ?? 3.7, 1);
 const fp = fmt(telemetry?.feed_pressure ?? 11.9, 1);
 const welcome = `Hello! I'm the Permionics AI Assistant.\n\n${config.display_name} has UF-101 running at ${fl} M³/HR with RO at ${fp} BAR. UF-201 and UF-301 are on standby.\n\nWhat would you like to know?`;
 setAiMessages([{ role: 'assistant', content: welcome, ts: now() }]);
 }
 if (open) setTimeout(() => inputRef.current?.focus(), 100);
 }, [open]); // eslint-disable-line

 const sendMessage = async (text) => {
 const msg = (text || input).trim();
 if (!msg) return;
 setInput('');
 setShowChips(false);

 const userMsg = { role: 'user', content: msg, ts: now() };
 const nextMessages = [...(aiMessages || []), userMsg];
 setAiMessages(nextMessages);
 setIsLoading(true);

 try {
 const token = localStorage.getItem('dt_token');
 const res = await fetch('/api/ai-chat', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${token}`,
 },
 body: JSON.stringify({
 messages: nextMessages,
 systemPrompt: buildSystemPrompt({ config, telemetry, userRole, selectedFacility, alarms }),
 }),
 });
 const data = await res.json();
 const reply = data.content || data.response || 'Sorry, I could not process that.';
 setAiMessages([...nextMessages, { role: 'assistant', content: reply, ts: now() }]);
 } catch {
 setAiMessages([...nextMessages, {
 role: 'assistant',
 content: `${config.display_name} is currently running with UF-101 active. RO HP pressure is at ${fmt(telemetry?.feed_pressure ?? 11.9, 1)} BAR. Would you like more detail?`,
 ts: now(),
 }]);
 } finally {
 setIsLoading(false);
 }
 };

 const unreadCount = 0; // future: track unread

 return (
 <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3" ref={panelRef}>

 {/* ── Compact Chat Panel ──────────────────────────────────────────────── */}
 {open && (
 <div className="w-[360px] h-[480px] bg-theme-panel border border-theme-border rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">

 {/* Header */}
 <div className="flex items-center justify-between px-4 py-3 bg-[#0a1020] border-b border-theme-border shrink-0">
 <div className="flex items-center gap-2">
 <div className="relative">
 <Bot size={16} className="text-cyan-700 dark:text-cyan-400" />
 <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse border border-[#0a1020]" />
 </div>
 <span className="text-sm font-bold text-theme-text">Permionics AI</span>
 </div>
 <div className="flex items-center gap-2">
 <Link
 to="/ai-assistant"
 onClick={() => setOpen(false)}
 className="text-[10px] text-theme-muted hover:text-cyan-700 dark:text-cyan-400 flex items-center gap-1 transition-colors"
 >
 <Maximize2 size={10} /> Open Full Page
 </Link>
 <button onClick={() => setOpen(false)} className="text-theme-muted hover:text-theme-text transition-colors p-0.5">
 <X size={14} />
 </button>
 </div>
 </div>

 {/* Chat Area */}
 <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>

 {/* Suggestion Chips */}
 {showChips && (aiMessages || []).length <= 1 && (
 <div className="flex flex-col gap-1.5 mb-1">
 {chips.map((chip, i) => (
 <button
 key={i}
 onClick={() => sendMessage(chip)}
 className="text-left text-[11px] text-cyan-700 dark:text-cyan-400 bg-cyan-950/30 hover:bg-cyan-900/40 border border-cyan-800/40 hover:border-cyan-500/40 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 group"
 >
 <ChevronRight size={9} className="shrink-0" />
 {chip}
 </button>
 ))}
 </div>
 )}

 {(aiMessages || []).map((msg, i) => (
 <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
 <div className={`max-w-[88%] px-3 py-2 rounded-xl text-[12px] leading-relaxed whitespace-pre-wrap ${
 msg.role === 'user'
 ? 'bg-cyan-600/25 text-cyan-50 border border-cyan-500/30 rounded-br-sm'
 : 'bg-slate-100 dark:bg-slate-80080 text-theme-text border border-theme-border/60 rounded-bl-sm'
 }`}>
 {msg.role === 'assistant' && (
 <div className="flex items-center gap-1 mb-1.5 pb-1.5 border-b border-theme-border/40">
 <Bot size={10} className="text-cyan-700 dark:text-cyan-400" />
 <span className="text-[9px] font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-widest">Permionics AI</span>
 <span className="text-[9px] text-theme-muted ml-auto">{msg.ts}</span>
 </div>
 )}
 {msg.role === 'user' && (
 <div className="flex items-center gap-1 mb-1.5 pb-1.5 border-b border-cyan-500/20">
 <User size={10} className="text-cyan-300" />
 <span className="text-[9px] font-bold text-cyan-300 uppercase tracking-widest">You</span>
 <span className="text-[9px] text-theme-muted ml-auto">{msg.ts}</span>
 </div>
 )}
 {msg.content}
 </div>
 </div>
 ))}

 {isLoading && (
 <div className="flex justify-start">
 <div className="bg-slate-100 dark:bg-slate-80080 border border-theme-border/60 rounded-xl rounded-bl-sm px-3 py-2 flex items-center gap-2">
 <Bot size={10} className="text-cyan-700 dark:text-cyan-400" />
 <span className="flex gap-0.5">
 {[0,1,2].map(d => <span key={d} className="w-1 h-1 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: `${d * 150}ms` }} />)}
 </span>
 </div>
 </div>
 )}
 <div ref={chatEndRef} />
 </div>

 {/* Input */}
 <div className="shrink-0 border-t border-theme-border p-3 bg-[#0a1020]">
 <div className="flex gap-2">
 <input
 ref={inputRef}
 type="text"
 value={input}
 onChange={e => setInput(e.target.value)}
 onKeyDown={e => e.key === 'Enter' && !isLoading && sendMessage()}
 placeholder="Ask about your plant..."
 className="flex-1 bg-theme-panel border border-theme-border text-theme-text px-3 py-2 rounded-lg text-[12px] placeholder:text-theme-muted focus:outline-none focus:border-cyan-500 transition-colors"
 />
 <button
 onClick={() => sendMessage()}
 disabled={!input.trim() || isLoading}
 className="px-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-theme-muted text-theme-text rounded-lg transition-colors"
 >
 <Send size={13} />
 </button>
 </div>
 </div>
 </div>
 )}

 {/* ── Orb Button ─────────────────────────────────────────────────────── */}
 <button
 onClick={() => setOpen(prev => !prev)}
 className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 border-2 ${
 open
 ? 'bg-slate-700 border-slate-300 dark:border-slate-600 rotate-12 scale-95'
 : 'bg-theme-panel border-cyan-500/40 hover:border-cyan-400 hover:scale-110 shadow-cyan-900/40'
 }`}
 >
 {/* Green pulse dot */}
 <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0d1526] animate-pulse" />
 {open
 ? <X size={20} className="text-theme-text" />
 : <MessageSquare size={22} className="text-theme-text" />}
 </button>
 </div>
 );
}
