import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const getPipeColor = (colorCode) => {
 if (colorCode && colorCode.startsWith('#')) return colorCode;
 switch (colorCode) {
 case 'WHITE': return '#f8fafc'; // Process water
 case 'BLUE': 
 case 'SKYBLUE': return '#0ea5e9'; // Permeate / RO feed / Soft water
 case 'CYAN': return '#06b6d4'; // Bright Cyan for final product
 case 'NAVY': return '#1e3a8a'; // Matte Navy Blue for Lamella
 case 'YELLOW': return '#eab308'; // RO-1 Reject
 case 'RED': return '#ef4444'; // Reject / high-pressure header
 case 'ORANGE': return '#f97316'; // CIP chemical circulation (new)
 case 'GRAY': return '#94a3b8'; // Utility / Raw feed / Drain
 default: return '#cbd5e1';
 }
};

const FlangeBolts = ({ count = 8, radius = 0.22, matrices }) => {
 const meshRef = useRef();
 useLayoutEffect(() => {
 if (!meshRef.current || !matrices) return;
 let idx = 0;
 const dummy = new THREE.Object3D();
 
 // For each joint matrix
 matrices.forEach(jointMatrix => {
 // Create 'count' bolts around the flange
 for (let i = 0; i < count; i++) {
 const angle = (i / count) * Math.PI * 2;
 dummy.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
 dummy.rotation.set(0, 0, 0);
 dummy.scale.set(1, 1, 1);
 dummy.updateMatrix();
 
 // Multiply by the joint's transform to place the bolt ring in world space
 const finalMatrix = new THREE.Matrix4().multiplyMatrices(jointMatrix, dummy.matrix);
 meshRef.current.setMatrixAt(idx++, finalMatrix);
 }
 });
 meshRef.current.instanceMatrix.needsUpdate = true;
 }, [matrices, count, radius]);

 if (!matrices || matrices.length === 0) return null;

 return (
 <instancedMesh ref={meshRef} args={[null, null, matrices.length * count]} castShadow>
 <cylinderGeometry args={[0.02, 0.02, 0.08, 8]} />
 <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.4} />
 </instancedMesh>
 );
};

export const PipeNetwork = ({ pipes }) => {
 const radius = 0.18;
 
 // Create an animated dashed texture for flow indication
 const flowTexture = useMemo(() => {
 const canvas = document.createElement('canvas');
 canvas.width = 64; canvas.height = 256;
 const ctx = canvas.getContext('2d');
 ctx.fillStyle = '#fff';
 ctx.fillRect(0, 0, 64, 256);
 // Draw flow arrows / dashes
 ctx.fillStyle = '#cbd5e1';
 ctx.fillRect(0, 0, 64, 128);
 const tex = new THREE.CanvasTexture(canvas);
 tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
 tex.repeat.set(1, 10);
 return tex;
 }, []);

 const materialsRef = useRef([]);
 const flowSpeedsRef = useRef([]);

 useFrame((_, delta) => {
 materialsRef.current.forEach((mat, i) => {
 if (mat && mat.map) {
 const speed = flowSpeedsRef.current[i] ?? 1.0;
 // Only scroll if flow is active
 mat.map.offset.y -= delta * 1.5 * speed;
 }
 });
 });

 // Calculate joint matrices for flanges
 const flangeMatrices = useMemo(() => {
 const matrices = [];
 pipes.forEach(pipe => {
 for (let i = 0; i < pipe.points.length; i++) {
 const pt = pipe.points[i];
 const vec = new THREE.Vector3(...pt);
 const matrix = new THREE.Matrix4();
 
 // Determine rotation to face the pipe direction
 let dir = new THREE.Vector3(0, 1, 0);
 if (i < pipe.points.length - 1) {
 dir.subVectors(new THREE.Vector3(...pipe.points[i+1]), vec).normalize();
 } else if (i > 0) {
 dir.subVectors(vec, new THREE.Vector3(...pipe.points[i-1])).normalize();
 }
 
 const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
 matrix.compose(vec, quaternion, new THREE.Vector3(1, 1, 1));
 matrices.push(matrix);
 }
 });
 return matrices;
 }, [pipes]);

 // Calculate smart junction spheres (elbows)
 const junctionSpheres = useMemo(() => {
 const map = new Map();
 pipes.forEach(pipe => {
 const r = pipe.radius || radius;
 pipe.points.forEach(pt => {
 const key = `${pt[0].toFixed(2)},${pt[1].toFixed(2)},${pt[2].toFixed(2)}`;
 if (!map.has(key)) {
 map.set(key, { pos: new THREE.Vector3(...pt), radius: r, color: pipe.color });
 } else {
 // Keep largest radius for diameter transitions
 const existing = map.get(key);
 if (r > existing.radius) {
 existing.radius = r;
 }
 }
 });
 });
 return Array.from(map.values());
 }, [pipes, radius]);

 return (
 <group>
 {pipes.map((pipe, idx) => {
 const points = pipe.points.map(p => new THREE.Vector3(...p));
 const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0);
 const color = getPipeColor(pipe.color);

 const tex = flowTexture.clone();
 tex.needsUpdate = true;
 const length = curve.getLength();
 tex.repeat.set(1, length / 2);
 
 flowSpeedsRef.current[idx] = pipe.flowSpeed ?? 1.0;

 return (
 <mesh key={pipe.id} castShadow receiveShadow>
 <tubeGeometry args={[curve, Math.max(points.length * 4, 64), pipe.radius || radius, 16, false]} />
 <meshStandardMaterial 
 ref={el => materialsRef.current[idx] = el}
 color={color} 
 roughness={0.3} 
 metalness={0.4} 
 map={tex} 
 />
 </mesh>
 );
 })}

 {/* Elbow/Junction Spheres */}
 {junctionSpheres.map((sphere, idx) => (
 <mesh key={`elbow-${idx}`} position={sphere.pos} castShadow receiveShadow>
 <sphereGeometry args={[sphere.radius, 16, 16]} />
 <meshStandardMaterial color={getPipeColor(sphere.color)} roughness={0.3} metalness={0.4} />
 </mesh>
 ))}

 {/* Flanges at every joint */}
 <instancedMesh args={[null, null, flangeMatrices.length]} castShadow>
 <cylinderGeometry args={[radius + 0.08, radius + 0.08, 0.05, 32]} />
 <meshStandardMaterial color="#64748b" roughness={0.6} metalness={0.5} />
 {flangeMatrices.map((mat, i) => (
 <primitive key={i} object={new THREE.Object3D()} />
 ))}
 </instancedMesh>

 {/* Since we don't have direct access to setMatrixAt inside declarative return without a ref easily, 
 let's just do it cleanly via a small component or just use <Instances> */}
 <Flanges matrices={flangeMatrices} radius={radius} />
 <FlangeBolts matrices={flangeMatrices} radius={radius + 0.04} count={8} />
 </group>
 );
};

const Flanges = ({ matrices, radius }) => {
 const meshRef = useRef();
 useLayoutEffect(() => {
 if (!meshRef.current || !matrices) return;
 matrices.forEach((mat, i) => {
 meshRef.current.setMatrixAt(i, mat);
 });
 meshRef.current.instanceMatrix.needsUpdate = true;
 }, [matrices]);

 return (
 <instancedMesh ref={meshRef} args={[null, null, matrices.length]} castShadow receiveShadow>
 <cylinderGeometry args={[radius + 0.08, radius + 0.08, 0.06, 32]} />
 <meshStandardMaterial color="#475569" roughness={0.6} metalness={0.5} />
 </instancedMesh>
 );
};
