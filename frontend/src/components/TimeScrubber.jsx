import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Play, Pause, FastForward, SkipForward } from 'lucide-react';

// NOTE: previously imported `historicalData` from '../data/historical_telemetry.json'
// and mapped a shape (record.uf_101?.feed_flow_m3h, record.ro_501?.pump_load_kw)
// that matches none of this app's real pipelines (not JETL's PT_401-style tags,
// not the ${stage}_param flat shape BatchAnalytics.jsx actually produces, not
// Nandesari's HPA1_flux keys). That file/mapping is gone. This component now
// reads real, facility-scoped rows from useAppStore's fullHistoricalDataset via
// getActivePlaybackDataset(), which already filters by selectedFacility AND
// selectedHistoryDay — so JETL playback only ever shows JETL rows, Nandesari
// playback only ever shows Nandesari rows, never a mix.
export default function TimeScrubber({ onPlaybackToggle, isPlaybackMode }) {
  const {
    playbackIndex,
    tickPlayback,
    getActivePlaybackDataset,
    getAvailablePlaybackDates,
    selectedHistoryDay,
    setSelectedHistoryDay,
    alarms,
  } = useAppStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // 1x, 2x, 5x

  // Recomputed on every render from the store — always reflects whichever
  // facility + day is currently selected. Do NOT cache this in local state;
  // it needs to change immediately when selectedFacility/selectedHistoryDay
  // changes (e.g. via the facility dropdown or the date selector below).
  const dataset = getActivePlaybackDataset ? getActivePlaybackDataset() : [];
  const availableDates = getAvailablePlaybackDates ? getAvailablePlaybackDates() : [];
  const hasData = dataset && dataset.length > 0;

  const handleSliderChange = (e) => {
    const newIndex = parseInt(e.target.value, 10);
    if (isPlaybackMode) tickPlayback(newIndex);
  };

  // Auto-play timer — advances playbackIndex and ticks the store, which
  // recomputes telemetry/KPIs/alarms for that row via tickPlayback().
  useEffect(() => {
    let interval;
    if (isPlaying && isPlaybackMode && hasData && playbackIndex < dataset.length - 1) {
      interval = setInterval(() => {
        const next = playbackIndex + 1;
        tickPlayback(next);
        if (next >= dataset.length - 1) setIsPlaying(false);
      }, 1000 / speed);
    }
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, speed, isPlaybackMode, playbackIndex, dataset.length]);

  useEffect(() => {
    if (!isPlaybackMode) setIsPlaying(false);
  }, [isPlaybackMode]);

  // Event Jump Handler — jumps within the CURRENT facility+day dataset only.
  const handleEventJump = (e) => {
    const val = e.target.value;
    if (!hasData) return;
    if (val === 'cip') tickPlayback(Math.floor(dataset.length * 0.25));
    if (val === 'trip') tickPlayback(Math.floor(dataset.length * 0.75));
    if (val === 'maint') tickPlayback(Math.floor(dataset.length * 0.90));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '7px 14px', marginBottom: 10, background: isPlaybackMode ? 'rgba(210,153,34,0.12)' : 'rgba(15,23,42,0.8)', border: isPlaybackMode ? '1px solid #f59e0b' : '1px solid #1e293b', borderRadius: 8 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'nowrap', overflow: 'visible' }}>
        {/* Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <input type="checkbox" checked={isPlaybackMode} onChange={(e) => onPlaybackToggle(e.target.checked)}
            style={{ width: 36, height: 18, cursor: 'pointer', accentColor: '#f59e0b' }} />
          <span style={{ fontWeight: 700, color: isPlaybackMode ? '#f59e0b' : '#64748b', whiteSpace: 'nowrap', fontSize: '0.72rem', letterSpacing: '0.12em' }}>
            HIST. PLAYBACK
          </span>
        </div>

        {/* Date selector — only dates that actually exist for the current facility */}
        <select
          disabled={!isPlaybackMode || availableDates.length === 0}
          value={selectedHistoryDay === 'Live' ? '' : selectedHistoryDay}
          onChange={(e) => setSelectedHistoryDay(e.target.value)}
          style={{ background: '#0f172a', border: '1px solid #1e293b', color: '#cbd5e1', fontSize: '0.7rem', fontWeight: 700, borderRadius: 5, padding: '4px 8px', cursor: isPlaybackMode ? 'pointer' : 'not-allowed' }}
        >
          <option value="" disabled>{availableDates.length ? 'Select date...' : 'No published data'}</option>
          {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              disabled={!isPlaybackMode || !hasData}
              onClick={() => setIsPlaying(!isPlaying)}
              className={`p-2 rounded-full transition-colors ${!isPlaybackMode ? 'text-theme-muted' : 'text-amber-700 dark:text-amber-500 hover:bg-amber-500/20'}`}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <button
              disabled={!isPlaybackMode || !hasData}
              onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 5 : 1)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-colors ${!isPlaybackMode ? 'text-theme-muted' : 'text-amber-700 dark:text-amber-500 hover:bg-amber-500/20'}`}
            >
              <FastForward size={14} /> {speed}x
            </button>
          </div>

          {/* Scrubber with labels */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.68rem', color: '#475569', whiteSpace: 'nowrap', fontFamily: 'monospace', minWidth: 90, textAlign: 'right' }}>
              {hasData && dataset[0]?.timestamp ? new Date(dataset[0].timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '— No Data —'}
            </span>
            <input type="range" min="0" max={hasData ? dataset.length - 1 : 0}
              value={hasData ? playbackIndex : 0} onChange={handleSliderChange}
              disabled={!isPlaybackMode || !hasData}
              style={{ flex: 1, accentColor: '#f59e0b', cursor: isPlaybackMode ? 'pointer' : 'not-allowed' }}
            />
            <span style={{ fontSize: '0.68rem', color: '#475569', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
              {hasData ? `${dataset.length} pts` : '--'}
            </span>
          </div>

          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem', color: '#f59e0b', whiteSpace: 'nowrap', minWidth: 140, textAlign: 'right' }}>
            {isPlaybackMode && hasData && dataset[playbackIndex]?.timestamp
              ? new Date(dataset[playbackIndex].timestamp).toLocaleString()
              : (hasData ? 'Ready' : '— No Data —')}
          </span>
        </div>

        {/* Event Jump */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <SkipForward size={14} color={isPlaybackMode ? '#f59e0b' : '#475569'} />
          <select
            disabled={!isPlaybackMode || !hasData}
            onChange={handleEventJump}
            defaultValue=""
            style={{ background: '#0f172a', border: '1px solid #1e293b', color: '#cbd5e1', fontSize: '0.7rem', fontWeight: 700, borderRadius: 5, padding: '3px 6px', minWidth: 180, cursor: isPlaybackMode ? 'pointer' : 'not-allowed' }}
          >
            <option value="" disabled>Jump to Event...</option>
            {(alarms || []).slice(0, 5).map(a => (
              <option key={a.id} value={a.triggeredAt}>{new Date(a.triggeredAt || a.date).toLocaleDateString()} {new Date(a.triggeredAt || a.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | {a.equipmentTag || a.tagId}</option>
            ))}
          </select>
        </div>
      </div>

      {!hasData && isPlaybackMode && (
        <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontStyle: 'italic' }}>
          No published playback data for this facility{selectedHistoryDay !== 'Live' ? ` on ${selectedHistoryDay}` : ''}. Upload a batch and click "Publish to Dashboard" in Batch Analytics.
        </div>
      )}
    </div>
  );
}
