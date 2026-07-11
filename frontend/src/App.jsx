import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import LiveDashboard from './pages/LiveDashboard';
import MembraneHealth from './pages/MembraneHealth';
import EnergyEfficiency from './pages/EnergyEfficiency';
import SubSystemAnalyzer from './pages/SubSystemAnalyzer';
import EngineeringSandbox from './pages/EngineeringSandbox';
import AdvancedAnalytics from './pages/AdvancedAnalytics';
import HistoricalTrends from './pages/HistoricalTrends';
import BatchAnalytics from './pages/BatchAnalytics';
import AssetRegister from './pages/AssetRegister';
import ModelTuning from './pages/ModelTuning';
import AIAssistant from './pages/AIAssistant';
import CipOptimization from './pages/CipOptimization';
import FinancialAnalytics from './pages/FinancialAnalytics';
import SettingsConfig from './pages/SettingsConfig';
import FleetCommandCenter from './pages/FleetCommandCenter';
import AlarmLedger from './pages/AlarmLedger';
import AuditLog from './pages/AuditLog';
import HistoricalLogsheet from './pages/HistoricalLogsheet';
import LogsheetAdmin from './pages/LogsheetAdmin';
import GlobalAlarmBanner from './components/GlobalAlarmBanner';
import SyncIndicator from './components/SyncIndicator';
import EmergencyStopBar from './components/EmergencyStopBar';
import EmergencyHaltOverlay from './components/EmergencyHaltOverlay';
import CommandPanelSidebar from './components/CommandPanelSidebar';
import GlobalAlertToaster from './components/GlobalAlertToaster';
import LoginPage from './pages/LoginPage';
import ClientDashboard from './pages/ClientDashboard';
import ClientManagement from './pages/ClientManagement';
import FloatingAIOrb from './components/FloatingAIOrb';
import ConnectionMonitor from './components/ConnectionMonitor';
import PageTransitionWrapper from './components/PageTransitionWrapper';
import { useAppStore } from './store/useAppStore';

function RequireAuth({ children }) {
  const { isAuthenticated } = useAppStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  const { userRole, isAuthenticated, authenticate, allowedPlants } = useAppStore();

  useEffect(() => {
    const handleGlobalError = (event) => {
      alert("GLOBAL CRASH DETECTED:\n\n" + (event.error ? event.error.stack : event.message));
    };
    const handlePromiseError = (event) => {
      alert("PROMISE CRASH DETECTED:\n\n" + (event.reason ? event.reason.stack : event.reason));
    };
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handlePromiseError);
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handlePromiseError);
    };
  }, []);

  // Session persistence is disabled for this demo so the Login Page always shows first
  useEffect(() => {
    // Intentionally empty: we do not want to auto-login on refresh
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ConnectionMonitor />
        <GlobalAlertToaster />
        <Routes>
          <Route path="/login" element={
            isAuthenticated ? <Navigate to="/command-center" replace /> : <LoginPage />
          } />

          <Route path="/*" element={
            <RequireAuth>
              {userRole === 'client' ? (
                <Routes>
                  <Route path="/*" element={<ClientDashboard />} />
                </Routes>
              ) : (
                <div className="flex flex-col h-screen overflow-hidden bg-theme-main transition-colors duration-300">
                  <EmergencyStopBar />
                  <EmergencyHaltOverlay />
                  <CommandPanelSidebar />
                  <div className="flex flex-1 overflow-hidden relative">
                    <Sidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <TopHeader />
                      <main className="flex-1 overflow-y-auto px-5 py-4 pb-14 relative flex flex-col min-h-0">
                        <PageTransitionWrapper>
                          <Routes>
                            <Route path="/" element={<Navigate to={allowedPlants?.length === 1 ? `/dashboard/${allowedPlants[0]}` : "/command-center"} replace />} />
                            <Route path="/command-center" element={allowedPlants?.length === 1 ? <Navigate to={`/dashboard/${allowedPlants[0]}`} replace /> : <FleetCommandCenter />} />
                            <Route path="/engineering-sandbox" element={<EngineeringSandbox />} />
                            <Route path="/client-management" element={<ClientManagement />} />
                            <Route path="/settings" element={<SettingsConfig />} />
                            <Route path="/dashboard/:plantId" element={<LiveDashboard />} />
                            <Route path="/membrane-health" element={<MembraneHealth />} />
                            <Route path="/energy-efficiency" element={<EnergyEfficiency />} />
                            <Route path="/alarm-ledger" element={<AlarmLedger />} />
                            <Route path="/process-scada" element={<SubSystemAnalyzer />} />
                            <Route path="/advanced-analytics" element={<AdvancedAnalytics />} />
                            <Route path="/historical-trends" element={<HistoricalTrends />} />
                            <Route path="/batch-analytics" element={<BatchAnalytics />} />
                            <Route path="/asset-register" element={<AssetRegister />} />
                            <Route path="/cip-optimization" element={<CipOptimization />} />
                            <Route path="/financial-analytics" element={<FinancialAnalytics />} />
                            <Route path="/model-tuning" element={<ModelTuning />} />
                            <Route path="/audit-log" element={<AuditLog />} />
                            <Route path="/ai-assistant" element={<AIAssistant />} />
                            <Route path="/historical-logsheet" element={<HistoricalLogsheet />} />
                            <Route path="/admin/logsheets" element={<LogsheetAdmin />} />
                          </Routes>
                        </PageTransitionWrapper>
                        <SyncIndicator />
                      </main>
                    </div>
                  </div>
                  <FloatingAIOrb />
                </div>
              )}
            </RequireAuth>
          } />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
