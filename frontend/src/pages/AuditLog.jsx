import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ClipboardList, Filter, Search, ArrowDownUp, ChevronLeft, ChevronRight } from 'lucide-react';

export default function AuditLog() {
 const { auditLog } = useAppStore();
 const [searchTerm, setSearchTerm] = useState('');
 const [currentPage, setCurrentPage] = useState(1);
 const itemsPerPage = 50;
 
 const [pageTimestamp, setPageTimestamp] = useState(() => new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' IST');

 useEffect(() => {
 const interval = setInterval(() => {
 setPageTimestamp(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' IST');
 }, 1000);
 return () => clearInterval(interval);
 }, []);
 
 const filteredLogs = auditLog.filter(log => 
 log.action.toLowerCase().includes(searchTerm.toLowerCase()) || 
 log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
 log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
 (log.severity && log.severity.toLowerCase().includes(searchTerm.toLowerCase()))
 );

 const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
 const currentLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

 const getSeverityColor = (severity) => {
 switch(severity) {
 case 'INFO': return 'text-cyan-700 dark:text-cyan-400 border-cyan-500/30 bg-cyan-950/20';
 case 'WARNING': return 'text-amber-700 dark:text-amber-400 border-amber-500/30 bg-amber-950/20';
 case 'CRITICAL': return 'text-red-700 dark:text-red-400 border-red-500/30 bg-red-950/20';
 case 'RESOLVED': return 'text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-950/20';
 default: return 'text-theme-muted border-theme-border bg-slate-100 dark:bg-slate-80050';
 }
 };

 const handleExportCSV = () => {
 if (filteredLogs.length === 0) return;
 const headers = ['Timestamp (IST)', 'Event ID', 'Operator / System', 'Severity', 'Action Type', 'Detailed Context'];
 const rows = filteredLogs.map(log => [
 new Date(log.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
 log.id,
 log.user,
 log.severity || 'INFO',
 log.action,
 `"${(log.details || '').replace(/"/g, '""')}"`
 ]);
 const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
 const link = document.createElement("a");
 link.setAttribute("href", encodeURI(csvContent));
 link.setAttribute("download", `Global_Audit_Trail_${new Date().toISOString().split('T')[0]}.csv`);
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 };

 return (
 <div className="flex flex-col min-h-full p-6 animate-in fade-in duration-300 shrink-0">
 <div className="flex items-center justify-between mb-8">
 <div>
 <h1 className="text-2xl font-black text-theme-text flex items-center gap-3">
 <ClipboardList className="text-cyan-700 dark:text-cyan-400" size={28} />
 Global Audit Trail
 </h1>
 <p className="text-theme-muted mt-1">Immutable record of compliance-critical operator actions, system overrides, and AI model deployments.</p>
 </div>
 <div className="flex gap-4 items-center">
 <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full mr-2">
 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
 <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Live · {pageTimestamp}</span>
 </div>
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" size={16} />
 <input 
 type="text" 
 placeholder="Search audit events..." 
 value={searchTerm}
 onChange={e => {
 setSearchTerm(e.target.value);
 setCurrentPage(1);
 }}
 className="bg-theme-panel border border-theme-border rounded-lg pl-10 pr-4 py-2 text-sm text-theme-text focus:outline-none focus:border-cyan-500 w-64"
 />
 </div>
 <button 
 onClick={handleExportCSV}
 className="bg-theme-panel border border-theme-border px-4 py-2 rounded-lg text-theme-text hover:text-theme-text hover:border-slate-500 transition-colors text-xs font-bold uppercase tracking-widest flex items-center gap-2"
 >
 Export CSV
 </button>
 </div>
 </div>

 <div className="bg-theme-panel border border-theme-border rounded-xl shadow-2xl overflow-hidden premium-card">
 <div className="overflow-x-auto">
 <table className="w-full text-left text-sm">
 <thead>
 <tr className="bg-theme-panel border-b border-theme-border text-theme-muted uppercase tracking-widest text-[10px] font-bold">
 <th className="p-4 w-40 cursor-pointer hover:text-theme-text group">Timestamp <ArrowDownUp size={12} className="inline opacity-0 group-hover:opacity-100 transition-opacity" /></th>
 <th className="p-4 w-32">Event ID</th>
 <th className="p-4 w-40">Operator / System</th>
 <th className="p-4 w-28">Severity</th>
 <th className="p-4 w-40">Action Type</th>
 <th className="p-4">Detailed Context</th>
 </tr>
 </thead>
 <tbody>
 {currentLogs.map(log => (
 <tr key={log.id} className="border-b border-theme-border/50 hover:bg-slate-100 dark:bg-slate-80030 transition-colors">
 <td className="p-4 text-theme-muted whitespace-nowrap font-mono text-xs">
 {new Date(log.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
 </td>
 <td className="p-4 text-theme-muted font-mono text-xs">{log.id}</td>
 <td className="p-4">
 <span className="text-theme-text font-mono text-xs">
 {log.user}
 </span>
 </td>
 <td className="p-4">
 <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${getSeverityColor(log.severity)}`}>
 {log.severity || 'INFO'}
 </span>
 </td>
 <td className="p-4">
 <span className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold uppercase tracking-widest border border-dashed
 ${log.action.includes('E-Stop') || log.action.includes('Alarm') || log.action.includes('Violation') ? 'text-amber-700 dark:text-amber-500 border-amber-500/30 bg-amber-500/5' : 
 log.action.includes('Model') || log.action.includes('Batch') ? 'text-purple-700 dark:text-purple-400 border-purple-500/30 bg-purple-500/5' : 
 'text-cyan-700 dark:text-cyan-400 border-cyan-500/30 bg-cyan-500/5'}`}
 >
 {log.action}
 </span>
 </td>
 <td className="p-4 text-theme-text text-sm">{log.details}</td>
 </tr>
 ))}
 {currentLogs.length === 0 && (
 <tr>
 <td colSpan="6" className="p-8 text-center text-theme-muted italic">No audit records found matching your search criteria.</td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 
 {/* Pagination Footer */}
 <div className="p-4 border-t border-theme-border bg-theme-panel flex items-center justify-between text-xs font-medium text-theme-muted">
 <div>
 Showing <span className="text-theme-text">{(currentPage - 1) * itemsPerPage + (filteredLogs.length > 0 ? 1 : 0)}</span> to <span className="text-theme-text">{Math.min(currentPage * itemsPerPage, filteredLogs.length)}</span> of <span className="text-theme-text">{filteredLogs.length}</span> records
 </div>
 <div className="flex gap-2">
 <button 
 onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
 disabled={currentPage === 1}
 className={`p-1.5 rounded border transition-colors ${
 currentPage === 1 
 ? 'bg-slate-100 dark:bg-slate-80050 border-theme-border/50 text-theme-muted cursor-not-allowed' 
 : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-theme-text hover:text-theme-text hover:bg-slate-300 dark:hover:bg-slate-700'
 }`}
 >
 <ChevronLeft size={16} />
 </button>
 <button 
 onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
 disabled={currentPage === totalPages}
 className={`p-1.5 rounded border transition-colors ${
 currentPage === totalPages 
 ? 'bg-slate-100 dark:bg-slate-80050 border-theme-border/50 text-theme-muted cursor-not-allowed' 
 : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-theme-text hover:text-theme-text hover:bg-slate-300 dark:hover:bg-slate-700'
 }`}
 >
 <ChevronRight size={16} />
 </button>
 </div>
 </div>
 </div>
 </div>
 );
}
