/**
 * exportToExcel.js
 * Universal Excel export utility for Permionics Digital Twin.
 * Uses SheetJS (xlsx) — works entirely in the browser, no server needed.
 */
import * as XLSX from 'xlsx';

/**
 * Main export function.
 * @param {Object} opts
 * @param {string} opts.filename       - e.g. "JETL_Performance_Report"
 * @param {string} opts.plantName      - e.g. "JETL — Jeedimetla ETP"
 * @param {string} opts.dateFrom       - ISO string or date label
 * @param {string} opts.dateTo         - ISO string or date label
 * @param {Array}  opts.sheets         - Array of { name, columns, rows }
 */
export function exportToExcel({ filename, plantName, dateFrom, dateTo, sheets }) {
  const wb = XLSX.utils.book_new();

  sheets.forEach(({ name, columns, rows }) => {
    // Build header row
    const header = columns.map(c => c.label);

    // Build data rows
    const data = rows.map(row =>
      columns.map(c => {
        const val = row[c.key];
        if (val === null || val === undefined) return '';
        return val;
      })
    );

    // Combine header + data
    const wsData = [header, ...data];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws['!cols'] = columns.map(c => ({ wch: c.width || 18 }));

    XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31)); // Sheet name max 31 chars
  });

  // Generate filename with timestamp
  const ts = new Date().toISOString().slice(0, 10);
  const safeFilename = `${filename}_${ts}.xlsx`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

  XLSX.writeFile(wb, safeFilename);
}

// ─── Sheet builder helpers ────────────────────────────────────────────────────

/**
 * Build a "Sensor Readings" sheet from telemetryHistory array.
 */
export function buildSensorSheet(telemetryHistory, dateFrom, dateTo) {
  const from = dateFrom ? new Date(dateFrom) : null;
  const to   = dateTo   ? new Date(dateTo)   : null;

  const filtered = (telemetryHistory || []).filter(t => {
    if (!t.timestamp) return true;
    const d = new Date(t.timestamp);
    if (from && d < from) return false;
    if (to   && d > to)   return false;
    return true;
  });

  return {
    name: 'Sensor Readings',
    columns: [
      { key: 'timestamp',            label: 'Timestamp',               width: 22 },
      { key: 'pH',                   label: 'pH',                      width: 10 },
      { key: 'conductivity',         label: 'Conductivity (µS/cm)',    width: 22 },
      { key: 'turbidity',            label: 'Turbidity (NTU)',         width: 18 },
      { key: 'feed_pressure',        label: 'Feed Pressure (BAR)',     width: 20 },
      { key: 'differential_pressure',label: 'Diff. Pressure (BAR)',   width: 20 },
      { key: 'flow_rate',            label: 'Flow Rate (M³/HR)',       width: 18 },
      { key: 'recovery_rate',        label: 'Recovery (%)',            width: 14 },
      { key: 'permeate_conductivity',label: 'Permeate EC (µS/cm)',    width: 22 },
    ],
    rows: filtered,
  };
}

/**
 * Build a "KPI Summary" sheet from telemetryHistory (daily averages).
 */
export function buildKPISheet(telemetryHistory) {
  // Group by date
  const byDate = {};
  (telemetryHistory || []).forEach(t => {
    const date = t.timestamp ? t.timestamp.slice(0, 10) : 'Unknown';
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(t);
  });

  const rows = Object.entries(byDate).map(([date, records]) => {
    const avg = (key) => {
      const vals = records.map(r => r[key]).filter(v => v != null && !isNaN(v));
      return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : '';
    };
    return {
      date,
      avg_flow:       avg('flow_rate'),
      avg_recovery:   avg('recovery_rate'),
      avg_dp:         avg('differential_pressure'),
      avg_feed_p:     avg('feed_pressure'),
      avg_ec:         avg('conductivity'),
      avg_ph:         avg('pH'),
      record_count:   records.length,
    };
  });

  return {
    name: 'KPI Summary (Daily)',
    columns: [
      { key: 'date',          label: 'Date',                  width: 14 },
      { key: 'avg_flow',      label: 'Avg Flow (M³/HR)',      width: 18 },
      { key: 'avg_recovery',  label: 'Avg Recovery (%)',      width: 18 },
      { key: 'avg_dp',        label: 'Avg ΔP (BAR)',          width: 14 },
      { key: 'avg_feed_p',    label: 'Avg Feed Pressure',     width: 18 },
      { key: 'avg_ec',        label: 'Avg EC (µS/cm)',        width: 18 },
      { key: 'avg_ph',        label: 'Avg pH',                width: 10 },
      { key: 'record_count',  label: 'Data Points',           width: 14 },
    ],
    rows,
  };
}

/**
 * Build a "PCB Compliance" sheet from telemetryHistory vs plant limits.
 */
export function buildComplianceSheet(telemetryHistory, limits) {
  const rows = (telemetryHistory || []).map(t => {
    const phOk  = t.pH != null ? (t.pH >= (limits?.ph_min ?? 6.5) && t.pH <= (limits?.ph_max ?? 9.0)) : null;
    const ecOk  = t.conductivity != null ? t.conductivity <= (limits?.conductivity_max ?? 2100) : null;
    const turbOk= t.turbidity != null ? t.turbidity <= (limits?.turbidity_max ?? 10) : null;

    return {
      timestamp:    t.timestamp || '',
      pH:           t.pH ?? '',
      ph_limit:     `${limits?.ph_min ?? 6.5} – ${limits?.ph_max ?? 9.0}`,
      ph_status:    phOk === null ? '' : phOk ? 'PASS' : 'FAIL',
      conductivity: t.conductivity ?? '',
      ec_limit:     limits?.conductivity_max ?? 2100,
      ec_status:    ecOk === null ? '' : ecOk ? 'PASS' : 'FAIL',
      turbidity:    t.turbidity ?? '',
      turb_limit:   limits?.turbidity_max ?? 10,
      turb_status:  turbOk === null ? '' : turbOk ? 'PASS' : 'FAIL',
    };
  });

  return {
    name: 'PCB Compliance',
    columns: [
      { key: 'timestamp',    label: 'Timestamp',          width: 22 },
      { key: 'pH',           label: 'pH Value',           width: 12 },
      { key: 'ph_limit',     label: 'pH Limit',           width: 14 },
      { key: 'ph_status',    label: 'pH Status',          width: 12 },
      { key: 'conductivity', label: 'EC (µS/cm)',         width: 14 },
      { key: 'ec_limit',     label: 'EC Limit',           width: 12 },
      { key: 'ec_status',    label: 'EC Status',          width: 12 },
      { key: 'turbidity',    label: 'Turbidity (NTU)',    width: 16 },
      { key: 'turb_limit',   label: 'Turbidity Limit',   width: 16 },
      { key: 'turb_status',  label: 'Turbidity Status',  width: 16 },
    ],
    rows,
  };
}

/**
 * Build an "Alarm History" sheet from alarms array.
 */
export function buildAlarmSheet(alarms, dateFrom, dateTo) {
  const from = dateFrom ? new Date(dateFrom) : null;
  const to   = dateTo   ? new Date(dateTo)   : null;

  const filtered = (alarms || []).filter(a => {
    if (!a.date) return true;
    const d = new Date(a.date);
    if (from && d < from) return false;
    if (to   && d > to)   return false;
    return true;
  });

  return {
    name: 'Alarm History',
    columns: [
      { key: 'id',                label: 'Alarm ID',          width: 14 },
      { key: 'date',              label: 'Date / Time',       width: 24 },
      { key: 'severity',          label: 'Severity',          width: 12 },
      { key: 'equipmentTag',      label: 'Equipment Tag',     width: 16 },
      { key: 'description',       label: 'Description',       width: 40 },
      { key: 'lifecycleStatus',   label: 'Status',            width: 12 },
      { key: 'acknowledgedBy',    label: 'Acknowledged By',   width: 18 },
      { key: 'rootCause',         label: 'Root Cause',        width: 36 },
      { key: 'recommendedAction', label: 'Recommended Action',width: 36 },
    ],
    rows: filtered,
  };
}

/**
 * Build a "Financial / OPEX" sheet.
 */
export function buildFinancialSheet(telemetryHistory) {
  const ENERGY_RATE = 8.5; // ₹ per kWh
  const rows = (telemetryHistory || []).map(t => {
    const sec   = t.energy_kwh && t.flow_rate ? t.energy_kwh / t.flow_rate : null;
    const opex  = sec ? sec * ENERGY_RATE : null;
    return {
      timestamp:   t.timestamp || '',
      flow_rate:   t.flow_rate ?? '',
      energy_kwh:  t.energy_kwh ?? '',
      sec:         sec ? sec.toFixed(3) : '',
      opex_per_m3: opex ? `₹${opex.toFixed(2)}` : '',
    };
  });

  return {
    name: 'Financial OPEX',
    columns: [
      { key: 'timestamp',    label: 'Timestamp',         width: 22 },
      { key: 'flow_rate',    label: 'Flow Rate (M³/HR)', width: 18 },
      { key: 'energy_kwh',   label: 'Energy (kWh)',      width: 16 },
      { key: 'sec',          label: 'SEC (kWh/M³)',      width: 14 },
      { key: 'opex_per_m3',  label: 'OPEX (₹/M³)',      width: 14 },
    ],
    rows,
  };
}
