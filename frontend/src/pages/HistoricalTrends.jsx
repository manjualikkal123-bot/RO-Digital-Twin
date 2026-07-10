import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Brush, Legend
} from 'recharts';
import { Download, ArrowDownToLine, ArrowUpToLine, Hash, Activity, Play, Pause, RotateCcw } from 'lucide-react';

const TAG_CONFIG = [
  { key: 'Feed Pressure',          unit: 'bar',   color: '#3b82f6' },
  { key: 'Reject Pressure',        unit: 'bar',   color: '#ef4444' },
  { key: 'Differential Pressure',  unit: 'bar',   color: '#f59e0b' },
  { key: 'Flow Rate',              unit: 'm³/h',  color: '#10b981' },
  { key: 'Permeate Conductivity',  unit: 'µS/cm', color: '#a855f7' },
  { key: 'Salt Rejection',         unit: '%',     color: '#eab308' },
  { key: 'Energy (SEC)',           unit: 'kWh/m³',color: '#ec4899' },
  { key: 'Health Score',           unit: '%',     color: '#06b6d4' },
];

const NANDESARI_STAGES = ['HPA1', 'HPA2', 'HPA3', 'HPA4', 'HPA5'];
const JETL_STAGES      = ['UF', 'RO1', 'RO2', 'RO-P'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="p-3 rounded-xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5)] text-xs z-50"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', border: '1px solid var(--border-panel)', color: 'var(--text-main)' }}
      >
        <p className="font-bold mb-2 pb-1" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-panel)' }}>{label}</p>
        {payload.map((p) =>
          p.value != null && (
            <div key={p.dataKey} className="flex justify-between gap-6 mb-1">
              <span className="font-bold" style={{ color: p.color }}>{p.name}:</span>
              <span className="font-black font-mono">{Number(p.value).toFixed(2)}</span>
            </div>
          )
        )}
      </div>
    );
  }
  return null;
};

// ─── Per-facility data extractor ─────────────────────────────────────────────
// Reads from the SAME fields that GlobalSyncManager writes into each history
// entry — i.e. the normalized flat shape (differential_pressure, flow_rate…)
// that is produced AFTER stage mapping, not from the raw nested JSON columns.
function extractMetrics(record, facility, stage) {
  // Both JETL and Nandesari nest their stage data under record.stages[stage]
  // as per the unified schema in GlobalSyncManager.js.
  const src = record?.stages?.[stage] || null;

  if (!src) return null;

  const orNull = (v) => (typeof v === 'number' && !isNaN(v)) ? v : null;

  let feedPres  = orNull(src.feed_pressure);
  let rejPres   = orNull(src.reject_pressure);
  let diffPres  = orNull(src.differential_pressure);
  let flowRate  = orNull(src.flow_rate);
  let permCond  = orNull(src.conductivity ?? src.permeate_conductivity);
  let saltRej   = orNull(src.salt_rejection);
  let sec       = null;
  let healthSc  = null;

  // Compute derived differential pressure if we have feed + reject
  if (diffPres == null && feedPres != null && rejPres != null) {
    diffPres = parseFloat((feedPres - rejPres).toFixed(3));
  }

  // Energy (SEC) — only if energy_kwh and flow_rate are both valid
  if (typeof src.energy_kwh === 'number' && src.flow_rate > 0) {
    sec = parseFloat((src.energy_kwh / src.flow_rate).toFixed(3));
  }

  return {
    feedPres, rejPres, diffPres, flowRate, permCond, saltRej, sec, healthSc
  };
}

export default function HistoricalTrends() {
  // Use fullHistoricalDataset (the complete loaded dataset for this facility)
  // NOT telemetryHistory which is only the rolling 288-point live window.
  const { selectedFacility, fullHistoricalDataset } = useAppStore();

  const isNandesari = selectedFacility === 'nia_nandesari';
  const stageList   = isNandesari ? NANDESARI_STAGES : JETL_STAGES;

  const [selectedStage, setSelectedStage] = useState(isNandesari ? 'HPA1' : 'RO1');
  const [selectedTags,  setSelectedTags]  = useState(['Feed Pressure', 'Differential Pressure', 'Flow Rate']);
  const [startDate,     setStartDate]     = useState('');
  const [endDate,       setEndDate]       = useState('');
  const rangeInitializedRef = useRef(false);

  const [isPlaying,  setIsPlaying]  = useState(false);
  const [playIndex,  setPlayIndex]  = useState(0);
  const intervalRef = useRef(null);

  // Reset stage when facility changes
  useEffect(() => {
    const def = selectedFacility === 'nia_nandesari' ? 'HPA1' : 'RO1';
    setSelectedStage(def);
    rangeInitializedRef.current = false;
  }, [selectedFacility]);

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // ── Build chart data from the full historical dataset ──────────────────────
  const allChartData = useMemo(() => {
    const dataset = fullHistoricalDataset || [];
    if (!dataset.length) return [];

    // Filter to this facility only
    const facilityRows = dataset.filter(r =>
      !r.facility || r.facility === selectedFacility
    );

    return facilityRows
      .map(record => {
        // Timestamp: prefer the stage-level timestamp for Nandesari so each
        // HPA train aligns to its own row's clock.
        const rawTs = isNandesari
          ? (record?.stages?.[selectedStage]?.timestamp || record.timestamp)
          : record.timestamp;

        const t = new Date(rawTs);
        if (isNaN(t.getTime())) return null;

        const m = extractMetrics(record, selectedFacility, selectedStage);
        if (!m) return null;

        const year  = t.getFullYear();
        const month = String(t.getMonth() + 1).padStart(2, '0');
        const day   = String(t.getDate()).padStart(2, '0');

        return {
          time:     t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          fullDate: t.toLocaleString(),
          dateOnly: `${year}-${month}-${day}`,
          sortTs:   t.getTime(),
          'Feed Pressure':         m.feedPres  != null ? parseFloat(m.feedPres.toFixed(2))  : null,
          'Reject Pressure':       m.rejPres   != null ? parseFloat(m.rejPres.toFixed(2))   : null,
          'Differential Pressure': m.diffPres  != null ? parseFloat(m.diffPres.toFixed(2))  : null,
          'Flow Rate':             m.flowRate  != null ? parseFloat(m.flowRate.toFixed(2))   : null,
          'Permeate Conductivity': m.permCond  != null ? parseFloat(m.permCond.toFixed(2))  : null,
          'Salt Rejection':        m.saltRej   != null ? parseFloat(m.saltRej.toFixed(2))   : null,
          'Energy (SEC)':          m.sec       != null ? parseFloat(m.sec.toFixed(3))        : null,
          'Health Score':          m.healthSc  != null ? parseFloat(m.healthSc.toFixed(1))  : null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.sortTs - b.sortTs);
  }, [fullHistoricalDataset, selectedFacility, selectedStage, isNandesari]);

  // ── Date range auto-init ───────────────────────────────────────────────────
  const dataSpan = useMemo(() => {
    if (!allChartData.length) return null;
    return {
      min: allChartData[0].dateOnly,
      max: allChartData[allChartData.length - 1].dateOnly
    };
  }, [allChartData]);

  useEffect(() => {
    if (!dataSpan) return;
    const noRange = !startDate || !endDate;
    const outOfRange = startDate && endDate && (endDate < dataSpan.min || startDate > dataSpan.max);
    if (noRange || outOfRange || !rangeInitializedRef.current) {
      setStartDate(dataSpan.min);
      setEndDate(dataSpan.max);
      rangeInitializedRef.current = true;
    }
  }, [dataSpan]);

  // ── Filtered + played data ─────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    if (!allChartData.length || !startDate || !endDate) return allChartData;
    return allChartData.filter(row => row.dateOnly >= startDate && row.dateOnly <= endDate);
  }, [allChartData, startDate, endDate]);

  useEffect(() => {
    setPlayIndex(0);
    setIsPlaying(false);
  }, [startDate, endDate, selectedFacility, selectedStage]);

  useEffect(() => {
    if (isPlaying && filteredData.length > 0) {
      intervalRef.current = setInterval(() => {
        setPlayIndex(prev => {
          if (prev >= filteredData.length - 1) {
            clearInterval(intervalRef.current);
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 150);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, filteredData.length]);

  const displayData = useMemo(() => {
    if (isPlaying || playIndex > 0) return filteredData.slice(0, playIndex + 1);
    return filteredData;
  }, [filteredData, isPlaying, playIndex]);

  // ── Stats for KPI cards ────────────────────────────────────────────────────
  const primaryTag = selectedTags[0];
  const stats = useMemo(() => {
    if (!primaryTag) return { min: '--', max: '--', avg: '--', current: '--' };
    const values = filteredData.map(d => parseFloat(d[primaryTag])).filter(v => !isNaN(v));
    if (!values.length) return { min: '--', max: '--', avg: '--', current: '--' };
    return {
      min:     Math.min(...values).toFixed(2),
      max:     Math.max(...values).toFixed(2),
      avg:     (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
      current: values[values.length - 1].toFixed(2),
    };
  }, [filteredData, primaryTag]);

  const handleExport = () => {
    if (!filteredData.length || !selectedTags.length) return;
    const headers = ['Time', 'Date', ...selectedTags];
    const rows = filteredData.map(row =>
      [row.time, row.fullDate, ...selectedTags.map(tag => row[tag] ?? '')].join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `historical_${selectedFacility}_${selectedStage}_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Build a unit label for the Y-axis from active tags ────────────────────
  const yAxisLabel = useMemo(() => {
    if (!primaryTag) return '';
    return TAG_CONFIG.find(t => t.key === primaryTag)?.unit || '';
  }, [primaryTag]);

  const noData = !fullHistoricalDataset || fullHistoricalDataset.length === 0;

  return (
    <div className="min-h-screen bg-transparent p-6 font-sans flex flex-col gap-6 overflow-y-auto custom-scrollbar">

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        {[
          { label: 'Minimum', value: stats.min, icon: <ArrowDownToLine size={80} />, accent: '' },
          { label: 'Maximum', value: stats.max, icon: <ArrowUpToLine   size={80} />, accent: '' },
          { label: 'Average', value: stats.avg, icon: <Hash            size={80} />, accent: '' },
          { label: 'Current', value: stats.current, icon: <Activity    size={80} />, accent: 'border-l-4 border-l-blue-500' },
        ].map(({ label, value, icon, accent }) => (
          <div key={label} className={`bg-theme-panel border-2 border-theme-border rounded-xl p-5 shadow-lg flex flex-col relative overflow-hidden premium-card ${accent}`}>
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] text-blue-600">{icon}</div>
            <span className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">
              {label} ({primaryTag || '--'})
            </span>
            <span className={`text-2xl font-black mt-1 ${label === 'Current' ? 'text-blue-600' : 'text-theme-text'}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* ── Controls panel ────────────────────────────────────────────────── */}
      <div className="bg-theme-panel border border-theme-border rounded-xl p-5 flex flex-col gap-5 shadow-xl shrink-0 z-10 premium-card">

        {/* Stage selector (Nandesari HPA or JETL RO stages) */}
        <div>
          <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest mb-2 ml-1 block">
            Stage
          </label>
          <div className="flex flex-wrap gap-2">
            {stageList.map(s => (
              <button
                key={s}
                onClick={() => setSelectedStage(s)}
                className="px-4 py-1.5 rounded-full text-xs font-black border-2 transition-all"
                style={{
                  borderColor:     selectedStage === s ? '#06b6d4' : 'var(--border-panel)',
                  backgroundColor: selectedStage === s ? '#06b6d422' : 'transparent',
                  color:           selectedStage === s ? '#06b6d4' : 'var(--text-muted)',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Metric toggles */}
        <div>
          <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest mb-2 ml-1 block">
            Metrics (click to toggle)
          </label>
          <div className="flex flex-wrap gap-2">
            {TAG_CONFIG.map(({ key, color }) => {
              const active = selectedTags.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleTag(key)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all"
                  style={{
                    borderColor:     active ? color : 'var(--border-panel)',
                    backgroundColor: active ? `${color}22` : 'transparent',
                    color:           active ? color : 'var(--text-muted)',
                    opacity:         active ? 1 : 0.6,
                  }}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {key}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date range + play + download */}
        <div className="flex flex-col md:flex-row gap-6 items-end justify-between">
          <div className="flex flex-col flex-1 min-w-[250px]">
            <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest mb-2 ml-1">
              Date Range{dataSpan && (
                <span className="normal-case font-semibold text-theme-muted/70">
                  {' '}(data available {dataSpan.min} to {dataSpan.max})
                </span>
              )}
            </label>
            <div className="flex items-center bg-theme-main border-2 border-theme-border rounded-lg px-4 py-2.5 shadow-sm focus-within:border-blue-500 focus-within:bg-theme-panel transition-colors">
              <input type="date" value={startDate} min={dataSpan?.min} max={dataSpan?.max}
                onChange={e => setStartDate(e.target.value)}
                className="bg-transparent text-theme-text text-sm font-black focus:outline-none w-full cursor-pointer" />
              <span className="text-theme-text font-black mx-2">-</span>
              <input type="date" value={endDate} min={dataSpan?.min} max={dataSpan?.max}
                onChange={e => setEndDate(e.target.value)}
                className="bg-transparent text-theme-text text-sm font-black focus:outline-none w-full cursor-pointer" />
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => { if (!filteredData.length) return; if (playIndex >= filteredData.length - 1) setPlayIndex(0); setIsPlaying(p => !p); }}
              disabled={!filteredData.length}
              className="flex items-center gap-2 bg-theme-main border-2 border-theme-border hover:border-blue-500 text-theme-text px-5 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all disabled:opacity-40">
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button onClick={() => { setIsPlaying(false); setPlayIndex(0); }}
              disabled={!filteredData.length}
              className="flex items-center gap-2 bg-theme-main border-2 border-theme-border hover:border-blue-500 text-theme-text px-4 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all disabled:opacity-40">
              <RotateCcw size={16} />
            </button>
          </div>

          <button onClick={handleExport}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-lg text-xs font-black uppercase tracking-widest shadow-md hover:shadow-[0_4px_15px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-2">
            <Download size={16} />
            Download Data
          </button>
        </div>

        {/* Point count indicator */}
        {!noData && (
          <div className="text-[10px] text-theme-muted font-semibold">
            {filteredData.length} data points loaded for <span className="text-cyan-500 font-black">{selectedStage}</span>
            {isPlaying && <span className="ml-2 text-green-500">▶ Playing — {playIndex + 1} / {filteredData.length}</span>}
          </div>
        )}
      </div>

      {/* ── Chart ─────────────────────────────────────────────────────────── */}
      <div className="bg-theme-panel border border-theme-border rounded-xl shadow-xl p-6 flex flex-col relative overflow-hidden premium-card flex-1 min-h-[500px] shrink-0">
        <h3 className="text-sm font-black text-theme-text mb-6 uppercase tracking-wider shrink-0">
          Historic Data — {selectedStage} — {selectedTags.length ? selectedTags.join(', ') : 'No metrics selected'}
        </h3>

        <div className="w-full flex-1 relative z-10 min-h-[400px]">
          {noData ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-theme-muted font-bold text-center px-8 gap-2">
              <span className="text-2xl">📂</span>
              <p>No historical data loaded for <span className="text-cyan-500">{selectedFacility}</span> yet.</p>
              <p className="text-xs font-normal mt-1">The GlobalSyncManager loads data on startup. If this persists, try refreshing the page.</p>
            </div>
          ) : allChartData.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-theme-muted font-bold text-center px-8 gap-2">
              <span className="text-2xl">📉</span>
              <p>No chart data could be extracted for stage <span className="text-cyan-500">{selectedStage}</span>.</p>
              <p className="text-xs font-normal mt-1">
                This usually means the stage's data columns (differential_pressure, flow_rate) are all null for this date range.
              </p>
            </div>
          ) : displayData.length > 0 && selectedTags.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={displayData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-panel)" vertical={false} opacity={0.3} />
                <XAxis
                  dataKey="time"
                  stroke="var(--text-muted)"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 'bold' }}
                  dy={10}
                  minTickGap={40}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={75}
                  stroke="var(--text-muted)"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 'bold' }}
                  domain={['auto', 'auto']}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 10, dy: 40 }}
                />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--text-muted)', strokeWidth: 1, strokeDasharray: '5 5' }} />
                <Legend wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }}
                  formatter={(value) => <span style={{ color: 'var(--text-muted)' }}>{value}</span>} />

                {TAG_CONFIG.filter(({ key }) => selectedTags.includes(key)).map(({ key, color }) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: color, stroke: '#ffffff', strokeWidth: 2 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}

                <Brush
                  dataKey="time"
                  height={28}
                  stroke="var(--text-muted)"
                  fill="transparent"
                  tickFormatter={() => ''}
                  travellerWidth={10}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-theme-muted font-bold">
              {selectedTags.length === 0
                ? 'Select at least one metric above.'
                : 'No data in the selected date range.'}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}