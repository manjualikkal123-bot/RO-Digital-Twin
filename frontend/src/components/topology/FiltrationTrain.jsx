import { RectangularTank, VerticalVessel } from './equipment/Tanks';
import { PumpAssembly } from './equipment/PumpAssembly';
import { Valve } from './equipment/Valve';
import { Instrument } from './equipment/Instrument';
import { UFRack } from './equipment/UFRack';
import { PipeNetwork } from './equipment/PipeNetwork';
import { Html } from '@react-three/drei';

const ExternalLabel = ({ text, pos }) => (
 <Html position={pos} center distanceFactor={25} zIndexRange={[100, 0]}>
 <div style={{
 background: '#334155', color: '#f8fafc', padding: '6px 12px',
 borderRadius: '4px', fontFamily: 'sans-serif', fontSize: '11px',
 fontWeight: 'bold', border: '1px solid #475569', pointerEvents: 'none',
 whiteSpace: 'nowrap'
 }}>
 {text}
 </div>
 </Html>
);

export const FiltrationTrain = ({ position, colorPalette, tagPrefix, blueprint, onSelect, flowSpeed, telemetryData = {} }) => {
 // Utility to map a tag like "P-101" to "P-201" if prefix is "20"
 const mapTag = (id) => {
 if (!id) return id;
 return id.replace('10', tagPrefix); // e.g. P-101 -> P-201, ASF-101 -> ASF-201
 };

 // Color mapping logic for pipes based on colorPalette prop
 const mappedPipes = blueprint.pipes.map(pipe => {
 let newColor = pipe.color;
 if (pipe.color === 'WHITE') newColor = colorPalette.processPipe;
 if (pipe.color === 'BLUE') newColor = colorPalette.permeate;
 if (pipe.color === 'RED') newColor = colorPalette.cip;
 // Utilities (GRAY) remain GRAY
 return { ...pipe, color: newColor, flowSpeed: flowSpeed ?? 1.0 };
 });

 return (
 <group position={position}>
 {/* Equipment Assembly */}
 {blueprint.equipment.map(eq => {
 const mappedId = mapTag(eq.id);
 const mappedLabel = eq.label ? eq.label.replace('101', `${tagPrefix}1`) : eq.label;
 const props = { ...eq, id: mappedId, label: mappedLabel, onSelect };
 
 if (eq.type === 'RectangularTank') return <RectangularTank key={mappedId} {...props} color={colorPalette.processPipe} />;
 if (eq.type === 'VerticalVessel') return <VerticalVessel key={mappedId} {...props} color={colorPalette.processPipe} />;
 if (eq.type === 'PumpAssembly') return <PumpAssembly key={mappedId} {...props} />; // Active state is handled by state
 if (eq.type === 'UFRack') return <UFRack key={mappedId} {...props} shellColor={colorPalette.processPipe} />;
 return null;
 })}

 {/* Valves */}
 {blueprint.valves.map(valve => {
 const mappedId = mapTag(valve.id);
 return <Valve key={mappedId} {...valve} id={mappedId} onSelect={onSelect} />;
 })}

 {/* Instruments */}
 {blueprint.instruments.map(inst => {
 const mappedId = mapTag(inst.id);
 const liveState = flowSpeed > 0 ? 'normal' : 'offline';
 const liveVal = telemetryData[mappedId] !== undefined ? String(telemetryData[mappedId]) : inst.value;
 return <Instrument key={mappedId} {...inst} id={mappedId} value={liveVal} state={liveState} onSelect={onSelect} />;
 })}

 {/* Pipes */}
 <PipeNetwork pipes={mappedPipes} />

 {/* Labels */}
 {blueprint.labels && blueprint.labels.map((lbl, i) => {
 const mappedText = lbl.text.replace('101', `${tagPrefix}1`);
 return <ExternalLabel key={i} text={mappedText} pos={lbl.pos} />;
 })}
 </group>
 );
};
