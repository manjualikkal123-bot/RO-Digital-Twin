import React, { useState, useRef, useEffect } from 'react';
import { Bell, ChevronDown, User, LogOut, Settings, CheckCircle2, Moon, Sun, Menu } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

// Page title map
const PAGE_TITLES = {
 '/command-center': 'Fleet Command Center',
 '/alarm-ledger': 'Alarm & Event Ledger',
 '/membrane-health': 'Membrane Health',
 '/energy-efficiency': 'Energy & Efficiency',
 '/process-scada': 'Process SCADA',
 '/advanced-analytics':'Advanced Analytics',
 '/historical-trends': 'Historical Trends',
 '/batch-analytics': 'Batch Analytics',
 '/financial-analytics':'Financial Analytics',
 '/historical-logsheet':'Historical Logsheets',
 '/cip-optimization': 'CIP Optimization',
 '/asset-register': 'Compliance & Reporting',
 '/model-tuning': 'Model Training Data',
 '/audit-log': 'Global Audit Trail',
 '/ai-assistant': 'AI Assistant',
 '/engineering-sandbox':'Simulation Sandbox',
 '/client-management': 'Client Management',
 '/settings': 'Settings & Configuration',
};

export default function TopHeader() {
 const {
 selectedFacility, setFacility,
 targetStage, setTargetStage,
 timeHorizon, setTimeHorizon,
 alarms, userRole, allowedPlants,
 fleetData, logout, syncStatus, toggleSidebar
 } = useAppStore();

 const navigate = useNavigate();
 const location = useLocation();
 const [userMenuOpen, setUserMenuOpen] = useState(false);
 const [bellOpen, setBellOpen] = useState(false);
 const userRef = useRef(null);
 const bellRef = useRef(null);

 const activeAlarms = alarms?.filter(a => a.lifecycleStatus === 'Active') || [];
 const isSynced = syncStatus?.status === 'Ok';

 // Determine page title
 const pathBase = '/' + (location.pathname.split('/')[1] || 'command-center');
 const isDashboard = location.pathname.startsWith('/dashboard/');
 const pageTitle = isDashboard ? 'Live Dashboard' : (PAGE_TITLES[pathBase] || 'Dashboard');

 // Close dropdowns on outside click
 useEffect(() => {
 const handler = (e) => {
 if (userRef.current && !userRef.current.contains(e.target)) setUserMenuOpen(false);
 if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
 };
 document.addEventListener('mousedown', handler);
 return () => document.removeEventListener('mousedown', handler);
 }, []);

 const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

 useEffect(() => {
 if (theme === 'dark') {
 document.documentElement.classList.add('dark');
 } else {
 document.documentElement.classList.remove('dark');
 }
 localStorage.setItem('theme', theme);
 }, [theme]);

 const handleLogout = () => {
 logout();
 navigate('/login');
 };

 return (
 <header className="h-14 shrink-0 flex items-center justify-between px-5 bg-theme-panel backdrop-blur-md border-b border-theme-border z-30 transition-colors duration-300">

 {/* LEFT — Page Title */}
 <div className="flex items-center gap-3 min-w-0">
 <button onClick={toggleSidebar} className="text-theme-muted hover:text-theme-text p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
 <Menu size={20} />
 </button>
 <span className="text-theme-text font-bold text-base truncate drop-shadow-sm">{pageTitle}</span>
 {/* Sync pill */}
 <span className={`hidden sm:flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
 isSynced
 ? 'text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
 : 'text-amber-700 dark:text-amber-400 border-amber-500/30 bg-amber-500/10'
 }`}>
 <span className={`w-1.5 h-1.5 rounded-full ${isSynced ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
 {isSynced ? `Live · ${syncStatus?.lastSynced || '--'}` : (syncStatus?.status || 'Connecting...')}
 </span>
 </div>



 {/* RIGHT — Controls */}
 <div className="flex items-center gap-2">

 {/* Facility Selector */}
 {(allowedPlants?.length > 1 || userRole === 'admin') && (
 <div className="relative">
 <select
 value={selectedFacility || ''}
 onChange={(e) => setFacility(e.target.value)}
 className="appearance-none bg-slate-200 dark:bg-slate-800 text-theme-text border border-theme-border rounded-lg pl-3 pr-7 py-1.5 text-xs font-semibold focus:border-theme-accent focus:outline-none cursor-pointer hover:border-theme-muted transition-colors"
 >
 {userRole === 'admin' && <option value="all">All Plants</option>}
 {fleetData?.filter(p => allowedPlants.includes(p.id)).map(plant => (
 <option key={plant.id} value={plant.id}>{plant.name}</option>
 ))}
 </select>
 <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
 </div>
 )}

 {/* Stage Selector */}
 {selectedFacility === 'jetl_hyderabad' && (
 <div className="relative">
 <select
 value={targetStage || 'RO1'}
 onChange={(e) => setTargetStage(e.target.value)}
 className="appearance-none bg-slate-200 dark:bg-slate-800 text-theme-text border border-theme-border rounded-lg pl-3 pr-7 py-1.5 text-xs font-semibold focus:border-theme-accent focus:outline-none cursor-pointer hover:border-theme-muted transition-colors"
 >
 <option value="UF">UF</option>
 <option value="RO1">RO-1</option>
 <option value="RO2">RO-2</option>
 <option value="RO-P">RO-P</option>
 </select>
 <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
 </div>
 )}

 {/* Time Horizon */}
 <div className="relative">
 <select
 value={timeHorizon}
 onChange={(e) => {
 const val = e.target.value;
 const tId = toast.loading(`Updating to ${val}...`, {
 style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b' }
 });
 setTimeHorizon(val);
 setTimeout(() => toast.success(`Showing last ${val}`, {
 id: tId,
 style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b' }
 }), 600);
 }}
 className="appearance-none bg-slate-200 dark:bg-slate-800 text-theme-text border border-theme-border rounded-lg pl-3 pr-7 py-1.5 text-xs font-semibold focus:border-theme-accent focus:outline-none cursor-pointer hover:border-theme-muted transition-colors"
 >
 <option value="1 Hour">1 Hour</option>
 <option value="24 Hours">24 Hours</option>
 <option value="7 Days">7 Days</option>
 </select>
 <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
 </div>

 {/* Divider */}
 <div className="w-px h-5 bg-theme-border mx-1" />

 {/* Theme Toggle */}
 <button
 onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
 className="relative w-8 h-8 rounded-lg flex items-center justify-center text-theme-muted hover:text-theme-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
 title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
 >
 {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
 </button>

 {/* Bell */}
 <div className="relative" ref={bellRef}>
 <button
 onClick={() => setBellOpen(p => !p)}
 className="relative w-8 h-8 rounded-lg flex items-center justify-center text-theme-muted hover:text-theme-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
 >
 <Bell size={16} />
 {activeAlarms.length > 0 && (
 <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full">
 <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" />
 </span>
 )}
 </button>

 {bellOpen && (
 <div className="absolute right-0 top-10 w-80 bg-theme-panel border border-theme-border rounded-xl shadow-2xl z-50 overflow-hidden premium-card">
 <div className="px-4 py-3 border-b border-theme-border flex items-center justify-between">
 <span className="text-theme-text font-bold text-sm">Active Alarms</span>
 {activeAlarms.length > 0 && (
 <span className="text-[10px] bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30 font-bold px-2 py-0.5 rounded-full">
 {activeAlarms.length} Active
 </span>
 )}
 </div>
 <div className="max-h-72 overflow-y-auto">
 {activeAlarms.length === 0 ? (
 <div className="flex flex-col items-center gap-2 py-8 text-theme-muted">
 <CheckCircle2 size={24} className="text-emerald-700 dark:text-emerald-500" />
 <span className="text-sm">All clear — no active alarms</span>
 </div>
 ) : (
 activeAlarms.slice(0, 8).map(alarm => (
 <div key={alarm.id} className="px-4 py-3 border-b border-theme-border/50 hover:bg-slate-100 dark:bg-slate-80030 transition-colors">
 <div className="flex items-start justify-between gap-2">
 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
 alarm.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30' :
 alarm.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30'
 }`}>{alarm.severity}</span>
 <span className="text-[10px] text-theme-muted">
 {alarm.equipmentTag}
 </span>
 </div>
 <p className="text-xs text-theme-text mt-1 leading-relaxed">{alarm.description}</p>
 </div>
 ))
 )}
 </div>
 {activeAlarms.length > 0 && (
 <button
 onClick={() => { navigate('/alarm-ledger'); setBellOpen(false); }}
 className="w-full py-2.5 text-xs text-cyan-700 dark:text-cyan-400 hover:text-cyan-300 font-semibold border-t border-theme-border hover:bg-slate-100 dark:bg-slate-80030 transition-colors"
 >
 View All in Alarm Ledger →
 </button>
 )}
 </div>
 )}
 </div>

 {/* User Avatar */}
 <div className="relative" ref={userRef}>
 <button
 onClick={() => setUserMenuOpen(p => !p)}
 className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-theme-text text-xs font-black hover:opacity-90 transition-opacity"
 >
 {userRole === 'admin' ? 'P' : 'CL'}
 </button>

 {userMenuOpen && (
 <div className="absolute right-0 top-10 w-48 bg-theme-panel border border-theme-border rounded-xl shadow-2xl z-50 overflow-hidden premium-card">
 <div className="px-4 py-3 border-b border-theme-border">
 <p className="text-theme-text text-xs font-bold capitalize">{userRole || 'User'}</p>
 <p className="text-theme-muted text-[10px]">Permasense DT</p>
 </div>
 {userRole === 'admin' && (
 <button
 onClick={() => { navigate('/settings'); setUserMenuOpen(false); }}
 className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-theme-muted hover:text-theme-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
 >
 <Settings size={14} /> Settings
 </button>
 )}
 <button
 onClick={handleLogout}
 className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-red-700 dark:text-red-500 hover:text-red-700 dark:text-red-400 hover:bg-red-500/10 transition-colors border-t border-theme-border"
 >
 <LogOut size={14} /> Logout
 </button>
 </div>
 )}
 </div>
 </div>
 </header>
 );
}
