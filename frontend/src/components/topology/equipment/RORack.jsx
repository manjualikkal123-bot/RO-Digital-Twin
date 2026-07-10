import React from 'react';
import { Cylinder, Html, Box } from '@react-three/drei';
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


// A single horizontal pressure vessel
const ROVessel = ({ position, label, onSelect, id }) => {
 const r = 0.4;
 const h = 8; // length of the vessel along Z axis
 return (
 <group position={position} onClick={(e) => { e.stopPropagation(); onSelect && onSelect(id || label, 'ROVessel'); }}>
 {/* Main shell */}
 <Cylinder args={[r, r, h, 32]} rotation={[Math.PI/2, 0, 0]} castShadow receiveShadow>
 {label === 'PV-201' ? (
 <meshStandardMaterial color="#ef4444" roughness={0.3} metalness={0.2} emissive="#dc2626" emissiveIntensity={0.5} />
 ) : (
 <ProceduralMetalMaterial color="#e2e8f0" roughness={0.2} metalness={0.1} />
 )}
 </Cylinder>
 {/* End Caps */}
 <mesh position={[0, 0, h/2]} rotation={[Math.PI/2, 0, 0]} castShadow>
 <sphereGeometry args={[r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
 <ProceduralMetalMaterial color="#cbd5e1" roughness={0.4} />
 </mesh>
 <mesh position={[0, 0, -h/2]} rotation={[-Math.PI/2, 0, 0]} castShadow>
 <sphereGeometry args={[r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
 <ProceduralMetalMaterial color="#cbd5e1" roughness={0.4} />
 </mesh>
 {/* Banding Lines */}
 {[-2.5, 0, 2.5].map(zOffset => (
 <Cylinder key={zOffset} args={[r + 0.02, r + 0.02, 0.08, 32]} rotation={[Math.PI/2, 0, 0]} position={[0, 0, zOffset]} castShadow>
 <meshStandardMaterial color="#94a3b8" roughness={0.6} />
 </Cylinder>
 ))}
 <Html position={[0, r + 0.2, h/2 - 1]} center distanceFactor={15} zIndexRange={[100, 0]}>
 <div style={{ 
 color: label === 'PV-201' ? '#ef4444' : '#0f172a', 
 fontWeight: '900', 
 fontSize: '18px', 
 background: label === 'PV-201' ? 'rgba(255, 200, 200, 0.9)' : 'rgba(255,255,255,0.8)', 
 padding: '4px 8px', 
 borderRadius: '4px',
 border: label === 'PV-201' ? '2px solid #ef4444' : '1px solid #94a3b8',
 boxShadow: label === 'PV-201' ? '0 0 10px #ef4444' : 'none'
 }}>{label}</div>
 </Html>
 </group>
 );
};

export const RORack = ({ pos, stages = [6, 4, 2], label, onSelect, id }) => {
 // stages is an array indicating the number of vertical vessels in each block left to right.
 // e.g. [6, 4, 2] means 3 blocks.
 const blockSpacingX = 4;
 const vesselSpacingY = 1.1;

 const totalWidth = (stages.length - 1) * blockSpacingX;
 const startX = 0; // The rack starts at pos X, building out to the right.

 return (
 <group position={pos} onClick={(e) => { e.stopPropagation(); onSelect && onSelect(id || label, 'RORack'); }}>
 <Html position={[totalWidth / 2, stages[0] * vesselSpacingY + 1.5, 0]} center distanceFactor={30}>
 <div style={{ background: 'rgba(15, 23, 42, 0.9)', color: '#06b6d4', padding: '8px 16px', borderRadius: '4px', border: '1px solid #0891b2', fontWeight: '900', fontSize: '16px', letterSpacing: '2px', textTransform: 'uppercase' }}>
 {label}
 </div>
 </Html>

 {/* Render the structural skid base */}
 <Box args={[totalWidth + 3, 0.4, 6]} position={[totalWidth / 2, -0.2, 0]} castShadow receiveShadow>
 <ProceduralMetalMaterial color="#334155" roughness={0.9} metalness={0.4} />
 </Box>

 {/* Render the vessel blocks */}
 {stages.map((vesselCount, stageIdx) => {
 const xPos = startX + stageIdx * blockSpacingX;
 return (
 <group key={`stage-${stageIdx}`} position={[xPos, 0, 0]}>
 {/* Vertical Support Struts */}
 <Box args={[0.2, vesselCount * vesselSpacingY, 0.2]} position={[-0.8, (vesselCount * vesselSpacingY) / 2, 2]} castShadow>
 <ProceduralMetalMaterial color="#475569" roughness={0.8} />
 </Box>
 <Box args={[0.2, vesselCount * vesselSpacingY, 0.2]} position={[0.8, (vesselCount * vesselSpacingY) / 2, 2]} castShadow>
 <ProceduralMetalMaterial color="#475569" roughness={0.8} />
 </Box>
 <Box args={[0.2, vesselCount * vesselSpacingY, 0.2]} position={[-0.8, (vesselCount * vesselSpacingY) / 2, -2]} castShadow>
 <ProceduralMetalMaterial color="#475569" roughness={0.8} />
 </Box>
 <Box args={[0.2, vesselCount * vesselSpacingY, 0.2]} position={[0.8, (vesselCount * vesselSpacingY) / 2, -2]} castShadow>
 <ProceduralMetalMaterial color="#475569" roughness={0.8} />
 </Box>

 {/* Vessels */}
 {Array.from({ length: vesselCount }).map((_, vIdx) => {
 const yPos = 0.8 + vIdx * vesselSpacingY; // start slightly above the base
 const pvLabel = `PV-${stageIdx + 1}0${vIdx + 1}`;
 return <ROVessel key={`v-${vIdx}`} position={[0, yPos, 0]} label={pvLabel} />;
 })}
 </group>
 );
 })}
 </group>
 );
};
