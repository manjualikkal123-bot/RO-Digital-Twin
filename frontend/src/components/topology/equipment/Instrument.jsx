import React, { useRef } from 'react';
import { Cylinder, Box, Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';


let sharedNoiseTex = null;
const getSharedNoiseTex = () => {
 if (!sharedNoiseTex) {
 const canvas = document.createElement('canvas');
 canvas.width = 128; canvas.height = 128;
 const ctx = canvas.getContext('2d');
 ctx.fillStyle = '#fff';
 ctx.fillRect(0, 0, 128, 128);
 for (let i = 0; i < 5000; i++) {
 const shade = 200 + Math.random() * 55;
 ctx.fillStyle = `rgba(${shade},${shade},${shade},${Math.random() * 0.1})`;
 ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
 }
 // We assume THREE is in scope because all these files import THREE
 sharedNoiseTex = new THREE.CanvasTexture(canvas);
 sharedNoiseTex.wrapS = sharedNoiseTex.wrapT = THREE.RepeatWrapping;
 sharedNoiseTex.repeat.set(2, 2);
 }
 return sharedNoiseTex;
};

const ProceduralMetalMaterial = ({ color, roughness = 0.5, metalness = 0.6 }) => {
 return <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} map={getSharedNoiseTex()} />;
};


const getInstrumentColor = (type, state) => {
 if (type === 'switch') {
 return state === 'active' ? '#ef4444' : '#22c55e';
 }
 switch (type) {
 case 'level': return '#3b82f6'; // blue
 case 'pressure': return '#eab308'; // yellow
 case 'flow': return '#14b8a6'; // teal/green
 case 'dp': return '#f97316'; // orange
 case 'speed': return '#a855f7'; // purple
 default: return '#cbd5e1';
 }
};

const getStatusColor = (state) => {
 if (state === 'normal') return '#22c55e'; // Green
 if (state === 'warning') return '#eab308'; // Amber
 if (state === 'critical') return '#ef4444'; // Red
 return '#94a3b8'; // Grey (offline)
};

export const Instrument = ({ id, type, pos, value, state, onSelect }) => {
 const lensColor = getInstrumentColor(type, state);
 const statusColor = getStatusColor(state);
 const isRunning = state === 'normal' || state === 'warning' || state === 'critical';
 
 const poleRef = useRef();
 
 useFrame((sceneState) => {
 if (poleRef.current && isRunning) {
 const pulse = (Math.sin(sceneState.clock.elapsedTime * 4) + 1) / 3; 
 poleRef.current.emissiveIntensity = pulse;
 } else if (poleRef.current) {
 poleRef.current.emissiveIntensity = 0;
 }
 });

 return (
 <group position={pos} onClick={(e) => { e.stopPropagation(); onSelect && onSelect(id, 'Instrument', value); }}>
 {/* Pipe Stand (Pole) - Animated Status Color */}
 <Cylinder args={[0.02, 0.02, 0.4, 8]} position={[0, -0.2, 0]} castShadow>
 <meshStandardMaterial 
 ref={poleRef}
 color={statusColor} 
 emissive={statusColor}
 emissiveIntensity={0}
 roughness={0.4} 
 metalness={0.6} 
 />
 </Cylinder>
 {/* Gauge Housing */}
 <Cylinder args={[0.12, 0.12, 0.05, 32]} rotation={[Math.PI/2, 0, 0]} castShadow>
 <ProceduralMetalMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
 </Cylinder>
 {/* Gauge Face / Lens */}
 <Cylinder args={[0.1, 0.1, 0.06, 32]} rotation={[Math.PI/2, 0, 0]} position={[0, 0, 0.01]} castShadow>
 <meshStandardMaterial color={lensColor} roughness={0.1} metalness={0.2} />
 </Cylinder>
 
 {/* Floating Readout Label */}
 <Html position={[0, 0.25, 0]} center distanceFactor={15} zIndexRange={[100, 0]}>
 <div 
 style={{
 background: 'rgba(15, 23, 42, 0.9)', color: '#f8fafc', padding: '4px 8px',
 borderRadius: '4px', fontFamily: 'monospace', fontSize: '10px',
 border: `1px solid ${lensColor}`, textAlign: 'center', pointerEvents: 'auto',
 boxShadow: isRunning ? `0 0 8px ${statusColor}80` : 'none'
 }}
 >
 <div style={{ fontWeight: 'bold' }}>{id}</div>
 {value && <div style={{ color: lensColor, marginTop: '2px' }}>{value}</div>}
 </div>
 </Html>
 </group>
 );
};
