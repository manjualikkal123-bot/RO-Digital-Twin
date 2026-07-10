import { useState, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Box } from '@react-three/drei';
import { EffectComposer, ToneMapping, SSAO } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

import { PlantEnvironment } from './Environment';
import { HUDOverlay } from './HUDOverlay';
import { RectangularTank, VerticalVessel } from './equipment/Tanks';
import { PipeNetwork } from './equipment/PipeNetwork';
import { FiltrationTrain } from './FiltrationTrain';
import { ReverseOsmosisSystem } from './ReverseOsmosisSystem';
import { PolishingRoSystem } from './PolishingRoSystem';

import macroConfig from '../../config/plant_macro_config.json';
import { useAppStore } from '../../store/useAppStore';

const CameraController = ({ view }) => {
 const { camera, controls } = useThree();
 
 useEffect(() => {
 if (controls) {
 if (view === 'UF Trains') {
 controls.target.set(-10, 0, -25);
 camera.position.set(-25, 40, 40);
 } else if (view === 'RO-1 Skids') {
 controls.target.set(60, 0, -25);
 camera.position.set(45, 40, 40);
 } else if (view === 'RO-2 Skids') {
 controls.target.set(135, 0, -25);
 camera.position.set(120, 40, 40);
 } else if (view === 'RO-P Polishing Area') {
 controls.target.set(215, 0, -25);
 camera.position.set(200, 40, 40);
 } else {
 // Macro Overview
 controls.target.set(100, 0, -25);
 camera.position.set(60, 96, 144);
 }
 controls.update();
 }
 }, [view, camera, controls]);

 return <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 + 0.1} minDistance={10} maxDistance={400} />;
};

export default function PlantScene3D({ data: liveData, onEquipmentClick }) {
 const [data] = useState(macroConfig);
 const [activeTrain, setActiveTrain] = useState('FULL PLANT OVERVIEW');
 const [cameraView, setCameraView] = useState('Macro Overview'); 
 
 const telemetrySnapshot = useAppStore(state => state.telemetry);
 const { cipActive, cipStage, cipTimeElapsed, cipCurrentPh } = useAppStore();

 const cipPipeColor = useMemo(() => {
 if (!cipActive) return 'ORANGE';
 if (cipStage.includes('Alkaline') || cipStage.includes('Chemical')) return '#a855f7'; // Purple
 if (cipStage.includes('Acidic')) return '#eab308'; // Yellow
 if (cipStage === 'Flush') return '#3b82f6'; // Blue
 if (cipStage === 'Air Scouring') return '#f8fafc'; // White/Gray
 return 'ORANGE';
 }, [cipActive, cipStage]);

 const [visibility, setVisibility] = useState({
 'STAGE-1 (UF)': true,
 'STAGE-2 (RO-1)': true,
 'STAGE-3 (RO-2)': true,
 'STAGE-4 (RO-P)': true
 });

 const toggleVisibility = (skid) => {
 setVisibility(prev => ({ ...prev, [skid]: !prev[skid] }));
 };

 const getTankTopY = (tankId) => {
 const tank = macroConfig.shared.equipment.find(eq => eq.id === tankId);
 if (!tank) return 10;
 return tank.pos[1] + tank.dims.h;
 };

 const flowActive = liveData && liveData.flow_rate > 0;

 const headerPipes = useMemo(() => {
 const h401 = getTankTopY("ROFWST-401");
 const h701 = getTankTopY("ROFWST-701");
 const h1001 = getTankTopY("ROPFWST-1001");
 const h1201 = getTankTopY("LT-1201");

 // FIX: per-stage flow state instead of one shared global flag.
 // Falls back to the old global flowActive if a stage's own
 // telemetry isn't available yet, so nothing breaks before the
 // store is fully wired per-stage.
 const ufState = (telemetrySnapshot['UF']?.flow_rate ?? (flowActive ? 1 : 0)) > 0 ? 1.0 : 0;
 const ro1State = (telemetrySnapshot['RO1']?.flow_rate ?? (flowActive ? 1 : 0)) > 0 ? 1.0 : 0;
 const ro2State = (telemetrySnapshot['RO2']?.flow_rate ?? (flowActive ? 1 : 0)) > 0 ? 1.0 : 0;
 const ropState = (telemetrySnapshot['RO-P']?.flow_rate ?? (flowActive ? 1 : 0)) > 0 ? 1.0 : 0;

 // CIP mode is a separate state from service flow — a stage can be
 // in CIP (cipState=1) while its service flow is 0. Reads a
 // `cip_active` boolean if your store exposes one; defaults to 0
 // (not shown) until that telemetry field exists, rather than
 // guessing it's always running.
 const ufCipState = telemetrySnapshot['UF']?.cip_active ? 1.0 : 0;
 const ro1CipState = telemetrySnapshot['RO1']?.cip_active ? 1.0 : 0;
 const ro2CipState = telemetrySnapshot['RO2']?.cip_active ? 1.0 : 0;
 const ropCipState = telemetrySnapshot['RO-P']?.cip_active ? 1.0 : 0;

 return [
 // ---------------- EXISTING SERVICE/PERMEATE/REJECT PIPES ----------------
 // Feed from Lamella Clarifier 1 to FWST-101
 { id: "lamella1-to-fwst", color: "WHITE", flowSpeed: ufState, points: [ [-51, 3, -4], [-47, 3, -4], [-47, 10, -4], [-47, 10, 4], [-44, 10, 4] ] },
 
 // UF Feed Suction Header (from FWST-101 to P-101/201/301)
 { id: "fwst-to-uf1", color: "WHITE", flowSpeed: ufState, points: [ [-36, 0.6, 4], [-32, 0.6, 4], [-32, 0.6, 2], [-29, 0.6, 2] ] },
 { id: "fwst-to-uf2", color: "WHITE", flowSpeed: ufState, points: [ [-32, 0.6, 4], [-32, 0.6, -23], [-29, 0.6, -23] ] },
 { id: "fwst-to-uf3", color: "WHITE", flowSpeed: ufState, points: [ [-32, 0.6, -23], [-32, 0.6, -48], [-29, 0.6, -48] ] },
 
 // STAGE 1: UF Permeate to ROFWST-401 (Sky Blue)
 { id: "uf1-perm", color: "SKYBLUE", flowSpeed: ufState, points: [ [16, 8.0, 0.9], [24, 8.0, 0.9], [24, 12, 0.9], [30, 12, 0.9], [30, 12, 4], [35, 12, 4], [35, h401 + 2, 4], [35, h401 + 2, 0], [35, h401, 0] ] },
 { id: "uf2-perm", color: "SKYBLUE", flowSpeed: ufState, points: [ [16, 8.0, -24.1], [24, 8.0, -24.1], [24, 12, -24.1], [30, 12, -24.1], [30, 12, 4] ] },
 { id: "uf3-perm", color: "SKYBLUE", flowSpeed: ufState, points: [ [16, 8.0, -49.1], [24, 8.0, -49.1], [24, 12, -49.1], [30, 12, -49.1], [30, 12, 4] ] },
 
 // STAGE 1: UF Reject to ETP (Red)
 { id: "uf1-rej", color: "RED", flowSpeed: ufState, points: [ [16, 0.4, 0.6], [22, 0.4, 0.6], [22, 0.4, 30] ] },
 { id: "uf2-rej", color: "RED", flowSpeed: ufState, points: [ [16, 0.4, -24.4], [22, 0.4, -24.4], [22, 0.4, 30] ] },
 { id: "uf3-rej", color: "RED", flowSpeed: ufState, points: [ [16, 0.4, -49.4], [22, 0.4, -49.4], [22, 0.4, 30] ] },
 
 // Tank 401 Outlet to RO-1
 { id: "tank401-out", color: "SKYBLUE", flowSpeed: ro1State, points: [ [38, 0.4, 4], [45, 0.4, 4] ] },

 // STAGE 2: RO-1 Permeate to ROPFWST-1001 (Sky Blue)
 { id: "ro1-401-perm", color: "SKYBLUE", flowSpeed: ro1State, points: [ [85, 8, 0], [95, 8, 0], [95, 16, 0], [95, 16, 4], [180, 16, 4], [180, h1001 - 1, 4] ] },
 { id: "ro1-501-perm", color: "SKYBLUE", flowSpeed: ro1State, points: [ [85, 8, -25], [95, 8, -25], [95, 16, -25], [95, 16, 4] ] },
 { id: "ro1-601-perm", color: "SKYBLUE", flowSpeed: ro1State, points: [ [85, 8, -50], [95, 8, -50], [95, 16, -50], [95, 16, 4] ] },

 // STAGE 2: RO-1 Reject to Lamella (Red) and ETP (Red)
 { id: "ro1-401-rej-lam", color: "RED", flowSpeed: ro1State, points: [ [85, 0.4, 0], [90, 0.4, 0], [90, 0.4, -20], [100, 0.4, -20] ] },
 { id: "ro1-501-rej-lam", color: "RED", flowSpeed: ro1State, points: [ [85, 0.4, -25], [90, 0.4, -25], [90, 0.4, -20] ] },
 { id: "ro1-601-rej-lam", color: "RED", flowSpeed: ro1State, points: [ [85, 0.4, -50], [90, 0.4, -50], [90, 0.4, -20] ] },
 { id: "ro1-401-rej-etp", color: "RED", flowSpeed: ro1State, points: [ [85, 0.4, 0], [85, 0.4, 30] ] },
 { id: "ro1-501-rej-etp", color: "RED", flowSpeed: ro1State, points: [ [85, 0.4, -25], [85, 0.4, 0] ] },
 { id: "ro1-601-rej-etp", color: "RED", flowSpeed: ro1State, points: [ [85, 0.4, -50], [85, 0.4, -25] ] },
 
 // Lamella to ROFWST-701 (Yellow) - split into 3 segments to fix rendering twist bug
 { id: "lamella-to-ro2-a", color: "YELLOW", flowSpeed: ro1State, points: [ [108, 0.4, -20], [113, 0.4, -20], [113, 12, -20] ] },
 { id: "lamella-to-ro2-b", color: "YELLOW", flowSpeed: ro1State, points: [ [113, 12, -20], [113, 12, 4] ] },
 { id: "lamella-to-ro2-c", color: "YELLOW", flowSpeed: ro1State, points: [ [113, 12, 4], [110, 12, 4], [110, h701 - 1, 4] ] },

 // Tank 701 Outlet to RO-2
 { id: "tank701-out", color: "SKYBLUE", flowSpeed: ro2State, points: [ [113, 0.4, 4], [115, 0.4, 4] ] },

 // STAGE 3: RO-2 Permeate to ROPFWST-1001 (Sky Blue)
 { id: "ro2-701-perm", color: "SKYBLUE", flowSpeed: ro2State, points: [ [155, 8, 0], [165, 8, 0], [165, 16, 0], [165, 16, 4], [180, 16, 4] ] },
 { id: "ro2-801-perm", color: "SKYBLUE", flowSpeed: ro2State, points: [ [155, 8, -25], [165, 8, -25], [165, 16, -25], [165, 16, 4] ] },
 { id: "ro2-901-perm", color: "SKYBLUE", flowSpeed: ro2State, points: [ [155, 8, -50], [165, 8, -50], [165, 16, -50], [165, 16, 4] ] },

 // STAGE 3: RO-2 Reject to Evaporator (Red) and ETP (Red)
 { id: "ro2-701-rej-evap", color: "RED", flowSpeed: ro2State, points: [ [155, 0.4, 0], [165, 0.4, 0], [165, 0.4, -35], [180, 0.4, -35] ] },
 { id: "ro2-801-rej-evap", color: "RED", flowSpeed: ro2State, points: [ [155, 0.4, -25], [165, 0.4, -25], [165, 0.4, -35] ] },
 { id: "ro2-901-rej-evap", color: "RED", flowSpeed: ro2State, points: [ [155, 0.4, -50], [165, 0.4, -50], [165, 0.4, -35] ] },
 { id: "ro2-701-rej-etp", color: "RED", flowSpeed: ro2State, points: [ [155, 0.4, 0], [155, 0.4, 30] ] },
 { id: "ro2-801-rej-etp", color: "RED", flowSpeed: ro2State, points: [ [155, 0.4, -25], [155, 0.4, 0] ] },
 { id: "ro2-901-rej-etp", color: "RED", flowSpeed: ro2State, points: [ [155, 0.4, -50], [155, 0.4, -25] ] },

 // Tank 1001 Outlet to RO-P
 { id: "tank1001-out", color: "SKYBLUE", flowSpeed: ropState, points: [ [184, 0.4, 4], [190, 0.4, 4] ] },

 // STAGE 4: RO-P Permeate to LT-1201 (Electric Cyan)
 { id: "rop-1001-perm", color: "CYAN", flowSpeed: ropState, points: [ [227, 8, 0], [240, 8, 0], [240, 16, 0], [240, 16, -10], [260, 16, -10], [260, h1201 - 1, -10] ] },
 { id: "rop-1101-perm", color: "CYAN", flowSpeed: ropState, points: [ [227, 8, -25], [240, 8, -25], [240, 16, -25], [240, 16, -10] ] },
 { id: "rop-1201-perm", color: "CYAN", flowSpeed: ropState, points: [ [227, 8, -50], [240, 8, -50], [240, 16, -50], [240, 16, -10] ] },

 // STAGE 4: RO-P Reject Loopback to ROFWST-401 (Red) and ETP (Red)
 { id: "rop-1201-rej-loop", color: "RED", flowSpeed: ropState, points: [ [230, 0.4, -50], [235, 0.4, -50], [235, 12, -50], [235, 12, -25] ] },
 { id: "rop-1101-rej-loop", color: "RED", flowSpeed: ropState, points: [ [230, 0.4, -25], [235, 0.4, -25], [235, 12, -25], [235, 12, 0] ] },
 { id: "rop-1001-rej-loop", color: "RED", flowSpeed: ropState, points: [ [230, 0.4, 0], [235, 0.4, 0], [235, 12, 0], [235, 12, 10] ] },
 { id: "rop-rej-loop-header", color: "RED", flowSpeed: ropState, points: [ [235, 12, 10], [35, 12, 10], [35, h401 + 2, 10], [35, h401 + 2, 2], [35, h401, 2] ] },
 { id: "rop-1001-rej-etp", color: "RED", flowSpeed: ropState, points: [ [230, 0.4, 0], [230, 0.4, 30] ] },
 { id: "rop-1101-rej-etp", color: "RED", flowSpeed: ropState, points: [ [230, 0.4, -25], [230, 0.4, 0] ] },
 { id: "rop-1201-rej-etp", color: "RED", flowSpeed: ropState, points: [ [230, 0.4, -50], [230, 0.4, -25] ] },

 // MAIN ETP COLLECTION HEADER (Red)
 { id: "etp-main-header-1", color: "RED", flowSpeed: 0.05, points: [ [22, 0.4, 30], [85, 0.4, 30] ] },
 { id: "etp-main-header-2", color: "RED", flowSpeed: 0.05, points: [ [85, 0.4, 30], [155, 0.4, 30] ] },
 { id: "etp-main-header-3", color: "RED", flowSpeed: 0.05, points: [ [155, 0.4, 30], [230, 0.4, 30], [250, 0.4, 30] ] },

 // ---------------- NEW: CIP CROSS-CONNECT PIPING (orange) ----------------
 // UF stage: T-101 at world pos [-15, y, -12], trains at z=0,-25,-50, x~-7 (System Pump P-102 area)
 // 1. CIP SUPPLY (DYNAMIC COLOR)
 { id: "cip-uf-supply-main", color: cipPipeColor, flowSpeed: ufCipState, points: [ [-15, 0.4, -12], [-11, 0.4, -12] ] },
 { id: "cip-uf-supply-dist", color: cipPipeColor, flowSpeed: ufCipState, points: [ [-11, 0.4, 2], [-11, 0.4, -48] ] },
 { id: "cip-uf-101-sup", color: cipPipeColor, flowSpeed: ufCipState, points: [ [-11, 0.4, 2], [-7, 0.4, 2] ] },
 { id: "cip-uf-201-sup", color: cipPipeColor, flowSpeed: ufCipState, points: [ [-11, 0.4, -23], [-7, 0.4, -23] ] },
 { id: "cip-uf-301-sup", color: cipPipeColor, flowSpeed: ufCipState, points: [ [-11, 0.4, -48], [-7, 0.4, -48] ] },

 // 2. CIP RETURN (DYNAMIC COLOR)
 // Main overhead return header and drop into T-101
 { id: "cip-uf-return-header", color: cipPipeColor, flowSpeed: ufCipState, points: [ [22, 9, 0], [22, 9, -50] ] },
 { id: "cip-uf-return-drop", color: cipPipeColor, flowSpeed: ufCipState, points: [ [22, 9, -12], [-15, 9, -12], [-15, 4.5, -12] ] },
 
 // Train 101 Returns
 { id: "cip-uf-101-ret-perm", color: cipPipeColor, flowSpeed: ufCipState, points: [ [16, 8, 0.9], [22, 8, 0.9], [22, 9, 0.9], [22, 9, 0] ] },
 { id: "cip-uf-101-ret-top", color: cipPipeColor, flowSpeed: ufCipState, points: [ [16, 8, 0], [22, 8, 0], [22, 9, 0] ] },
 { id: "cip-uf-101-ret-bot", color: cipPipeColor, flowSpeed: ufCipState, points: [ [22, 0.4, 0.6], [22, 9, 0.6], [22, 9, 0] ] },
 
 // Train 201 Returns
 { id: "cip-uf-201-ret-perm", color: cipPipeColor, flowSpeed: ufCipState, points: [ [16, 8, -24.1], [22, 8, -24.1], [22, 9, -24.1], [22, 9, -25] ] },
 { id: "cip-uf-201-ret-top", color: cipPipeColor, flowSpeed: ufCipState, points: [ [16, 8, -25], [22, 8, -25], [22, 9, -25] ] },
 { id: "cip-uf-201-ret-bot", color: cipPipeColor, flowSpeed: ufCipState, points: [ [22, 0.4, -24.4], [22, 9, -24.4], [22, 9, -25] ] },

 // Train 301 Returns
 { id: "cip-uf-301-ret-perm", color: cipPipeColor, flowSpeed: ufCipState, points: [ [16, 8, -49.1], [22, 8, -49.1], [22, 9, -49.1], [22, 9, -50] ] },
 { id: "cip-uf-301-ret-top", color: cipPipeColor, flowSpeed: ufCipState, points: [ [16, 8, -50], [22, 8, -50], [22, 9, -50] ] },
 { id: "cip-uf-301-ret-bot", color: cipPipeColor, flowSpeed: ufCipState, points: [ [22, 0.4, -49.4], [22, 9, -49.4], [22, 9, -50] ] },

 // RO-1 stage: T-404 + P-405 at world pos ~[45-48, y, -12], trains at z=0,-25,-50, x~50 (feed pump area)
 { id: "cip-ro1-401", color: "ORANGE", flowSpeed: ro1CipState, points: [ [50, 0.4, 4], [45, 0.4, 4], [45, 0.4, -12] ] },
 { id: "cip-ro1-501", color: "ORANGE", flowSpeed: ro1CipState, points: [ [50, 0.4, -21], [45, 0.4, -21], [45, 0.4, -12] ] },
 { id: "cip-ro1-601", color: "ORANGE", flowSpeed: ro1CipState, points: [ [50, 0.4, -46], [45, 0.4, -46], [45, 0.4, -12] ] },

 // RO-2 stage: T-702 + P-704 at world pos ~[115-118, y, -12], trains at z=0,-25,-50, x~120
 { id: "cip-ro2-701", color: "ORANGE", flowSpeed: ro2CipState, points: [ [120, 0.4, 4], [115, 0.4, 4], [115, 0.4, -12] ] },
 { id: "cip-ro2-801", color: "ORANGE", flowSpeed: ro2CipState, points: [ [120, 0.4, -21], [115, 0.4, -21], [115, 0.4, -12] ] },
 { id: "cip-ro2-901", color: "ORANGE", flowSpeed: ro2CipState, points: [ [120, 0.4, -46], [115, 0.4, -46], [115, 0.4, -12] ] },

 // RO-P stage: T-1001 at world pos [185, y, -12], trains at z=0,-25,-50, x~195 (feed pump area)
 { id: "cip-rop-1001", color: "ORANGE", flowSpeed: ropCipState, points: [ [195, 0.4, 4], [185, 0.4, 4], [185, 0.4, -12] ] },
 { id: "cip-rop-1101", color: "ORANGE", flowSpeed: ropCipState, points: [ [195, 0.4, -21], [185, 0.4, -21], [185, 0.4, -12] ] },
 { id: "cip-rop-1201", color: "ORANGE", flowSpeed: ropCipState, points: [ [195, 0.4, -46], [185, 0.4, -46], [185, 0.4, -12] ] },
 ];
 }, [flowActive, telemetrySnapshot]);

 const handleSelect = (id, type, value) => {
 if (!id || typeof id !== 'string') return;
 
 // Determine which stage the clicked item belongs to
 let targetStage = null;
 let unit = null;

 const match = id.match(/-(\d+)/);
 if (match) {
 unit = match[1];
 const num = parseInt(unit, 10);
 if (num >= 100 && num < 400) targetStage = 'UF';
 else if (num >= 400 && num < 700) targetStage = 'RO1';
 else if (num >= 700 && num < 1000) targetStage = 'RO2';
 else if (num >= 1000 && num < 1300) targetStage = 'RO-P';
 }

 if (!targetStage) {
 // Fallback for non-stage items if any
 const panel = document.getElementById('ui-info-panel');
 const tagEl = document.getElementById('ui-info-tag');
 const contentEl = document.getElementById('ui-info-content');
 if (panel && tagEl && contentEl) {
 panel.style.display = 'block';
 tagEl.innerText = id;
 contentEl.innerHTML = `
 <strong>Type:</strong> ${type}<br/>
 ${value ? `<strong>State/Value:</strong> ${value}` : ''}
 `;
 }
 }
 if (onEquipmentClick) onEquipmentClick(id);
 };

 const handlePointerMissed = () => {
 const panel = document.getElementById('ui-info-panel');
 if (panel) panel.style.display = 'none';
 };

 if (!data) return <div>Loading...</div>;

 return (
 <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0f172a', overflow: 'hidden' }}>
 
 <div style={{
 width: '100%',
 height: '100%',
 position: 'absolute',
 left: 0,
 top: 0,
 }}>
 <HUDOverlay 
 timer={data.timer} 
 activeTrain={activeTrain} 
 onCameraJump={(view) => {
 setCameraView(view);
 setActiveTrain(view);
 }}
 visibility={visibility}
 onToggleVisibility={toggleVisibility}
 />

 <Canvas 
 shadows 
 camera={{ position: [60, 96, 144], fov: 45 }}
 onPointerMissed={handlePointerMissed}
 >
 <PlantEnvironment />

 <group>
 {data.shared.equipment.map(eq => {
 if (eq.type === 'RectangularTank') return <RectangularTank key={eq.id} {...eq} onSelect={handleSelect} />;
 if (eq.type === 'VerticalVessel') return <VerticalVessel key={eq.id} {...eq} onSelect={handleSelect} />;
 return null;
 })}

 <PipeNetwork pipes={headerPipes} />
 </group>

 {visibility['STAGE-1 (UF)'] && (
 <group>
 <FiltrationTrain position={[0, 0, 0]} colorPalette={{ processPipe: "#cbd5e1", permeate: "#0ea5e9", cip: "#d97706" }} tagPrefix="10" blueprint={data.trainBlueprint} onSelect={handleSelect} flowSpeed={flowActive ? 1.0 : 0} telemetryData={telemetrySnapshot['UF']} />
 <FiltrationTrain position={[0, 0, -25]} colorPalette={{ processPipe: "#cbd5e1", permeate: "#0ea5e9", cip: "#d97706" }} tagPrefix="20" blueprint={data.trainBlueprint} onSelect={handleSelect} flowSpeed={flowActive ? 1.0 : 0} telemetryData={telemetrySnapshot['UF']} />
 <FiltrationTrain position={[0, 0, -50]} colorPalette={{ processPipe: "#cbd5e1", permeate: "#0ea5e9", cip: "#d97706" }} tagPrefix="30" blueprint={data.trainBlueprint} onSelect={handleSelect} flowSpeed={flowActive ? 1.0 : 0} telemetryData={telemetrySnapshot['UF']} />
 </group>
 )}

 {visibility['STAGE-2 (RO-1)'] && data.ro1Blueprints && (
 <group>
 <ReverseOsmosisSystem position={[0, 0, 0]} colorPalette={{ processPipe: "#1d4ed8", permeate: "#22d3ee" }} blueprint={data.ro1Blueprints['401']} onSelect={handleSelect} flowSpeed={flowActive ? 1.0 : 0} telemetryData={telemetrySnapshot['RO1']} />
 <ReverseOsmosisSystem position={[0, 0, -25]} colorPalette={{ processPipe: "#1d4ed8", permeate: "#22d3ee" }} blueprint={data.ro1Blueprints['501']} onSelect={handleSelect} flowSpeed={flowActive ? 1.0 : 0} telemetryData={telemetrySnapshot['RO1']} />
 <ReverseOsmosisSystem position={[0, 0, -50]} colorPalette={{ processPipe: "#1d4ed8", permeate: "#22d3ee" }} blueprint={data.ro1Blueprints['601']} onSelect={handleSelect} flowSpeed={flowActive ? 1.0 : 0} telemetryData={telemetrySnapshot['RO1']} />
 </group>
 )}

 {visibility['STAGE-3 (RO-2)'] && data.ro2Blueprints && (
 <group>
 <ReverseOsmosisSystem position={[0, 0, 0]} colorPalette={{ processPipe: "#0f766e", permeate: "#2dd4bf" }} blueprint={data.ro2Blueprints['701']} onSelect={handleSelect} flowSpeed={flowActive ? 1.0 : 0} telemetryData={telemetrySnapshot['RO2']} />
 <ReverseOsmosisSystem position={[0, 0, -25]} colorPalette={{ processPipe: "#0f766e", permeate: "#2dd4bf" }} blueprint={data.ro2Blueprints['801']} onSelect={handleSelect} flowSpeed={flowActive ? 1.0 : 0} telemetryData={telemetrySnapshot['RO2']} />
 <ReverseOsmosisSystem position={[0, 0, -50]} colorPalette={{ processPipe: "#0f766e", permeate: "#2dd4bf" }} blueprint={data.ro2Blueprints['901']} onSelect={handleSelect} flowSpeed={flowActive ? 1.0 : 0} telemetryData={telemetrySnapshot['RO2']} />
 </group>
 )}

 {visibility['STAGE-4 (RO-P)'] && data.ropBlueprints && (
 <group>
 <PolishingRoSystem position={[0, 0, 0]} colorPalette={{ processPipe: "#e2e8f0", permeate: "#06b6d4" }} blueprint={data.ropBlueprints['1001']} onSelect={handleSelect} flowSpeed={flowActive ? 1.0 : 0} telemetryData={telemetrySnapshot['RO-P']} />
 <PolishingRoSystem position={[0, 0, -25]} colorPalette={{ processPipe: "#e2e8f0", permeate: "#06b6d4" }} blueprint={data.ropBlueprints['1101']} onSelect={handleSelect} flowSpeed={flowActive ? 1.0 : 0} telemetryData={telemetrySnapshot['RO-P']} />
 <PolishingRoSystem position={[0, 0, -50]} colorPalette={{ processPipe: "#e2e8f0", permeate: "#06b6d4" }} blueprint={data.ropBlueprints['1201']} onSelect={handleSelect} flowSpeed={flowActive ? 1.0 : 0} telemetryData={telemetrySnapshot['RO-P']} />
 </group>
 )}

 {/* ETP Destination Block */}
 <group position={[250, 0, 30]}>
 <Box args={[4, 2, 4]} position={[0, 1, 0]} castShadow receiveShadow>
 <meshStandardMaterial color="#475569" roughness={0.7} />
 </Box>
 <Html position={[0, 3, 0]} center distanceFactor={25}>
 <div style={{
 background: 'rgba(15, 23, 42, 0.9)', color: '#f8fafc', padding: '6px 12px',
 borderRadius: '4px', fontFamily: 'monospace', fontSize: '14px',
 border: '1px solid #ef4444', fontWeight: 'bold', whiteSpace: 'nowrap'
 }}>
 TO ETP (EFFLUENT TREATMENT)
 </div>
 </Html>
 </group>

 {/* UF CIP Valves (Visual Representation) */}
 <group position={[-14, 0.4, -12]}>
 <mesh>
 <sphereGeometry args={[0.3, 16, 16]} />
 <meshStandardMaterial color="#ef4444" />
 </mesh>
 <Html position={[0, 1.5, 0]} center distanceFactor={20}>
 <div style={{ background: 'rgba(239, 68, 68, 0.9)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid white' }}>AV-119</div>
 </Html>
 </group>

 <group position={[-9, 0.4, 2]}>
 <mesh>
 <sphereGeometry args={[0.3, 16, 16]} />
 <meshStandardMaterial color="#ef4444" />
 </mesh>
 <Html position={[0, 1.5, 0]} center distanceFactor={20}>
 <div style={{ background: 'rgba(239, 68, 68, 0.9)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid white' }}>AV-116</div>
 </Html>
 </group>

 {/* CIP Active HUD */}
 {cipActive && (
 <group position={[-15, 12, -12]}>
 <Html position={[0, 0, 0]} center distanceFactor={25}>
 <div style={{
 background: 'rgba(15, 23, 42, 0.95)',
 border: `2px solid ${cipPipeColor}`,
 borderRadius: '8px',
 padding: '12px',
 color: 'white',
 fontFamily: 'monospace',
 width: '200px',
 boxShadow: `0 0 20px ${cipPipeColor}40`
 }}>
 <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: cipPipeColor, borderBottom: `1px solid ${cipPipeColor}`, paddingBottom: '4px' }}>
 CIP ACTIVE: T-101
 </div>
 <div style={{ fontSize: '12px', marginBottom: '4px' }}>STAGE: <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{cipStage}</span></div>
 <div style={{ fontSize: '12px', marginBottom: '4px' }}>pH SENSOR: <span style={{ color: '#f8fafc', fontSize: '14px', fontWeight: 'bold' }}>{cipCurrentPh.toFixed(2)}</span></div>
 <div style={{ fontSize: '12px' }}>TIMER: <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{cipTimeElapsed}s / 57s</span></div>
 </div>
 </Html>
 </group>
 )}

 <CameraController view={cameraView} />
 
 <EffectComposer>
 <SSAO samples={21} radius={0.5} intensity={20} luminanceInfluence={0.5} color="black" blendFunction={BlendFunction.MULTIPLY} />
 <ToneMapping />
 </EffectComposer>
 </Canvas>
 </div>
 </div>
 );
}
