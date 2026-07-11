import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Map, Cpu, MessageSquare, MonitorPlay, BarChart2, LayoutDashboard,
  Stethoscope, Zap, ShieldCheck, TestTubes, TrendingUp, Settings,
  AlertOctagon, FileSpreadsheet, Users, LogOut, Layers, ClipboardList, BookOpen, Wrench, Droplets, Database,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

const Sidebar = () => {
  const { selectedFacility, userRole, allowedPlants, logout, pendingManualEntries, alarms, isSidebarCollapsed, toggleSidebar } = useAppStore();
  const navigate = useNavigate();

  const activeAlarmCount = alarms?.filter(a => a.lifecycleStatus === 'Active').length || 0;
  const pendingBatchCount = pendingManualEntries?.length || 0;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }) =>
    `flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 mb-0.5 rounded-lg text-sm font-medium transition-all w-full relative overflow-hidden group ${
      isActive
        ? 'bg-theme-accent/10 text-theme-accent shadow-[inset_2px_0_0_0_var(--accent)]'
        : 'text-theme-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-theme-text'
    }`;

  const SectionLabel = ({ children }) => (
    !isSidebarCollapsed ? (
      <div className="text-[9px] font-black text-theme-muted tracking-[0.2em] uppercase mb-2 mt-5 px-3 first:mt-0 whitespace-nowrap">
        {children}
      </div>
    ) : (
      <div className="h-4 mt-5 first:mt-0 border-b border-theme-border w-8 mx-auto" />
    )
  );

  return (
    <nav className={`select-none ${isSidebarCollapsed ? 'w-[70px] min-w-[70px]' : 'w-[220px] min-w-[220px]'} flex-shrink-0 flex flex-col h-full bg-theme-panel backdrop-blur-2xl border-r border-theme-border overflow-y-auto custom-scrollbar transition-all duration-300`}>

      {/* Logo */}
      <div className={`px-4 py-6 border-b border-theme-border shrink-0 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="w-10 h-10 flex items-center justify-center shrink-0">
          <img 
            src="/logo.png" 
            alt="Permasense Logo" 
            className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(6,182,212,0.3)] hover:drop-shadow-[0_0_15px_rgba(6,182,212,0.8)] hover:scale-110 transition-all duration-300 cursor-pointer"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div className="hidden w-8 h-8 rounded-lg bg-gradient-to-br from-theme-accent to-blue-600 items-center justify-center shrink-0 shadow-md">
            <span className="text-theme-text text-xs font-black">PS</span>
          </div>
        </div>
        {!isSidebarCollapsed && (
          <div className="whitespace-nowrap overflow-hidden">
            <div className="text-theme-text font-black text-[15px] leading-none tracking-widest uppercase">Permasense</div>
            <div className="text-theme-accent text-[9px] font-black tracking-[0.3em] uppercase mt-1">Digital Twin</div>
          </div>
        )}
      </div>

      {/* Nav Body */}
      <div className="flex-1 flex flex-col px-3 py-4">

        {/* FLEET VIEW */}
        {userRole === 'admin' && (
          <>
            <SectionLabel>Fleet View</SectionLabel>
            <NavLink to="/command-center" className={navLinkClass} title="Command Center">
              <Map size={16} className="shrink-0" />
              {!isSidebarCollapsed && <span>Command Center</span>}
            </NavLink>
            <NavLink to="/alarm-ledger" className={navLinkClass} title="Alarm Ledger">
              <div className="relative shrink-0">
                <AlertOctagon size={16} />
                {activeAlarmCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full">
                    <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" />
                  </span>
                )}
              </div>
              {!isSidebarCollapsed && (
                <span className="flex-1 flex items-center justify-between whitespace-nowrap">
                  Alarm Ledger
                  {activeAlarmCount > 0 && (
                    <span className="text-[9px] bg-red-500 text-theme-text font-bold px-1.5 py-0.5 rounded-full">{activeAlarmCount}</span>
                  )}
                </span>
              )}
            </NavLink>
          </>
        )}

        {/* MONITORING */}
        <SectionLabel>Monitoring</SectionLabel>
        <NavLink to={`/dashboard/${selectedFacility || 'jetl_hyderabad'}`} className={navLinkClass} title="Live Dashboard">
          <LayoutDashboard size={16} className="shrink-0" />
          {!isSidebarCollapsed && <span>Live Dashboard</span>}
        </NavLink>
        <NavLink to="/membrane-health" className={navLinkClass} title="Membrane Health">
          <Droplets size={16} className="shrink-0" />
          {!isSidebarCollapsed && <span>Membrane Health</span>}
        </NavLink>
        <NavLink to="/energy-efficiency" className={navLinkClass} title="Energy & Efficiency">
          <Zap size={16} className="shrink-0" />
          {!isSidebarCollapsed && <span>Energy</span>}
        </NavLink>
        <NavLink to="/process-scada" className={navLinkClass} title="Process SCADA">
          <MonitorPlay size={16} className="shrink-0" />
          {!isSidebarCollapsed && <span>Process SCADA</span>}
        </NavLink>

        {/* ANALYTICS */}
        <SectionLabel>Analytics</SectionLabel>
        <NavLink to="/advanced-analytics" className={navLinkClass} title="Advanced Analytics">
          <BarChart2 size={16} className="shrink-0" />
          {!isSidebarCollapsed && <span>Analytics</span>}
        </NavLink>
        <NavLink to="/historical-trends" className={navLinkClass} title="Historical Trends">
          <TrendingUp size={16} className="shrink-0" />
          {!isSidebarCollapsed && <span>Historical</span>}
        </NavLink>
        <NavLink to="/batch-analytics" className={navLinkClass} title="Batch Analytics">
          <div className="relative shrink-0">
            <FileSpreadsheet size={16} />
            {pendingBatchCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full">
                <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-75" />
              </span>
            )}
          </div>
          {!isSidebarCollapsed && (
            <span className="flex-1 flex items-center justify-between whitespace-nowrap">
              Batch Upload
              {pendingBatchCount > 0 && (
                <span className="text-[9px] bg-blue-500 text-theme-text font-bold px-1.5 py-0.5 rounded-full">{pendingBatchCount}</span>
              )}
            </span>
          )}
        </NavLink>
        <NavLink to="/financial-analytics" className={navLinkClass} title="Financial Analytics">
          <TrendingUp size={16} className="shrink-0" />
          {!isSidebarCollapsed && <span>Financial</span>}
        </NavLink>
        <NavLink to="/historical-logsheet" className={navLinkClass} title="Historical Logsheets">
          <BookOpen size={16} className="shrink-0" />
          {!isSidebarCollapsed && <span>Logsheets</span>}
        </NavLink>

        {/* AI & MODELS */}
        {userRole === 'admin' && (
          <>
            <SectionLabel>AI & Models</SectionLabel>
            <NavLink to="/model-tuning" className={navLinkClass} title="Model Training">
              <Layers size={16} className="shrink-0" />
              {!isSidebarCollapsed && <span>Model Training</span>}
            </NavLink>
          </>
        )}

        {/* OPERATIONS */}
        <SectionLabel>Operations</SectionLabel>
        {userRole === 'admin' && (
          <NavLink to="/engineering-sandbox" className={navLinkClass} title="Simulation">
            <Cpu size={16} className="shrink-0" />
            {!isSidebarCollapsed && <span>Simulation</span>}
          </NavLink>
        )}
        <NavLink to="/cip-optimization" className={navLinkClass} title="CIP Optimization">
          <TestTubes size={16} className="shrink-0" />
          {!isSidebarCollapsed && <span>CIP Optimizer</span>}
        </NavLink>
        <NavLink to="/asset-register" className={navLinkClass} title="Compliance">
          <ShieldCheck size={16} className="shrink-0" />
          {!isSidebarCollapsed && <span>Compliance</span>}
        </NavLink>
        {/* {userRole === 'admin' && (
          <NavLink to="/admin/logsheets" className={navLinkClass} title="Logsheet Parser">
            <Database size={16} className="shrink-0" />
            {!isSidebarCollapsed && <span>Logsheet Parser</span>}
          </NavLink>
        )} */}
        {userRole === 'admin' && (
          <NavLink to="/audit-log" className={navLinkClass} title="Audit Trail">
            <ClipboardList size={16} className="shrink-0" />
            {!isSidebarCollapsed && <span>Audit Trail</span>}
          </NavLink>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* FOOTER */}
        <div className="border-t border-theme-border pt-3 mt-3 flex flex-col gap-0.5">
          <NavLink to="/ai-assistant" className={navLinkClass} title="AI Assistant">
            <MessageSquare size={16} className="shrink-0" />
            {!isSidebarCollapsed && <span>AI Assistant</span>}
          </NavLink>
          {userRole === 'admin' && (
            <>
              <NavLink to="/client-management" className={navLinkClass} title="Client Management">
                <Users size={16} className="shrink-0" />
                {!isSidebarCollapsed && <span>Clients</span>}
              </NavLink>
              <NavLink to="/settings" className={navLinkClass} title="Settings">
                <Settings size={16} className="shrink-0" />
                {!isSidebarCollapsed && <span>Settings</span>}
              </NavLink>
            </>
          )}
          <button
            onClick={handleLogout}
            className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2 rounded-lg text-sm font-medium text-theme-muted hover:text-red-700 dark:text-red-400 hover:bg-red-500/10 transition-all w-full mt-1`}
            title="Logout"
          >
            <LogOut size={16} className="shrink-0" />
            {!isSidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;
