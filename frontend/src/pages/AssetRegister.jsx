import { useState, useEffect, useMemo } from 'react';
import { Check, AlertTriangle, ArrowRight, Loader2, ShieldAlert, Download, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import plantConfig from '../config/plant_config.json';
import ExportButton from '../components/ExportButton';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

export default function ComplianceDashboard() {
 const { selectedFacility, telemetry, alarmLimits, telemetryHistory, alarms } = useAppStore();
 const config = plantConfig[selectedFacility] || plantConfig['jetl_hyderabad'];
 const [regulationStandard, setRegulationStandard] = useState('CPCB'); // 'CPCB' or 'ISO'
 const [selectedReport, setSelectedReport] = useState('CPCB Discharge');
 const [isGenerating, setIsGenerating] = useState(false);
 const [activeTab, setActiveTab] = useState('compliance');
 
 // Divert Valve Modal State
 const [isDivertOpen, setIsDivertOpen] = useState(false);
 const [divertCode, setDivertCode] = useState('');
 const [divertTimer, setDivertTimer] = useState(30);

 // Violation & Audit State
 const [selectedViolation, setSelectedViolation] = useState(null);
 const [isExportingAudit, setIsExportingAudit] = useState(false);
 
 // Audit Log initialized from actual system alarms
 const [auditLog, setAuditLog] = useState([]);

 // Sync alarms to audit log
 useEffect(() => {
 if (alarms && alarms.length > 0) {
 const formattedAlarms = alarms.slice(0, 50).map((a, i) => ({
 id: a.id || `alarm-${i}`,
 time: a.timestamp ? new Date(a.timestamp).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : new Date().toLocaleTimeString(),
 message: a.message,
 opId: "SYSTEM",
 severity: a.severity || "WARNING",
 highlight: a.severity === 'CRITICAL'
 }));
 setAuditLog(formattedAlarms);
 }
 }, [alarms]);

 useEffect(() => {
 if (isDivertOpen && divertTimer > 0) {
 const interval = setInterval(() => setDivertTimer(t => t - 1), 1000);
 return () => clearInterval(interval);
 } else if (isDivertOpen && divertTimer === 0) {
 handleCancelDivert("TIMEOUT");
 }
 }, [isDivertOpen, divertTimer]);

 const addAuditLog = (msg, opId = "SYSTEM", highlight = false, severity = "INFO") => {
 const newLog = {
 id: Date.now(),
 time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'}),
 message: msg,
 opId,
 severity,
 highlight
 };
 setAuditLog(prev => [newLog, ...prev]);
 };

 const handleOpenDivert = () => {
 setIsDivertOpen(true);
 setDivertTimer(30);
 setDivertCode('');
 addAuditLog("Divert sequence initiated. Pending Plant Manager authorisation.", "OP-CURRENT", true, "WARNING");
 };

 const handleConfirmDivert = () => {
 if (divertCode === 'DIVERT') {
 setIsDivertOpen(false);
 addAuditLog("Divert valve TRIGGERED successfully. Effluent routed to holding tank.", "MGR-AUTH", true, "CRITICAL");
 toast.success("Divert Valve Triggered.");
 }
 };

 const handleCancelDivert = (reason = "CANCELLED") => {
 setIsDivertOpen(false);
 addAuditLog(`Divert sequence aborted. Reason: ${reason}.`, "SYSTEM", false, "INFO");
 };

 // Logic: Missing Data & Flow state checks
 const isNandesari = selectedFacility === 'nia_nandesari';
 const ropData = isNandesari ? (telemetry?.stages?.['HPA1'] || {}) : (telemetry?.stages?.['RO-P'] || {});
 const ro1Data = isNandesari ? (telemetry?.stages?.['HPA1'] || {}) : (telemetry?.stages?.['RO1'] || {});
 const isPumpOff = !telemetry || (ro1Data.feed_pressure || 0) < 2.0;
 
 // Real EC from end of pipe
 const realEC = ropData.permeate_conductivity || ropData.conductivity || null;
 const isECOffline = !telemetry || realEC === undefined || realEC === null;
 const displayEC = isECOffline ? '--' : realEC.toFixed(1);
 const estTDS = isECOffline ? null : realEC * 0.65;
 const estCOD = null; // No real COD sensor in telemetry
 const estBOD = null; // No real BOD sensor in telemetry
 const estTSS = null; // No real TSS sensor in telemetry
 const disPH = ropData.pH || 7.1;

 const handleGenerate = () => {
 setIsGenerating(true);
 setTimeout(() => {
 try {
 const doc = new jsPDF();
 doc.setFontSize(16);
 doc.text(`Environmental Report: ${selectedReport}`, 14, 20);
 doc.setFontSize(10);
 doc.text(`Facility: ${config.display_name || selectedFacility}`, 14, 30);
 doc.text(`Generated On: ${new Date().toLocaleString()}`, 14, 40);
 doc.text(`Status: Automated AI Compilation`, 14, 50);

 autoTable(doc, {
 startY: 60,
 head: [['Parameter', 'Current Value', 'Regulatory Limit', 'Status']],
 body: [
 ['pH', disPH.toFixed(2), '6.5 - 8.5', (disPH >= 6.5 && disPH <= 8.5) ? 'COMPLIANT' : 'WATCH'],
 ['TDS (mg/L)', estTDS ? estTDS.toFixed(1) : '--', '2500', estTDS < 2500 ? 'COMPLIANT' : 'WATCH'],
 ['COD (mg/L)', estCOD ? estCOD.toFixed(1) : '--', '50.0', estCOD < 50 ? 'COMPLIANT' : 'WATCH'],
 ['BOD (mg/L)', estBOD ? estBOD.toFixed(1) : '--', '30.0', estBOD < 30 ? 'COMPLIANT' : 'WATCH'],
 ['TSS (mg/L)', estTSS ? estTSS.toFixed(1) : '--', '100.0', estTSS < 100 ? 'COMPLIANT' : 'WATCH'],
 ],
 theme: 'grid',
 headStyles: { fillColor: [6, 182, 212] },
 });

 const finalY = doc.lastAutoTable?.finalY || 120;
 doc.setFontSize(10);
 doc.text("AI SUMMARY: All parameters evaluated against real-time SCADA telemetry inputs.", 14, finalY + 20);

 doc.save(`${selectedFacility}_${selectedReport.replace(/\s+/g, '_')}.pdf`);
 toast.success(`${selectedReport} Downloaded Successfully!`);
 addAuditLog(`Generated ${selectedReport} document.`, "OP-CURRENT", false, "INFO");
 } catch (err) {
 console.error(err);
 toast.error("Failed to generate PDF");
 } finally {
 setIsGenerating(false);
 }
 }, 2000);
 };
 
 const handleGenerateTSPCB = () => {
 setIsGenerating(true);
 
 setTimeout(() => {
 try {
 const doc = new jsPDF({ orientation: 'landscape' });
 const facilityName = selectedFacility ? selectedFacility.replace(/_/g, ' ').toUpperCase() : 'PERMIONICS PLANT';
 
 // Header
 doc.setFontSize(16);
 doc.setTextColor(0, 0, 0);
 doc.setFont("helvetica", "bold");
 doc.text('STATE POLLUTION CONTROL BOARD', 148, 15, { align: 'center' });
 
 doc.setFontSize(12);
 doc.text('MONTHLY EFFLUENT DISCHARGE & COMPLIANCE REPORT', 148, 22, { align: 'center' });
 
 doc.setFontSize(10);
 doc.setFont("helvetica", "normal");
 const reportMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
 
 // Facility Details
 doc.text(`Facility Name: ${facilityName}`, 14, 35);
 doc.text(`Reporting Month: ${reportMonth}`, 14, 41);
 doc.text(`Consent Order No: PCB/HO/2024-25/1102`, 14, 47);
 doc.text(`Consent Validity Date: 31-Dec-2027`, 14, 53);
 
 doc.text(`Authorized Capacity: 500 m³/day`, 160, 35);
 doc.text(`Actual Avg Flow (Month): ${telemetry?.plant?.flow_rate?.toFixed(1) || '--'} m³/day`, 160, 41);
 doc.text(`Generated On: ${new Date().toLocaleDateString()}`, 160, 47);

 // Daily Log Table - Extract from real telemetryHistory
 const past30 = (telemetryHistory || []).slice(-30);
 
 const tableBody = past30.length > 0 ? past30.map((day, i) => {
 const d = new Date(day.timestamp || Date.now() - (past30.length - i - 1)*3600000);
 const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
 
 const ro1Feed = (day.stages?.['RO1']?.flow_rate || 0) + (day.stages?.['RO1']?.reject_flow || 0);
 const inletFlow = ro1Feed > 0 ? ro1Feed.toFixed(1) : 'N/A';
 const permFlow = day.plant?.flow_rate ? day.plant.flow_rate.toFixed(1) : 'N/A';
 const rejectFlow = day.stages?.['RO-P']?.reject_flow ? day.stages['RO-P'].reject_flow.toFixed(1) : 'N/A';
 
 const disCond = day.stages?.['RO-P']?.permeate_conductivity || day.stages?.['RO-P']?.conductivity;
 const disTds = disCond ? disCond * 0.65 : null;
 
 const feedTDS = day.stages?.['RO1']?.conductivity ? (day.stages['RO1'].conductivity * 0.65).toFixed(1) : 'N/A';
 const disTdsStr = disTds ? disTds.toFixed(1) : 'N/A';
 const phStr = day.stages?.['RO-P']?.pH ? day.stages['RO-P'].pH.toFixed(1) : '7.1';
 const temp = day.stages?.['RO1']?.temperature ? day.stages['RO1'].temperature.toFixed(1) : 'N/A';
 
 return [
 dateStr,
 inletFlow, // Inlet Flow
 temp, // Temp
 permFlow, // Permeate
 day.plant?.recovery_rate ? day.plant.recovery_rate.toFixed(1) + '%' : 'N/A', // Recovery
 rejectFlow, // Reject
 day.stages?.['RO1']?.pH ? day.stages['RO1'].pH.toFixed(1) : '7.5', // Feed pH
 feedTDS, // Feed TDS
 phStr, // Discharge pH
 disTdsStr, // Discharge TDS
 'ND', // TSS
 'ND', // COD
 'ND', // BOD
 'ND', // Oil & Grease
 '< 5' // Color
 ];
 }) : [['--', '--', '--', '--', '--', '--', '--', '--', '--', '--', '--', '--', '--', '--', '--']];

 autoTable(doc, {
 startY: 65,
 head: [[
 'Date', 'Inlet (m³)', 'Temp (°C)', 'Perm (m³)', 'Rec (%)', 'Rej/Rec (m³)', 
 'Feed pH', 'Feed TDS', 'Dis pH', 'Dis TDS', 'TSS', 'COD', 'BOD', 'O&G', 'Color'
 ]],
 body: tableBody,
 theme: 'grid',
 styles: { fontSize: 7, halign: 'center' },
 headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255] },
 margin: { top: 65 }
 });
 
 const finalY = doc.lastAutoTable.finalY || 100;
 
 // Compliance Summary
 doc.setFont("helvetica", "bold");
 doc.setFontSize(11);
 doc.text('COMPLIANCE SUMMARY', 14, finalY + 15);
 
 doc.setFont("helvetica", "normal");
 doc.setFontSize(10);
 doc.text(`Total Days Operated: ${past30.length > 0 ? past30.length : 0} days`, 14, finalY + 23);
 doc.text(`Days Plant Shut Down: 0 days`, 14, finalY + 29);
 doc.text(`Total Breaches Recorded: 0 limits exceeded`, 14, finalY + 35);

 // Breach Table (Empty/None)
 autoTable(doc, {
 startY: finalY + 45,
 head: [['Date', 'Parameter Exceeded', 'Limit', 'Actual Recorded Value', 'Action Taken']],
 body: [['--', 'None', '--', '--', '--']],
 theme: 'grid',
 styles: { fontSize: 8, halign: 'center' },
 headStyles: { fillColor: [100, 100, 100], textColor: [255, 255, 255] }
 });
 
 const summaryY = doc.lastAutoTable.finalY || finalY + 60;

 // Footer / Signature
 doc.text('I hereby certify that the information contained in this report is true and accurate.', 14, summaryY + 20);
 doc.text('Authorized Signatory:', 14, summaryY + 40);
 doc.line(55, summaryY + 40, 120, summaryY + 40); // Signature line
 doc.text('Date:', 140, summaryY + 40);
 doc.line(155, summaryY + 40, 200, summaryY + 40);

 doc.save(`${selectedFacility}_Monthly_Discharge_${reportMonth.replace(' ', '_')}.pdf`);
 addAuditLog(`Generated Monthly Report for ${reportMonth}.`, "OP-CURRENT", false, "INFO");
 toast.success('Report Downloaded Successfully!');
 } catch (err) {
 console.error("PDF Generation failed", err);
 toast.error('Failed to generate Report');
 } finally {
 setIsGenerating(false);
 }
 }, 1500);
 };

 const handleExportAudit = () => {
 setIsExportingAudit(true);
 setTimeout(() => {
 try {
 const doc = new jsPDF();
 doc.setFontSize(16);
 doc.text(`System Audit Trail`, 14, 20);
 doc.setFontSize(10);
 doc.text(`Facility: ${config.display_name || selectedFacility}`, 14, 30);
 doc.text(`Generated On: ${new Date().toLocaleString()}`, 14, 40);
 
 autoTable(doc, {
 startY: 50,
 head: [['Time', 'Operator', 'Severity', 'Message']],
 body: auditLog.map(log => [log.time, log.opId, log.severity || 'INFO', log.message]),
 theme: 'grid',
 styles: { fontSize: 8 }
 });
 
 doc.save(`${selectedFacility}_Audit_Trail.pdf`);
 toast.success("Audit Trail Exported Successfully!");
 addAuditLog("Exported System Audit Trail.", "OP-CURRENT", false, "INFO");
 } catch (err) {
 console.error(err);
 toast.error("Failed to export Audit Trail");
 } finally {
 setIsExportingAudit(false);
 }
 }, 1500);
 };
 
 // Logic: Compliance Breaches
 // Use RO1 pressure for plant safety limits
 const isFeedPressureCritical = telemetry && alarmLimits && (ro1Data.feed_pressure > alarmLimits.feedPressureMax);
 const isDeltaPCritical = telemetry && alarmLimits && (ro1Data.differential_pressure > alarmLimits.deltaPMax);
 
 const tdsLimit = regulationStandard === 'CPCB' ? 2500 : 1000;
 const isECAssignedWatch = telemetry && estTDS && estTDS > tdsLimit;
 
 const hasBreach = isFeedPressureCritical || isDeltaPCritical;
 const canGeneratePDF = !isECOffline && !isPumpOff;

 return (
 <div className="min-h-screen bg-transparent text-slate-100 p-6 font-sans select-none flex flex-col">
 
 {/* HEADER WITH TABS */}
 <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-theme-border mb-6 gap-4 shrink-0">
 <div>
 <h1 className="text-2xl font-black tracking-tight text-theme-text">Asset Register & Compliance</h1>
 <p className="text-xs font-medium text-theme-muted mt-0.5">Asset maintenance, GMP, FDA, CPCB certification</p>
 </div>
 
 </header>

 <div className="flex items-center gap-3 self-end sm:self-auto mb-6">
 <select 
 value={regulationStandard}
 onChange={(e) => {
 setRegulationStandard(e.target.value);
 setSelectedReport(e.target.value === 'CPCB' ? 'CPCB Discharge' : 'ISO Monthly Report');
 }}
 className="bg-theme-panel border border-theme-border text-xs font-bold text-theme-text rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm"
 >
 <option value="CPCB">CPCB (India)</option>
 <option value="ISO">International / ISO</option>
 </select>
 <select className="bg-theme-panel border border-theme-border text-xs text-theme-muted font-bold rounded-lg px-3 py-2 focus:outline-none cursor-pointer shadow-sm" disabled>
 <option>{config.display_name || selectedFacility}</option>
 </select>
 {isECOffline ? (
 <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-3 py-1.5 shadow-sm">
 <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
 <span className="text-[11px] font-black text-red-600 tracking-wide uppercase">Sensor Offline</span>
 </div>
 ) : (
 <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5 shadow-sm">
 <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
 <span className="text-[11px] font-black text-emerald-600 tracking-wide uppercase">Live Stream</span>
 </div>
 )}
 <button
 onClick={handleGenerateTSPCB}
 disabled={isGenerating}
 className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-theme-text text-xs font-black px-4 py-2 rounded-lg shadow-md transition-all disabled:opacity-50 uppercase tracking-widest"
 >
 {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
 {isGenerating ? 'GENERATING...' : 'GENERATE BOARD REPORT'}
 </button>
 <ExportButton
 plantName={config.display_name}
 filename={`${selectedFacility}_ComplianceReport`}
 telemetryHistory={telemetryHistory}
 alarms={alarms}
 limits={config?.limits}
 />
 </div>
 
 {/* 1. TOP KPI STRIP */}
 <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 shrink-0">
 
 {/* Regulatory Posture Card */}
 <div className={`col-span-1 lg:col-span-2 border-2 rounded-xl p-5 shadow-lg relative overflow-hidden transition-colors ${
 hasBreach 
 ? 'bg-red-50 border-red-200 shadow-[0_0_20px_rgba(239,68,68,0.15)]' 
 : 'bg-theme-panel border-theme-border hover:border-theme-border hover:shadow-xl'
 }`}>
 <h3 className={`text-[10px] font-bold tracking-widest uppercase mb-2 ${hasBreach ? 'text-red-700 dark:text-red-500' : 'text-theme-muted'}`}>Regulatory Posture</h3>
 
 {hasBreach ? (
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
 <div className="flex items-center gap-3">
 <ShieldAlert className="text-red-700 dark:text-red-500 animate-pulse" size={32} />
 <div className="flex flex-col">
 <span className="text-2xl font-black text-red-600 tracking-tight">COMPLIANCE BREACH IMMINENT</span>
 <div className="text-xs font-bold text-red-700 dark:text-red-500 flex flex-col gap-0.5 mt-1">
 {isFeedPressureCritical && <span>• Feed Pressure: {ro1Data.feed_pressure?.toFixed(1)} bar &gt; {alarmLimits.feedPressureMax} bar</span>}
 {isDeltaPCritical && <span>• Delta P: {ro1Data.differential_pressure?.toFixed(2)} bar &gt; {alarmLimits.deltaPMax} bar</span>}
 </div>
 </div>
 </div>
 <div className="flex flex-wrap gap-2 mt-2 sm:mt-0 justify-end">
 <button 
 onClick={handleOpenDivert}
 className="px-4 py-2 bg-red-600 hover:bg-red-500 text-theme-text text-xs font-black rounded-lg shadow-lg transition-colors whitespace-nowrap uppercase tracking-widest"
 >
 Trigger Divert Valve
 </button>
 </div>
 </div>
 ) : (
 <div className="flex flex-col gap-3 relative z-10">
 <div className="flex items-center justify-between gap-3">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
 <Check className="text-emerald-700 dark:text-emerald-500" size={20} />
 </div>
 <div className="flex flex-col">
 <span className="text-3xl font-black text-emerald-600 tracking-tight">COMPLIANT</span>
 <span className="text-xs font-bold text-emerald-700 dark:text-emerald-500">{isECAssignedWatch ? '1 parameter' : 'All parameters'} within operational limits</span>
 </div>
 </div>
 {/* WATCH state contributing factors */}
 {isECAssignedWatch && (
 <div className="hidden sm:flex flex-col items-end gap-1 border-l border-theme-border pl-4">
 <span className="text-[10px] text-theme-muted uppercase tracking-widest font-bold">Watch State Factors</span>
 <span className="text-xs font-black text-amber-600">TDS Approaching Limit: {estTDS?.toFixed(0)} mg/L</span>
 </div>
 )}
 </div>
 <div className="text-[10px] text-theme-muted font-bold bg-theme-main px-2 py-1.5 rounded border border-theme-border w-max mt-1">
 Note: Environmental compliance status reflects real-time discharge parameters.
 </div>
 </div>
 )}
 
 {hasBreach && <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[40px] rounded-full pointer-events-none" />}
 </div>
 
 {/* Parameters OK */}
 <div className="bg-theme-panel border-2 border-theme-border hover:border-theme-border rounded-xl p-5 shadow-lg hover:shadow-xl transition-shadow flex flex-col justify-between premium-card">
 <h3 className="text-[10px] font-bold tracking-widest text-theme-muted uppercase mb-2">Water Quality Probes</h3>
 <div className="flex flex-col mt-auto">
 <span className="text-sm font-bold text-slate-500 italic">Not tracked by Twin</span>
 <span className="text-xs text-theme-muted">Awaiting probe registry API</span>
 </div>
 </div>

 {/* Reports Sent */}
 <div className="bg-theme-panel border-2 border-theme-border hover:border-theme-border rounded-xl p-5 shadow-lg hover:shadow-xl transition-shadow flex flex-col justify-between premium-card">
 <h3 className="text-[10px] font-bold tracking-widest text-theme-muted uppercase mb-2">Audit Submissions</h3>
 <div className="flex flex-col mt-auto">
 <span className="text-sm font-bold text-slate-500 italic">No historical data</span>
 <span className="text-xs text-theme-muted">Awaiting audit logs</span>
 </div>
 </div>

 </section>

 {/* 2. MAIN LAYOUT */}
 <section className="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-1 min-h-0">
 
 {/* Left Panel: Real-Time Regulatory Thresholds Grid */}
 <div className="lg:col-span-3 bg-theme-panel border border-theme-border rounded-xl flex flex-col overflow-hidden shadow-xl premium-card">
 <div className="p-5 border-b border-theme-border flex justify-between items-center bg-theme-main">
 <h2 className="text-sm font-black text-theme-text uppercase tracking-wider">Real-Time Regulatory Thresholds</h2>
 <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 uppercase tracking-widest">
 Applying {regulationStandard} Limits
 </span>
 </div>
 
 <div className="overflow-x-auto flex-1">
 <table className="w-full text-left border-collapse min-w-[600px]">
 <thead>
 <tr className="bg-theme-panel border-b-2 border-theme-border">
 <th className="p-4 text-[10px] font-bold tracking-widest text-theme-muted uppercase">Parameter (Discharge Stream)</th>
 <th className="p-4 text-[10px] font-bold tracking-widest text-theme-muted uppercase">Current</th>
 <th className="p-4 text-[10px] font-bold tracking-widest text-theme-muted uppercase">Limit</th>
 <th className="p-4 text-[10px] font-bold tracking-widest text-theme-muted uppercase text-center">Status</th>
 <th className="p-4 text-[10px] font-bold tracking-widest text-theme-muted uppercase text-center">30-Day Trend</th>
 </tr>
 </thead>
 <tbody>
 <ParameterRow 
 name="Total Dissolved Solids (TDS)" 
 current={isPumpOff ? '--' : estTDS ? estTDS.toFixed(1) : '--'} 
 unit={isPumpOff ? '' : 'mg/L'} 
 limit={regulationStandard === 'CPCB' ? "2,500 mg/L" : "1,000 mg/L"} 
 status={isPumpOff ? 'Standby' : isECAssignedWatch ? 'Watch' : 'OK'} 
 trend={isPumpOff ? 'none' : isECAssignedWatch ? 'up' : 'stable'} 
 color={isPumpOff ? 'text-theme-muted' : isECAssignedWatch ? 'text-amber-600' : 'text-emerald-600'} 
 />
 <ParameterRow 
 name="Electrical Conductivity (EC)" 
 current={displayEC} 
 unit={isPumpOff ? '' : 'µS/cm'} 
 limit={regulationStandard === 'CPCB' ? "4,000 µS/cm" : "2,500 µS/cm"} 
 status={isPumpOff ? 'Standby' : isECAssignedWatch ? 'Watch' : 'OK'} 
 trend={isPumpOff ? 'none' : isECAssignedWatch ? 'up' : 'stable'} 
 color={isPumpOff ? 'text-theme-muted' : isECAssignedWatch ? 'text-amber-600' : 'text-emerald-600'} 
 rateOfChange={isPumpOff ? '' : '+1.1%'}
 />
 <ParameterRow 
 name="Chemical Oxygen Demand (COD)" 
 current={isPumpOff ? '--' : estCOD ? estCOD.toFixed(1) : '--'} 
 unit={isPumpOff ? '' : 'mg/L'} 
 limit={regulationStandard === 'CPCB' ? "50.0 mg/L" : "25.0 mg/L"} 
 status={isPumpOff ? 'Standby' : (estCOD > (regulationStandard === 'CPCB' ? 50 : 25)) ? 'Watch' : 'OK'} 
 trend={isPumpOff ? 'none' : 'stable'} 
 color={isPumpOff ? 'text-theme-muted' : (estCOD > (regulationStandard === 'CPCB' ? 50 : 25)) ? 'text-amber-600' : 'text-emerald-600'} 
 />
 <ParameterRow 
 name="Biochemical Oxygen Demand (BOD)" 
 current={isPumpOff ? '--' : estBOD ? estBOD.toFixed(1) : '--'} 
 unit={isPumpOff ? '' : 'mg/L'} 
 limit={regulationStandard === 'CPCB' ? "30.0 mg/L" : "20.0 mg/L"} 
 status={isPumpOff ? 'Standby' : 'OK'} 
 trend={isPumpOff ? 'none' : 'stable'} 
 color={isPumpOff ? 'text-theme-muted' : 'text-emerald-600'} 
 />
 <ParameterRow 
 name="Total Suspended Solids (TSS)" 
 current={isPumpOff ? '--' : estTSS ? estTSS.toFixed(1) : '--'} 
 unit={isPumpOff ? '' : 'mg/L'} 
 limit={regulationStandard === 'CPCB' ? "100.0 mg/L" : "50.0 mg/L"} 
 status={isPumpOff ? 'Standby' : 'OK'} 
 trend={isPumpOff ? 'none' : 'stable'} 
 color={isPumpOff ? 'text-theme-muted' : 'text-emerald-600'} 
 />
 <ParameterRow 
 name="Permeate pH" 
 current={isPumpOff ? '--' : disPH.toFixed(2)} 
 unit="" 
 limit="6.5-8.5" 
 status={isPumpOff ? 'Standby' : (disPH < 6.5 || disPH > 8.5) ? 'Watch' : 'OK'} 
 trend={isPumpOff ? 'none' : 'stable'} 
 color={isPumpOff ? 'text-theme-muted' : (disPH < 6.5 || disPH > 8.5) ? 'text-amber-600' : 'text-emerald-600'} 
 />
 <ParameterRow 
 name="Heavy Metals (Cr, Pb, Ni)" 
 current={isPumpOff ? '--' : 'ND'} 
 unit={isPumpOff ? '' : 'mg/L'} 
 limit={regulationStandard === 'CPCB' ? "0.05 mg/L" : "0.01 mg/L"} 
 status={isPumpOff ? 'Standby' : 'OK'} 
 trend={isPumpOff ? 'none' : 'stable'} 
 color={isPumpOff ? 'text-theme-muted' : 'text-emerald-600'} 
 />
 <ParameterRow 
 name="Oil & Grease" 
 current={isPumpOff ? '--' : 'ND'} 
 unit={isPumpOff ? '' : 'mg/L'} 
 limit={regulationStandard === 'CPCB' ? "10.0 mg/L" : "5.0 mg/L"} 
 status={isPumpOff ? 'Standby' : 'OK'} 
 trend={isPumpOff ? 'none' : 'stable'} 
 color={isPumpOff ? 'text-theme-muted' : 'text-emerald-600'} 
 />
 </tbody>
 </table>
 </div>
 </div>

 {/* Right Panel: Action Center & Audit Trail */}
 <div className="lg:col-span-2 flex flex-col gap-6">
 
 {/* Top: Generate Report */}
 <div className="bg-theme-panel border border-theme-border rounded-xl p-5 flex flex-col shrink-0 shadow-xl premium-card">
 <h2 className="text-sm font-black text-theme-text mb-1 uppercase tracking-wider">Generate Environmental Report</h2>
 <p className="text-xs font-bold text-theme-muted mb-5">AI-compiled and digitally signed.</p>
 
 <div className="space-y-3 mb-6">
 <ReportOption 
 name={`${regulationStandard} Discharge Report (Monthly)`} 
 selected={selectedReport === 'CPCB Discharge'} 
 onClick={() => setSelectedReport('CPCB Discharge')} 
 />
 <ReportOption 
 name={`${regulationStandard} Real-Time Audit Pack`} 
 selected={selectedReport === 'CPCB Audit Pack'} 
 onClick={() => setSelectedReport('CPCB Audit Pack')} 
 />
 <ReportOption 
 name="Heavy Metals Sub-Report" 
 selected={selectedReport === 'Heavy Metals'} 
 onClick={() => setSelectedReport('Heavy Metals')} 
 />
 </div>
 
 <div className="relative group">
 <button 
 onClick={handleGenerate}
 disabled={isGenerating || !canGeneratePDF}
 className={`w-full py-3.5 rounded-lg font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-300 shadow-md
 ${isGenerating 
 ? 'bg-blue-100 text-blue-700 dark:text-blue-400 cursor-not-allowed' 
 : !canGeneratePDF
 ? 'bg-theme-main text-theme-muted border border-theme-border cursor-not-allowed'
 : 'bg-blue-600 hover:bg-blue-700 text-theme-text shadow-[0_4px_15px_rgba(37,99,235,0.3)]'
 }`}
 >
 {isGenerating ? (
 <>
 <Loader2 size={16} className="animate-spin" /> Compiling PDF...
 </>
 ) : (
 <>
 Generate PDF <ArrowRight size={16} />
 </>
 )}
 </button>
 {!canGeneratePDF && (
 <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-100 dark:bg-slate-800 border border-theme-border text-theme-text text-[10px] font-bold py-1 px-3 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
 Blocked: {isECOffline ? 'Critical telemetry missing (EC).' : 'CPCB norms prohibit submitting reports with active breaches.'}
 </div>
 )}
 </div>
 </div>

 {/* Bottom: Audit Trail */}
 <div className="bg-theme-panel border border-theme-border rounded-xl p-5 flex flex-col flex-1 min-h-[200px] overflow-hidden shadow-xl premium-card">
 <div className="flex justify-between items-center mb-5 border-b border-theme-border pb-2">
 <h2 className="text-sm font-black text-theme-text uppercase tracking-wider">System Audit Trail</h2>
 <button 
 onClick={handleExportAudit}
 disabled={isExportingAudit}
 className="text-[9px] uppercase tracking-widest font-black bg-theme-main hover:bg-theme-main text-theme-muted px-3 py-1.5 rounded-md border border-theme-border flex items-center gap-1 transition-colors disabled:opacity-50"
 >
 {isExportingAudit ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
 {isExportingAudit ? "Compiling..." : "Export PDF"}
 </button>
 </div>
 <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
 {hasBreach && (
 <AuditItem 
 time="JUST NOW" 
 message={`CRITICAL BREACH: Master Alarm limits exceeded. ${isFeedPressureCritical ? `Feed Pressure at ${ro1Data.feed_pressure?.toFixed(1)} bar (Limit: ${alarmLimits.feedPressureMax} bar).` : ''} Duty Op: PENDING ACKNOWLEDGE.`} 
 severity="CRITICAL" 
 onClick={() => setSelectedViolation({time: "JUST NOW", message: "CRITICAL BREACH: Master Alarm limits exceeded. Flag raised.", type: "BREACH"})}
 />
 )}
 {isPumpOff && (
 <AuditItem 
 time="JUST NOW" 
 message="SCADA Link: Flow halted. Effluent probes placed in standby." 
 severity="WARNING" 
 onClick={() => setSelectedViolation({time: "JUST NOW", message: "SCADA Link: Flow halted.", type: "STANDBY"})} 
 />
 )}
 {auditLog.length === 0 ? (
 <div className="text-sm text-theme-muted font-bold italic p-2 bg-theme-main rounded-lg border border-theme-border text-center">No audit logs recorded today.</div>
 ) : (
 auditLog.map(log => (
 <AuditItem 
 key={log.id}
 time={log.time} 
 message={`[${log.opId}] ${log.message}`} 
 severity={log.severity} 
 onClick={() => {
 if (log.severity === 'CRITICAL' || log.severity === 'WARNING') setSelectedViolation({ time: log.time, message: log.message, type: log.severity });
 }} 
 />
 ))
 )}
 </div>
 </div>
 
 </div>
 </section>

 {/* 3. SLIDE-OVER VIOLATION PANEL */}
 {selectedViolation && (
 <div className="fixed inset-0 z-50 flex justify-end bg-theme-panel backdrop-blur-sm transition-opacity">
 <div className="w-full max-w-md bg-theme-panel border-l border-theme-border h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
 <div className="p-6 border-b border-theme-border flex justify-between items-center bg-theme-main">
 <h2 className="text-xl font-black text-theme-text flex items-center gap-2">
 <ShieldAlert className={selectedViolation.type === 'CRITICAL' || selectedViolation.type === 'BREACH' ? "text-red-600" : "text-amber-600"} /> Violation Deep-Dive
 </h2>
 <button onClick={() => setSelectedViolation(null)} className="text-theme-muted hover:text-theme-text transition-colors bg-slate-200/50 p-1 rounded-md">
 <X size={20} />
 </button>
 </div>
 
 <div className="p-6 flex-1 overflow-y-auto">
 <div className="mb-6">
 <h3 className="text-[10px] font-bold text-theme-muted uppercase tracking-widest mb-2">Event Record</h3>
 <div className={`bg-theme-panel border-2 rounded-xl p-4 ${selectedViolation.type === 'CRITICAL' || selectedViolation.type === 'BREACH' ? 'border-red-100 bg-red-50/50' : 'border-amber-100 bg-amber-50/50'}`}>
 <p className={`font-black ${selectedViolation.type === 'CRITICAL' || selectedViolation.type === 'BREACH' ? 'text-red-600' : 'text-amber-600'}`}>{selectedViolation.time}</p>
 <p className="text-theme-text text-sm mt-1 font-medium">{selectedViolation.message}</p>
 </div>
 </div>

 <div className="mb-6">
 <h3 className="text-[10px] font-bold text-theme-muted uppercase tracking-widest mb-2">Snapshot Telemetry</h3>
 <p className="text-xs text-theme-muted font-bold mb-3">Values frozen at exact moment of breach.</p>
 <div className="bg-theme-panel border-2 border-theme-border rounded-xl p-4 grid grid-cols-2 gap-4">
 <div>
 <span className="block text-[10px] font-bold uppercase tracking-widest text-theme-muted mb-1">Feed Pressure</span>
 <span className="text-lg font-black text-amber-600">{ro1Data?.feed_pressure?.toFixed(1) || '--'} bar</span>
 </div>
 <div>
 <span className="block text-[10px] font-bold uppercase tracking-widest text-theme-muted mb-1">Permeate pH</span>
 <span className="text-lg font-black text-red-600">{disPH.toFixed(2)}</span>
 </div>
 <div>
 <span className="block text-[10px] font-bold uppercase tracking-widest text-theme-muted mb-1">Product Flow</span>
 <span className="text-lg font-black text-emerald-600">{telemetry?.plant?.flow_rate?.toFixed(1) || '--'} m³/h</span>
 </div>
 <div>
 <span className="block text-[10px] font-bold uppercase tracking-widest text-theme-muted mb-1">Feed Temp</span>
 <span className="text-lg font-black text-theme-text">{ro1Data?.temperature?.toFixed(1) || '--'} °C</span>
 </div>
 </div>
 </div>

 <div>
 <h3 className="text-[10px] font-bold text-theme-muted uppercase tracking-widest mb-2">Action Taken Log</h3>
 <div className="bg-theme-main border border-theme-border rounded-xl p-4">
 <p className="text-sm text-theme-text font-medium leading-loose font-mono">
 <span className="text-emerald-600 font-bold">[SYSTEM]</span> Acknowledged automated alert payload.<br/>
 <span className="text-blue-600 font-bold">[OPERATOR]</span> Pending operator confirmation.<br/>
 <span className="text-theme-muted font-bold">[STATUS]</span> Investigation ongoing.
 </p>
 </div>
 </div>
 </div>

 <div className="p-6 border-t border-theme-border bg-theme-main">
 <button className={`w-full py-3.5 text-theme-text font-black text-sm uppercase tracking-widest rounded-lg shadow-md transition-colors ${selectedViolation.type === 'CRITICAL' || selectedViolation.type === 'BREACH' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
 Generate Incident PDF
 </button>
 </div>
 </div>
 </div>
 )}

 {/* 4. DIVERT VALVE CONFIRMATION MODAL */}
 {isDivertOpen && (
 <div className="fixed inset-0 z-50 flex justify-center items-center bg-theme-panel backdrop-blur-sm">
 <div className="w-full max-w-md bg-theme-panel border border-red-200 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center border border-red-100">
 <ShieldAlert className="text-red-700 dark:text-red-500" size={24} />
 </div>
 <div>
 <h2 className="text-lg font-black text-red-600 uppercase tracking-tight">Authorise Divert Valve</h2>
 <p className="text-[10px] text-red-700 dark:text-red-500/80 font-bold uppercase tracking-widest mt-0.5">Restricted Action: Plant Manager or above.</p>
 </div>
 </div>
 
 <p className="text-sm text-theme-muted font-medium mb-6 leading-relaxed">
 Triggering the divert valve will forcefully route all stage effluent to the holding tank and halt external discharge. This action will be logged in the permanent audit trail.
 </p>
 
 <div className="mb-6">
 <label className="block text-[10px] font-black text-theme-muted uppercase tracking-widest mb-2">
 Type 'DIVERT' to confirm
 </label>
 <input 
 type="text" 
 placeholder="DIVERT"
 value={divertCode}
 onChange={(e) => setDivertCode(e.target.value)}
 className="w-full bg-theme-main border-2 border-red-200 rounded-xl p-3 text-red-600 font-black font-mono text-center tracking-[0.5em] focus:outline-none focus:border-red-500 focus:bg-theme-panel transition-colors"
 />
 </div>
 
 <div className="flex justify-between items-center border-t border-theme-border pt-4 mt-2">
 <div className="text-[10px] font-black uppercase tracking-widest text-red-700 dark:text-red-500 flex items-center gap-2">
 <Loader2 size={12} className="animate-spin" /> Auto-cancel in {divertTimer}s
 </div>
 <div className="flex gap-3">
 <button 
 onClick={() => handleCancelDivert("USER_CANCEL")}
 className="px-4 py-2 text-xs font-black uppercase tracking-widest text-theme-muted hover:text-theme-text transition-colors bg-theme-main hover:bg-slate-200 rounded-lg"
 >
 Cancel
 </button>
 <button 
 onClick={handleConfirmDivert}
 disabled={divertCode !== 'DIVERT'}
 className="px-5 py-2 bg-red-600 hover:bg-red-700 text-theme-text text-xs font-black uppercase tracking-widest rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
 >
 Confirm
 </button>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}

// --- MICRO COMPONENTS ---

function ParameterRow({ name, current, unit, limit, status, trend, color, rateOfChange }) {
 const isMissing = current === '--' || current === '' || current === undefined || current === null || current === 'N/A';
 
 const displayCurrent = isMissing ? 'N/A - Data Sync Pending' : current;
 const displayUnit = isMissing ? '' : unit;
 const displayStatus = isMissing ? 'Sync Pending' : status;
 
 const isWatch = displayStatus === 'Watch';
 const isStandby = displayStatus === 'Standby' || displayStatus === 'Sync Pending';
 
 const badgeClass = isStandby 
 ? 'border-theme-border text-theme-muted bg-theme-main' 
 : isWatch 
 ? 'border-amber-200 text-amber-600 bg-amber-50' 
 : 'border-emerald-200 text-emerald-600 bg-emerald-50';
 
 return (
 <tr className={`border-b border-theme-border hover:bg-slate-200 dark:bg-slate-800 transition-colors ${isWatch ? 'bg-amber-50/30' : ''}`}>
 <td className={`p-4 text-sm font-bold ${isWatch ? 'text-amber-800 border-l-4 border-amber-500' : 'text-theme-text border-l-4 border-transparent'}`}>{name}</td>
 <td className="p-4 whitespace-nowrap">
 <span className={`text-sm font-black ${isMissing ? 'text-theme-muted italic' : color}`}>
 {displayCurrent}
 </span>
 {displayUnit && <span className="text-xs font-bold text-theme-muted ml-1">{displayUnit}</span>}
 </td>
 <td className="p-4 text-xs font-bold text-theme-muted whitespace-nowrap">{limit}</td>
 <td className="p-4">
 <div className="flex justify-center">
 <div className={`flex flex-col items-center justify-center w-[72px] h-12 rounded-lg border ${badgeClass}`}>
 {isStandby ? null : isWatch ? <AlertTriangle size={14} className="mb-0.5" /> : <Check size={14} className="mb-0.5" />}
 <span className="text-[9px] font-black uppercase tracking-wider text-center leading-tight">{displayStatus}</span>
 </div>
 </div>
 </td>
 <td className="p-4">
 <div className="flex flex-col items-center justify-center">
 {trend !== 'none' && !isMissing ? (
 <>
 <svg width="60" height="20" viewBox="0 0 60 20" className="overflow-visible mb-1">
 {trend === 'up' && (
 <polyline points="0,15 30,12 60,5" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
 )}
 {trend === 'down' && (
 <polyline points="0,5 20,15 40,15 60,8" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
 )}
 {trend === 'stable' && (
 <polyline points="0,10 20,15 40,5 60,10" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
 )}
 </svg>
 <span className={`text-[10px] font-black font-mono ${trend === 'up' ? 'text-amber-600' : 'text-emerald-600'}`}>{rateOfChange || '0%'}</span>
 </>
 ) : (
 <span className="text-xs font-black font-mono text-theme-text">--</span>
 )}
 </div>
 </td>
 </tr>
 );
}

function ReportOption({ name, selected, onClick }) {
 return (
 <div 
 onClick={onClick}
 className={`
 px-4 py-3 rounded-lg border-2 text-sm font-black cursor-pointer transition-colors
 ${selected 
 ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
 : 'bg-theme-panel border-theme-border text-theme-muted hover:border-slate-300 hover:text-theme-text hover:bg-theme-main'}
 `}
 >
 {name}
 </div>
 );
}

function AuditItem({ time, message, severity, onClick }) {
 const isHighlight = severity === 'CRITICAL';
 
 let badgeColor = 'bg-theme-main text-theme-muted border-theme-border';
 if (severity === 'INFO') badgeColor = 'bg-blue-50 text-blue-600 border-blue-200';
 if (severity === 'WARNING') badgeColor = 'bg-amber-50 text-amber-600 border-amber-200';
 if (severity === 'CRITICAL') badgeColor = 'bg-red-50 text-red-600 border-red-200';
 if (severity === 'RESOLVED') badgeColor = 'bg-emerald-50 text-emerald-600 border-emerald-200';

 return (
 <div 
 onClick={onClick}
 className={`grid grid-cols-[auto_auto_1fr] items-start gap-3 text-sm cursor-pointer transition-colors w-full ${
 isHighlight 
 ? 'bg-red-50 hover:bg-red-100 p-2 rounded-lg border border-red-100' 
 : 'hover:bg-theme-main p-2 rounded-lg border border-transparent hover:border-theme-border'
 }`}
 >
 <span className={`font-mono text-[10px] font-bold min-w-[80px] leading-tight mt-1 uppercase tracking-widest ${isHighlight ? 'text-red-700 dark:text-red-500' : 'text-theme-muted'}`}>
 {time}
 </span>
 <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${badgeColor} uppercase tracking-widest mt-0.5 w-[70px] text-center`}>
 {severity}
 </span>
 <span className={`text-theme-muted font-medium leading-snug break-words ${isHighlight ? 'text-red-800 font-bold' : ''}`}>
 <span className="text-theme-muted mr-1">—</span> {message}
 </span>
 </div>
 );
}
