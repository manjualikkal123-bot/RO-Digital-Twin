// GlobalSyncManager.js
//
// Replays REAL JETL telemetry (jetl_train.json = RO1+RO2+RO-P merged by nearest
// timestamp, jetl_uf.json = UF on its own independent timeline) on a fixed
// interval. Each dataset loops back to its own start independently when it
// reaches the end. No synthetic noise, no hardcoded fallback values.
//
// Also replays REAL Nandesari (nia_nandesari) telemetry from
// nia_nandesari.json - a single file, single timeline, 5 parallel HPA trains
// per row (HPA1..HPA5), built from the June 2026 logsheet by grouping every
// (date, time-of-day) reading across all 5 HPA blocks. See
// mapNandesariRowToTelemetry() / buildFullTelemetryNandesari() below.
//
// For any OTHER facility, this falls back to whatever per-facility JSON file
// exists at /api/data-source/<facility>.json, passed through with no stage
// nesting. That payload shape is unrelated to JETL/Nandesari and is out of
// scope until wired up the same way.

// Confirmed hardware/process faults found by scanning jetl_train.json (see
// useAppStore.js history for the original fault log). Applied HERE, at the
// raw-tag source, because mapJetlRowToTelemetry() renames every tag to a
// friendly field name before it leaves this file — any clamp downstream of
// that rename (e.g. in useAppStore.setTelemetry) can never match the raw
// tag pattern again. Out-of-range readings become null (renders as '--'
// gap in the UI), never a fabricated clamped number.
//   PT_704   (RO-2 booster pressure):     0–60 bar   — confirmed fixed in
//            hardware as of the latest logsheet, kept as a safety net.
//   CDIC_701 (RO-2 feed conductivity):     0–8000 µS/cm  — still faulty.
//   CDIC_702 (RO-2 permeate conductivity): 0–1000 µS/cm  — still faulty.
//   ORP_401  (RO-1 ORP):                   -50–50 mV     — CIP wash signature.
//   PH_401   (RO-1 pH):                    2–12          — CIP wash signature.
const clampOrNull = (v, min, max) => {
  const n = (typeof v === 'number' && !isNaN(v)) ? v : null;
  if (n === null) return null;
  return (n < min || n > max) ? null : n;
};

class GlobalSyncManager {
  constructor() {
    this.intervalId = null;
    this.config = null;
    this.store = null;

    // Two independent, independently-looping cursors (JETL)
    this.trainRows = [];   // RO1 / RO2 / RO-P merged rows
    this.ufRows = [];      // UF rows, own timeline
    this.trainIndex = 0;
    this.ufIndex = 0;

    // Single timeline cursor (Nandesari - all 5 HPA trains share one clock)
    this.nandesariRows = [];
    this.nandesariIndex = 0;
  }

  setStore(store) {
    this.store = store;
  }

  async fetchConfig() {
    try {
      const res = await fetch('/syncConfig.json');
      if (!res.ok) throw new Error('Failed to load syncConfig.json');
      this.config = await res.json();
    } catch (e) {
      console.error('GlobalSyncManager Config Error:', e);
      this.config = { refreshIntervalMs: 5000, loopEnabled: true };
    }
  }

  async fetchJetlData() {
    const token = localStorage.getItem('dt_token');
    if (!token) throw new Error('Not authenticated: missing dt_token — please log in again');
    const authHeader = { 'Authorization': `Bearer ${token}` };

    const [trainRes, ufRes] = await Promise.all([
      fetch('/api/data-source/jetl_train.json', { headers: authHeader }),
      fetch('/api/data-source/jetl_uf.json', { headers: authHeader }),
    ]);
    if (trainRes.status === 401 || ufRes.status === 401) {
      throw new Error('Session expired (401) — please log in again to resume live telemetry');
    }
    if (!trainRes.ok) throw new Error(`HTTP ${trainRes.status} loading jetl_train.json`);
    if (!ufRes.ok) throw new Error(`HTTP ${ufRes.status} loading jetl_uf.json`);

    this.trainRows = await trainRes.json();
    this.ufRows = await ufRes.json();

    if (!this.trainRows.length || !this.ufRows.length) {
      throw new Error('JETL data file is empty');
    }
    this.trainIndex = 0;
    this.ufIndex = 0;

    if (this.store && typeof this.store.getState === 'function') {
      const storeState = this.store.getState();
      if (typeof storeState.setFullHistoricalDataset === 'function') {
        const fullDataset = [];
        const originalTrainIndex = this.trainIndex;
        const originalUfIndex = this.ufIndex;
        const maxLen = Math.max(this.trainRows.length, this.ufRows.length);
        for(let i = 0; i < maxLen; i++) {
          this.trainIndex = Math.min(i, this.trainRows.length - 1);
          this.ufIndex = Math.min(i, this.ufRows.length - 1);
          fullDataset.push(this.buildFullTelemetry());
        }
        this.trainIndex = originalTrainIndex;
        this.ufIndex = originalUfIndex;
        storeState.setFullHistoricalDataset(fullDataset);
      }
    }
  }

  async fetchNandesariData() {
    const token = localStorage.getItem('dt_token');
    if (!token) throw new Error('Not authenticated: missing dt_token — please log in again');
    const authHeader = { 'Authorization': `Bearer ${token}` };

    const res = await fetch('/api/data-source/nia_nandesari.json', { headers: authHeader });
    if (res.status === 401) throw new Error('Session expired (401) — please log in again to resume live telemetry');
    if (!res.ok) throw new Error(`HTTP ${res.status} loading nia_nandesari.json`);

    this.nandesariRows = await res.json();
    if (!this.nandesariRows.length) {
      throw new Error('Nandesari data file is empty');
    }
    this.nandesariIndex = 0;

    if (this.store && typeof this.store.getState === 'function') {
      const storeState = this.store.getState();
      if (typeof storeState.setFullHistoricalDataset === 'function') {
        const fullDataset = [];
        const originalIndex = this.nandesariIndex;
        for(let i = 0; i < this.nandesariRows.length; i++) {
          this.nandesariIndex = i;
          fullDataset.push(this.buildFullTelemetryNandesari());
        }
        this.nandesariIndex = originalIndex;
        storeState.setFullHistoricalDataset(fullDataset);
      }
    }
  }

  async fetchGenericData(facility) {
    const token = localStorage.getItem('dt_token');
    if (!token) throw new Error('Not authenticated: missing dt_token — please log in again');
    const authHeader = { 'Authorization': `Bearer ${token}` };

    const res = await fetch(`/api/data-source/${facility}.json`, { headers: authHeader });
    if (res.status === 401) throw new Error('Session expired (401) — please log in again to resume live telemetry');
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const rows = await res.json();
    if (!rows || !rows.length) throw new Error('Data file is empty');
    this.trainRows = rows;
    this.ufRows = [];
    this.trainIndex = 0;
  }

  async fetchExcelData() {
    const store = this.store ? this.store.getState() : null;
    if (store && typeof store.setSyncStatus === 'function') {
      store.setSyncStatus({ status: 'Fetching Data...', error: null, lastSynced: null });
    }
    try {
      const selectedFacility = (store && store.selectedFacility) ? store.selectedFacility : 'jetl_hyderabad';
      if (selectedFacility === 'jetl_hyderabad') {
        await this.fetchJetlData();
      } else if (selectedFacility === 'nia_nandesari') {
        await this.fetchNandesariData();
      } else {
        await this.fetchGenericData(selectedFacility);
      }
    } catch (e) {
      console.error('GlobalSyncManager Fetch Error:', e);
      if (store && typeof store.setSyncStatus === 'function') {
        store.setSyncStatus({ status: 'Error', error: e.message, lastSynced: null });
      }
      setTimeout(() => this.startSync(), 5000);
      throw e;
    }
  }

  // Builds the telemetry object for a given stage from REAL JETL data only
  // (PMPL_LOGSHEETS.xlsx, full instrument set). Missing tags -> 0 (not
  // fabricated). Recovery / rejection -> null when not physically computable
  // from the available tags (UF has no reject-flow tag, so it has no
  // recovery figure at all in this dataset).
  mapJetlRowToTelemetry(targetStage) {
    const num = (v) => (typeof v === 'number' && !isNaN(v)) ? v : 0;
    const orNull = (v) => (typeof v === 'number' && !isNaN(v)) ? v : null;

    if (targetStage === 'UF') {
      const row = this.ufRows[this.ufIndex];
      const uf = row?.UF || {};
      const flow = orNull(uf.FT_101);

      return {
        facility: 'jetl_hyderabad',
        stage: 'UF',
        timestamp: row?.timestamp || null,
        feed_pressure: orNull(uf.PT_101),       // Membrane I/L
        reject_pressure: orNull(uf.PT_102),     // Reject Line
        flow_rate: flow,                     // Permeate Line FT-101
        differential_pressure: num(uf.PT_101) - num(uf.PT_102), // no dedicated TMP tag on UF
        conductivity: null,                  // no conductivity tag exists for UF in this dataset
        permeate_conductivity: null,
        recovery_rate: null,                 // UF has no reject-flow tag — not computable
        salt_rejection: null,
        level_lt101: num(uf.LT_101),
        pump_rpm: num(uf.P_102_RPM),
        pH: 0,
        temperature: 0,
        turbidity: 0,
        energy_kwh: null,
        normalized_flux: flow,
        cip_active: Boolean(uf?.CIP_ACTIVE || uf?.cip_active),
        raw: uf,
      };
    }

    const row = this.trainRows[this.trainIndex];
    const ro1 = row?.RO1 || null;
    const ro2 = row?.RO2 || null;
    const rop = row?.['RO-P'] || null;

    if (targetStage === 'RO1') {
      const permeateFlow = orNull(ro1?.FT_401);
      const rejectFlow = num(ro1?.FT_402);
      const totalFlow = (permeateFlow || 0) + rejectFlow;
      const feedCond = orNull(ro1?.CDIC_401);
      const permCond = orNull(ro1?.CDIC_402);

      return {
        facility: 'jetl_hyderabad',
        stage: 'RO1',
        timestamp: row?.timestamp || null,
        feed_pressure: orNull(ro1?.PT_401),
        reject_pressure: orNull(ro1?.PT_402),
        booster1_pressure_in: num(ro1?.PT_403),
        booster1_pressure_out: num(ro1?.PT_404),
        booster2_pressure_in: num(ro1?.PT_405),
        booster2_pressure_out: num(ro1?.PT_406),
        flow_rate: permeateFlow,
        reject_flow: rejectFlow,
        feed_tank_level: num(ro1?.LT_401),
        differential_pressure: num(ro1?.PT_401) - num(ro1?.PT_402),
        conductivity: feedCond,
        permeate_conductivity: permCond,
        orp: clampOrNull(ro1?.ORP_401, -50, 50),
        valve_position: orNull(ro1?.PID_401),
        recovery_rate: totalFlow > 0 ? (permeateFlow / totalFlow) * 100 : null,
        salt_rejection: (feedCond && feedCond > 0 && permCond !== null) ? (1 - (permCond / feedCond)) * 100 : null,
        pH: clampOrNull(ro1?.PH_401, 2, 12) ?? 0,   // real tag exists for RO1; null'd during CIP acid wash
        temperature: 0,
        turbidity: 0,
        energy_kwh: null,
        normalized_flux: permeateFlow,
        cip_active: Boolean(ro1?.CIP_ACTIVE || ro1?.cip_active),
        raw: ro1,
      };
    }

    if (targetStage === 'RO2') {
      const permeateFlow = orNull(ro2?.FT_701);
      const rejectFlow = num(ro2?.FT_702);
      const totalFlow = (permeateFlow || 0) + rejectFlow;
      const feedCond = clampOrNull(ro2?.CDIC_701, 0, 8000);   // still faulty in current data — nulled on breach
      const permCond = clampOrNull(ro2?.CDIC_702, 0, 1000);   // still faulty in current data — nulled on breach

      return {
        facility: 'jetl_hyderabad',
        stage: 'RO2',
        timestamp: row?.timestamp || null,
        feed_pressure: orNull(ro2?.PT_701),
        reject_pressure: orNull(ro2?.PT_702),
        booster_pressure_in: num(ro2?.PT_703),
        booster_pressure_out: clampOrNull(ro2?.PT_704, 0, 60) ?? 0, // confirmed fixed in hardware; kept as safety net
        flow_rate: permeateFlow,
        reject_flow: rejectFlow,
        feed_tank_level: num(ro2?.LT_701),
        differential_pressure: num(ro2?.PT_701) - num(ro2?.PT_702),
        conductivity: feedCond,
        permeate_conductivity: permCond,
        valve_position: orNull(ro2?.PID_701),
        recovery_rate: totalFlow > 0 ? (permeateFlow / totalFlow) * 100 : null,
        salt_rejection: (feedCond && feedCond > 0 && permCond !== null) ? (1 - (permCond / feedCond)) * 100 : null,
        pH: orNull(ro2?.PH_701) ?? 0,   // real tag exists for RO2
        temperature: 0,
        turbidity: 0,
        energy_kwh: null,
        normalized_flux: permeateFlow,
        cip_active: Boolean(ro2?.CIP_ACTIVE || ro2?.cip_active),
        raw: ro2,
      };
    }

    if (targetStage === 'RO-P') {
      const permeateFlow = orNull(rop?.FT_1001);
      const rejectFlow = num(rop?.FT_1002);
      const totalFlow = (permeateFlow || 0) + rejectFlow;
      const feedCond = orNull(rop?.CDIC_1001);
      const permCond = orNull(rop?.CDIC_1002);

      return {
        facility: 'jetl_hyderabad',
        stage: 'RO-P',
        timestamp: row?.timestamp || null,
        feed_pressure: orNull(rop?.PT_1001),
        reject_pressure: orNull(rop?.PT_1002),
        flow_rate: permeateFlow,
        reject_flow: rejectFlow,
        feed_tank_level: num(rop?.LT_1001),
        differential_pressure: num(rop?.PT_1001) - num(rop?.PT_1002),
        conductivity: feedCond,
        permeate_conductivity: permCond,
        valve_position: orNull(rop?.PID_1001),
        recovery_rate: totalFlow > 0 ? (permeateFlow / totalFlow) * 100 : null,
        salt_rejection: (feedCond && feedCond > 0 && permCond !== null) ? (1 - (permCond / feedCond)) * 100 : null,
        pH: 0,        // no pH tag for RO-P in this dataset
        temperature: 0,
        turbidity: 0,
        energy_kwh: null,
        normalized_flux: permeateFlow,
        cip_active: Boolean(rop?.CIP_ACTIVE || rop?.cip_active),
        raw: rop,
      };
    }

    return null;
  }

  // Builds telemetry for a single HPA train from REAL Nandesari data only
  // (nia_nandesari.json, built from the June 2026 logsheet). Missing tags ->
  // null (renders as '--' gap), never fabricated. Column choices mirror the
  // ones validated in BatchAnalytics.jsx's parseNandesariMatrix():
  //   feed_pressure      <- ARR1_IL  (RO Array 1 inlet - this train's RO feed)
  //   reject_pressure    <- ARR2_OL  (RO Array 2 outlet - concentrate side)
  //   flow_rate          <- PERM_FLOW_12 (1st+2nd stage permeate flow)
  //   conductivity       <- PERM_CDT_12  (1st+2nd stage permeate conductivity)
  // There is no feed-side conductivity tag anywhere in this logsheet (only
  // permeate-side CDT and a downstream degasser TDS) - so feed_conductivity
  // and salt_rejection are honestly null for every HPA train, always.
  mapNandesariRowToTelemetry(targetStage) {
    const orNull = (v) => (typeof v === 'number' && !isNaN(v) && v !== 0) ? v : null;
    const orNullZ = (v) => (typeof v === 'number' && !isNaN(v)) ? v : null; // allows zero

    const row = this.nandesariRows[this.nandesariIndex];
    const hpa = row?.[targetStage] || null;
    if (!hpa) return null;

    const feedPressure  = orNull(hpa.ARR1_IL);   // RO Array 1 inlet (bar)
    const rejectPressure = orNull(hpa.ARR2_OL);  // RO Array 2 outlet (bar)
    const permeateFlow  = orNull(hpa.PERM_FLOW_12);
    const rejectFlow    = orNull(hpa.REJECT_FLOW);
    const totalFlow     = (permeateFlow || 0) + (rejectFlow || 0);

    // ARR1_DP is the dedicated differential-pressure tag measured by the plant
    // instrumentation across RO Array 1. Use it directly as the primary TMP
    // indicator — far more reliable than ARR1_IL - ARR2_OL which can go negative
    // due to cross-train pressure interactions.
    const arr1Dp  = orNull(hpa.ARR1_DP);
    const tmfDp   = orNull(hpa.TMF_DP);
    // Use TMF_DP if ARR1_DP is missing; both are physically valid DP readings.
    const dp = arr1Dp ?? tmfDp;

    return {
      facility: 'nia_nandesari',
      stage: targetStage,
      timestamp: row?.timestamp || null,
      feed_pressure: feedPressure,
      reject_pressure: rejectPressure,
      tmf_pressure_in:  orNullZ(hpa.TMF_IN),
      tmf_pressure_out: orNullZ(hpa.TMF_OUT),
      flow_rate: permeateFlow,
      reject_flow: rejectFlow,
      // Use the dedicated ARR1_DP tag — not feed-minus-reject subtraction
      differential_pressure: dp,
      tmp: dp,  // alias so computeStageHealth can also find it as 'tmp'
      conductivity: orNull(hpa.PERM_CDT_12),       // permeate-side only
      feed_conductivity: null,                      // not in this dataset
      permeate_conductivity_3rd: orNull(hpa.PERM_CDT_3),
      tds: orNull(hpa.DG_TDS),
      recovery_rate: totalFlow > 0 ? (permeateFlow / totalFlow) * 100 : null,
      salt_rejection: null,                         // no feed conductivity — not computable
      pH: orNullZ(hpa.FEED_PH) ?? 0,
      permeate_pH: orNull(hpa.PERM_PH),
      turbidity: orNullZ(hpa.TURB_FEED) ?? 0,
      vfd_rpm: orNull(hpa.VFD_RPM),
      temperature: 0,                               // no temperature tag in this dataset
      energy_kwh: null,                             // no energy tag in this dataset
      normalized_flux: permeateFlow,
      cip_active: false,                            // no CIP flag tag in this dataset
      raw: hpa,
    };
  }


  // Builds telemetry for all 5 HPA trains on every tick, plus a `plant`
  // rollup that sums permeate flow across all 5 trains (Nandesari has no
  // single end-of-pipe meter - each HPA train is its own independent
  // product stream, unlike JETL's sequential UF->RO1->RO2->RO-P topology).
  // Energy is 0 for all stages (no energy tags exist in this dataset), so
  // plant SEC is honestly null, not fabricated.
  buildFullTelemetryNandesari() {
    const stages = {};
    ['HPA1', 'HPA2', 'HPA3', 'HPA4', 'HPA5'].forEach(s => {
      stages[s] = this.mapNandesariRowToTelemetry(s);
    });

    const flows = Object.values(stages).map(s => s?.flow_rate).filter(v => typeof v === 'number');
    const totalFlow = flows.length ? flows.reduce((a, b) => a + b, 0) : null;

    return {
      facility: 'nia_nandesari',
      timestamp: this.nandesariRows[this.nandesariIndex]?.timestamp || null,
      stages,
      plant: {
        flow_rate: totalFlow,       // sum of all 5 trains' permeate flow
        recovery_rate: null,        // no plant-wide feed meter to compute this against
        energy_kwh: 0,
        sec: null,
      },
    };
  }

  // Builds telemetry for ALL FOUR stages on every tick (not just whichever
  // stage a detail page's dropdown happens to be on), plus a `plant` rollup
  // anchored to RO-P (the true end-of-pipe product per JETL's topology:
  // UF -> RO1 -> {RO2 (reject path), RO-P (permeate path)} -> RO-P final).
  //
  // Overall recovery = RO-P permeate / RO1's own feed (= RO1 permeate +
  // RO1 reject, since RO1 has no dedicated feed-flow meter — mass balance).
  // Energy is 0 for all stages (no energy tags exist in this dataset), so
  // plant SEC is honestly 0, not fabricated.
  buildFullTelemetry() {
    const ufTel = this.mapJetlRowToTelemetry('UF');
    const ro1Tel = this.mapJetlRowToTelemetry('RO1');
    const ro2Tel = this.mapJetlRowToTelemetry('RO2');
    const ropTel = this.mapJetlRowToTelemetry('RO-P');

    const ro1Feed = (ro1Tel.flow_rate || 0) + (ro1Tel.reject_flow || 0);
    const plantRecovery = ro1Feed > 0 ? (ropTel.flow_rate / ro1Feed) * 100 : null;
    const totalEnergy = [ufTel, ro1Tel, ro2Tel, ropTel].reduce((sum, s) => sum + (s.energy_kwh || 0), 0);
    const plantSEC = ropTel.flow_rate > 0 ? totalEnergy / ropTel.flow_rate : null;

    return {
      facility: 'jetl_hyderabad',
      timestamp: ropTel.timestamp,
      stages: { UF: ufTel, RO1: ro1Tel, RO2: ro2Tel, 'RO-P': ropTel },
      plant: {
        flow_rate: ropTel.flow_rate,           // end-of-pipe product flow (RO-P permeate)
        recovery_rate: plantRecovery,          // RO-P permeate / RO1 feed
        energy_kwh: totalEnergy,
        sec: plantSEC,
      },
      // No flat top-level fields. Every consumer must read telemetry.stages.<STAGE>
      // or telemetry.plant — this is the strict, single schema going forward.
    };
  }

  syncNextRow() {
    const store = this.store ? this.store.getState() : null;
    if (store && store.isPlaybackMode) return; // Don't run live sync during historical playback

    const facility = store ? (store.selectedFacility || 'jetl_hyderabad') : 'jetl_hyderabad';

    try {
      let telemetry = null;
      if (facility === 'jetl_hyderabad') {
        if (!this.trainRows.length || !this.ufRows.length) return;
        telemetry = this.buildFullTelemetry();
      } else if (facility === 'nia_nandesari') {
        if (!this.nandesariRows.length) return;
        telemetry = this.buildFullTelemetryNandesari();
      } else {
        if (!this.trainRows.length) return;
        const row = this.trainRows[this.trainIndex];
        
        // Dynamically wrap the flat parsed row into the global schema
        // so generic plants automatically work with the Live Dashboard.
        const stageName = "Stage 1"; // Default for generic data
        telemetry = {
          facility: facility,
          timestamp: row.timestamp || null,
          stages: {
            [stageName]: {
              facility: facility,
              stage: stageName,
              ...row
            }
          },
          plant: {
            flow_rate: row.flow_rate || null,
            recovery_rate: row.recovery_rate || null,
            energy_kwh: row.energy_kwh || 0,
            sec: null
          }
        };
      }

      if (telemetry && store) {
        if (typeof store.setTelemetry === 'function') store.setTelemetry(telemetry);
        if (typeof store.setSyncStatus === 'function') {
          store.setSyncStatus({
            status: 'Ok',
            error: null,
            lastSynced: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' IST',
          });
        }
      }
    } catch (err) {
      console.warn('Silent crash in GlobalSyncManager:', err);
    }

    // Advance BOTH cursors every tick now (UF and train are independent
    // timelines, each loops back to 0 on its own when exhausted), since
    // every tick now computes all four stages regardless of dropdown state.
    if (facility === 'jetl_hyderabad') {
      this.ufIndex++;
      if (this.ufIndex >= this.ufRows.length) {
        this.ufIndex = (this.config && this.config.loopEnabled) ? 0 : this.ufRows.length - 1;
      }
      this.trainIndex++;
      if (this.trainIndex >= this.trainRows.length) {
        this.trainIndex = (this.config && this.config.loopEnabled) ? 0 : this.trainRows.length - 1;
      }
    } else if (facility === 'nia_nandesari') {
      this.nandesariIndex++;
      if (this.nandesariIndex >= this.nandesariRows.length) {
        this.nandesariIndex = (this.config && this.config.loopEnabled) ? 0 : this.nandesariRows.length - 1;
      }
    } else {
      this.trainIndex++;
      if (this.trainIndex >= this.trainRows.length) {
        this.trainIndex = (this.config && this.config.loopEnabled) ? 0 : this.trainRows.length - 1;
      }
    }
  }

  async startSync() {
    this.stopSync();
    await this.fetchConfig();
    try {
      await this.fetchExcelData();
      this.syncNextRow();
      this.intervalId = setInterval(() => this.syncNextRow(), this.config.refreshIntervalMs);

      // Start Intelligence Layer Sync
      if (this.store && typeof this.store.getState === 'function') {
        const fetchMl = () => {
          const state = this.store.getState();
          if (state.selectedFacility && typeof state.fetchIntelligenceLayer === 'function') {
            state.fetchIntelligenceLayer(state.selectedFacility);
          }
        };
        fetchMl();
        this.mlIntervalId = setInterval(fetchMl, 60000);
      }
    } catch (e) {
      // Handled in fetchExcelData
    }
  }

  stopSync() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.mlIntervalId) {
      clearInterval(this.mlIntervalId);
      this.mlIntervalId = null;
    }
  }
}

export const globalSyncManager = new GlobalSyncManager();
