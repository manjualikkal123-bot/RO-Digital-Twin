import { create } from 'zustand';
import { globalSyncManager } from '../services/GlobalSyncManager';
import plantConfig from '../config/plant_config.json';
// NOTE: removed unused imports `config` ('../../../config.json') and
// `generateHistoricalAlarms` (mockAlarms) — neither is referenced anywhere
// in this file. Dead imports removed as part of cleanup.

export const useAppStore = create((set, get) => ({
  // Authentication & Global Context State
  isAuthenticated: false,
  userRole: null, // 'admin' or 'client'
  allowedPlants: [],
  pcbLimits: null,
  selectedFacility: null,
  targetStage: 'RO1',
  timeHorizon: '1 Hour',
  isPlaybackMode: false,
  aiMessages: [], // Shared AI chat history between page + orb
  isSidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  // Operator Command & Emergency Response State
  isEmergencyHalted: false,
  commandLog: [],
  auditLog: [
    { id: 'AUD-001', timestamp: new Date().toISOString(), action: 'System Boot', user: 'SYSTEM', details: 'Platform initialized and connected to PLC', severity: 'INFO' }
  ],
  logAuditEvent: (action, details, user = null, severity = 'INFO') => set((state) => ({
    auditLog: [{
      id: `AUD-${Math.floor(Math.random() * 10000)}`,
      timestamp: new Date().toISOString(),
      action,
      user: user || (state.userRole === 'admin' ? 'SYS_ADMIN' : 'OP_LEAD'),
      details,
      severity
    }, ...state.auditLog]
  })),
  sensorFaults: {},
  activeCommandPanel: null,

  // Settings & Configuration States
  alarmLimits: {
    feedPressureMax: 35.0, // Updated from 70.0 based on real RO-401 SPHH limit
    feedPressureWarningMargin: 5.0, // SPH is 30.0, SPHH is 35.0
    deltaPMax: 3.0, // Updated from 1.50 based on real SCADA SPHH limit
    deltaPWarningMargin: 2.5, // Early warning before trip
    minRejection: 98.5,
    ecMax: 4000.0,
    ecWarningMargin: 500.0,
    tdsMax: 2500.0,
    tdsWarningMargin: 300.0,
    codMax: 50.0,
    codWarningMargin: 10.0,
    phMin: 6.5,
    phMax: 8.5,
    phWarningMargin: 0.5,
    cr6Max: 0.1,
    cr6WarningMargin: 0.02
  },

  assetGeometry: {
    stage1Vessels: 12,
    stage2Vessels: 6,
    elementsPerVessel: 6,
    elementAreaM2: 40 // Standard 8040 element
  },
  setAlarmLimits: (newLimits) => set({ alarmLimits: { ...get().alarmLimits, ...newLimits } }),

  configLastModified: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
  configChangeLog: [],
  updateConfigLogs: (newLogs) => set((state) => ({
    configChangeLog: [...newLogs, ...state.configChangeLog],
    configLastModified: newLogs[0]?.date || state.configLastModified
  })),

  // Derived KPIs (Global) — null until the first real telemetry tick lands.
  // The UI must render a loading/"awaiting sync" state for null KPIs, never
  // a fake plausible number. (Previously these were hardcoded to 2.45/99.2/
  // 1.8/850/98 — fabricated values shown before any real data ever arrived.)
  derivedKPIs: {
    activeSEC: null,
    saltRejection: null,
    carbonFootprint: null,
    rulDays: null,
    healthScore: null,
    breachTimer: 0,
    anomalyFlags: []
  },
  telemetryHistory: [],
  activeModelVersion: 'v3.0-live',
  pendingManualEntries: [],

  // Historical Simulated Data
  fullHistoricalDataset: [],
  selectedHistoryDay: 'Live', // 'Live' or a specific date string like '2026-06-01'
  setFullHistoricalDataset: (dataset) => set({ fullHistoricalDataset: dataset }),
  setSelectedHistoryDay: (day) => {
    set({ selectedHistoryDay: day, playbackIndex: 0 });
    // Re-tick immediately so the KPI cards/chart show the new day's first
    // row instead of stale data from whatever day was previously selected.
    if (get().isPlaybackMode) get().tickPlayback(0);
  },

  historicalFinances: [],
  historicalMembrane: [],
  historicalEnergy: [],
  membraneAgeDays: null,
  setMembraneAgeDays: (days) => {
    set({ membraneAgeDays: days });
    const facility = get().selectedFacility;
    if (facility) get().fetchHistoricalData(facility);
  },
  cipLedger: [], // Real CIP wash history. Empty until actual washes are logged via logCipWash().
  logCipWash: (entry) => set((state) => ({
    cipLedger: [
      {
        id: `CIP-${Date.now().toString().slice(-6)}`,
        date: entry.date || new Date().toISOString().split('T')[0],
        stage: entry.stage,          // e.g. 'RO1' — required, no default guess
        type: entry.type,            // e.g. 'High pH (Alkali)' — operator-entered, required
        status: entry.status || 'Completed',
        preWashTMP: entry.preWashTMP ?? null,   // bar, operator-logged if available
        postWashTMP: entry.postWashTMP ?? null, // bar, operator-logged if available
        notes: entry.notes || '',
      },
      ...state.cipLedger,
    ],
  })),

  // CIP Sequence Simulation
  cipActive: false,
  cipStage: 'Idle',
  cipTimeElapsed: 0,
  cipCurrentPh: 7.0,
  startCipSimulation: () => {
    if (get().cipActive) return; // Prevent double trigger
    
    set({ cipActive: true, cipStage: 'Chemical Wash', cipTimeElapsed: 0, cipCurrentPh: 7.0 });
    
    // JETL Protocol: 1 real second = 1 simulation minute.
    // Chemical Wash: 50s | Air Scouring: 2s | Flush: 5s
    let simTime = 0;
    const interval = setInterval(() => {
      simTime++;
      
      let stage = 'Chemical Wash';
      let targetPh = 12.0; // Assuming Alkaline for this simulation
      
      if (simTime >= 57) { // End of sequence
        clearInterval(interval);
        set({ cipActive: false, cipStage: 'Idle', cipTimeElapsed: 0, cipCurrentPh: 7.0 });
        
        // Auto-log the wash completion
        get().logCipWash({
          stage: 'UF-101',
          type: 'JETL Routine CIP (Alk)',
          notes: 'Automated digital twin simulation sequence completed successfully.',
          status: 'Completed'
        });
        return;
      } else if (simTime > 52) { // Flush (last 5s)
        stage = 'Flush';
        targetPh = 7.0;
      } else if (simTime > 50) { // Air Scouring (2s)
        stage = 'Air Scouring';
        targetPh = 12.0; // Chemical still present until flushed
      }
      
      // Calculate smooth pH transition (exponential approach)
      const currentPh = get().cipCurrentPh;
      const phDiff = targetPh - currentPh;
      const nextPh = currentPh + (phDiff * 0.15);
      
      set({ 
        cipStage: stage,
        cipTimeElapsed: simTime,
        cipCurrentPh: parseFloat(nextPh.toFixed(2))
      });
      
    }, 1000); // Tick every 1 second
  },

  // Authentication Actions
  authenticate: async (token, _isRetry = false) => {
    try {
      // --- MOCK AUTHENTICATION LOGIC ---
      if (token && token.startsWith('mock_')) {
        let mockData = null;
        if (token === 'mock_jetl_admin_token') {
          mockData = { role: 'admin', allowed_plants: ['jetl_hyderabad'] };
        } else if (token === 'mock_nia_admin_token') {
          mockData = { role: 'admin', allowed_plants: ['nia_nandesari'] };
        } else if (token === 'mock_super_admin_token') {
          mockData = { role: 'admin', allowed_plants: ['jetl_hyderabad', 'nia_nandesari'] };
        }

        if (mockData) {
          const firstPlant = mockData.allowed_plants.length > 0 ? mockData.allowed_plants[0] : null;
          const mockFleetData = mockData.allowed_plants.map(id => {
            const config = plantConfig[id] || {};
            return {
              id,
              name: config.display_name || id,
              fullName: config.full_name || id,
              location: config.location || '',
              lat: config.coordinates?.lat || 0,
              lon: config.coordinates?.lon || 0,
              plantType: config.plant_type || '',
              industry: config.industry || '',
              badge: config.badge || null,
              flow_m3h: (config.capacity_kld || 1000) / 24,
              recovery: 75,
              rf_trend: [0.75, 0.75], 
              statusData: { status: 'Optimal', rootCause: null }
            };
          });
          set({
            isAuthenticated: true,
            userRole: mockData.role,
            allowedPlants: mockData.allowed_plants,
            pcbLimits: null,
            selectedFacility: firstPlant,
            fleetData: mockFleetData
          });
          if (firstPlant) get().fetchHistoricalData(firstPlant);
          if (mockData.allowed_plants.length > 0) get().connectWebSocket(mockData.allowed_plants[0]);
          return;
        }
      }
      // --- END MOCK LOGIC ---

      const response = await fetch('/api/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();

        // Fetch fleet data
        const fleetRes = await fetch('/api/fleet', { headers: { 'Authorization': `Bearer ${token}` } });
        const fleetData = fleetRes.ok ? await fleetRes.json() : [];
        const firstPlant = data.allowed_plants.length > 0 ? data.allowed_plants[0] : null;
        set({
          isAuthenticated: true,
          userRole: data.role,
          allowedPlants: data.allowed_plants,
          pcbLimits: data.pcb_limits || null,
          selectedFacility: firstPlant,
          fleetData
        });

        if (firstPlant) {
          get().fetchHistoricalData(firstPlant);
        }

        // Connect to websocket for first allowed plant
        if (data.allowed_plants.length > 0) {
          get().connectWebSocket(data.allowed_plants[0]);
        }
      } else if (response.status >= 500 && !_isRetry) {
        // Backend restarting/unavailable, not a genuine invalid-token 401.
        // Give it one short retry before booting the user to the login screen.
        await new Promise((r) => setTimeout(r, 1500));
        return get().authenticate(token, true);
      } else {
        // A real 401/403 (or a retry that also failed) — session is genuinely invalid.
        get().logout();
      }
    } catch (e) {
      if (!_isRetry) {
        // Network-level failure (e.g. server mid-restart) — one retry before giving up.
        await new Promise((r) => setTimeout(r, 1500));
        return get().authenticate(token, true);
      }
      console.error('Failed to verify token', e);
      get().logout();
    }
  },

  logout: () => {
    localStorage.removeItem('dt_token');
    if (get().socket) get().socket.close();
    set({
      isAuthenticated: false,
      userRole: null,
      allowedPlants: [],
      pcbLimits: null,
      selectedFacility: null,
      telemetry: null,
      syncStatus: { status: 'Idle', lastSynced: null, error: null }
    });
  },

  // Telemetry & Sync State
  telemetry: null,
  syncStatus: { status: 'Idle', lastSynced: null, error: null },

  // Live Dynamic Alarms (Generated by Physics Loop)
  alarms: [],

  // Global Fleet Status Array (Simulated for Multi-Tenant View)
  fleetData: [],
  socket: null,
  setAiMessages: (msgs) => set({ aiMessages: msgs }),
  getFacilityConfig: () => {
    const facility = get().selectedFacility;
    return plantConfig[facility] || { type: "Unknown" };
  },
  fetchHistoricalData: async (facilityKey) => {
    // Backend API fetches for pre-simulated data are removed per physics-based update.
    // The arrays will build dynamically from the live loop.
  },

  mlMembraneForecast: null,
  mlEnergyForecast: null,
  mlFinanceForecast: null,

  fetchIntelligenceLayer: async (facility) => {
    try {
      const token = localStorage.getItem('dt_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const opts = { headers };
      const p1 = fetch(`/api/predict-membrane?plantId=${facility}`, opts).then(r => r.ok ? r.json() : null);
      const p2 = fetch(`/api/predict-energy?plantId=${facility}`, opts).then(r => r.ok ? r.json() : null);
      const p3 = fetch(`/api/predict-finances?plantId=${facility}`, opts).then(r => r.ok ? r.json() : null);
      
      const [mlMembraneForecast, mlEnergyForecast, mlFinanceForecast] = await Promise.all([p1, p2, p3]);
      console.log('[ML] risk_matrix received:', mlMembraneForecast?.risk_matrix);
      set({ mlMembraneForecast, mlEnergyForecast, mlFinanceForecast });
    } catch(err) {
      console.error("Intelligence Layer fetch error", err);
    }
  },

  // Actions
  playbackIndex: 0,
  setPlaybackIndex: (idx) => set({ playbackIndex: idx }),

  startPlaybackMode: (rows, columnMapping = {}, facilityId = null) => {
    globalSyncManager.stopSync(); // CRITICAL: Stop the live simulator loop before entering playback mode!
    const state = get();
    // The facility this batch actually belongs to. Falls back to whatever is
    // currently selected only if the caller didn't pass one explicitly — but
    // BatchAnalytics.jsx should always pass its selectedPlantLocation mapped
    // to the real facility id ('jetl_hyderabad' / 'nia_nandesari'), never rely
    // on this fallback silently guessing wrong.
    const resolvedFacilityId = facilityId || state.selectedFacility || 'jetl_hyderabad';

    // Each facility has its own stage-prefix vocabulary. Nandesari's raw rows
    // use HPA1..HPA5 (see parseNandesariMatrix in BatchAnalytics.jsx) — JETL/
    // WAAREE use UF/RO1/RO2/RO-P/FEED/AOP. Checking only the JETL list here
    // used to mean every field silently resolved to null for Nandesari rows,
    // since none of its real keys (HPA1_flux, HPA2_pressure...) ever matched.
    const STAGE_PREFIXES_BY_FACILITY = {
      nia_nandesari: ['HPA1', 'HPA2', 'HPA3', 'HPA4', 'HPA5', ''],
      jetl_hyderabad: ['UF', 'RO1', 'RO2', 'RO-P', ''],
      // Fallback for any other/unregistered facility: try the union of both
      // known vocabularies rather than silently matching nothing.
      _default: ['UF', 'RO1', 'RO2', 'RO-P', 'HPA1', 'HPA2', 'HPA3', 'HPA4', 'HPA5', 'FEED', 'AOP', ''],
    };
    const stagePrefixes = STAGE_PREFIXES_BY_FACILITY[resolvedFacilityId] || STAGE_PREFIXES_BY_FACILITY._default;

    // Helper to find column keys by their mapped label
    const getCol = (labelKeywords) => {
      const key = Object.keys(columnMapping).find(k =>
        labelKeywords.some(keyword => columnMapping[k]?.label?.toLowerCase().includes(keyword.toLowerCase()))
      );
      return key;
    };
    const safeVal = (v) => (v === null || v === undefined || v === '') ? null : Number(v);
    // Helper to safely extract stage-specific data
    const getVal = (row, paramNames) => {
      for (const param of paramNames) {
        const mappedCol = getCol([param]);
        if (mappedCol && row[mappedCol] !== undefined && !isNaN(row[mappedCol]) && row[mappedCol] !== '') return safeVal(row[mappedCol]);

        for (const stage of stagePrefixes) {
          const keyPrefix = stage ? `${stage}_` : '';
          const val = row[`${keyPrefix}${param}`];
          if (val !== undefined && val !== null && !isNaN(val) && val !== '') return safeVal(val);
        }
      }
      return null;
    };
    const m = {
      time: getCol(['time', 'date']) || 'Time'
    };

    // Safely parse dates to prevent 'Invalid time value' crashes
    const safeIsoDate = (val) => {
      if (!val) return new Date().toISOString();
      let d = new Date(val);
      if (isNaN(d.getTime())) {
        // Handle common DD-MM-YYYY or DD/MM/YYYY
        if (typeof val === 'string') {
          const parts = val.split(/[-/]/);
          if (parts.length === 3) {
            d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            if (!isNaN(d.getTime())) return d.toISOString();
          }
        }
        return new Date().toISOString();
      }
      return d.toISOString();
    };

    // Map all rows to standardize shape for playback scrubbing
    const mappedRows = rows.map((r) => {
      const fluxVal = getVal(r, ['flux', 'flow', 'Flux_LMH']);
      const pressVal = getVal(r, ['pressure', 'feed_pressure', 'Feed_Press_bar']);
      const tmpVal = getVal(r, ['tmp', 'differential_pressure', 'TMP_bar']);
      const condVal = getVal(r, ['conductivity', 'feed_conductivity', 'Cond_in_microS']);
      const phVal = getVal(r, ['ph', 'pH']);
      const tempVal = getVal(r, ['temperature', 'temp', 'Temp_C']);
      const energyVal = getVal(r, ['energy', 'power', 'Energy_kWh']);

      const parsedFlux = fluxVal !== null ? fluxVal : null;
      const parsedFlowRate = parsedFlux !== null ? parsedFlux * 40 * 18 / 1000 : null;
      const parsedEnergyKwh = energyVal !== null ? energyVal : null;

      return {
        ...r,
        facility: resolvedFacilityId,
        timestamp: safeIsoDate(r[m.time] || r.time || r.Time || r.date || r.Date),
        flow_rate: parsedFlowRate,
        feed_pressure: pressVal,
        tmp: tmpVal,
        differential_pressure: tmpVal,
        conductivity: condVal,
        permeate_conductivity: condVal !== null ? Math.max(0, condVal * 0.015) : null,
        ph: phVal,
        temperature: tempVal,
        normalized_flux: parsedFlux,
        energy_kwh: parsedEnergyKwh
      };
    });

    // Merge into the existing dataset rather than overwriting it — publishing
    // a Nandesari batch should not wipe out a previously published JETL batch
    // (or vice versa). Replace only this facility's prior rows.
    const otherFacilitiesRows = (state.fullHistoricalDataset || []).filter(r => r.facility !== resolvedFacilityId);
    const nextFullHistoricalDataset = [...otherFacilitiesRows, ...mappedRows];

    set({
      isPlaybackMode: true,
      fullHistoricalDataset: nextFullHistoricalDataset,
      // Switch the active facility view to whatever was just published — a
      // published Nandesari batch should be visible without the user having
      // to separately flip the facility dropdown to match.
      selectedFacility: resolvedFacilityId,
      playbackIndex: 0,
      // Default the day filter to this batch's first date so the scrubber
      // opens already showing real data, not an empty 'Live' filter.
      selectedHistoryDay: mappedRows[0]?.timestamp ? mappedRows[0].timestamp.slice(0, 10) : state.selectedHistoryDay
    });

    // Auto-tick to index 0 of the now-active (facility+day filtered) dataset.
    get().tickPlayback(0);
  },

  // Returns only the rows belonging to the currently selected facility, and
  // (if a specific day is chosen rather than 'Live') only that day. This is
  // what TimeScrubber/BatchAnalytics should read for the date dropdown and
  // for computing slider bounds — never read fullHistoricalDataset directly,
  // it may contain multiple facilities' rows merged together.
  getActivePlaybackDataset: () => {
    const state = get();
    const facility = state.selectedFacility || 'jetl_hyderabad';
    const facilityRows = (state.fullHistoricalDataset || []).filter(r => r.facility === facility);
    if (!state.selectedHistoryDay || state.selectedHistoryDay === 'Live') return facilityRows;
    return facilityRows.filter(r => r.timestamp && r.timestamp.slice(0, 10) === state.selectedHistoryDay);
  },
  // Unique available dates for the currently selected facility, for the date
  // dropdown. Computed from real row timestamps only — never fabricated.
  getAvailablePlaybackDates: () => {
    const state = get();
    const facility = state.selectedFacility || 'jetl_hyderabad';
    const facilityRows = (state.fullHistoricalDataset || []).filter(r => r.facility === facility);
    const dates = new Set(facilityRows.map(r => r.timestamp?.slice(0, 10)).filter(Boolean));
    return Array.from(dates).sort();
  },

  // idx here is an index into getActivePlaybackDataset() (the current
  // facility+day filtered view) — NOT a raw index into fullHistoricalDataset,
  // which may hold multiple facilities' rows merged together.
  tickPlayback: (idx) => {
    const state = get();
    const dataset = state.getActivePlaybackDataset();
    if (!dataset || !dataset[idx]) return;

    const newTelemetry = dataset[idx];
    
    // Build historicalMembrane snapshot for charts (just up to this index)
    const newHistoricalMembrane = dataset.slice(0, idx + 1).map(r => ({
      date: r.timestamp,
      permeability: r.normalized_flux !== null ? r.normalized_flux / 15 : null,
      dp: r.differential_pressure,
      saltPassage: r.conductivity && r.permeate_conductivity ? (r.permeate_conductivity / r.conductivity) * 100 : null,
      isProjection: false
    }));

    const deltaPWarningMargin = state.alarmLimits?.deltaPWarningMargin || 0.25;

    // --- Global Derived KPI Computation ---
    const activeSEC = newTelemetry.energy_kwh !== null && newTelemetry.flow_rate ? (newTelemetry.energy_kwh / newTelemetry.flow_rate) : null;
    const saltRejection = newTelemetry.conductivity && newTelemetry.permeate_conductivity
      ? ((newTelemetry.conductivity - newTelemetry.permeate_conductivity) / newTelemetry.conductivity) * 100
      : null;
    const carbonFootprint = activeSEC !== null ? activeSEC * 0.82 : null; // kg CO2 per m3
    const healthScore = state.mlMembraneForecast?.metrics?.healthScore ?? null;
    const rulDays = state.mlMembraneForecast?.metrics?.rulDays ?? null;

    const anomalyFlags = [];
    if (activeSEC !== null && activeSEC > 3.0) anomalyFlags.push('High Energy');
    if (saltRejection !== null && saltRejection < 98.0) anomalyFlags.push('Poor Rejection');
    if (newTelemetry.differential_pressure !== null && newTelemetry.differential_pressure > deltaPWarningMargin) {
      anomalyFlags.push('High TMP');
    }

    const derivedKPIs = {
      activeSEC,
      saltRejection,
      carbonFootprint,
      rulDays,
      healthScore,
      breachTimer: state.derivedKPIs?.breachTimer || 0,
      anomalyFlags
    };

    // --- Generate Alarms for Playback (with deduplication) ---
    let newAlarms = [...state.alarms];
    if (newTelemetry.differential_pressure !== null && newTelemetry.differential_pressure > deltaPWarningMargin) {
      // Check if alarm already exists
      const existingWarning = newAlarms.find(a => a.lifecycleStatus === 'Active' && a.equipmentTag === 'RO-TRN-A' && a.severity === 'WARNING');
      if (!existingWarning) {
        newAlarms.unshift({
          id: `ALM-${Date.now().toString().slice(-4)}`,
          date: new Date(newTelemetry.timestamp).toISOString(),
          facility: newTelemetry.facility,
          equipmentTag: 'RO-TRN-A',
          severity: 'WARNING',
          description: `Playback: High TMP > ${deltaPWarningMargin} bar`,
          lifecycleStatus: 'Active',
          acknowledgedBy: null,
          duration: 'Active',
          rootCause: 'Data threshold exceeded',
          recommendedAction: 'Inspect feed water quality'
        });
      }
    } else {
      // Clear warning if condition passed
      newAlarms = newAlarms.filter(a => !(a.equipmentTag === 'RO-TRN-A' && a.severity === 'WARNING'));
    }

    set({
      playbackIndex: idx,
      telemetry: newTelemetry,
      historicalMembrane: newHistoricalMembrane,
      telemetryHistory: dataset.slice(Math.max(0, idx - 288), idx + 1), // maintain rolling window for live charts
      derivedKPIs: derivedKPIs,
      alarms: newAlarms
    });
  },

  exitPlaybackMode: () => {
    set({ isPlaybackMode: false });
    // Refetch real historical data and reconnect websocket for live telemetry
    const facilityKey = get().selectedFacility;
    get().fetchHistoricalData(facilityKey);
    // Start live sync again!
    globalSyncManager.startSync();
  },
  setFacility: (facilityKey) => {
    // Each facility topology has its own primary stage: HPA trains for Nandesari, RO1 for JETL.
    // Always resetting to 'RO1' left the store with a stage that doesn't exist in Nandesari's
    // telemetry (which has HPA1..HPA5, not UF/RO1/RO2/RO-P) — causing any direct consumer
    // of targetStage to read a stale wrong key until the next tick overwrote it.
    const defaultStageForFacility = facilityKey === 'nia_nandesari' ? 'HPA1' : 'RO1';
    const wasInPlayback = get().isPlaybackMode;
    set({
      selectedFacility: facilityKey,
      telemetry: null,
      targetStage: defaultStageForFacility,
      telemetryHistory: [],
      historicalFinances: [],
      historicalMembrane: [],
      historicalEnergy: [],
      // Switching facility while scrubbing historical data must re-filter —
      // otherwise the scrubber keeps showing the previous facility's rows
      // (or nothing) under the new facility's name/dropdown.
      ...(wasInPlayback ? { playbackIndex: 0, selectedHistoryDay: 'Live' } : {})
    });
    if (wasInPlayback) {
      // 'Live' means "no day filter" in getActivePlaybackDataset — re-tick
      // against whatever rows exist for the new facility, if any.
      const idx0 = get().getActivePlaybackDataset()[0] ? 0 : -1;
      if (idx0 === 0) get().tickPlayback(0);
    } else {
      get().connectWebSocket(facilityKey); // Reconnect WS on facility change (live mode only)
    }
  },

  setTargetStage: (stage) => set({ targetStage: stage }),
  purgeModelMemory: async () => {
    // Simulating backend model purge API call
    return new Promise((resolve) => {
      setTimeout(() => {
        set({
          activeModelVersion: 'v0.0.0-baseline',
          telemetryHistory: [],
          historicalFinances: [],
          historicalMembrane: [],
          historicalEnergy: [],
          pendingManualEntries: []
        });
        resolve({
          status: "success",
          message: "Model weights deleted. Database synthetic tracks dropped.",
          active_version: "v0.0.0-baseline",
          parameters_learned: 0
        });
      }, 3000); // 3 second mock delay for UI sequence
    });
  },

  addManualEntry: (entry) => set(state => ({
    pendingManualEntries: [...state.pendingManualEntries, entry]
  })),
  commitManualEntry: (entryId) => set(state => ({
    pendingManualEntries: state.pendingManualEntries.filter(e => e.id !== entryId)
  })),

  setUserRole: (role) => {
    // Automated Facility Synchronization trap
    if (role === 'client') {
      set({ userRole: role, selectedFacility: get().clientFacility });
      get().connectWebSocket(get().clientFacility);
    } else {
      set({ userRole: role });
    }
  },
  setTelemetry: (data) => set((state) => {
    // State Collision Prevention: Drop live/mock data if we are in Playback Mode
    if (get().isPlaybackMode && data.facility !== "Historical_Playback") {
      return;
    }

    const totalArea = (state.assetGeometry.stage1Vessels + state.assetGeometry.stage2Vessels) *
      state.assetGeometry.elementsPerVessel *
      state.assetGeometry.elementAreaM2;

    // Extract the currently selected stage for the UI to display on gauges
    // For Nandesari (HPA topology) default to HPA1; for JETL default to RO1
    const isNandesari = data.facility === 'nia_nandesari';
    const defaultStage = isNandesari ? 'HPA1' : 'RO1';
    const targetStage = state.targetStage || defaultStage;
    // If the stored targetStage is a JETL stage but we switched to Nandesari, fall back gracefully
    const resolvedStage = (data.stages && data.stages[targetStage]) ? targetStage : defaultStage;

    // Pick the UI display data based on resolvedStage
    const stageData = (data.stages && data.stages[resolvedStage]) ? data.stages[resolvedStage] : data;

    // Merge the stage data into the root of telemetry so legacy UI components still read it easily,
    // but preserve the nested `stages` object for advanced components like the 3D plant view
    const mergedData = { ...state.telemetry, ...stageData, stages: data.stages || state.telemetry?.stages };
    // ─── SENSOR SANITY CLAMP (JETL Data Audit v2) ──────────────────────────
    // Confirmed hardware/process faults found by scanning jetl_train.json.
    // All out-of-range values are set to null so they never corrupt charts,
    // alarms, or KPI calculations. null renders as '--' (gap) in the UI.
    //
    // FAULT 1 — PT_* pressure tags: Physical range 0–60 bar (Permionics HPA spec).
    //   PT_704 (RO-2) was outputting 12,000–30,000 bar. Hardware transmitter fault.
    //   Real-world fix: recalibrate/replace PT_704 on RO-2 skid. ✅ Fixed by user.
    //
    // FAULT 2 — CDIC_701 (RO-2 feed conductivity): Same 12,000–30,000 pattern.
    //   92/133 rows bad. The fault is in shared signal wiring/marshalling cabinet
    //   on RO-2, not individual sensors. Physical max for wastewater feed: ~8,000 µS/cm.
    //
    // FAULT 3 — CDIC_702 (RO-2 permeate conductivity): 3 rows at 1,008–1,315 µS/cm.
    //   Max permeate conductivity for RO stage should be ≤1,000 µS/cm.
    //   Likely caused by membrane bypass events on those 3 timestamps.
    //
    // FAULT 4 — ORP_401 (RO-1 ORP sensor): Operational range –50 to +50 mV.
    //   47 rows show 51–524 mV spikes. Correlated with PH_401 drops (same rows).
    //   High ORP + low pH = CIP acid wash in progress. Readings are real but
    //   represent CIP mode, not normal production — null them to prevent false
    //   "chlorine spike" alarms during cleaning cycles.
    //
    // FAULT 5 — PH_401 (RO-1 pH sensor): Normal range 2–12.
    //   27 rows show pH 0.5–1.2, always co-occurring with ORP spikes (same rows).
    //   Confirmed CIP acid wash signature (HCl dosing targets pH 2).
    //   Null these so the pH gauge shows a gap during CIP, not a false alarm.
    //
    // NOTE — CDIC_1002 (RO-P permeate TDS): Spec < 500 ppm (confirmed by plant operator).
    //   The 40 rows showing 52–218 µS/cm are within acceptable operating bounds.
    //   No clamping needed. No alarm threshold breach.
    //
    // MOVED: This clamp used to run here, matching raw tag names like "PT_704"
    // and "CDIC_701". But GlobalSyncManager.mapJetlRowToTelemetry() renames
    // every tag to friendly field names (feed_pressure, conductivity, pH...)
    // BEFORE it ever reaches this function — so the clamp below silently
    // matched nothing and did nothing. The clamp now lives at the source,
    // in GlobalSyncManager.js (clampOrNull), where the raw tag names still
    // exist. Nothing to do here anymore — mergedData already arrives clean.
    // ────────────────────────────────────────────────────────────────────────


    const trueFlux = mergedData.flow_rate ? ((mergedData.flow_rate * 1000) / totalArea) : (mergedData.normalized_flux ?? 0);

    // --- Global Derived KPI Computation ---
    // KPIs are anchored to the primary stage: RO1 for JETL, HPA1 for Nandesari.
    const kpiAnchor = isNandesari ? 'HPA1' : 'RO1';
    const kpiSource = (data.stages && data.stages[kpiAnchor]) ? data.stages[kpiAnchor] : mergedData;

    const hasEnergyData = typeof kpiSource.energy_kwh === 'number' && kpiSource.flow_rate > 0;
    let activeSEC = null;
    if (hasEnergyData) {
      activeSEC = kpiSource.energy_kwh / kpiSource.flow_rate;
    } else if (typeof kpiSource.feed_pressure === 'number' && kpiSource.feed_pressure > 0) {
      // Thermodynamic estimate: Power = Q * dP / (36 * efficiency)
      // SEC = dP / (36 * 0.80)
      activeSEC = kpiSource.feed_pressure / 28.8;
    }
    let saltRejection = null;
    if (typeof kpiSource.salt_rejection === 'number') {
      saltRejection = kpiSource.salt_rejection;
    } else if (
      typeof kpiSource.conductivity === 'number' && kpiSource.conductivity > 0 &&
      typeof kpiSource.permeate_conductivity === 'number'
    ) {
      saltRejection = ((kpiSource.conductivity - kpiSource.permeate_conductivity) / kpiSource.conductivity) * 100;
    }

    const carbonFootprint = activeSEC !== null ? activeSEC * 0.82 : null; // kg CO2 per m3

    // Pull from Intelligence Layer instead of guessing
    const healthScore = state.mlMembraneForecast?.metrics?.healthScore ?? null;
    const rulDays = state.mlMembraneForecast?.metrics?.rulDays ?? null;

    let anomalyFlags = [];
    if (activeSEC !== null && activeSEC > 3.0) anomalyFlags.push('High Energy');
    if (saltRejection !== null && saltRejection < 98.0) anomalyFlags.push('Poor Rejection');
    if (typeof kpiSource.differential_pressure === 'number' && kpiSource.differential_pressure > state.alarmLimits.deltaPWarningMargin) {
      anomalyFlags.push('High TMP');
    }

    const derivedKPIs = {
      activeSEC,
      saltRejection,
      carbonFootprint,
      rulDays,
      healthScore,
      breachTimer: state.derivedKPIs.breachTimer, // Preserved or incremented elsewhere
      anomalyFlags,
    };

    // --- Sensor Flat-line / Fault Detection ---
    let newFaults = { ...state.sensorFaults };
    let faultAlarms = [];
    if (state.telemetry) {
      Object.keys(mergedData).forEach(key => {
        if (typeof mergedData[key] === 'number') {
          if (!newFaults[key]) newFaults[key] = { cycles: 0, isFault: false };

          if (mergedData[key] === state.telemetry[key]) {
            newFaults[key].cycles += 1;
          } else {
            newFaults[key].cycles = 0;
            newFaults[key].isFault = false;
          }
          if (newFaults[key].cycles >= 10 && !newFaults[key].isFault) {
            newFaults[key].isFault = true;
            faultAlarms.push({
              id: `ALM-FLT-${Math.floor(Math.random() * 10000)}`,
              date: new Date().toISOString(),
              facility: mergedData.facility || state.selectedFacility,
              equipmentTag: key,
              severity: 'MEDIUM',
              description: `Sensor Fault: ${key.toUpperCase()} flat-line detected.`,
              lifecycleStatus: 'Active',
              acknowledgedBy: null,
              rootCause: `No data variation over multiple consecutive cycles.`,
              recommendedAction: 'Inspect sensor transmitter connection.',
              triggerValues: { [key]: mergedData[key] }
            });
          }
        }
      });
    }
    // Alarm Evaluation Logic
    const limits = state.alarmLimits;
    let newAlarms = [...state.alarms];
    let alarmTriggered = false;
    // We only trigger new alarms for 'Demo_Mode' or current facility to prevent duplicates
    // Resolve facility: use mergedData.facility if valid, else fall back to the active selectedFacility
    const resolvedFacility = (mergedData.facility && mergedData.facility !== 'Demo_Mode')
      ? mergedData.facility
      : state.selectedFacility || 'jetl_hyderabad';
    if (mergedData.feed_pressure > limits.feedPressureMax) {
      const activeAlarm = newAlarms.find(a => a.lifecycleStatus === 'Active' && a.equipmentTag === 'HP-PMP-01');
      if (!activeAlarm) {
        newAlarms.unshift({
          id: `ALM-${Date.now().toString().slice(-4)}`,
          date: new Date().toISOString(),
          facility: resolvedFacility,
          equipmentTag: 'HP-PMP-01',
          severity: 'CRITICAL',
          description: `Overpressure Trip: Feed Pressure at ${mergedData.feed_pressure.toFixed(1)} bar (Max: ${limits.feedPressureMax.toFixed(1)} bar)`,
          lifecycleStatus: 'Active',
          acknowledgedBy: null,
          resolutionTime: null,
          duration: 'Active',
          stage: targetStage,
          rootCause: `Feed Pressure exceeded ${limits.feedPressureMax.toFixed(1)} bar.`,
          recommendedAction: 'Reduce VFD speed immediately.',
          triggerValues: { ...mergedData }
        });
        alarmTriggered = true;
      }
    }
    if (mergedData.differential_pressure > limits.deltaPMax) {
      const activeAlarm = state.alarms.find(a => a.facility === resolvedFacility && a.equipmentTag === 'RO-TRN-1' && a.lifecycleStatus === 'Active');
      if (!activeAlarm) {
        newAlarms.unshift({
          id: `ALM-${Date.now().toString().slice(-4)}`,
          date: new Date().toISOString(),
          facility: resolvedFacility,
          equipmentTag: 'RO-TRN-1',
          severity: 'CRITICAL',
          description: `High TMP Trip: Delta P at ${mergedData.differential_pressure.toFixed(2)} bar (Max: ${limits.deltaPMax.toFixed(2)} bar)`,
          lifecycleStatus: 'Active',
          acknowledgedBy: null,
          resolutionTime: null,
          duration: 'Active',
          stage: targetStage,
          rootCause: `Membrane Delta P exceeded ${limits.deltaPMax.toFixed(2)} bar.`,
          recommendedAction: 'Trigger CIP protocol.',
          triggerValues: { ...mergedData }
        });
        alarmTriggered = true;
      }
    }
    const newTelemetry = { ...mergedData, normalized_flux: parseFloat(trueFlux?.toFixed(1) || 0) };
    const newHistory = [...state.telemetryHistory, newTelemetry].slice(-288);

    // Physics-Based Financial Model (Per tick calculation)
    const activeTariff = 8.5; // Currency per kWh — assumption, confirm with plant
    const waterValue = 50.0; // Currency per m3 — assumption, confirm with plant
    const chemicalBaseCost = 1500; // assumption, confirm with plant

    // Extrapolate daily OPEX from instantaneous flow (m3/h)
    const dailyFlow = newTelemetry.flow_rate * 24;
    // FIX: energy_kwh can legitimately be null (no energy meter on this
    // stage/dataset) — propagate null instead of letting it silently become
    // NaN through arithmetic, so the finance UI can show "no energy data"
    // instead of a corrupted number.
    const hasEnergyForFinance = typeof newTelemetry.energy_kwh === 'number' && !Number.isNaN(newTelemetry.energy_kwh);
    const dailyEnergy = hasEnergyForFinance ? newTelemetry.energy_kwh * 24 : null;

    const rev = dailyFlow * waterValue;
    const enCost = dailyEnergy !== null ? dailyEnergy * activeTariff : null;

    // Chemical cost climbs with differential pressure (Fouling penalty)
    const diffP = newTelemetry.differential_pressure || 1.0;
    const chemCost = chemicalBaseCost + Math.max(0, (diffP - 1.2) * 500);

    const profit = enCost !== null ? rev - enCost - chemCost : null;

    const timeLabel = new Date().toLocaleTimeString();
    const newFinancePoint = {
      date: timeLabel,
      revenue: parseFloat(rev.toFixed(0)),
      energyCost: enCost !== null ? parseFloat(enCost.toFixed(0)) : null,
      chemicalCost: parseFloat(chemCost.toFixed(0)),
      netProfit: profit !== null ? parseFloat(profit.toFixed(0)) : null,
      isProjection: false
    };
    const newMembranePoint = {
      date: timeLabel,
      flux: parseFloat(newTelemetry.normalized_flux.toFixed(1)),
      saltPassage: saltRejection !== null ? parseFloat((100 - saltRejection).toFixed(2)) : null,
      isProjection: false
    };
    const newEnergyPoint = {
      date: timeLabel,
      energy_kwh: dailyEnergy !== null ? parseFloat(dailyEnergy.toFixed(0)) : null,
      sec: activeSEC !== null ? parseFloat(activeSEC.toFixed(2)) : null,
      isProjection: false
    };
    // Cap history arrays to prevent memory leak (e.g., 500 points)
    const maxPoints = 500;
    const nextFinances = [...state.historicalFinances, newFinancePoint].slice(-maxPoints);
    const nextMembrane = [...state.historicalMembrane, newMembranePoint].slice(-maxPoints);
    const nextEnergy = [...state.historicalEnergy, newEnergyPoint].slice(-maxPoints);
    // Sanitize all alarms: ensure facility is never null/undefined (prevents [] in banner)
    const sanitize = (a) => ({ ...a, facility: a.facility || state.selectedFacility || 'jetl_hyderabad' });
    const sanitizedAlarms = alarmTriggered || faultAlarms.length > 0
      ? [...faultAlarms, ...newAlarms].map(sanitize)
      : undefined;
    return {
      telemetry: newTelemetry,
      telemetryHistory: newHistory,
      historicalFinances: nextFinances,
      historicalMembrane: nextMembrane,
      historicalEnergy: nextEnergy,
      derivedKPIs,
      sensorFaults: newFaults,
      ...(sanitizedAlarms ? { alarms: sanitizedAlarms } : {})
    };
  }),
  triggerEmergencyStop: (operatorName, reason) => set((state) => {
    const haltAlarm = {
      id: `ALM-ESTOP-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString(),
      facility: state.selectedFacility || 'jetl_hyderabad',
      equipmentTag: 'GLOBAL_PLANT',
      severity: 'CRITICAL',
      description: `EMERGENCY STOP ACTIVATED by ${operatorName}`,
      lifecycleStatus: 'Active',
      acknowledgedBy: operatorName,
      resolutionTime: null,
      duration: 'Active',
      rootCause: reason,
      recommendedAction: 'Follow emergency protocol. Clear area. Investigate reason before restart.',
      triggerValues: { operator: operatorName, reason }
    };
    return {
      isEmergencyHalted: true,
      alarms: [haltAlarm, ...state.alarms]
    };
  }),
  clearEmergencyStop: (operatorName) => set((state) => {
    // Mark the estop alarm as resolved
    const updatedAlarms = state.alarms.map(a => {
      if (a.id.startsWith('ALM-ESTOP-') && a.lifecycleStatus === 'Active') {
        return {
          ...a,
          lifecycleStatus: 'Resolved',
          resolutionTime: new Date().toISOString(),
          duration: 'Resolved'
        };
      }
      return a;
    });
    return {
      isEmergencyHalted: false,
      alarms: updatedAlarms
    };
  }),
  openCommandPanel: (panelData) => set({ activeCommandPanel: panelData }),
  closeCommandPanel: () => set({ activeCommandPanel: null }),
  logCommand: (commandData) => set((state) => {
    const newCommand = {
      id: `CMD-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      status: 'Pending',
      ...commandData
    };
    return { commandLog: [newCommand, ...state.commandLog] };
  }),
  setSyncStatus: (statusObj) => set({ syncStatus: statusObj }),
  setPlaybackMode: (mode) => set({ isPlaybackMode: mode }),
  setTimeHorizon: (horizon) => {
    set({ timeHorizon: horizon });
    const facility = get().selectedFacility;
    if (facility) {
      get().fetchHistoricalData(facility);
    }
  },
  connectWebSocket: (facilityKey) => {
    // Stop any existing sync loop
    globalSyncManager.stopSync();

    // Connect to central digital twin loop
    globalSyncManager.startSync();
  },
}));

globalSyncManager.setStore(useAppStore);
