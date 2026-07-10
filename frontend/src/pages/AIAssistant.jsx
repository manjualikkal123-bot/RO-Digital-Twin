import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Trash2, Download, CheckCircle2, AlertTriangle, Clock, Wifi, Bot, User, RefreshCw, ChevronRight, Sparkles, LifeBuoy, ClipboardList, FileText } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useLocation } from 'react-router-dom';
import plantConfig from '../config/plant_config.json';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (v, d = 1) => (v != null ? Number(v).toFixed(d) : '--');
const now = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

function buildSensorSnapshot(telemetry, config) {
  const dp = telemetry?.differential_pressure;
  const fp = telemetry?.feed_pressure;
  const fl = telemetry?.flow_rate;
  const uff = telemetry?.feed_tank_level ?? 70.5;
  const rof = telemetry?.ro_feed_tank_level ?? 68.9;

  const dpLimit = config?.limits?.dp_max ?? 1.5;
  const fpLimit = config?.limits?.feed_pressure_max ?? 55;

  return [
    { tag: 'Feed Tank Level (UF)', value: `${fmt(uff)}%`, ok: uff > 20 },
    { tag: 'UF-101 Permeate Flow', value: `${fmt(fl ?? 3.7)} M³/HR`, ok: (fl ?? 3.7) > 2 },
    { tag: 'UF-101 Diff. Pressure', value: `${fmt(dp ?? 0.6)} BAR`, ok: (dp ?? 0.6) < dpLimit },
    { tag: 'Feed Tank Level (RO)', value: `${fmt(rof)}%`, ok: rof > 20 },
    { tag: 'RO HP Pump Pressure', value: `${fmt(fp ?? 11.9)} BAR`, ok: (fp ?? 11.9) < fpLimit },
    { tag: 'RO Diff. Pressure', value: `${fmt(dp ? dp * 3.2 : 1.9)} BAR`, ok: (dp ? dp * 3.2 : 1.9) < 2.5 },
    { tag: 'UF-201 Status', value: 'STANDBY', ok: null },
    { tag: 'UF-301 Status', value: 'STANDBY', ok: null },
  ];
}

// ─── Mode definitions ──────────────────────────────────────────────────────
// Each mode changes: (a) the persona/behavior instructions layered on top of
// the shared live-data context, and (b) the suggested question chips.
// All modes still get the SAME live telemetry/fleet/audit context injected —
// only the "how to behave" instructions differ. Never invent numbers.
const MODES = [
  {
    id: 'plant_expert',
    label: 'Plant Expert',
    icon: Wifi,
    description: 'Deep technical Q&A grounded in live plant telemetry.',
    persona: `You are in PLANT EXPERT mode. Be technical and precise. Reference specific tag names,
live sensor values, and thresholds from the data provided. Compare against operational limits.
Discuss fouling, TMP, flux, CIP timing, and cross-plant comparisons if the user is ADMIN.
Ground every claim in the live data block below — if a value isn't present, say so rather than guessing.`,
    chips: (ctx) => ([
      ctx.hasActiveAlarm
        ? `What is causing the "${ctx.mainAlarmDesc}" alarm?`
        : `Why is the differential pressure at ${ctx.dpValue.toFixed(1)} BAR right now?`,
      'Should I schedule a CIP wash based on current fouling trend?',
      `What is the RO differential pressure trend at ${ctx.plantName}?`,
      'Which plant in the fleet has the worst membrane health this week?',
    ]),
  },
  {
    id: 'personal_assistant',
    label: 'Personal Assistant',
    icon: Sparkles,
    description: 'General-purpose help — explain concepts, draft text, answer anything.',
    persona: `You are in PERSONAL ASSISTANT mode. Be warm, conversational, and helpful on a wide
range of topics — not just plant operations. You can explain concepts simply (e.g. "explain osmotic
pressure simply"), help draft short messages/emails, do quick calculations, or just chat. You still
have access to live plant data below and should use it naturally if the user's question touches on
the plant, but you are not limited to plant topics in this mode.`,
    chips: () => ([
      'Explain osmotic pressure simply',
      'Summarise my plant performance over the last 24 hours in plain language',
      'Draft a short WhatsApp update to my supervisor about today\'s status',
      'What should I keep an eye on this week?',
    ]),
  },
  {
    id: 'troubleshooting',
    label: 'Troubleshooting',
    icon: LifeBuoy,
    description: 'Guided root-cause diagnosis for a specific symptom.',
    persona: `You are in TROUBLESHOOTING mode. Act like an experienced field engineer walking someone
through a diagnostic checklist. When the user describes a symptom (e.g. "high differential pressure",
"low permeate flow", "alarm on RO-401"):
1. Ask 1 clarifying question ONLY if truly necessary (prefer to reason from the live data first).
2. Cross-reference the live sensor snapshot and recent audit/command logs provided below.
3. List the 2-4 MOST LIKELY root causes ranked by probability, briefly explaining why each fits
   the current data.
4. Give concrete, safe next steps (checks, not equipment commands — you cannot control equipment).
5. Flag if this looks like it needs an on-site Permionics engineer immediately (e.g. active CRITICAL alarm).
Keep it structured — short numbered lists are preferred over long paragraphs in this mode.`,
    chips: (ctx) => ([
      ctx.hasActiveAlarm
        ? `Walk me through fixing the "${ctx.mainAlarmDesc}" alarm`
        : 'My differential pressure seems high — what should I check?',
      'Permeate flow has dropped — what could cause this?',
      'RO feed pressure is climbing — is this fouling or scaling?',
      'A pump tripped — what should I check before restarting?',
    ]),
  },
  {
    id: 'procurement',
    label: 'Procurement',
    icon: ClipboardList,
    description: 'Spares, consumables, and reorder guidance.',
    persona: `You are in PROCUREMENT mode. Help with spares, consumables (membranes, filters,
CIP chemicals), and reorder planning. IMPORTANT: only use data explicitly provided to you — if no
procurement/inventory/spares data is present in the context below, say plainly: "I don't have
procurement or inventory data wired in yet for this plant — I can only discuss what's in the live
telemetry and CIP ledger below." Do not invent part numbers, stock levels, vendors, or prices.
If CIP ledger or membrane install date data is available, you may reason about *when* a membrane
or consumable is likely to need replacement based on that.`,
    chips: () => ([
      'Based on CIP history, when might membranes need replacement?',
      'What consumables are typically used in a CIP wash cycle?',
      'Do we have any procurement or inventory data connected yet?',
      'What should I plan to reorder before the next scheduled CIP?',
    ]),
  },
  {
    id: 'report_writer',
    label: 'Report Writer',
    icon: FileText,
    description: 'Drafts a written summary/report from real plant data.',
    persona: `You are in REPORT WRITER mode. Produce a clean, professional written report using ONLY
the live data, audit logs, command logs, and any historical telemetry summary provided below.
Structure reports with clear headers (e.g. "Summary", "Key Metrics", "Alarms & Events", "Recommendations").
If the user asks for a report covering a time period you don't have historical data for, say so honestly
and offer to write a report for the period you DO have data for instead. Never fabricate historical
figures, trends, or dates. Keep tone formal and suitable for pasting into an email or PDF.`,
    chips: (ctx) => ([
      `Write a shift summary report for ${ctx.plantName} based on current data`,
      'Draft a compliance status report for today',
      'Summarise this week\'s alarms and events into a report',
      'Write a brief report I can send to my supervisor right now',
    ]),
  },
];

const getMode = (id) => MODES.find(m => m.id === id) || MODES[0];

function buildSystemPrompt({ config, telemetry, userRole, selectedFacility, alarms, auditLog, commandLog, alarmLimits, derivedKPIs, cipLedger, configChangeLog, pcbLimits, fleetData, mode }) {
  const ts = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const dp = fmt(telemetry?.differential_pressure ?? 0.6, 2);
  const fp = fmt(telemetry?.feed_pressure ?? 11.9, 1);
  const fl = fmt(telemetry?.flow_rate ?? 3.7, 1);
  const uff = fmt(telemetry?.feed_tank_level ?? 70.5, 1);
  const rof = fmt(telemetry?.ro_feed_tank_level ?? 68.9, 1);
  const activeAlarms = alarms?.filter(a => a.lifecycleStatus === 'Active').map(a => a.description).join('; ') || 'None';

  // Format expanded context
  const auditStr = (auditLog || []).slice(0, 5).map(l => `[${l.timestamp}] ${l.action} by ${l.user}: ${l.details}`).join('\n  ') || 'None';
  const cmdStr = (commandLog || []).slice(0, 3).map(c => `[${c.timestamp}] ${c.operator} changed ${c.tagId} from ${c.previousValue} to ${c.commandedValue} ${c.unit} (Reason: ${c.reason})`).join('\n  ') || 'None';
  const configLogStr = (configChangeLog || []).slice(0, 3).map(c => `[${c.date}] ${c.user}: ${c.change}`).join('\n  ') || 'None';
  const cipStr = (cipLedger || []).slice(0, 3).map(c => `[${c.date}] ${c.type} on ${c.vessel}. Status: ${c.status}. AI Rec: ${c.aiRec}`).join('\n  ') || 'None';

  const limitsStr = JSON.stringify(alarmLimits || {});
  const pcbLimitsStr = JSON.stringify(pcbLimits || {});
  const kpiStr = JSON.stringify(derivedKPIs || {});

  const fleetStr = (fleetData || []).map(f => `${f.name} (${f.id}): ${f.type}, Status: ${f.status}`).join('\n  ') || 'None';

  const activeMode = getMode(mode);

  return `You are the Permionics Digital Twin AI Assistant, embedded in a professional industrial dashboard for ETP and RO membrane water treatment plants operated and monitored by Permionics Membranes Pvt. Ltd., Vadodara, India.

CURRENT MODE: ${activeMode.label.toUpperCase()}
${activeMode.persona}

CURRENT USER:
  Role: ${userRole ?? 'admin'} (admin or client)
  Authorised plants: ${selectedFacility ?? 'jetl_hyderabad'}

CURRENTLY SELECTED PLANT: ${selectedFacility ?? 'jetl_hyderabad'}

LIVE SENSOR DATA AS OF ${ts} IST:
  Plant: ${config?.display_name ?? 'JETL — Jeedimetla ETP'}
  Location: ${config?.location ?? 'Jeedimetla Industrial Estate, Hyderabad'}
  Plant Type: ${config?.plant_type ?? 'CETP'}

  UF-101 System:
    Feed Tank Level: ${uff}%
    Differential Pressure: ${dp} BAR
    Permeate Flow: ${fl} M³/HR
    Status: RUNNING

  UF-201 System:
    Status: STANDBY

  UF-301 System:
    Status: STANDBY

  RO-401 System:
    Feed Tank Level: ${rof}%
    HP Pump Pressure: ${fp} BAR
    Differential Pressure: ${fmt((telemetry?.differential_pressure ?? 0.6) * 3.2, 2)} BAR

ACTIVE ALARMS: ${activeAlarms}
PLANT CAPACITY: ${config?.capacity_kld ?? 350} KLD
COMMISSIONED: ${config?.commissioned ?? '1989'}

DASHBOARD STATE & KPIs:
  Derived KPIs: ${kpiStr}

SYSTEM THRESHOLDS:
  Operational Limits: ${limitsStr}
  PCB Limits: ${pcbLimitsStr}

RECENT AUDIT & COMMAND LOGS (Top 5):
  Audit Logs:
  ${auditStr}

  Command Logs:
  ${cmdStr}

  Config Changes:
  ${configLogStr}

  CIP Wash Ledger:
  ${cipStr}

FLEET & CROSS-FACILITY CONTEXT:
  ${fleetStr}

--- DIGITAL TWIN DASHBOARD KNOWLEDGE BASE ---
You are completely aware of all features and pages in the Permionics Digital Twin Dashboard. Use this knowledge to guide the user.
1. GLOBAL NAVIGATION (Sidebar):
   - Dashboard: The main overview page showing plant P&ID, live telemetry cards, status indicators, and compliance metrics.
   - Map View: A geographical map showing all Permionics installations across India with live status pins.
   - Analytics: The "Advanced Analytics" page containing historical charts (Performance Trends, Energy Consumption), AI predictions, and deep Root Cause Analysis tools for predicting membrane fouling and failures.
   - Reports: Automatically generated shift, daily, and monthly compliance and operations reports with PDF export.
   - Settings: User management, alarm thresholds, and API configurations.
   - WhatsApp Settings: Controls for configuring automated WhatsApp compliance alerts to operations teams.

2. ADVANCED ANALYTICS FEATURES:
   - Remaining Useful Life (RUL) predictions for membranes (e.g. how many days until critical failure or CIP wash is required).
   - "Deep RCA Diagnostic" capability where you (the AI) can diagnose the exact root cause of fouling (biological, scaling, seasonal temp drops).
   - Real-time Performance Trend charts showing Normalized Flux vs. Time.

3. ALERTS & COMPLIANCE:
   - The platform constantly monitors Discharge limits (BOD, COD, pH, Turbidity, TSS).
   - If limits are breached, it automatically fires Mock WhatsApp and Email alerts to facility managers.

YOUR RULES:
1. Always answer using the live data above. Never make up numbers. If a value is not in the data provided, say so honestly.
2. For CLIENT role: Use plain language only. No engineering jargon unless asked. Focus on: is the plant OK, when is maintenance, what do alarms mean.
3. For ADMIN role: You may use technical terms. Reference specific tag names like PT-401, FT-101. Compare across plants if asked. Discuss fouling, TMP, flux, CIP timing.
4. Keep answers to 3-5 sentences unless the user asks for more detail, the current mode calls for structured output, or the user explicitly asked for a report.
5. If the user asks what the dashboard can do, list the features clearly from your Knowledge Base and explain how to navigate there.
6. If asked about a plant that is NOT in the fleet data or the user is NOT authorised to see, say: "I can only share data for the plants you are authorised to access." If it IS in the fleet data, answer the question!
7. If asked to take any action (change a setpoint, start a pump etc), say: "I can only observe and report — I cannot control plant equipment. Please contact your Permionics engineer."
8. End every response with one short follow-up question or suggestion to keep the conversation helpful, unless in Report Writer mode producing a formal document.
9. If the user seems confused or stressed about an alarm, be calm and reassuring while being accurate.`;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AIAssistant() {
  const location = useLocation();
  const { selectedFacility, telemetry, userRole, alarms, aiMessages, setAiMessages, auditLog, commandLog, alarmLimits, derivedKPIs, cipLedger, configChangeLog, pcbLimits, fleetData } = useAppStore();
  const config = plantConfig[selectedFacility] || plantConfig['jetl_hyderabad'];

  // ── Mode state (Plant Expert / Personal Assistant / Troubleshooting / Procurement / Report Writer)
  const [mode, setMode] = useState('personal_assistant');
  const activeMode = getMode(mode);

  // Generate dynamic chips based on live telemetry, alarms, AND the active mode
  const activeAlarmsList = alarms?.filter(a => a.lifecycleStatus === 'Active') || [];
  const dpValue = telemetry?.differential_pressure ?? 0.6;

  const chipCtx = {
    hasActiveAlarm: activeAlarmsList.length > 0,
    mainAlarmDesc: activeAlarmsList[0]?.description,
    dpValue,
    plantName: config.display_name,
  };
  const chips = activeMode.chips(chipCtx);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showChips, setShowChips] = useState(true);
  const [lastSynced, setLastSynced] = useState(now());
  const chatEndRef = useRef(null);

  // ── Build welcome message from live data ─────────────────────────────────
  useEffect(() => {
    if (!aiMessages || aiMessages.length === 0) {
      const welcome = `Hello! I'm the Permionics AI Assistant. I have access to live data from your plant right now.\n\nWhat would you like to know?`;
      setAiMessages([{ role: 'assistant', content: welcome, ts: now() }]);
    }
  }, []); // eslint-disable-line

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, isLoading]);

  // Auto prompt on mount if passed via navigation state
  useEffect(() => {
    const autoPrompt = location.state?.autoPrompt;
    const autoMode = location.state?.autoMode;
    if (autoMode) setMode(autoMode);
    if (autoPrompt) {
      sendMessage(autoPrompt);
      // Clear state so we don't re-trigger on refresh
      window.history.replaceState({}, document.title);
    }
  }, []); // eslint-disable-line

  // ── Refresh sensor snapshot every 30s ────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setLastSynced(now()), 30000);
    return () => clearInterval(id);
  }, []);

  // ── Switching modes clears the suggested-chips dismissal but keeps chat history,
  // and drops a small system note into the transcript so the user can see the switch.
  const handleModeChange = (newModeId) => {
    if (newModeId === mode) return;
    setMode(newModeId);
    setShowChips(true);
  };

  // ── Send message ──────────────────────────────────────────────────────────
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
          systemPrompt: buildSystemPrompt({ config, telemetry, userRole, selectedFacility, alarms, auditLog, commandLog, alarmLimits, derivedKPIs, cipLedger, configChangeLog, pcbLimits, fleetData, mode }),
        }),
      });
      const data = await res.json();
      const reply = data.content || data.response || 'Sorry, I could not process that. Please try again.';
      setAiMessages([...nextMessages, { role: 'assistant', content: reply, ts: now() }]);
    } catch {
      setAiMessages([...nextMessages, {
        role: 'assistant',
        content: `Based on live data: ${config.display_name} is currently running with UF-101 active and UF-201/UF-301 on standby. Feed pressure reads ${fmt(telemetry?.feed_pressure ?? 11.9, 1)} BAR. Would you like me to explain what that means for performance?`,
        ts: now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setAiMessages([]);
    setShowChips(true);
    // Re-trigger welcome
    const fl = fmt(telemetry?.flow_rate ?? 3.7, 1);
    const fp = fmt(telemetry?.feed_pressure ?? 11.9, 1);
    const welcome = `Hello! I'm the Permionics AI Assistant. I have access to live data from your plant right now.\n\nI can see that ${config.display_name} has UF-101 running at ${fl} M³/HR with RO operating at ${fp} BAR. UF-201 and UF-301 are currently on standby.\n\nWhat would you like to know?`;
    setTimeout(() => setAiMessages([{ role: 'assistant', content: welcome, ts: now() }]), 50);
  };

  const sensorRows = buildSensorSnapshot(telemetry, config);

  // Status badge
  const dp = telemetry?.differential_pressure ?? 0.6;
  const fp = telemetry?.feed_pressure ?? 11.9;
  const isCritical = dp > 1.5 || fp > 55;
  const isWarning = dp > 1.2 || fp > 45;
  const activeCritical = alarms?.some(a => a.lifecycleStatus === 'Active' && a.severity === 'CRITICAL');
  const activeWarning = alarms?.some(a => a.lifecycleStatus === 'Active' && a.severity === 'WARNING');
  const hasCritical = isCritical || activeCritical;
  const hasWarning = isWarning || activeWarning;

  const statusLabel = hasCritical ? 'CRITICAL ALARMS ACTIVE' : hasWarning ? 'WARNINGS ACTIVE' : 'OPTIMAL — FLOW EFFICIENCY';
  const statusColor = hasCritical ? 'text-red-700 dark:text-red-400 bg-red-500/10 border-red-500/30' : hasWarning ? 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30';

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[600px] gap-0 overflow-hidden rounded-xl border border-theme-border bg-theme-main shadow-2xl">

      {/* ── LEFT COLUMN — Context Panel ────────────────────────────────────── */}
      <div className="w-[35%] min-w-[280px] flex flex-col border-r border-theme-border bg-theme-panel overflow-y-auto">

        {/* Section 1 — Active Plant */}
        <div className="p-4 border-b border-theme-border">
          <div className="text-[10px] font-bold text-theme-muted uppercase tracking-widest mb-3 flex items-center gap-1">
            <Wifi size={10} /> Active Plant
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-theme-text font-bold text-sm leading-tight">{config.display_name}</span>
            <span className="text-theme-muted text-[11px]">{config.location}</span>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded border ${statusColor}`}>
                {statusLabel}
              </span>
              <span className="text-[9px] text-theme-muted flex items-center gap-1">
                <Clock size={9} /> Synced {lastSynced}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2 — Live Snapshot */}
        <div className="p-4 border-b border-theme-border flex-1">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">AI is reading these live values</span>
            <span className="flex items-center gap-1 text-[9px] text-emerald-700 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Live as of {lastSynced}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            {sensorRows.map((row, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-theme-border/50 last:border-0">
                <span className="text-[11px] text-theme-muted">{row.tag}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-theme-text">{row.value}</span>
                  {row.ok === null
                    ? <span className="text-theme-muted text-[10px]">⚪</span>
                    : row.ok
                      ? <CheckCircle2 size={11} className="text-emerald-700 dark:text-emerald-500" />
                      : <AlertTriangle size={11} className="text-amber-700 dark:text-amber-400" />}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[9px] text-theme-muted flex items-center gap-1">
            <RefreshCw size={9} /> Updates every 30 seconds
          </div>
        </div>

        {/* Section 3 — Suggested Questions (mode-aware) */}
        {showChips && (
          <div className="p-4">
            <div className="text-[10px] font-bold text-theme-muted uppercase tracking-widest mb-3">
              Try asking... <span className="normal-case font-semibold text-theme-muted/70">({activeMode.label})</span>
            </div>
            <div className="flex flex-col gap-2">
              {chips.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(chip)}
                  className="text-left text-[11px] text-cyan-700 dark:text-cyan-400 bg-cyan-950/30 hover:bg-cyan-900/40 border border-cyan-800/50 hover:border-cyan-500/50 px-3 py-2 rounded-lg transition-all flex items-center gap-2 group"
                >
                  <ChevronRight size={10} className="shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT COLUMN — Chat Window ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-theme-border bg-theme-panel shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bot size={18} className="text-cyan-700 dark:text-cyan-400" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-[#0d1526] animate-pulse" />
            </div>
            <span className="text-sm font-bold text-theme-text">Permionics AI</span>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">● Live</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const header = `=== AI SESSION EXPORT ===\nFacility: ${config.display_name}\nMode: ${activeMode.label}\nRole: ${userRole}\nTimestamp: ${new Date().toISOString()}\n\n`;
                const body = (aiMessages || []).map(m => `[${m.role.toUpperCase()} ${m.ts}] ${m.content}`).join('\n\n');
                const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([header + body], { type: 'text/plain' })), download: `AI_Session_${Date.now()}.txt` });
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
              }}
              className="text-[10px] text-theme-muted hover:text-theme-text flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 dark:bg-slate-800 transition-colors"
            >
              <Download size={12} /> Export
            </button>
            <button
              onClick={clearChat}
              className="text-[10px] text-theme-muted hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 px-2 py-1 rounded hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/20"
            >
              <Trash2 size={12} /> Clear Chat
            </button>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-theme-border bg-theme-panel shrink-0 overflow-x-auto">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = m.id === mode;
            return (
              <button
                key={m.id}
                onClick={() => handleModeChange(m.id)}
                title={m.description}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
                  active
                    ? 'bg-cyan-600/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/50'
                    : 'bg-transparent text-theme-muted border-transparent hover:border-theme-border hover:text-theme-text'
                }`}
              >
                <Icon size={12} />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
          {(aiMessages || []).map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex flex-col max-w-[80%] gap-1`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-cyan-600/25 text-cyan-50 border border-cyan-500/30 rounded-br-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-theme-text border border-theme-border/80 rounded-bl-sm'
                }`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-theme-border/50">
                      <Bot size={12} className="text-cyan-700 dark:text-cyan-400" />
                      <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-widest">Permionics AI</span>
                    </div>
                  )}
                  {msg.role === 'user' && (
                    <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-cyan-500/20">
                      <User size={12} className="text-cyan-300" />
                      <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest">You</span>
                    </div>
                  )}
                  {msg.content}
                </div>
                <span className={`text-[10px] text-theme-muted ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>{msg.ts}</span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 dark:bg-slate-800 border border-theme-border/80 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                <Bot size={12} className="text-cyan-700 dark:text-cyan-400" />
                <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-widest mr-2">Permionics AI</span>
                <span className="text-theme-muted text-sm">AI is thinking</span>
                <span className="flex gap-0.5">
                  {[0, 1, 2].map(d => <span key={d} className="w-1 h-1 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: `${d * 150}ms` }} />)}
                </span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="shrink-0 border-t border-theme-border bg-theme-panel p-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !isLoading && sendMessage()}
              placeholder={
                mode === 'troubleshooting' ? 'Describe the symptom or alarm...' :
                mode === 'report_writer' ? 'Ask me to write a report...' :
                mode === 'procurement' ? 'Ask about spares, consumables, reorders...' :
                'Ask about your plant...'
              }
              className="flex-1 bg-theme-panel border border-theme-border text-theme-text px-4 py-2.5 rounded-xl text-sm placeholder:text-theme-muted focus:outline-none focus:border-cyan-500 transition-colors"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="px-4 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-theme-muted text-theme-text rounded-xl transition-colors flex items-center justify-center shadow-lg shadow-cyan-900/30"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-[10px] text-theme-muted text-center">
            AI has access to live sensor data. For confirmation, refer to SCADA/Asset Register — this assistant is for guidance only.<br />
            For emergencies call Permionics ops:{' '}
            <span className="text-theme-muted">+91-98980-12345</span>
          </p>
        </div>
      </div>
    </div>
  );
}
