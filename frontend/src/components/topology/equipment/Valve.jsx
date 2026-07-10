import React, { useRef, useLayoutEffect } from 'react';
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


const BonnetBolts = ({ radius, count }) => {
 const meshRef = useRef();
 useLayoutEffect(() => {
 if (!meshRef.current) return;
 const dummy = new THREE.Object3D();
 for (let i = 0; i < count; i++) {
 const angle = (i / count) * Math.PI * 2;
 dummy.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
 dummy.updateMatrix();
 meshRef.current.setMatrixAt(i, dummy.matrix);
 }
 meshRef.current.instanceMatrix.needsUpdate = true;
 }, [radius, count]);

 return (
 <instancedMesh ref={meshRef} args={[null, null, count]} castShadow>
 <cylinderGeometry args={[0.02, 0.02, 0.05, 8]} />
 <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.4} />
 </instancedMesh>
 );
};

export const Valve = ({ id, pos, state, axis, onSelect }) => {
 const isOpen = state === 'Open';
 const vaneRef = useRef();
 
 // Smoothly animate the vane rotation
 useFrame((_, delta) => {
 if (!vaneRef.current) return;
 const targetAngle = isOpen ? 0 : Math.PI / 2;
 vaneRef.current.rotation.y = THREE.MathUtils.lerp(vaneRef.current.rotation.y, targetAngle, delta * 5);
 });

 // Rotation based on pipe axis. If pipe is X, valve body spans X, actuator points up Y.
 // If pipe is Y, valve body spans Y, actuator points X or Z. The brief says "which determines the valve's rotation so it sits correctly across the pipe".
 // Let's assume actuator always points +Y unless axis is Y, then actuator points +X.
 const groupRot = axis === 'Y' ? [0, 0, -Math.PI / 2] : [0, 0, 0];

 return (
 <group position={pos} rotation={groupRot} onClick={(e) => { e.stopPropagation(); onSelect && onSelect(id, 'Valve', state); }}>
 
 {/* Valve Body */}
 <Cylinder args={[0.15, 0.15, 0.4, 16]} rotation={[0, 0, Math.PI/2]} castShadow>
 <ProceduralMetalMaterial color="#64748b" roughness={0.6} />
 </Cylinder>
 <Cylinder args={[0.1, 0.12, 0.15, 16]} position={[0, 0.075, 0]} castShadow>
 <ProceduralMetalMaterial color="#64748b" roughness={0.6} />
 </Cylinder>
 
 {/* Bonnet Bolt Ring (Instanced) */}
 <group position={[0, 0.15, 0]}>
 <Cylinder args={[0.18, 0.18, 0.04, 16]} castShadow>
 <ProceduralMetalMaterial color="#64748b" roughness={0.6} />
 </Cylinder>
 <group position={[0, 0.02, 0]}>
 <BonnetBolts radius={0.14} count={8} />
 </group>
 </group>

 {/* Yoke Struts */}
 <Box args={[0.04, 0.3, 0.04]} position={[0.1, 0.3, 0]} castShadow>
 <ProceduralMetalMaterial color="#94a3b8" />
 </Box>
 <Box args={[0.04, 0.3, 0.04]} position={[-0.1, 0.3, 0]} castShadow>
 <ProceduralMetalMaterial color="#94a3b8" />
 </Box>
 <Cylinder args={[0.02, 0.02, 0.3, 8]} position={[0, 0.3, 0]} castShadow>
 <ProceduralMetalMaterial color="#cbd5e1" metalness={0.9} />
 </Cylinder>

 {/* Pneumatic Actuator Housing */}
 <Cylinder args={[0.2, 0.2, 0.25, 32]} position={[0, 0.55, 0]} castShadow>
 <ProceduralMetalMaterial color="#e2e8f0" roughness={0.3} metalness={0.5} />
 </Cylinder>

 {/* Rotating Position Indicator Vane */}
 <group position={[0, 0.7, 0]} ref={vaneRef}>
 <Cylinder args={[0.08, 0.08, 0.02, 16]} position={[0, 0, 0]}>
 <meshStandardMaterial color="#cbd5e1" />
 </Cylinder>
 <Box args={[0.16, 0.04, 0.02]} position={[0, 0.02, 0]}>
 <meshStandardMaterial color={isOpen ? '#22c55e' : '#ef4444'} />
 </Box>
 </group>

 {/* Indicator Light LED */}
 <mesh position={[0, 0.75, 0]}>
 <sphereGeometry args={[0.03, 16, 16]} />
 <meshBasicMaterial color={isOpen ? '#22c55e' : '#ef4444'} />
 </mesh>

 {/* Always-visible tag plate */}
 {/* We counter-rotate the HTML so it always reads upright even if the valve group is rotated */}
 <group rotation={axis === 'Y' ? [0, 0, Math.PI / 2] : [0, 0, 0]}>
 <Html position={[0, -0.3, 0.1]} center distanceFactor={20} zIndexRange={[100, 0]}>
 <div 
 style={{
 background: '#0f172a', color: '#e2e8f0', padding: '2px 4px',
 fontFamily: 'monospace', fontSize: '9px', border: '1px solid #475569',
 pointerEvents: 'none'
 }}
 >
 {id}
 </div>
 </Html>
 </group>

 </group>
 );
};
