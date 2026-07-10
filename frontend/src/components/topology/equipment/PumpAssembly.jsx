import React, { useRef } from 'react';
import { Box, Cylinder, Html } from '@react-three/drei';
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


const EquipmentLabel = ({ tag, state, rpm, onClick }) => (
 <Html position={[0, 1.5, 0]} center distanceFactor={20} zIndexRange={[100, 0]}>
 <div 
 onClick={onClick}
 style={{
 background: 'rgba(15, 23, 42, 0.8)', color: '#f8fafc', padding: '4px 8px',
 borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px',
 border: '1px solid #475569', cursor: 'pointer', whiteSpace: 'nowrap',
 pointerEvents: 'auto', textAlign: 'center'
 }}
 >
 <div style={{ fontWeight: 'bold' }}>{tag}</div>
 {state && <div style={{ fontSize: '10px', color: state === 'Running' ? '#22c55e' : '#ef4444' }}>{state}</div>}
 {rpm && <div style={{ fontSize: '10px', color: '#cbd5e1' }}>{rpm} RPM</div>}
 </div>
 </Html>
);

export const PumpAssembly = ({ id, pos, state, rpm, color, label, onSelect }) => {
 const isRunning = state === 'Running';
 const shaftRef = useRef();

 useFrame((state, delta) => {
 if (isRunning && shaftRef.current) {
 shaftRef.current.rotation.x += delta * 15; // Fast spin
 }
 });

 const motorColor = '#475569';
 const baseColor = '#334155';
 
 return (
 <group position={pos} onClick={(e) => { e.stopPropagation(); onSelect && onSelect(id, 'Pump'); }}>
 <EquipmentLabel tag={id} state={state} rpm={rpm} />
 
 {/* Baseplate */}
 <Box args={[1.5, 0.1, 0.8]} position={[0, 0.05, 0]} castShadow receiveShadow>
 <ProceduralMetalMaterial color={baseColor} roughness={0.8} metalness={0.2} />
 </Box>
 {/* Anchor Bolts */}
 {[-0.6, 0.6].map(x => [-0.3, 0.3].map(z => (
 <Cylinder key={`${x}-${z}`} args={[0.03, 0.03, 0.15]} position={[x, 0.1, z]} castShadow>
 <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.4} />
 </Cylinder>
 )))}

 {/* Volute Casing (Pump Body) */}
 <Cylinder args={[0.4, 0.4, 0.3, 32]} rotation={[Math.PI/2, 0, 0]} position={[-0.4, 0.5, 0]} castShadow>
 <ProceduralMetalMaterial color={color} roughness={0.6} metalness={0.3} />
 </Cylinder>
 
 {/* Suction Nozzle (Front) */}
 <Cylinder args={[0.15, 0.15, 0.3, 16]} rotation={[0, 0, Math.PI/2]} position={[-0.7, 0.5, 0]} castShadow>
 <ProceduralMetalMaterial color={color} roughness={0.6} metalness={0.3} />
 </Cylinder>
 <Cylinder args={[0.2, 0.2, 0.05, 16]} rotation={[0, 0, Math.PI/2]} position={[-0.85, 0.5, 0]} castShadow>
 <ProceduralMetalMaterial color={color} roughness={0.6} metalness={0.3} />
 </Cylinder>

 {/* Discharge Nozzle (Top) */}
 <Cylinder args={[0.15, 0.15, 0.3, 16]} position={[-0.4, 0.9, 0]} castShadow>
 <ProceduralMetalMaterial color={color} roughness={0.6} metalness={0.3} />
 </Cylinder>
 <Cylinder args={[0.2, 0.2, 0.05, 16]} position={[-0.4, 1.05, 0]} castShadow>
 <ProceduralMetalMaterial color={color} roughness={0.6} metalness={0.3} />
 </Cylinder>

 {/* Coupling Guard (Yellow) */}
 <mesh position={[0, 0.5, 0]} rotation={[0, 0, -Math.PI/2]} castShadow>
 <cylinderGeometry args={[0.15, 0.15, 0.4, 16, 1, false, 0, Math.PI]} />
 <meshStandardMaterial color="#eab308" roughness={0.7} side={THREE.DoubleSide} />
 </mesh>

 {/* Spinning Shaft */}
 <Cylinder ref={shaftRef} args={[0.05, 0.05, 0.6, 8]} rotation={[0, 0, Math.PI/2]} position={[0, 0.5, 0]} castShadow>
 <ProceduralMetalMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
 </Cylinder>

 {/* Motor Housing */}
 <Cylinder args={[0.3, 0.3, 0.6, 32]} rotation={[0, 0, Math.PI/2]} position={[0.5, 0.5, 0]} castShadow>
 <ProceduralMetalMaterial color={motorColor} roughness={0.7} metalness={0.4} />
 </Cylinder>
 {/* Motor Fins */}
 {Array.from({ length: 8 }).map((_, i) => (
 <Box key={i} args={[0.5, 0.05, 0.65]} rotation={[Math.PI/4 * i, 0, 0]} position={[0.5, 0.5, 0]} castShadow>
 <ProceduralMetalMaterial color={motorColor} roughness={0.7} metalness={0.4} />
 </Box>
 ))}

 {/* Indicator Light */}
 <group position={[0.5, 0.85, 0]}>
 <Cylinder args={[0.04, 0.04, 0.05]} position={[0, 0, 0]}>
 <meshStandardMaterial color="#334155" />
 </Cylinder>
 <mesh position={[0, 0.05, 0]}>
 <sphereGeometry args={[0.04, 16, 16]} />
 <meshBasicMaterial color={isRunning ? '#22c55e' : '#ef4444'} />
 </mesh>
 </group>
 </group>
 );
};
