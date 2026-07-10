import React from 'react';
import { Box, Cylinder, Html } from '@react-three/drei';
import * as THREE from 'three';

const EquipmentLabel = ({ tag, state, onClick }) => (
 <Html position={[0, 1.5, 0]} center distanceFactor={20} zIndexRange={[100, 0]}>
 <div 
 onClick={onClick}
 style={{
 background: 'rgba(15, 23, 42, 0.8)', color: '#f8fafc', padding: '4px 8px',
 borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px',
 border: '1px solid #475569', cursor: 'pointer', whiteSpace: 'nowrap',
 pointerEvents: 'auto'
 }}
 title={`${tag}${state ? ` — ${state}` : ''}`}
 >
 {tag}
 </div>
 </Html>
);


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


export const RectangularTank = ({ id, pos, dims, color = '#94a3b8', label, onSelect }) => {
 const { w, h, d } = dims;
 return (
 <group position={pos} onClick={(e) => { e.stopPropagation(); onSelect && onSelect(id, 'Tank'); }}>
 <EquipmentLabel tag={id} />
 {/* Main Shell */}
 <Box args={[w, h, d]} position={[0, h/2, 0]} castShadow receiveShadow>
 <ProceduralMetalMaterial color={color} roughness={0.7} metalness={0.4} />
 </Box>
 {/* Vertical Ribs */}
 {[-w/2 + 0.5, 0, w/2 - 0.5].map((x, i) => (
 <Box key={i} args={[0.2, h, 0.4]} position={[x, h/2, d/2]} castShadow>
 <ProceduralMetalMaterial color={color} roughness={0.7} metalness={0.4} />
 </Box>
 ))}
 {/* Top Manway */}
 <Cylinder args={[0.8, 0.8, 0.2, 16]} position={[0, h + 0.1, 0]} castShadow>
 <ProceduralMetalMaterial color={color} roughness={0.5} metalness={0.8} />
 </Cylinder>
 {/* Ladder */}
 <group position={[-w/2 - 0.1, h/2, 0]}>
 <Box args={[0.05, h, 0.05]} position={[-0.4, 0, 0.4]} />
 <Box args={[0.05, h, 0.05]} position={[-0.4, 0, -0.4]} />
 {Array.from({ length: Math.floor(h / 0.5) }).map((_, i) => (
 <Box key={i} args={[0.05, 0.05, 0.8]} position={[-0.4, -h/2 + i * 0.5 + 0.25, 0]} />
 ))}
 </group>
 {/* Sight Glass */}
 <group position={[w/2 + 0.1, h/2, d/4]}>
 <Box args={[0.1, h * 0.8, 0.2]} position={[0, 0, 0]}>
 <meshStandardMaterial color="#334155" />
 </Box>
 <Box args={[0.11, h * 0.8 * 0.521, 0.1]} position={[0, -h * 0.8 / 2 + (h * 0.8 * 0.521) / 2, 0]}>
 <meshStandardMaterial color="#38bdf8" transparent opacity={0.8} />
 </Box>
 </group>
 </group>
 );
};

export const VerticalVessel = ({ id, pos, dims, color = '#94a3b8', label, onSelect }) => {
 const { r, h } = dims;
 return (
 <group position={pos} onClick={(e) => { e.stopPropagation(); onSelect && onSelect(id, 'Vessel'); }}>
 <EquipmentLabel tag={id} />
 {/* Shell */}
 <Cylinder args={[r, r, h, 32]} position={[0, h/2, 0]} castShadow receiveShadow>
 <ProceduralMetalMaterial color={color} roughness={0.5} metalness={0.6} />
 </Cylinder>
 {/* Top Dished Head */}
 <mesh position={[0, h, 0]} castShadow>
 <sphereGeometry args={[r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
 <ProceduralMetalMaterial color={color} roughness={0.5} metalness={0.6} />
 </mesh>
 {/* Bottom Dished Head (Skirt area) */}
 <mesh position={[0, 0, 0]} castShadow>
 <sphereGeometry args={[r, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
 <ProceduralMetalMaterial color={color} roughness={0.5} metalness={0.6} />
 </mesh>
 {/* Support Skirt */}
 <Cylinder args={[r, r, r/2, 32]} position={[0, -r/4, 0]} castShadow>
 <meshStandardMaterial color="#334155" roughness={0.9} />
 </Cylinder>
 {/* Banding Rings */}
 <Cylinder args={[r + 0.05, r + 0.05, 0.1, 32]} position={[0, h * 0.25, 0]} castShadow>
 <ProceduralMetalMaterial color="#475569" roughness={0.4} metalness={0.8} />
 </Cylinder>
 <Cylinder args={[r + 0.05, r + 0.05, 0.1, 32]} position={[0, h * 0.75, 0]} castShadow>
 <ProceduralMetalMaterial color="#475569" roughness={0.4} metalness={0.8} />
 </Cylinder>
 {/* Top Nozzle */}
 <Cylinder args={[0.2, 0.2, 0.5, 16]} position={[0, h + r/2 + 0.25, 0]} castShadow>
 <ProceduralMetalMaterial color={color} roughness={0.5} metalness={0.6} />
 </Cylinder>
 {/* Nameplate for MCF */}
 {id.startsWith('MCF') && (
 <mesh position={[0, h/2, r + 0.06]}>
 <planeGeometry args={[1.5, 0.5]} />
 <meshStandardMaterial color="#eab308" />
 <Html position={[0,0,0.01]} center distanceFactor={15} transform>
 <div style={{ color: 'black', fontWeight: 'bold', fontSize: '10px', padding: '2px' }}>{label}</div>
 </Html>
 </mesh>
 )}
 </group>
 );
};
