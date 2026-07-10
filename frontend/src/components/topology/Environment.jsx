import React, { useMemo } from 'react';
import { Box, Plane, Environment, Sky } from '@react-three/drei';
import * as THREE from 'three';

const createProceduralTexture = (width, height, type) => {
 const canvas = document.createElement('canvas');
 canvas.width = width;
 canvas.height = height;
 const context = canvas.getContext('2d');

 if (type === 'concrete') {
 context.fillStyle = '#64748b';
 context.fillRect(0, 0, width, height);
 for (let i = 0; i < 50000; i++) {
 const x = Math.random() * width;
 const y = Math.random() * height;
 const shade = Math.random() * 50;
 context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${Math.random() * 0.1})`;
 context.fillRect(x, y, 2, 2);
 }
 // Expansion joints
 context.strokeStyle = '#334155';
 context.lineWidth = 2;
 for (let x = 0; x < width; x += 100) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
 for (let y = 0; y < height; y += 100) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
 } else if (type === 'grating') {
 context.fillStyle = '#475569';
 context.fillRect(0, 0, width, height);
 context.strokeStyle = '#94a3b8';
 context.lineWidth = 1;
 for (let x = 0; x < width; x += 10) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x+10, 10); context.stroke(); }
 for (let x = 0; x < width; x += 10) { context.beginPath(); context.moveTo(x, 10); context.lineTo(x+10, 0); context.stroke(); }
 }

 const texture = new THREE.CanvasTexture(canvas);
 texture.wrapS = THREE.RepeatWrapping;
 texture.wrapT = THREE.RepeatWrapping;
 texture.repeat.set(20, 20); // Scale the floor texture
 return texture;
};

const Handrail = ({ start, end }) => {
 const length = new THREE.Vector3(...end).distanceTo(new THREE.Vector3(...start));
 const posts = Math.ceil(length / 1.5) + 1;
 const postSpacing = length / (posts - 1);
 const dir = new THREE.Vector3(...end).sub(new THREE.Vector3(...start)).normalize();
 
 return (
 <group position={start}>
 {/* Top Rail */}
 <group position={[dir.x * length / 2, 1.1, dir.z * length / 2]} rotation={[0, Math.atan2(dir.x, dir.z), 0]}>
 <mesh rotation={[Math.PI / 2, 0, 0]}>
 <cylinderGeometry args={[0.03, 0.03, length, 8]} />
 <meshStandardMaterial color="#eab308" roughness={0.6} />
 </mesh>
 </group>
 {/* Mid Rail */}
 <group position={[dir.x * length / 2, 0.55, dir.z * length / 2]} rotation={[0, Math.atan2(dir.x, dir.z), 0]}>
 <mesh rotation={[Math.PI / 2, 0, 0]}>
 <cylinderGeometry args={[0.02, 0.02, length, 8]} />
 <meshStandardMaterial color="#eab308" roughness={0.6} />
 </mesh>
 </group>
 {/* Posts */}
 {Array.from({ length: posts }).map((_, i) => (
 <mesh key={i} position={[dir.x * i * postSpacing, 0.55, dir.z * i * postSpacing]}>
 <cylinderGeometry args={[0.03, 0.03, 1.1, 8]} />
 <meshStandardMaterial color="#eab308" roughness={0.6} />
 </mesh>
 ))}
 </group>
 );
};

export const PlantEnvironment = () => {
 const concreteTexture = useMemo(() => createProceduralTexture(512, 512, 'concrete'), []);
 const gratingTexture = useMemo(() => {
 const tex = createProceduralTexture(128, 128, 'grating');
 tex.repeat.set(5, 5);
 return tex;
 }, []);

 return (
 <group>
 {/* Lighting Rig - Cinematic */}
 <ambientLight intensity={0.2} color="#ffffff" />
 {/* Warm Key Light */}
 <directionalLight position={[20, 30, 10]} intensity={1.5} color="#fff1e6" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-50} shadow-camera-right={50} shadow-camera-top={50} shadow-camera-bottom={-50} />
 {/* Cool Fill Light */}
 <directionalLight position={[-20, 20, -20]} intensity={0.5} color="#e0f2fe" />
 {/* Accent Lights */}
 <pointLight position={[-35, 5, 5]} intensity={2.0} color="#fbbf24" distance={15} />
 <pointLight position={[20, 5, -10]} intensity={2.0} color="#38bdf8" distance={15} />

 {/* Procedural Reflection Cubemap (Local, no preset) */}
 <Environment resolution={256} frames={1}>
 {/* Simple sky sphere for reflections */}
 <mesh scale={100}>
 <sphereGeometry args={[1, 32, 32]} />
 <meshBasicMaterial color="#e2e8f0" side={THREE.BackSide} />
 </mesh>
 <directionalLight position={[10, 10, 10]} intensity={1} />
 </Environment>

 {/* Main Concrete Floor */}
 <Plane args={[350, 150]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[100, -0.01, 0]}>
 <meshStandardMaterial map={concreteTexture} roughness={0.9} metalness={0.1} color="#cbd5e1" />
 </Plane>

 {/* Grating Platforms */}
 <Plane args={[12, 8]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[-7, 0.01, 14]}>
 <meshStandardMaterial map={gratingTexture} roughness={0.7} metalness={0.6} color="#94a3b8" />
 </Plane>
 <Plane args={[8, 8]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[2, 0.01, -10]}>
 <meshStandardMaterial map={gratingTexture} roughness={0.7} metalness={0.6} color="#94a3b8" />
 </Plane>

 {/* Handrails */}
 <Handrail start={[-40, 0, -2]} end={[-40, 0, 10]} />
 <Handrail start={[-2, 0, 16]} end={[-12, 0, 16]} />
 </group>
 );
};
