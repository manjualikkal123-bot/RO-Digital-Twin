export const DATA_DICTIONARY = {
 'HLS-101': { name: 'CIP High Level', tags: [{ id: 'STATE', desc: 'Tank Switch', value: 'NOT ACTIVE' }] },
 'LLS-101': { name: 'CIP Low Level', tags: [{ id: 'STATE', desc: 'Tank Switch', value: 'ACTIVE' }] },

 // --- AUTOMATED VALVES (AV-101 to AV-119) ---
 'AV-101': { name: 'ASF Drain Valve', tags: [{ id: 'CMD', desc: 'Logic Command', value: 'CLOSED' }, { id: 'FB', desc: 'Position Feedback', value: 'CLOSED' }] },
 'AV-102': { name: 'MCF-A Feed Valve', tags: [{ id: 'CMD', desc: 'Logic Command', value: 'OPEN' }] },
 'AV-103': { name: 'MCF-A Out Valve', tags: [{ id: 'CMD', desc: 'Logic Command', value: 'OPEN' }] },
 'AV-104': { name: 'MCF-A Backwash In', tags: [{ id: 'CMD', desc: 'Logic Command', value: 'CLOSED' }] },
 'AV-105': { name: 'MCF-A Backwash Drain', tags: [{ id: 'CMD', desc: 'Logic Command', value: 'CLOSED' }] },
 'AV-106': { name: 'MCF-B Feed Valve', tags: [{ id: 'CMD', desc: 'Logic Command', value: 'OPEN' }] },
 'AV-107': { name: 'MCF-B Out Valve', tags: [{ id: 'CMD', desc: 'Logic Command', value: 'OPEN' }] },
 'AV-108': { name: 'MCF-B Backwash In', tags: [{ id: 'CMD', desc: 'Logic Command', value: 'CLOSED' }] },
 'AV-109': { name: 'MCF-B Backwash Drain', tags: [{ id: 'CMD', desc: 'Logic Command', value: 'CLOSED' }] },
 'AV-110': { name: 'Permeate To RO-1', tags: [{ id: 'CMD', desc: 'Logic Command', value: 'OPEN' }] },
 'AV-111': { name: 'Permeate Flush Rtn', tags: [{ id: 'CMD', desc: 'Logic Command', value: 'CLOSED' }] },
 'AV-112': { name: 'Reject To Drain', tags: [{ id: 'CMD', desc: 'Logic Command', value: 'OPEN' }] },
 'AV-113': { name: 'Reject Rtn Valve A', tags: [{ id: 'CMD', desc: 'Logic Command', value: 'CLOSED' }] },
 'AV-114': { name: 'Reject Rtn Valve B', tags: [{ id: 'CMD', desc: 'Logic Command', value: 'CLOSED' }] },
 'AV-115': { name: 'Reject Rtn Valve C', tags: [{ id: 'CMD', desc: 'Logic Command', value: 'CLOSED' }] },
 'AV-116': { name: 'CIP Feed To Rack', tags: [{ id: 'CMD', desc: 'Logic Command', value: 'CLOSED' }] },
 'AV-117': { name: 'Air Scour Inlet', tags: [{ id: 'CMD', desc: 'Logic Command', value: 'CLOSED' }] },
 'AV-118': { name: 'Permeate Exit Block', tags: [{ id: 'CMD', desc: 'Logic Command', value: 'OPEN' }] },
 'AV-119': { name: 'CIP Tank Outlet', tags: [{ id: 'CMD', desc: 'Logic Command', value: 'CLOSED' }] },

 // ── UF-201 TANKS & VESSELS ──────────────────────────────────────────────
 'FWST-201': { name: 'UF-201 Feed Water Storage Tank', tags: [
 { id: 'LT-201', desc: 'Level Transmitter', value: '46.5 %' },
 ]},
 'ASF-201': { name: 'ASF-201 Auto Strainer', tags: [{ id: 'DPS-201', desc: 'Differential Pressure Switch', value: '0.2 bar' }]},
 'MCF-201A': { name: 'Micron Cartridge Filter 201A', tags: [{ id: 'DPS-202', desc: 'Combined DP Switch', value: '0.3 bar' }]},
 'MCF-201B': { name: 'Micron Cartridge Filter 201B', tags: [{ id: 'DPS-202', desc: 'Combined DP Switch', value: '0.3 bar' }]},
 'UF-201 Membranes': { name: 'UF-201 System Rack (14× PV)', tags: [
 { id: 'FT-201', desc: 'Permeate Flow', value: '50.0 m³/hr' },
 { id: 'PT-201', desc: 'Feed Pressure', value: '2.5 bar' },
 { id: 'PT-202', desc: 'Reject Pressure', value: '2.5 bar' },
 ]},
 'T-201': { name: 'UF-201 CIP Tank', tags: [
 { id: 'HLS-201', desc: 'High Level Switch', value: 'Normal' },
 { id: 'LLS-201', desc: 'Low Level Switch', value: 'Normal' },
 ]},
 // ── UF-201 PUMPS ─────────────────────────────────────────────────────────
 'P-201': { name: 'UF-201 Feed Pump', tags: [{ id: 'STATUS', desc: 'Run Status', value: 'RUNNING' }, { id: 'SPEED', desc: 'Motor Speed', value: '1450 RPM' }]},
 'P-202': { name: 'UF-201 System Pump', tags: [{ id: 'LPS-201', desc: 'Low Pressure Switch', value: 'Normal' }, { id: 'PT-201', desc: 'Discharge Pressure', value: '2.5 bar' }, { id: 'SPEED', desc: 'Motor Speed', value: '2000 RPM' }]},
 'AB-201': { name: 'Air Blower 201', tags: [{ id: 'STATUS', desc: 'Run Status', value: 'STANDBY' }]},
 // ── UF-201 INSTRUMENTS ───────────────────────────────────────────────────
 'LT-201': { name: 'FWST-201 Level Transmitter', tags: [{ id: 'LT-201', desc: 'Tank Level', value: '46.5 %' }]},
 'DPS-201': { name: 'ASF-201 Differential Pressure', tags: [{ id: 'DPS-201', desc: 'DP Switch', value: '0.2 bar' }]},
 'DPS-202': { name: 'MCF-201 Combined DP Switch', tags: [{ id: 'DPS-202', desc: 'DP Switch', value: '0.3 bar' }]},
 'LPS-201': { name: 'P-202 Low Pressure Switch', tags: [{ id: 'LPS-201', desc: 'Speed', value: '2000 RPM' }]},
 'PT-201': { name: 'System Feed Pressure', tags: [{ id: 'PT-201', desc: 'Pressure', value: '2.5 bar' }]},
 'FT-201': { name: 'Permeate Flow Transmitter', tags: [{ id: 'FT-201', desc: 'Flow Rate', value: '50.0 m³/hr' }]},
 'PT-202': { name: 'Reject Pressure Transmitter', tags: [{ id: 'PT-202', desc: 'Pressure', value: '2.5 bar' }]},
 'HLS-201': { name: 'CIP-201 High Level Switch', tags: [{ id: 'HLS-201', desc: 'Level', value: 'Normal' }]},
 'LLS-201': { name: 'CIP-201 Low Level Switch', tags: [{ id: 'LLS-201', desc: 'Level', value: 'Normal' }]},
 // ── UF-201 AUTOMATED VALVES (AV-201 → AV-219) ──────────────────────────
 'AV-201': { name: 'ASF-201 Drain to ETP', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }]},
 'AV-202': { name: 'MCF-201A Inlet Feed', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }]},
 'AV-203': { name: 'MCF-201A Outlet', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }]},
 'AV-204': { name: 'MCF-201A Soft Water Backwash', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }]},
 'AV-205': { name: 'MCF-201A Drain', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }]},
 'AV-206': { name: 'MCF-201B Inlet Feed', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }]},
 'AV-207': { name: 'MCF-201B Outlet', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }]},
 'AV-208': { name: 'MCF-201B Soft Water Backwash', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }]},
 'AV-209': { name: 'MCF-201B Drain', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }]},
 'AV-210': { name: 'Permeate to RO-3 FW Storage Tank', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }]},
 'AV-211': { name: 'Permeate Backwash Return', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }]},
 'AV-212': { name: 'Reject Drain to ETP', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }]},
 'AV-213': { name: 'Reject Return Manifold #1', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }]},
 'AV-214': { name: 'Reject Return Manifold #2', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }]},
 'AV-215': { name: 'Reject Return to CIP', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }]},
 'AV-216': { name: 'CIP Chemical Feed to UF-201 Rack', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }]},
 'AV-217': { name: 'Air Blower AB-201 Feed', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }]},
 'AV-218': { name: 'UF-201 Rack Permeate Exit', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }]},
 'AV-219': { name: 'CIP-201 Tank Bottom Outlet', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }]},
 // ── OTHER SYSTEMS ────────────────────────────────────────────────────────
 'ROFWST-401': { name: 'RO-1 FW Storage Tank', tags: [{ id: 'LT-401', desc: 'Level Transmitter', value: '68.7 %' }] },
 // ── RO-401 MAJOR EQUIPMENT ────────────────────────────────────────────────
 'P-401': { name: 'RO-1 Feed Pump', tags: [{ id: 'STATUS', desc: 'Run Status', value: 'RUNNING' }] },
 'MCF-401':{ name: 'RO-1 Cartridge Filter', tags: [{ id: 'DPS-401', desc: 'Diff Pressure', value: '0.3 bar' }] },
 'P-402': { name: 'RO-1 High Pressure Pump', tags: [{ id: 'LPS-401', desc: 'Speed', value: '2412 RPM' }, { id: 'PT-401', desc: 'Discharge', value: '11.8 bar' }] },
 'P-403': { name: 'RO-1 Inter Booster Pump 1', tags: [{ id: 'SPEED', desc: 'Speed', value: '2375 RPM' }] },
 'P-404': { name: 'RO-1 Inter Booster Pump 2', tags: [{ id: 'SPEED', desc: 'Speed', value: '2104 RPM' }] },
 'T-404': { name: 'RO-1 CIP Tank', tags: [{ id: 'LLS-404', desc: 'Low Level', value: 'Normal' }] },
 'P-405': { name: 'RO-1 CIP Pump', tags: [{ id: 'STATUS', desc: 'Run Status', value: 'STANDBY' }] },
 'RO-401 Membranes': { name: 'RO-401 System (3 Stages)', tags: [
 { id: 'PT-402', desc: 'Stage-1 Feed Press', value: '10.4 bar' },
 { id: 'PT-403', desc: 'Stage-2 Feed Press', value: '11.9 bar' },
 { id: 'PT-404', desc: 'Stage-2 Conc Press', value: '10.9 bar' },
 { id: 'PT-405', desc: 'Stage-3 Feed Press', value: '11.9 bar' },
 { id: 'PT-406', desc: 'Stage-3 Conc Press', value: '10.9 bar' },
 { id: 'FT-401', desc: 'Permeate Flow', value: '37.5 m³/hr' },
 { id: 'CDT-402',desc: 'Permeate Cond', value: '188.9 µS/cm²' },
 ]},
 // ── RO-401 DOSING ─────────────────────────────────────────────────────────
 'DP-401': { name: 'De-Chlorination Dosing Pump', tags: [{ id: 'STATUS', desc: 'Run Status', value: 'RUNNING' }] },
 'DP-402': { name: 'Acid Dosing Pump', tags: [{ id: 'STATUS', desc: 'Run Status', value: 'RUNNING' }] },
 'DP-403': { name: 'Anti-Scalant Dosing Pump', tags: [{ id: 'STATUS', desc: 'Run Status', value: 'RUNNING' }] },
 'T-402': { name: 'Acid Dosing Tank', tags: [{ id: 'LLS-402', desc: 'Low Level', value: 'Normal' }] },
 'T-403': { name: 'Anti-Scalant Dosing Tank', tags: [{ id: 'LLS-403', desc: 'Low Level', value: 'Normal' }] },
 // ── RO-401 INSTRUMENTS ───────────────────────────────────────────────────
 'LT-401': { name: 'ROFWST-401 Level', tags: [{ id: 'LT-401', desc: 'Level', value: '68.7 %' }] },
 'DPS-401': { name: 'MCF-401 Diff Pressure', tags: [{ id: 'DPS-401', desc: 'DP Switch', value: '0.3 bar' }] },
 'pHT-401': { name: 'RO-401 Feed pH', tags: [{ id: 'pHT-401', desc: 'pH', value: '6.2 pH' }] },
 'ORP-401': { name: 'RO-401 Feed ORP', tags: [{ id: 'ORP-401', desc: 'ORP', value: '+8.1 mV' }] },
 'CDT-401': { name: 'RO-401 Feed Conductivity', tags: [{ id: 'CDT-401', desc: 'Conductivity',value: '2832.8 µS/cm²' }] },
 'LPS-401': { name: 'P-402 Speed Switch', tags: [{ id: 'LPS-401', desc: 'Speed', value: '2412 RPM' }] },
 'PT-401': { name: 'HP Pump Discharge Pressure', tags: [{ id: 'PT-401', desc: 'Pressure', value: '11.8 bar' }] },
 'PT-402': { name: 'Stage-1 Feed Pressure', tags: [{ id: 'PT-402', desc: 'Pressure', value: '10.4 bar' }] },
 'PT-403': { name: 'Stage-2 Feed Pressure', tags: [{ id: 'PT-403', desc: 'Pressure', value: '11.9 bar' }] },
 'PT-404': { name: 'Stage-2 Conc Pressure', tags: [{ id: 'PT-404', desc: 'Pressure', value: '10.9 bar' }] },
 'PT-405': { name: 'Stage-3 Feed Pressure', tags: [{ id: 'PT-405', desc: 'Pressure', value: '11.9 bar' }] },
 'PT-406': { name: 'Stage-3 Conc Pressure', tags: [{ id: 'PT-406', desc: 'Pressure', value: '10.9 bar' }] },
 'CDT-402': { name: 'Permeate Conductivity', tags: [{ id: 'CDT-402', desc: 'Conductivity',value: '188.9 µS/cm²' }] },
 'FT-401': { name: 'Permeate Flow', tags: [{ id: 'FT-401', desc: 'Flow Rate', value: '37.5 m³/hr' }] },
 'FT-402': { name: 'Reject/Recirculation Flow', tags: [{ id: 'FT-402', desc: 'Flow Rate', value: '6.7 m³/hr' }] },
 'PID-401': { name: 'Concentrate Control Valve', tags: [{ id: 'PID-401', desc: 'Position', value: '0.0 % CLOSE' }] },
 'LLS-404': { name: 'CIP Tank Low Level Switch', tags: [{ id: 'LLS-404', desc: 'Level', value: 'Normal' }] },
 'LT-1001': { name: 'Downstream Tank Level', tags: [{ id: 'LT-1001', desc: 'Level', value: '30.8 %' }] },
 // ── RO-401 AUTOMATED VALVES ──────────────────────────────────────────────
 'AV-401': { name: 'MCF-401 Outlet / Feed Control', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-402': { name: 'Permeate to RO-P FW Storage', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-403': { name: 'Permeate Header Isolation', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-404': { name: 'Reject Recirculation Valve A', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-405': { name: 'Reject Recirculation Valve B', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-406': { name: 'Reject to ETP / Lamella', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-407': { name: 'RO Rack Feed Inlet Valve', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-408': { name: 'Inter-Stage Isolation Valve', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-409': { name: 'Permeate Exit Valve', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-410': { name: 'Concentrate Recirculation', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-411': { name: 'CIP Pump Outlet Valve', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 // ── RO-501 MAJOR EQUIPMENT ───────────────────────────────────────────────
 'P-501': { name: 'RO-501 Feed Pump', tags: [{ id: 'STATUS', desc: 'Run Status', value: 'RUNNING' }] },
 'MCF-501':{ name: 'RO-501 Cartridge Filter', tags: [{ id: 'DPS-501', desc: 'Diff Pressure', value: '0.2 bar' }] },
 'P-502': { name: 'RO-501 High Pressure Pump', tags: [{ id: 'LPS-501', desc: 'Speed', value: '0 RPM' }, { id: 'PT-501', desc: 'Discharge', value: '1.2 bar' }] },
 'P-503': { name: 'RO-501 Inter Booster Pump 1', tags: [{ id: 'SPEED', desc: 'Speed', value: '107 RPM' }] },
 'P-504': { name: 'RO-501 Inter Booster Pump 2', tags: [{ id: 'SPEED', desc: 'Speed', value: '99 RPM' }] },
 'RO-501 Membranes': { name: 'RO-501 System (3 Stages)', tags: [
 { id: 'PT-502', desc: 'Stage-1 Feed Press', value: '1.1 bar' },
 { id: 'PT-503', desc: 'Stage-2 Feed Press', value: '0.5 bar' },
 { id: 'PT-504', desc: 'Stage-2 Conc Press', value: '0.5 bar' },
 { id: 'PT-505', desc: 'Stage-3 Feed Press', value: '0.3 bar' },
 { id: 'PT-506', desc: 'Stage-3 Conc Press', value: '0.2 bar' },
 { id: 'FT-501', desc: 'Permeate Flow', value: '47.5 m³/hr' },
 { id: 'CDT-502',desc: 'Permeate Cond', value: '0.0 µS/cm²' },
 ]},
 // ── RO-501 DOSING ────────────────────────────────────────────────────────
 'DP-501': { name: 'RO-501 De-Chlor. Dosing Pump', tags: [{ id: 'STATUS', desc: 'Run Status', value: 'RUNNING' }] },
 'DP-502': { name: 'RO-501 Acid Dosing Pump', tags: [{ id: 'STATUS', desc: 'Run Status', value: 'RUNNING' }] },
 'DP-503': { name: 'RO-501 Anti-Scalant Dosing Pump', tags: [{ id: 'STATUS', desc: 'Run Status', value: 'RUNNING' }] },
 // ── RO-501 INSTRUMENTS ──────────────────────────────────────────────────
 'DPS-501': { name: 'MCF-501 Diff Pressure Switch', tags: [{ id: 'DPS-501', desc: 'DP', value: '0.2 bar' }] },
 'pHT-501': { name: 'RO-501 Feed pH', tags: [{ id: 'pHT-501', desc: 'pH', value: '14.0 pH' }] },
 'ORP-501': { name: 'RO-501 Feed ORP', tags: [{ id: 'ORP-501', desc: 'ORP', value: '-1469.7 mV' }] },
 'CDT-501': { name: 'RO-501 Feed Conductivity', tags: [{ id: 'CDT-501', desc: 'Conductivity', value: '0.0 µS/cm²' }] },
 'LPS-501': { name: 'P-502 Speed Switch', tags: [{ id: 'LPS-501', desc: 'Speed', value: '0 RPM' }] },
 'PT-501': { name: 'HP Pump Discharge Pressure', tags: [{ id: 'PT-501', desc: 'Pressure', value: '1.2 bar' }] },
 'PT-502': { name: 'Stage-1 Feed Pressure', tags: [{ id: 'PT-502', desc: 'Pressure', value: '1.1 bar' }] },
 'PT-503': { name: 'Stage-2 Feed Pressure', tags: [{ id: 'PT-503', desc: 'Pressure', value: '0.5 bar' }] },
 'PT-504': { name: 'Stage-2 Conc Pressure', tags: [{ id: 'PT-504', desc: 'Pressure', value: '0.5 bar' }] },
 'PT-505': { name: 'Stage-3 Feed Pressure', tags: [{ id: 'PT-505', desc: 'Pressure', value: '0.3 bar' }] },
 'PT-506': { name: 'Stage-3 Conc Pressure', tags: [{ id: 'PT-506', desc: 'Pressure', value: '0.2 bar' }] },
 'CDT-502': { name: 'RO-501 Permeate Conductivity', tags: [{ id: 'CDT-502', desc: 'Conductivity', value: '0.0 µS/cm²' }] },
 'FT-501': { name: 'RO-501 Permeate Flow', tags: [{ id: 'FT-501', desc: 'Flow Rate', value: '47.5 m³/hr' }] },
 'FT-502': { name: 'RO-501 Reject Flow', tags: [{ id: 'FT-502', desc: 'Flow Rate', value: '0.0 m³/hr' }] },
 'PID-501': { name: 'RO-501 Concentrate Control Valve', tags: [{ id: 'PID-501', desc: 'Position', value: '100.0% CLOSE' }] },
 // ── RO-501 AUTOMATED VALVES ─────────────────────────────────────────────
 'AV-501': { name: 'MCF-501 Feed Control Valve', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-502': { name: 'Permeate to RO-P FW Storage', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-503': { name: 'Permeate Header Isolation', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-504': { name: 'Reject Recirculation Valve A', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-505': { name: 'Reject Recirculation Valve B', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-506': { name: 'Reject to ETP / Lamella', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-507': { name: 'RO Rack Feed Inlet Valve', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-508': { name: 'Inter-Stage Isolation Valve', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-509': { name: 'Permeate Exit Valve', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-510': { name: 'Concentrate Recirculation', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-511': { name: 'CIP Pump Outlet Valve', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },

 // ── RO-701 MAJOR EQUIPMENT ───────────────────────────────────────────────
 'ROFWST-701': { name: 'RO-2 Feed Water Storage Tank', tags: [{ id: 'LT-701', desc: 'Level', value: '69.9 %' }] },
 'P-701': { name: 'RO-2 Feed Pump', tags: [{ id: 'SPEED', desc: 'Speed', value: '2456 RPM' }] },
 'PSF-701': { name: 'Pressure Sand Filter 701', tags: [{ id: 'DPS-701', desc: 'Diff Pressure', value: '0.1 bar' }, { id: 'CDT-701', desc: 'Cond.', value: '16939.7 µS/cm²' }] },
 'MCF-701A': { name: 'Cartridge Filter 701A', tags: [{ id: 'DPS-702', desc: 'Combined DP', value: '0.2 bar' }] },
 'MCF-701B': { name: 'Cartridge Filter 701B', tags: [{ id: 'DPS-702', desc: 'Combined DP', value: '0.2 bar' }] },
 'P-702': { name: 'RO-2 High Pressure Pump', tags: [{ id: 'LPS-701', desc: 'Speed Switch', value: '821 RPM' }, { id: 'PT-701', desc: 'Discharge', value: '20.9 bar' }] },
 'P-703': { name: 'RO-2 Inter Booster Pump', tags: [{ id: 'SPEED', desc: 'Speed', value: '1999 RPM' }] },
 'RO-701 Membranes': { name: 'RO-701 System (2 Stages)', tags: [
 { id: 'PT-702', desc: 'Stage-1 Conc Press', value: '20.0 bar' },
 { id: 'PT-703', desc: 'Stage-2 Feed Press', value: '23.8 bar' },
 { id: 'PT-704', desc: 'Stage-2 Conc Press', value: '23.6 bar' },
 { id: 'FT-701', desc: 'Permeate Flow', value: '4.1 m³/hr' },
 { id: 'CDT-702',desc: 'Permeate Cond.', value: '948.7 µS/cm²' },
 ]},
 
 // ── RO-701 DOSING & CIP ──────────────────────────────────────────────────
 'DP-701': { name: 'Acid Dosing Pump (From T-402)', tags: [{ id: 'STATUS', desc: 'Run Status', value: 'RUNNING' }] },
 'T-701': { name: 'Antiscalant Dosing Tank', tags: [{ id: 'LLS-701', desc: 'Low Level Switch', value: 'Normal' }] },
 'DP-702': { name: 'Antiscalant Dosing Pump', tags: [{ id: 'STATUS', desc: 'Run Status', value: 'RUNNING' }] },
 'T-702': { name: 'RO-2 CIP Tank', tags: [{ id: 'LLS-702', desc: 'Low Level Switch', value: 'Normal' }] },
 'P-704': { name: 'RO-2 CIP Pump', tags: [{ id: 'STATUS', desc: 'Run Status', value: 'STANDBY' }] },
 
 // ── RO-701 INSTRUMENTS ──────────────────────────────────────────────────
 'pHT-701': { name: 'Feed pH', tags: [{ id: 'pHT-701', desc: 'pH', value: '6.2 pH' }] },
 'FT-702': { name: 'Reject Flow', tags: [{ id: 'FT-702', desc: 'Flow Rate', value: '2.6 m³/hr' }] },
 'PID-701': { name: 'Reject Control Valve', tags: [{ id: 'PID-701', desc: 'Position', value: '25.5 % CLOSE' }] },

 // ── RO-701 AUTOMATED VALVES (AV-701 to AV-714) ─────────────────────────
 'AV-701': { name: 'Drain Valve (Pre-HP Pump)', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-702': { name: 'Permeate to RO-P FW Storage', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-703': { name: 'Permeate to RO-2 CIP Tank', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-704': { name: 'Reject to ETP', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-705': { name: 'Reject to RO-2 CIP Tank', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-706': { name: 'Stage 1 CIP Drop', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-707': { name: 'Stage 2 CIP Drop', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-708': { name: 'RO-2 CIP Inlet Header', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-710': { name: 'MCF-701A Inlet', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-711': { name: 'MCF-701A Outlet', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-712': { name: 'MCF-701B Inlet', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-713': { name: 'MCF-701B Outlet', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-714': { name: 'RO-2 CIP Tank Outlet', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },

 // ── RO-801 MAJOR EQUIPMENT ───────────────────────────────────────────────
 'ROFWST-801': { name: 'RO-2 Feed Water Storage Tank', tags: [{ id: 'LT-701', desc: 'Level', value: '59.8 %' }] },
 'P-801': { name: 'RO-2 Feed Pump', tags: [{ id: 'SPEED', desc: 'Speed', value: '0 RPM' }] },
 'PSF-801': { name: 'Pressure Sand Filter 801', tags: [{ id: 'DPS-801', desc: 'Diff Pressure', value: '0.1 bar' }, { id: 'CDT-801', desc: 'Cond.', value: '10.9 µS/cm²' }] },
 'MCF-801A': { name: 'Cartridge Filter 801A', tags: [{ id: 'DPS-802', desc: 'Combined DP', value: '0.1 bar' }] },
 'MCF-801B': { name: 'Cartridge Filter 801B', tags: [{ id: 'DPS-802', desc: 'Combined DP', value: '0.1 bar' }] },
 'P-802': { name: 'RO-2 High Pressure Pump', tags: [{ id: 'LPS-801', desc: 'Speed Switch', value: '0 RPM' }, { id: 'PT-801', desc: 'Discharge', value: '1.8 bar' }] },
 'P-803': { name: 'RO-2 Inter Booster Pump', tags: [{ id: 'SPEED', desc: 'Speed', value: '2 RPM' }] },
 'RO-801 Membranes': { name: 'RO-801 System (2 Stages)', tags: [
 { id: 'PT-802', desc: 'Stage-1 Conc Press', value: '1.7 bar' },
 { id: 'PT-803', desc: 'Stage-2 Feed Press', value: '0.4 bar' },
 { id: 'PT-804', desc: 'Stage-2 Conc Press', value: '0.4 bar' },
 { id: 'FT-801', desc: 'Permeate Flow', value: '8.0 m³/hr' },
 { id: 'CDT-802',desc: 'Permeate Cond.', value: '0.5 µS/cm²' },
 ]},
 
 // ── RO-801 DOSING & CIP ──────────────────────────────────────────────────
 'DP-801': { name: 'Acid Dosing Pump (From T-402)', tags: [{ id: 'STATUS', desc: 'Run Status', value: 'STOPPED' }] },
 'DP-802': { name: 'Antiscalant Dosing Pump', tags: [{ id: 'STATUS', desc: 'Run Status', value: 'STOPPED' }] },
 
 // ── RO-801 INSTRUMENTS ──────────────────────────────────────────────────
 'pHT-801': { name: 'Feed pH', tags: [{ id: 'pHT-801', desc: 'pH', value: '14.0 pH' }] },
 'FT-802': { name: 'Reject Flow', tags: [{ id: 'FT-802', desc: 'Flow Rate', value: '0.0 m³/hr' }] },
 'PID-801': { name: 'Reject Control Valve', tags: [{ id: 'PID-801', desc: 'Position', value: '100.0 % CLOSE' }] },

 // ── RO-801 AUTOMATED VALVES (AV-801 to AV-814) ─────────────────────────
 'AV-801': { name: 'Drain Valve (Pre-HP Pump)', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-802': { name: 'Permeate to RO-P FW Storage', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-803': { name: 'Permeate to RO-2 CIP Tank', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-804': { name: 'Reject to ETP', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-805': { name: 'Reject to RO-2 CIP Tank', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-806': { name: 'Stage 1 CIP Drop', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-807': { name: 'Stage 2 CIP Drop', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-808': { name: 'RO-2 CIP Inlet Header', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-810': { name: 'MCF-801A Inlet', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-811': { name: 'MCF-801A Outlet', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-812': { name: 'MCF-801B Inlet', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-813': { name: 'MCF-801B Outlet', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-814': { name: 'RO-2 CIP Tank Outlet', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },

 // ── ROP-1001 MAJOR EQUIPMENT ─────────────────────────────────────────────
 'ROPFWST-1001': { name: 'RO-P Feed Water Storage Tank', tags: [{ id: 'LT-1001', desc: 'Level', value: '30.9 %' }] },
 'P-1001': { name: 'RO-P Feed Pump', tags: [{ id: 'STATUS', desc: 'Status', value: 'RUNNING' }] },
 'MCF-1001': { name: 'Cartridge Filter 1001', tags: [{ id: 'DPS-1001', desc: 'Combined DP', value: '0.1 bar' }, { id: 'CDIC-1001', desc: 'Cond.', value: '262.8 µS/cm²' }] },
 'P-1002': { name: 'RO-P System Pump', tags: [{ id: 'LPS-1001', desc: 'Speed Switch', value: 'Normal' }, { id: 'PT-1001', desc: 'Discharge', value: '7.8 bar' }, { id: 'SPEED', desc: 'Speed', value: '2579 RPM' }] },
 'ROP-1001 Membranes': { name: 'ROP-1001 System (1 Stage)', tags: [
 { id: 'PT-1002', desc: 'Reject Press', value: '6.8 bar' },
 { id: 'FT-1001', desc: 'Permeate Flow', value: '37.5 m³/hr' },
 { id: 'CDIC-1002',desc: 'Permeate Cond.', value: '32.8 µS/cm²' },
 ]},
 
 // ── ROP-1001 DOSING & CIP ────────────────────────────────────────────────
 'DP-1001': { name: 'Antiscalant Dosing Pump', tags: [{ id: 'STATUS', desc: 'Run Status', value: 'RUNNING' }] },
 'T-1001': { name: 'ROP CIP Tank', tags: [{ id: 'LLS-1001', desc: 'Low Level Switch', value: 'Normal' }] },
 
 // ── ROP-1001 INSTRUMENTS ─────────────────────────────────────────────────
 'FT-1002': { name: 'Reject Flow', tags: [{ id: 'FT-1002', desc: 'Flow Rate', value: '4.2 m³/hr' }] },
 'PID-1001': { name: 'Reject Control Valve', tags: [{ id: 'PID-1001', desc: 'Position', value: '18.1 %' }] },

 // ── ROP-1001 AUTOMATED VALVES ────────────────────────────────────────────
 'AV-1001': { name: 'Permeate to RO-P FW Storage', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-1002': { name: 'Permeate to ROP CIP Tank', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-1003': { name: 'Reject to ETP', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-1004': { name: 'Reject to RO-1 FW Storage', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'OPEN' }] },
 'AV-1005': { name: 'Reject to ROP CIP Tank', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-1006': { name: 'Pre-Membrane Drain', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-1007': { name: 'CIP Inlet', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 'AV-1008': { name: 'ROP CIP Tank Outlet', tags: [{ id: 'STATUS', desc: 'Valve State', value: 'CLOSED' }] },
 };



export function injectLiveTelemetry(baseDict, telemetry) {
 if (!telemetry) return baseDict;

 // Deep clone the dictionary so we don't mutate the base constants
 const dict = JSON.parse(JSON.stringify(baseDict));

 // Map telemetry to all components
 Object.keys(dict).forEach(key => {
 const equip = dict[key];
 if (!equip.tags) return;

 equip.tags.forEach(tag => {
 // Flow Transmitters
 if (tag.id.startsWith('FT-')) {
 const flow = telemetry?.flow_rate;
 tag.value = flow != null ? `${flow.toFixed(1)} m³/hr` : '--';
 }
 
 // Pressure Transmitters
 else if (tag.id.startsWith('PT-')) {
 const press = telemetry?.feed_pressure ?? telemetry?.net_pressure;
 tag.value = press != null ? `${press.toFixed(1)} bar` : '--';
 }
 
 // Differential Pressure
 else if (tag.id.startsWith('DPS-')) {
 const dp = telemetry?.differential_pressure;
 tag.value = dp != null ? `${dp.toFixed(2)} bar` : '--';
 }
 
 // Conductivity
 else if (tag.id.startsWith('CDT-') || tag.id.startsWith('CDIC-')) {
 const cdt = telemetry?.conductivity;
 tag.value = cdt != null ? `${cdt.toFixed(1)} µS/cm²` : '--';
 }
 
 // pH
 else if (tag.id.startsWith('pHT-')) {
 const ph = telemetry?.pH;
 tag.value = ph != null ? `${ph.toFixed(2)} pH` : '--';
 }
 
 // Tank Levels
 else if (tag.id.startsWith('LT-')) {
 tag.value = '--'; // No real level telemetry available
 }
 
 // Pump RPMs
 else if (tag.id === 'SPEED' || tag.id.startsWith('LPS-')) {
 tag.value = '--'; // No real RPM telemetry available
 }
 });
 });

 return dict;
}
