import { X, Activity, Droplets, Gauge } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { useAppStore } from '../store/useAppStore';

// FIXED: The old config used raw tag strings like `PT-401`, `FT-401`,
// `TMP-401`, `CDIC-401`. Those never matched anything — GlobalSyncManager
// renames every raw tag to a friendly field name (feed_pressure,
// conductivity, flow_rate...) before it reaches history/current. This
// config now uses those real field names, per stage, so charts and KPI
// tiles actually populate.
//
// Note on "TMP": there is no dedicated transmembrane-pressure tag in this
// dataset for any stage. `differential_pressure` (feed_pressure minus
// reject_pressure) is the closest real proxy GlobalSyncManager computes,
// so that's what's plotted here instead of a fabricated TMP reading.
const getChartConfig = (stage) => {
  if (stage === 'UF') {
    return {
      charts: [
        { key: 'differential_pressure', name: 'Diff. Pressure (proxy for TMP)', unit: 'bar', color: '#f59e0b', domain: ['auto', 'auto'] },
        { key: 'flow_rate', name: 'Permeate Flow', unit: 'm³/h', color: '#0ea5e9', domain: ['auto', 'auto'] },
        { key: 'level_lt101', name: 'Feed Tank Level', unit: '%', color: '#8b5cf6', domain: [0, 100] },
      ],
      kpis: [
        { key: 'feed_pressure', label: 'Feed Pressure', unit: 'bar' },
        { key: 'reject_pressure', label: 'Reject Pressure', unit: 'bar' },
      ],
    };
  }

  if (stage === 'RO1' || stage === 'RO2' || stage === 'RO-P') {
    return {
      charts: [
        { key: 'differential_pressure', name: 'Diff. Pressure (proxy for TMP)', unit: 'bar', color: '#f59e0b', domain: ['auto', 'auto'] },
        { key: 'flow_rate', name: 'Permeate Flow', unit: 'm³/h', color: '#0ea5e9', domain: ['auto', 'auto'] },
        {
          multi: true,
          title: 'Conductivity — Feed vs Permeate',
          keys: ['conductivity', 'permeate_conductivity'],
          colors: ['#f43f5e', '#a855f7'],
        },
      ],
      kpis: [
        { key: 'feed_pressure', label: 'Feed Pressure', unit: 'bar' },
        { key: 'reject_pressure', label: 'Reject Pressure', unit: 'bar' },
      ],
    };
  }

  return null;
};

// Values can legitimately be null (clamped-out faulty reading, or a tag
// that plain doesn't exist for this stage, e.g. UF has no conductivity tag
// at all). Show a clean dash rather than "null" or "NaN".
const fmt = (v) => (v === null || v === undefined || Number.isNaN(v)) ? '—' : v;

export default function LiveTelemetryPanel({ stage: stageContext, onClose }) {
  const store = useAppStore();
  const telemetryHistory = store.telemetryHistory || [];
  const telemetry = store.telemetry || {};

  const stageName = stageContext ? stageContext.stage : '';
  const unitName = stageContext ? stageContext.unit : '';
  const config = stageContext ? getChartConfig(stageContext.stage) : null;
  
  const stageHistory = {};
  if (stageName) {
    telemetryHistory.forEach(t => {
      const stageData = t.stages?.[stageName] || t; 
      if (stageData) {
        const timeStr = t.timestamp ? new Date(t.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
        Object.entries(stageData).forEach(([key, value]) => {
          if (!stageHistory[key]) stageHistory[key] = [];
          stageHistory[key].push({ time: timeStr, value });
        });
      }
    });
  }
  const currentRow = stageName ? (telemetry.stages?.[stageName] || telemetry || {}) : {};

  return (
    <div className="flex flex-col h-full w-full bg-[#0a1020] text-theme-text">
      {config && (
        <>
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-theme-border">
            <div>
              <h2 className="text-sm font-black text-theme-text flex items-center gap-2 tracking-widest uppercase">
                <Activity className="text-cyan-700 dark:text-cyan-400" size={16} /> {stageName} MODULE {unitName}
              </h2>
              {/* FIXED: previously showed currentRow.Date / currentRow.Time, which
                  don't exist on this row shape — real field is `timestamp`. */}
              <p className="text-[10px] text-theme-muted mt-1 uppercase tracking-widest">
                {currentRow.timestamp ? new Date(currentRow.timestamp).toLocaleString() : '—'}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:bg-slate-800 rounded-full transition-colors text-theme-muted hover:text-theme-text">
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 invisible-scroll">

            {/* KPI Tiles */}
            <div className="grid grid-cols-2 gap-3">
              {config.kpis.map(({ key, label, unit }) => (
                <div key={key} className="bg-theme-panel border border-theme-border rounded-lg p-3">
                  <div className="text-[9px] text-theme-muted font-bold uppercase tracking-widest mb-1">{label}</div>
                  <div className="flex items-end gap-1">
                    <span className="text-xl font-black text-emerald-700 dark:text-emerald-400">
                      {fmt(currentRow[key])}
                    </span>
                    <span className="text-xs text-theme-muted mb-1">{unit}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="space-y-4">
              {config.charts.map((chart, idx) => {
                if (chart.multi) {
                  const dataList = stageHistory[chart.keys[0]] || [];
                  const chartData = dataList.map((entry, i) => {
                    const res = { time: entry.time };
                    chart.keys.forEach((k) => {
                      if (stageHistory[k] && stageHistory[k][i]) {
                        res[k] = stageHistory[k][i].value;
                      }
                    });
                    return res;
                  });

                  return (
                    <div key={idx} className="bg-theme-panel border border-theme-border rounded-lg p-3 shadow-inner">
                      <h3 className="text-[10px] text-theme-muted uppercase tracking-widest font-bold mb-2 flex items-center gap-1">
                        <Droplets size={12} className="text-fuchsia-400" /> {chart.title}
                      </h3>
                      <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 9 }} minTickGap={15} />
                            <YAxis stroke="#64748b" tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
                            <RechartsTooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: '10px' }}
                              itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                            />
                            {chart.keys.map((k, i) => (
                              <Line key={k} type="monotone" dataKey={k} stroke={chart.colors[i]} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  );
                }

                // Single metric chart
                const singleData = [...(stageHistory[chart.key] || [])];
                return (
                  <div key={chart.key} className="bg-theme-panel border border-theme-border rounded-lg p-3 shadow-inner">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-[10px] text-theme-muted uppercase tracking-widest font-bold flex items-center gap-1">
                        <Gauge size={12} className="text-cyan-700 dark:text-cyan-400" /> {chart.name}
                      </h3>
                      <span className="text-xs font-bold" style={{ color: chart.color }}>
                        {fmt(currentRow[chart.key])} <span className="text-[9px] text-theme-muted">{chart.unit}</span>
                      </span>
                    </div>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={singleData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 9 }} minTickGap={15} />
                          <YAxis stroke="#64748b" tick={{ fontSize: 9 }} domain={chart.domain} />
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: '10px' }}
                          />
                          <Line type="monotone" dataKey="value" name={chart.name} stroke={chart.color} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </>
      )}
    </div>
  );
}
