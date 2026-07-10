import React, { useState } from 'react';
import { Play, Pause, FastForward } from 'lucide-react';

export const HUDOverlay = ({ 
 timer = { elapsed: 142, remaining: 38 }, 
 activeTrain = 'FULL PLANT OVERVIEW', 
 onCameraJump,
 visibility,
 onToggleVisibility
}) => {
 const [isPlaying, setIsPlaying] = useState(true);
 const [speed, setSpeed] = useState(2000);

 const togglePlay = () => {
 setIsPlaying(!isPlaying);
 };

 const toggleSpeed = () => {
 const nextSpeed = speed === 2000 ? 500 : (speed === 500 ? 100 : 2000);
 setSpeed(nextSpeed);
 };
 
 return (
 <div style={{
 position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
 pointerEvents: 'none', zIndex: 10, display: 'flex', flexDirection: 'column'
 }}>
 {/* Top Bar */}
 <div style={{
 display: 'flex', justifyContent: 'space-between', alignItems: 'center',
 background: '#0f172a', color: '#f8fafc', padding: '10px 20px',
 borderBottom: '2px solid #334155', fontFamily: 'sans-serif'
 }}>
 {/* Playback Controls */}
 <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto' }}>
 <button onClick={togglePlay} className="flex items-center justify-center p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-theme-text hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
 {isPlaying ? <Pause size={16} /> : <Play size={16} />}
 </button>
 <button onClick={toggleSpeed} className="flex items-center gap-1 p-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-theme-text hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-xs font-bold">
 <FastForward size={14} /> {speed === 2000 ? '1x' : (speed === 500 ? '4x' : '20x')}
 </button>
 </div>

 {/* Camera Navigation */}
 <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto', flex: 1, justifyContent: 'center' }}>
 {["Macro Overview", "UF Trains", "RO-1 Skids", "RO-2 Skids", "RO-P Polishing Area"].map(view => (
 <button 
 key={view}
 onClick={() => onCameraJump && onCameraJump(view)}
 style={{ 
 background: activeTrain === view ? '#0ea5e9' : '#334155', 
 color: '#fff', border: '1px solid #475569', 
 padding: '6px 16px', borderRadius: '4px', fontSize: '11px', 
 fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
 letterSpacing: '1px'
 }}
 >
 {view}
 </button>
 ))}
 </div>

 <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
 <span style={{ fontSize: '14px', fontFamily: 'monospace' }}>TELEMETRY STREAM</span>
 <div style={{ background: '#22c55e', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
 LIVE
 </div>
 </div>
 </div>

 {/* Status Banner */}
 <div style={{
 background: '#1e293b', color: '#94a3b8', padding: '8px 20px', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px',
 display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #0f172a'
 }}>
 <span style={{ color: '#38bdf8' }}>{activeTrain} - LIVE TELEMETRY STREAM</span>
 
 {/* Visibility Toggles & Legend Toggle */}
 <div style={{ display: 'flex', gap: '20px', pointerEvents: 'auto', alignItems: 'center' }}>
 {visibility && (
 <>
 <span style={{ fontSize: '12px', opacity: 0.8 }}>ISOLATE ZONES:</span>
 {Object.entries(visibility).map(([skid, isVisible]) => (
 <label key={skid} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: isVisible ? '#22d3ee' : '#64748b' }}>
 <input 
 type="checkbox" 
 checked={isVisible} 
 onChange={() => onToggleVisibility && onToggleVisibility(skid)} 
 style={{ cursor: 'pointer' }}
 />
 {skid}
 </label>
 ))}
 </>
 )}
 
 <button 
 onClick={() => {
 const leg = document.getElementById('zld-legend');
 if (leg) leg.style.display = leg.style.display === 'none' ? 'block' : 'none';
 }}
 style={{ marginLeft: '10px', background: '#334155', color: '#fff', border: '1px solid #475569', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}
 >
 TOGGLE LEGEND
 </button>
 </div>
 </div>

 <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px', flex: 1, position: 'relative' }}>
 {/* ZLD Legend - Moved to Top Right below the banner, hidden by default */}
 <div id="zld-legend" style={{
 background: 'rgba(15, 23, 42, 0.95)', padding: '15px', borderRadius: '8px', color: '#cbd5e1',
 fontFamily: 'sans-serif', fontSize: '12px', height: 'max-content', pointerEvents: 'auto',
 position: 'absolute', top: '10px', right: '20px', border: '1px solid #38bdf8', display: 'none',
 boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
 }}>
 <h4 style={{ margin: '0 0 10px 0', color: '#fff', borderBottom: '1px solid #475569', paddingBottom: '6px' }}>ZLD PIPELINE MATRIX</h4>
 <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '10px' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '4px', background: '#cbd5e1' }}></div> UF Process (Silver)</div>
 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '4px', background: '#0ea5e9' }}></div> UF Permeate (Light Blue)</div>
 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '4px', background: '#1d4ed8' }}></div> RO-1 Process (Cobalt)</div>
 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '4px', background: '#eab308' }}></div> RO-1 Reject (Yellow)</div>
 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '4px', background: '#0f766e' }}></div> RO-2 Process (Emerald)</div>
 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '4px', background: '#ef4444' }}></div> RO-2 Reject (Crimson)</div>
 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '4px', background: '#06b6d4' }}></div> Final Product (Cyan)</div>
 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', background: '#22c55e', borderRadius: '2px' }}></div> Active Equipment</div>
 </div>
 </div>

 {/* Info Panel Placeholder for Selection */}
 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
 <div id="ui-info-panel" style={{
 background: 'rgba(15, 23, 42, 0.95)', padding: '20px', borderRadius: '8px', color: '#f8fafc',
 fontFamily: 'sans-serif', border: '1px solid #38bdf8', minWidth: '250px', display: 'none', pointerEvents: 'auto',
 boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
 }}>
 <h3 id="ui-info-tag" style={{ margin: '0 0 10px 0', color: '#38bdf8', letterSpacing: '1px' }}>TAG-NAME</h3>
 <div id="ui-info-content" style={{ fontSize: '14px', lineHeight: '1.6', color: '#cbd5e1' }}></div>
 </div>
 </div>
 </div>
 {/* Watermark Logo in Bottom Right */}
 <div style={{ position: 'absolute', bottom: '20px', right: '20px', pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.4 }}>
 <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#0ea5e9' }}></div>
 <strong style={{ letterSpacing: '1px', fontSize: '10px', color: '#f8fafc' }}>PERMIONICS ZLD</strong>
 </div>
 </div>
 );
};
