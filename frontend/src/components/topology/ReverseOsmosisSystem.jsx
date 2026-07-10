import { RectangularTank, VerticalVessel } from './equipment/Tanks';
import { PumpAssembly } from './equipment/PumpAssembly';
import { Valve } from './equipment/Valve';
import { Instrument } from './equipment/Instrument';
import { RORack } from './equipment/RORack';
import { PipeNetwork } from './equipment/PipeNetwork';
import { Html } from '@react-three/drei';

const ExternalLabel = ({ text, pos }) => (
 <Html position={pos} center distanceFactor={25} zIndexRange={[100, 0]}>
 <div style={{
 background: '#334155', color: '#f8fafc', padding: '6px 12px',
 borderRadius: '4px', fontFamily: 'sans-serif', fontSize: '18px',
 fontWeight: 'bold', border: '1px solid #475569', pointerEvents: 'none',
 whiteSpace: 'nowrap'
 }}>
 {text}
 </div>
 </Html>
);

export const ReverseOsmosisSystem = ({ position, colorPalette, blueprint, onSelect, flowSpeed, telemetryData = {} }) => {
 if (!blueprint) return null;

 // Process specific pipe colors if any mapping is needed, here we mostly use direct config colors
 const mappedPipes = blueprint.pipes?.map(pipe => {
 let newColor = pipe.color;
 if (pipe.color === 'WHITE') newColor = colorPalette?.processPipe || '#f8fafc';
 if (pipe.color === 'BLUE') newColor = colorPalette?.permeate || '#06b6d4';
 if (pipe.color === 'YELLOW') newColor = '#eab308'; // RO Reject
 if (pipe.color === 'RED') newColor = colorPalette?.cip || '#ef4444'; // CIP
 return { ...pipe, color: newColor, flowSpeed: flowSpeed ?? 1.0 };
 }) || [];

 return (
 <group position={position}>
 {/* Equipment Assembly */}
 {blueprint.equipment?.map(eq => {
 const props = { ...eq, onSelect };
 
 if (eq.type === 'RectangularTank') return <RectangularTank key={eq.id} {...props} color={colorPalette?.processPipe} />;
 if (eq.type === 'VerticalVessel') return <VerticalVessel key={eq.id} {...props} color={colorPalette?.processPipe} />;
 if (eq.type === 'PumpAssembly') return <PumpAssembly key={eq.id} {...props} />;
 if (eq.type === 'RORack') return <RORack key={eq.id} {...props} shellColor={colorPalette?.processPipe} />;
 return null;
 })}

 {/* Valves */}
 {blueprint.valves?.map(valve => {
 return <Valve key={valve.id} {...valve} onSelect={onSelect} />;
 })}

 {/* Instruments */}
 {blueprint.instruments && blueprint.instruments.map(inst => {
 const liveState = flowSpeed > 0 ? 'normal' : 'offline';
 const liveVal = telemetryData[inst.id] !== undefined ? String(telemetryData[inst.id]) : inst.value;
 return <Instrument key={inst.id} {...inst} value={liveVal} state={liveState} onSelect={onSelect} />;
 })}


 {/* Pipes */}
 <PipeNetwork pipes={mappedPipes} />

 {/* Labels */}
 {blueprint.labels && blueprint.labels.map((lbl, i) => (
 <ExternalLabel key={i} text={lbl.text} pos={lbl.pos} />
 ))}
 </group>
 );
};
