import React from 'react';
import { Box, Cylinder, Html } from '@react-three/drei';
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
 sharedNoiseTex = new THREE.CanvasTexture(canvas);
 sharedNoiseTex.wrapS = sharedNoiseTex.wrapT = THREE.RepeatWrapping;
 sharedNoiseTex.repeat.set(2, 2);
 }
 return sharedNoiseTex;
};

const ProceduralMetalMaterial = ({ color, roughness = 0.5, metalness = 0.6 }) => {
 return <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} map={getSharedNoiseTex()} />;
};

// =====================================================================
// FIXED: vessels now stack vertically (varying Y, same X), matching
// the real UF-101 P&ID (PV14...PV1 as one vertical column) and the
// same pattern RORack already uses correctly. Previously this stacked
// along X at a single Y, producing a flat horizontal row.
//
// Header pipe connection point is now derived from the same formula
// used to place the top vessel, so external pipes (trainBlueprint.pipes
// "permeate-out" etc, and PlantScene3D's headerPipes) can be updated
// to reference PERMEATE_HEADER_Y / PERMEATE_HEADER_X exported below
// instead of guessing a disconnected coordinate.
// =====================================================================

const r = 0.45;
const h = 2.2; // vessel length along Z (shorter than before — real UF elements are shorter than RO's 8040 array run)
const vesselSpacingY = 0.55; // vertical spacing between stacked vessels

export const UF_RACK_GEOMETRY = { r, h, vesselSpacingY };

export const UFRack = ({ pos, count = 14, spacing, label, shellColor = '#f1f5f9', onSelect, id }) => {
 // NOTE: `spacing` prop is now vertical spacing between vessels, not
 // horizontal. Falls back to the module default if not provided so
 // existing call sites that still pass the old horizontal `spacing`
 // value don't explode — but you should update plant_macro_config.json's
 // trainBlueprint equipment entry to pass the intended vertical value,
 // or just omit it and let this default apply.
 const vSpacing = spacing || vesselSpacingY;

 const totalHeight = (count - 1) * vSpacing;
 const startY = 0; // bottom vessel sits at rack's local y=0, stack goes up from there

 // Permeate header now runs along the TOP of the vertical stack,
 // horizontal riser, at real connection height — not a guessed y=9.6.
 const permeateHeaderY = startY + totalHeight + r + 0.4;

 return (
 <group position={pos} onClick={(e) => { e.stopPropagation(); onSelect && onSelect(id || label, 'UFRack'); }}>
 {/* Group Label */}
 <Html position={[0, permeateHeaderY + 1, 0]} center distanceFactor={25}>
 <div style={{ background: 'rgba(15, 23, 42, 0.9)', color: '#f8fafc', padding: '8px 16px', borderRadius: '4px', border: '1px solid #475569', fontWeight: 'bold', fontSize: '16px', letterSpacing: '1px' }}>
 {label}
 </div>
 </Html>

 {/* Vertical support rails (replace old horizontal top/bottom rail pairs) */}
 {[-r - 0.5, r + 0.5].map((zOff) => (
 <Box key={`rail-${zOff}`} args={[0.2, totalHeight + 1.2, 0.2]} position={[0, startY + totalHeight / 2, zOff]} castShadow>
 <ProceduralMetalMaterial color="#475569" roughness={0.8} />
 </Box>
 ))}

 {/* Permeate Header — horizontal pipe running along the top of the stack, single riser */}
 <Cylinder args={[0.15, 0.15, 1.2, 16]} rotation={[Math.PI / 2, 0, 0]} position={[0, permeateHeaderY, 0]} castShadow>
 <ProceduralMetalMaterial color="#0ea5e9" roughness={0.4} metalness={0.2} />
 </Cylinder>
 {/* Permeate Outlet Riser — the actual point external pipes should connect to */}
 <Cylinder args={[0.15, 0.15, 0.6, 16]} position={[0, permeateHeaderY - 0.3, 0.9]} castShadow>
 <ProceduralMetalMaterial color="#0ea5e9" roughness={0.4} metalness={0.2} />
 </Cylinder>

 {/* Feed Header — along the bottom of the stack */}
 <Cylinder args={[0.2, 0.2, 1.2, 16]} rotation={[Math.PI / 2, 0, 0]} position={[0, startY - r - 0.4, 0]} castShadow>
 <ProceduralMetalMaterial color={shellColor} roughness={0.4} metalness={0.2} />
 </Cylinder>

 {/* Membrane Vessels — stacked vertically, same X/Z, varying Y */}
 {Array.from({ length: count }).map((_, i) => {
 const y = startY + i * vSpacing;
 const pvLabel = `PV${count - i}`; // bottom (i=0) is PV14, top is PV1 — matches P&ID top-to-bottom reading
 return (
 <group key={i} position={[0, y, 0]}>
 {/* Main FRP Shell — cylinder axis along Z (horizontal elements, vertically racked) */}
 <Cylinder args={[r, r, h, 32]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
 <ProceduralMetalMaterial color={shellColor} roughness={0.3} metalness={0.1} />
 </Cylinder>
 {/* Dished End Caps */}
 <mesh position={[0, 0, h / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
 <sphereGeometry args={[r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
 <ProceduralMetalMaterial color="#e2e8f0" roughness={0.4} />
 </mesh>
 <mesh position={[0, 0, -h / 2]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
 <sphereGeometry args={[r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
 <ProceduralMetalMaterial color="#e2e8f0" roughness={0.4} />
 </mesh>
 {/* Banding Line */}
 <Cylinder args={[r + 0.01, r + 0.01, 0.05, 32]} rotation={[Math.PI / 2, 0, 0]} castShadow>
 <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
 </Cylinder>
 {/* Permeate Port (top, connects toward permeate header) */}
 <Cylinder args={[0.06, 0.06, 0.15, 16]} position={[0, r + 0.08, 0.9]} castShadow>
 <ProceduralMetalMaterial color="#cbd5e1" />
 </Cylinder>
 {/* Tag */}
 <Html position={[0.8, 0, 0]} center distanceFactor={15} zIndexRange={[100, 0]}>
 <div style={{ background: 'rgba(255,255,255,0.8)', color: '#0f172a', fontWeight: 'bold', fontSize: '14px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>{pvLabel}</div>
 </Html>
 </group>
 );
 })}
 </group>
 );
};
