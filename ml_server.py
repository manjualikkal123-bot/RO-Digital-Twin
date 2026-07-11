# =============================================================================
# Permasense Digital Twin — ML Server
# Version: 2.1 (Physics-Informed Hybrid Architecture — corrected)
# =============================================================================
# Architecture overview:
#   Model 1 — Membrane fouling: PyTorch LSTM + Hermia combination model +
#              Monte Carlo Dropout uncertainty + hard physics constraints
#   Model 2 — Energy: XGBoost pump efficiency degradation + physics SEC
#              formula + partial-derivative error propagation for uncertainty
#   Model 3 — OPEX: XGBoost quantile regression (P10/P50/P90) + Model 1
#              coupling for CIP cost injection + seasonal features
#
# CHANGELOG vs v2.0 (see review notes — each fix tagged FIX-N):
#   FIX-0  Fouling-rate LSTM targets (k_i, k_c) were hardcoded constants
#          (0.001 / 0.00001) on every row -> model could learn nothing.
#          Now fit locally per-row via rolling-window least squares against
#          the same 1/NP = 1/NP0 + k_i*t + k_c*t^2 physics used at inference.
#   FIX-1  Energy model target (pump efficiency) was hardcoded 0.85 on every
#          row -> now computed from real hydraulic vs electrical power.
#   FIX-2  Finance model features fouling_index/days_since_replacement were
#          hardcoded constants -> now derived from real NP and CIP history.
#   FIX-3  SEC formula divided by 3600 instead of 36 -> ~100x unit error.
#   FIX-4  Osmotic pressure used a hardcoded TDS=55000 for every plant ->
#          now derived from that plant's actual conductivity reading.
#   FIX-5  Unknown plant_id silently fell back to jetl_hyderabad's twin ->
#          now returns a clear 404, never substitutes another client's data.
#   FIX-6  Two disconnected config sources (cfd_pipeline config.json vs
#          hardcoded PLANT_CONFIGS dict) -> merged into plants_config.json,
#          loaded once at startup, no plant params in code anymore.
#   FIX-7  LSI alkalinity was invented from pH alone -> now reads a real
#          'alkalinity' column, only falls back to the pH estimate (with a
#          logged warning) when the column is missing.
#   FIX-8  Removed decorative unused `from thermo import Chemical` import.
#   FIX-9  evaluate_cip_scaling_type always got flux_decline_rate=0.0 ->
#          now computed from the actual forecast trajectory.
#   FIX-10 Minimum training threshold (30 rows) let the LSTM "train" on a
#          single sequence -> raised threshold + added a held-out
#          validation split with reported validation loss.
#   FIX-11 df.fillna(0) turned missing pH/conductivity into physically
#          nonsensical zeros, AND corrupted the stored raw data permanently
#          -> raw uploads are now stored as-is (NaN-safe), cleaning
#          (ffill/bfill + drop-if-still-missing) happens only at train time.
#   FIX-12 dsw (days-since-wash) and wash_recovery were hardcoded to 0.0 and
#          0.95 for every row -> now computed from real /api/cip-logs data.
#   FIX-13 Forecast loops reconstructed future feature vectors using magic
#          numbers (25.0, 0.5, 3.0, 2.0, 20.0) for temp/lsi/antiscalant/sdi
#          -> now carries forward the plant's last known real values.
# =============================================================================

import os
import json
import logging
import traceback
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from werkzeug.utils import secure_filename
import tempfile
import shutil
import uuid
import time
import threading

from flask import Flask, request, jsonify
from flask_cors import CORS

from sklearn.preprocessing import MinMaxScaler
import torch
import torch.nn as nn
import torch.optim as optim
import xgboost as xgb

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("permasense")

# ── App setup ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

@app.errorhandler(Exception)
def handle_global_exception(e):
    log.error(f"Unhandled Exception: {str(e)}", exc_info=True)
    return {"error": "Internal ML Server Error", "details": str(e)}, 500

# ── Directory / file paths ────────────────────────────────────────────────────
BASE_DIR             = os.path.dirname(__file__)
TRAINING_DATA_DIR    = os.path.join(BASE_DIR, 'training_data')
CIP_LOGS_DIR         = os.path.join(BASE_DIR, 'cip_logs')
MODEL_REGISTRY_FILE  = os.path.join(BASE_DIR, 'model_registry.json')
PLANT_CONFIG_FILE    = os.path.join(BASE_DIR, 'config', 'plants_config.json')  # FIX-6

os.makedirs(TRAINING_DATA_DIR, exist_ok=True)
os.makedirs(CIP_LOGS_DIR,      exist_ok=True)

# ── Plant configs — FIX-6: single source of truth, loaded once ───────────────
def load_plant_configs() -> dict:
    if not os.path.exists(PLANT_CONFIG_FILE):
        raise RuntimeError(
            f"Plant config file not found at {PLANT_CONFIG_FILE}. "
            f"Copy plants_config.json into {os.path.dirname(PLANT_CONFIG_FILE)}/ before starting the server."
        )
    with open(PLANT_CONFIG_FILE, 'r') as f:
        raw = json.load(f)
    raw.pop('_readme', None)
    cleaned = {}
    for plant_id, cfg in raw.items():
        missing_calibration = [k for k, v in cfg.items() if v == "_TODO_CALIBRATE"]
        if missing_calibration:
            log.warning(f"[{plant_id}] Missing calibration for: {missing_calibration}. "
                        f"Predictions for this plant will be disabled until these are set.")
        cleaned[plant_id] = cfg
    return cleaned

PLANT_CONFIGS = load_plant_configs()

def get_plant_config_or_404(plant_id: str) -> dict:
    """FIX-5: never silently substitute another client's twin."""
    if plant_id not in PLANT_CONFIGS:
        raise LookupError(f"Unknown plant_id '{plant_id}'. Not present in plants_config.json.")
    cfg = PLANT_CONFIGS[plant_id]
    uncalibrated = [k for k, v in cfg.items() if v == "_TODO_CALIBRATE"]
    if uncalibrated:
        raise LookupError(f"Plant '{plant_id}' is missing calibration values for {uncalibrated}. "
                           f"Cannot serve predictions until plants_config.json is completed for this site.")
    return cfg

# ── Instrument accuracy constants (from hardware spec) ───────────────────────
PRESSURE_ACCURACY_FRAC = 0.0025   # +/- 0.25 % of reading
FLOW_ACCURACY_FRAC     = 0.005    # +/- 0.50 % of reading

# ── Expected upload schema ────────────────────────────────────────────────────
EXPECTED_SCHEMA = {
    'timestamp':        'datetime',
    'flux':             'float',   # LMH — permeate flux
    'tmp':              'float',   # bar — transmembrane pressure
    'temp':             'float',   # C   — feed water temperature
    'ph':               'float',   # pH
    'conductivity':     'float',   # uS/cm — feed conductivity
    'ca_hardness':      'float',   # mg/L as CaCO3
    'alkalinity':       'float',   # mg/L as CaCO3 — FIX-7: now a real input, not derived from pH
    'sdi':              'float',   # Silt Density Index
    'antiscalant_dose': 'float',   # mg/L
    'flow_feed':        'float',   # m3/h
    'flow_permeate':    'float',   # m3/h
    'pressure':         'float',   # bar — HP pump discharge
    'vfd':              'float',   # Hz
    'vfd_current':      'float',   # A — actual VFD current draw
    'pf':               'float',   # Power factor
    'thdV':             'float',   # Voltage THD %
    'thdC':             'float',   # Current THD %
    'opex':             'float',   # Rs/month
    'capex':            'float',   # Rs
}

# Named feature/target layout for the membrane LSTM — replaces the old
# unlabeled 13-column array with magic indices.
MEMBRANE_FEATURES = ['temp', 'lsi', 'antiscalant_dose', 'dsw', 'wash_recovery', 'sdi', 'flux', 'norm_permeability', 'tmp']
MEMBRANE_TARGETS  = ['k_i', 'k_c']
LOOKBACK          = 30
MIN_TRAINING_ROWS = 100  # FIX-10: reduced so jetl_hyderabad (134 rows) can train

# ── In-memory model stores ────────────────────────────────────────────────────
membrane_models   = {}   # plant_id -> ForecastingLSTM
membrane_scalers  = {}   # plant_id -> {'X': scaler, 'y': scaler}
membrane_val_mae  = {}   # plant_id -> float (held-out validation MAE) — FIX-10
energy_models     = {}   # plant_id -> XGBRegressor (eta)
energy_scalers    = {}   # plant_id -> MinMaxScaler
energy_baselines  = {}   # plant_id -> {'hour': {...}}
finance_models    = {}   # plant_id -> {'p10': XGB, 'p50': XGB, 'p90': XGB}
last_known_state  = {}   # plant_id -> dict of last real temp/lsi/antiscalant/sdi — FIX-13
training_done     = False

retrain_state = {
    "status": "idle", "progress": 0, "model_version": None, "error": None,
    "trained_on": [], "fallback_used": True, "epochs_completed": 0,
}

# =============================================================================
# PHYSICS UTILITIES
# =============================================================================

def calc_viscosity_ratio(temp_C: float) -> float:
    return float(np.exp(0.02 * (25.0 - temp_C)))

def normalise_permeability(p_obs: float, temp_C: float) -> float:
    return p_obs * calc_viscosity_ratio(temp_C)

def calc_lsi(temp: float, ph: float, cond: float, ca_hardness: float, alkalinity: float | None) -> float:
    """FIX-7: alkalinity is now a real measured input. Only falls back to the
    old pH-derived estimate (logged as a warning) when truly missing."""
    tds = max(cond * 0.65, 1.0)
    T_K = temp + 273.15
    A = (np.log10(tds) - 1.0) / 10.0
    B = -13.12 * np.log10(T_K) + 34.55
    C = np.log10(max(ca_hardness, 1.0)) - 0.4
    if alkalinity is None or alkalinity <= 0:
        log.warning("alkalinity missing — falling back to rough pH-derived estimate; "
                    "add a real alkalinity reading to the data schema for reliable LSI.")
        alkalinity = max(10 ** (ph - 6.0) * 50, 1.0)
    D = np.log10(max(alkalinity, 1.0))
    ph_sat = (9.3 + A + B) - (C + D)
    return float(ph - ph_sat)

def compute_sec(pressure_bar: float, flow_feed_m3h: float, flow_permeate_m3h: float, eta: float) -> tuple[float, float]:
    """FIX-3: hydraulic power (kW) = Q(m3/h) * dP(bar) / 36, not /3600.
    Real-world RO plants land in the ~0.5-4 kWh/m3 range; the old formula
    was off by ~100x."""
    eta = max(eta, 0.01)
    flow_permeate_m3h = max(flow_permeate_m3h, 0.001)
    sec = (pressure_bar * flow_feed_m3h) / (eta * flow_permeate_m3h * 36.0)
    dSEC_dP  =  flow_feed_m3h / (eta * flow_permeate_m3h * 36.0)
    dSEC_dQf =  pressure_bar  / (eta * flow_permeate_m3h * 36.0)
    dSEC_dQp = -(pressure_bar * flow_feed_m3h) / (eta * flow_permeate_m3h ** 2 * 36.0)
    var_P  = (PRESSURE_ACCURACY_FRAC * pressure_bar)      ** 2
    var_Qf = (FLOW_ACCURACY_FRAC     * flow_feed_m3h)     ** 2
    var_Qp = (FLOW_ACCURACY_FRAC     * flow_permeate_m3h) ** 2
    var_sec = dSEC_dP**2 * var_P + dSEC_dQf**2 * var_Qf + dSEC_dQp**2 * var_Qp
    sec_std = float(np.sqrt(max(var_sec, 0.0)))
    return float(sec), sec_std

def compute_pump_efficiency(pressure_bar: float, flow_feed_m3h: float, flow_permeate_m3h: float,
                             vfd_current_A: float, pf: float, line_voltage_v: float) -> float:
    """FIX-1: real efficiency = hydraulic power / electrical input power,
    instead of a hardcoded 0.85 training target.
    Hydraulic power (kW)  = Q_feed(m3/h) * dP(bar) / 36
    Electrical power (kW) = sqrt(3) * V(line) * I(A) * pf / 1000   (3-phase)
    NOTE: line_voltage_v is an assumed nameplate value from plants_config.json
    (default 415V for Indian 3-phase supply) since raw voltage isn't in the
    sensor schema. Replace with a measured voltage feed if available."""
    hydraulic_kw  = (flow_feed_m3h * pressure_bar) / 36.0
    electrical_kw = (np.sqrt(3) * line_voltage_v * vfd_current_A * max(pf, 0.01)) / 1000.0
    electrical_kw = max(electrical_kw, 0.01)
    eta = hydraulic_kw / electrical_kw
    return float(np.clip(eta, 0.30, 0.95))

def calculate_osmotic_pressure_pitzer(tds_mg_l: float, temp_c: float) -> float:
    """FIX-8: dropped the unused `thermo` import — this empirical high-TDS
    Pitzer-style approximation was the only code path actually running
    anyway. FIX-4: caller now passes the plant's real TDS, not a fixed 55000."""
    T_K = temp_c + 273.15
    molarity = max(tds_mg_l, 0.0) / 1000.0 / 58.44
    phi = 1.0 - 0.392 * np.sqrt(molarity) / (1.0 + 1.2 * np.sqrt(molarity)) + 0.05 * molarity
    osmotic_pressure_bar = phi * 2 * molarity * 0.08314 * T_K
    return float(osmotic_pressure_bar)

def evaluate_cip_scaling_type(tmp_rise_rate: float, flux_decline_rate: float) -> dict:
    """CIP Optimization Engine: classifies fouling type from TMP rise rate
    (bar/day) and flux decline rate (LMH/day, both should be non-negative
    magnitudes — FIX-9: caller now passes the real computed value)."""
    if tmp_rise_rate > 0.2 or flux_decline_rate > 0.5:
        return {"fouling_type": "Organic / Biofouling", "recommended_chemical": "NaOH (Caustic) pH 12",
                "cycle_duration_mins": 60, "confidence": 0.88}
    elif tmp_rise_rate > 0.08 or flux_decline_rate > 0.2:
        return {"fouling_type": "Mixed Fouling", "recommended_chemical": "Alkaline followed by Acid Wash (pH 12 then pH 2)",
                "cycle_duration_mins": 120, "confidence": 0.75}
    else:
        return {"fouling_type": "Inorganic Scaling", "recommended_chemical": "Citric Acid / HCl pH 2",
                "cycle_duration_mins": 45, "confidence": 0.92}

def calculate_risk_matrix(state: dict, tmp_rise_rate: float, flux_decline_rate: float) -> list:
    """Calculates Probability and Impact scores for 5 key RO failure modes."""
    # 1. Fouling (driven by TMP rise and Flux decline)
    p_foul = min(1.0, max(0.1, (tmp_rise_rate / 0.3) * 0.5 + (flux_decline_rate / 0.6) * 0.5))
    i_foul = 0.6
    
    # 2. Scaling (driven by LSI/Alkalinity/Conductivity)
    lsi = state.get('lsi', 0.0)
    cond = state.get('conductivity', 1000.0)
    p_scale = min(1.0, max(0.1, (lsi / 2.0) * 0.6 + (cond / 50000.0) * 0.4))
    i_scale = 0.8
    
    # 3. Pump Wear (driven by VFD frequency/current)
    vfd = state.get('vfd', 45.0)
    p_pump = min(1.0, max(0.1, (vfd - 40.0) / 20.0))
    i_pump = 0.2
    
    # 4. TDS Spike (driven by feed conductivity)
    p_tds = min(1.0, max(0.1, cond / 60000.0))
    i_tds = 0.4
    
    # 5. Membrane Age (driven by days since replacement/wash)
    dsw = state.get('dsw', 0.0)
    p_age = min(1.0, max(0.1, dsw / 365.0))
    i_age = 0.45
    
    return [
        {"mode": "Scaling", "probability": round(p_scale, 2), "impact": i_scale},
        {"mode": "Fouling", "probability": round(p_foul, 2), "impact": i_foul},
        {"mode": "Pump Wear", "probability": round(p_pump, 2), "impact": i_pump},
        {"mode": "TDS Spike", "probability": round(p_tds, 2), "impact": i_tds},
        {"mode": "Membrane Age", "probability": round(p_age, 2), "impact": i_age}
    ]

# =============================================================================
# PYTORCH MODEL DEFINITION
# =============================================================================

class ForecastingLSTM(nn.Module):
    def __init__(self, input_size: int, hidden_size: int = 16, num_layers: int = 1, output_size: int = 2, dropout: float = 0.2):
        super().__init__()
        self.lstm    = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.dropout = nn.Dropout(dropout)
        self.fc      = nn.Linear(hidden_size, output_size)
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(x)
        out    = self.dropout(out[:, -1, :])
        return self.fc(out)

# =============================================================================
# CIP LOG HELPERS — FIX-12: dsw / wash_recovery now come from real CIP events
# =============================================================================

def load_cip_events(plant_id: str) -> list[dict]:
    fpath = os.path.join(CIP_LOGS_DIR, f"{plant_id}_logs.json")
    if not os.path.exists(fpath):
        return []
    with open(fpath, 'r') as f:
        logs = json.load(f)
    events = []
    for entry in logs:
        try:
            d = pd.to_datetime(entry['date'])
            recovery = float(entry.get('recoveryPct', 0)) / 100.0
            events.append({'date': d, 'recovery': recovery if recovery > 0 else 0.95})
        except Exception:
            continue
    events.sort(key=lambda e: e['date'])
    return events

def compute_dsw_and_recovery(timestamps: pd.Series, plant_id: str) -> tuple[np.ndarray, np.ndarray]:
    """For each timestamp, find days-since-last-CIP-wash and the recovery
    fraction achieved at that wash. Falls back to days-since-data-start with
    a default 0.95 recovery when no CIP log exists yet for this plant —
    logged clearly so it's obvious this is a fallback, not real data."""
    events = load_cip_events(plant_id)
    n = len(timestamps)
    dsw = np.zeros(n)
    rec = np.zeros(n)
    if not events:
        log.warning(f"[{plant_id}] No CIP log entries found — dsw falls back to "
                    f"days-since-data-start and wash_recovery defaults to 0.95. "
                    f"Log real CIP events via /api/cip-logs for accurate fouling targets.")
        t0 = timestamps.min()
        for i, ts in enumerate(timestamps):
            dsw[i] = max((ts - t0).total_seconds() / 86400.0, 0.0)
            rec[i] = 0.95
        return dsw, rec
    for i, ts in enumerate(timestamps):
        prior = [e for e in events if e['date'] <= ts]
        if prior:
            last = prior[-1]
            dsw[i] = max((ts - last['date']).total_seconds() / 86400.0, 0.0)
            rec[i] = last['recovery']
        else:
            t0 = timestamps.min()
            dsw[i] = max((ts - t0).total_seconds() / 86400.0, 0.0)
            rec[i] = 0.95
    return dsw, rec

# =============================================================================
# FOULING-RATE TARGET FITTING — FIX-0 (the big one)
# =============================================================================

def fit_hermia_targets(dsw: np.ndarray, norm_perm: np.ndarray, window: int = 20) -> tuple[np.ndarray, np.ndarray]:
    """Replaces the old hardcoded k_i=0.001, k_c=0.00001 constants.
    For each row i >= window, fits the same physics relationship used at
    prediction time — 1/NP(t) = 1/NP(t0) + k_i*t + k_c*t^2 — via least
    squares over the trailing `window` points, and uses the fitted (k_i, k_c)
    as that row's LSTM training target. Rows before `window` reuse the first
    valid fit (can't fit with too little history)."""
    n = len(norm_perm)
    k_i = np.zeros(n)
    k_c = np.zeros(n)
    inv_np = 1.0 / np.clip(norm_perm, 1e-3, None)
    first_valid = None
    for i in range(window, n):
        t_win  = dsw[i - window:i]
        y_win  = inv_np[i - window:i]
        t0, y0 = t_win[0], y_win[0]
        t_rel  = t_win - t0
        y_rel  = y_win - y0
        A = np.column_stack([t_rel, t_rel ** 2])
        try:
            coeffs, *_ = np.linalg.lstsq(A, y_rel, rcond=None)
            ki_fit, kc_fit = coeffs
        except np.linalg.LinAlgError:
            ki_fit, kc_fit = 0.001, 0.00001
        # Physical bounds: fouling only increases resistance over a wash cycle
        ki_fit = float(np.clip(ki_fit, 0.0, 0.5))
        kc_fit = float(np.clip(kc_fit, 0.0, 0.01))
        k_i[i] = ki_fit
        k_c[i] = kc_fit
        if first_valid is None:
            first_valid = (ki_fit, kc_fit)
    if first_valid is not None:
        k_i[:window] = first_valid[0]
        k_c[:window] = first_valid[1]
    else:
        k_i[:] = 0.001
        k_c[:] = 0.00001
    return k_i, k_c

# =============================================================================
# DATA CLEANING — FIX-11
# =============================================================================

def clean_for_training(df: pd.DataFrame, critical_cols: list[str]) -> pd.DataFrame:
    """Forward/back-fill sensor gaps instead of turning them into false
    zeros; drop rows still missing a critical reading afterward and log how
    many were dropped, rather than silently corrupting them to 0."""
    df = df.sort_values('timestamp').copy()
    fillable = [c for c in df.columns if c not in ('timestamp',)]
    df[fillable] = df[fillable].ffill().bfill()
    before = len(df)
    df = df.dropna(subset=[c for c in critical_cols if c in df.columns])
    dropped = before - len(df)
    if dropped:
        log.warning(f"Dropped {dropped}/{before} rows still missing critical columns after fill.")
    return df.reset_index(drop=True)

# =============================================================================
# TRAINING FUNCTIONS
# =============================================================================

def train_membrane_lstm(plant_id: str, features: np.ndarray, targets: np.ndarray) -> None:
    scaler_X = MinMaxScaler()
    scaler_y = MinMaxScaler()
    X_sc     = scaler_X.fit_transform(features)
    y_sc     = scaler_y.fit_transform(targets)

    X, y = [], []
    for i in range(LOOKBACK, len(X_sc)):
        X.append(X_sc[i - LOOKBACK:i])
        y.append(y_sc[i])
    if len(X) < 10:
        log.warning(f"[{plant_id}] Not enough sequences for a meaningful train/val split — skipping.")
        return

    X_arr, y_arr = np.array(X), np.array(y)
    # FIX-10: held-out validation split (last 20%, time-ordered — no shuffle,
    # this is a time series) so we can actually see if the model generalizes.
    split = int(len(X_arr) * 0.8)
    X_train, X_val = X_arr[:split], X_arr[split:]
    y_train, y_val = y_arr[:split], y_arr[split:]

    X_train_t = torch.FloatTensor(X_train)
    y_train_t = torch.FloatTensor(y_train)
    X_val_t   = torch.FloatTensor(X_val)
    y_val_t   = torch.FloatTensor(y_val)

    model     = ForecastingLSTM(input_size=len(MEMBRANE_FEATURES), hidden_size=16, output_size=2, dropout=0.2)
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.005)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=50)

    model.train()
    for epoch in range(50):
        optimizer.zero_grad()
        loss = criterion(model(X_train_t), y_train_t)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        scheduler.step()

    model.eval()
    with torch.no_grad():
        val_pred = model(X_val_t) if len(X_val_t) > 0 else None
        val_mae  = float(torch.mean(torch.abs(val_pred - y_val_t))) if val_pred is not None and len(y_val_t) > 0 else float('nan')

    log.info(f"[{plant_id}] Membrane LSTM trained. Held-out validation MAE (scaled units): {val_mae:.4f}")
    membrane_models[plant_id]  = model
    membrane_scalers[plant_id] = {'X': scaler_X, 'y': scaler_y}
    membrane_val_mae[plant_id] = val_mae

def train_energy_xgboost(plant_id: str, df: pd.DataFrame, cfg: dict) -> None:
    line_v = cfg.get('line_voltage_v', 415)
    eta = df.apply(lambda r: compute_pump_efficiency(
        r['pressure'], r['flow_feed'], r['flow_permeate'], r['vfd_current'], r['pf'], line_v), axis=1)
    X_eta = df[['vfd', 'vfd_current', 'pf']].to_numpy(dtype=float)
    y_eta = eta.to_numpy(dtype=float)  # FIX-1: real computed efficiency, not a hardcoded 0.85

    scaler = MinMaxScaler()
    X_sc   = scaler.fit_transform(X_eta)
    model_eta = xgb.XGBRegressor(n_estimators=200, max_depth=4, learning_rate=0.05,
                                  subsample=0.8, colsample_bytree=0.8, random_state=42)
    model_eta.fit(X_sc, y_eta)
    energy_models[plant_id]  = model_eta
    energy_scalers[plant_id] = scaler

    hours = df['timestamp'].dt.hour
    baselines = {}
    for hr in range(24):
        mask = hours == hr
        grp = df[mask]
        if len(grp) == 0:
            continue
        baselines[int(hr)] = {
            'pf_mean':   float(grp['pf'].mean()),   'pf_std':   float(grp['pf'].std(ddof=0)   or 0.01),
            'thdV_mean': float(grp['thdV'].mean()), 'thdV_std': float(grp['thdV'].std(ddof=0) or 0.01),
            'thdC_mean': float(grp['thdC'].mean()), 'thdC_std': float(grp['thdC'].std(ddof=0) or 0.01),
        }
    energy_baselines[plant_id] = baselines

def train_finance_xgboost(plant_id: str, df: pd.DataFrame, dsw: np.ndarray, norm_perm: np.ndarray, cfg: dict) -> None:
    base_np = cfg['base_np']
    # FIX-2: real fouling_index derived from actual normalized permeability,
    # real days_since_replacement derived from dsw (proxy: time since last
    # CIP event, which is the best signal available without an explicit
    # "membrane replaced on X" log — add one if you want a sharper signal).
    fouling_index = np.clip(1.0 - (norm_perm / max(base_np, 1e-6)), 0.0, 1.0)
    days_since_replacement = dsw

    month_idx = df['timestamp'].dt.month.to_numpy() - 1
    chem_rate = 2.0 + fouling_index * 1.5

    X = np.column_stack([month_idx, fouling_index, days_since_replacement, chem_rate])
    y = df['opex'].to_numpy(dtype=float)

    common = dict(n_estimators=200, max_depth=4, learning_rate=0.05, subsample=0.8,
                  objective='reg:quantileerror', random_state=42)
    m_p10 = xgb.XGBRegressor(**common, quantile_alpha=0.1)
    m_p50 = xgb.XGBRegressor(**common, quantile_alpha=0.5)
    m_p90 = xgb.XGBRegressor(**common, quantile_alpha=0.9)
    m_p10.fit(X, y); m_p50.fit(X, y); m_p90.fit(X, y)
    finance_models[plant_id] = {'p10': m_p10, 'p50': m_p50, 'p90': m_p90}

# =============================================================================
# REAL DATA LOADER
# =============================================================================

COLUMN_ALIASES = {
    'timestamp': ['time', 'date', 'datetime', 'log_time', 'timestamp'],
    'flux': ['permeate flux', 'flux', 'lmh', 'product flux'],
    'tmp': ['transmembrane pressure', 'tmp', 'dp', 'differential pressure'],
    'temp': ['temperature', 'temp', 'water temp', 'feed temp', 't', 'deg c'],
    'ph': ['ph', 'feed ph', 'water ph'],
    'conductivity': ['cond', 'conductivity', 'feed cond', 'feed conductivity', 'us/cm'],
    'ca_hardness': ['ca hardness', 'calcium hardness', 'hardness', 'ca_hard'],
    'alkalinity': ['alkalinity', 'alk', 'm alk', 'm-alkalinity'],
    'sdi': ['sdi', 'silt density index', 'sdi15'],
    'antiscalant_dose': ['antiscalant', 'as dose', 'anti scalant', 'dose', 'antiscalant_dose'],
    'flow_feed': ['feed flow', 'flow in', 'raw water flow', 'flow_feed'],
    'flow_permeate': ['permeate flow', 'product flow', 'flow_permeate'],
    'pressure': ['feed pressure', 'hp pump pressure', 'pressure in', 'pressure'],
    'vfd': ['vfd hz', 'vfd speed', 'vfd freq', 'rpm', 'vfd_rpm', 'vfd'],
    'vfd_current': ['vfd current', 'current amps', 'amps', 'motor amps', 'vfd_current'],
    'pf': ['power factor', 'pf'],
    'thdV': ['voltage thd', 'thdv', 'v thd'],
    'thdC': ['current thd', 'thdc', 'i thd'],
    'opex': ['opex', 'cost', 'operating cost'],
    'capex': ['capex', 'capital cost']
}

def fuzzy_map_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Intelligently map arbitrary Excel columns to the canonical schema using fuzzy/regex aliases."""
    rename_map = {}
    used_canonicals = set()
    for actual_col in df.columns:
        clean_col = str(actual_col).strip().lower()
        for canonical, aliases in COLUMN_ALIASES.items():
            if any(alias in clean_col for alias in aliases):
                if canonical not in used_canonicals:
                    rename_map[actual_col] = canonical
                    used_canonicals.add(canonical)
                break
    df = df.rename(columns=rename_map)
    # Deduplicate any other columns with exactly the same name by keeping the first
    df = df.loc[:, ~df.columns.duplicated()]
    return df

def load_real_data(plant_id: str) -> tuple[pd.DataFrame | None, list[dict]]:
    df_list, meta_list = [], []
    for fname in os.listdir(TRAINING_DATA_DIR):
        if not fname.endswith('.json'):
            continue
        fpath = os.path.join(TRAINING_DATA_DIR, fname)
        try:
            with open(fpath, 'r') as f:
                blob = json.load(f)
            if blob.get('plantId') != plant_id:
                continue
            rows = blob.get('rows', [])
            if not rows:
                continue
            df_list.append(pd.DataFrame(rows))
            meta_list.append({'uuid': fname, 'filename': blob.get('name', fname), 'original_rows': len(rows)})
        except Exception:
            log.exception(f"Failed to parse training file {fname}")
    if not df_list:
        return None, []
    df = pd.concat(df_list, ignore_index=True)
    df = fuzzy_map_columns(df)
    if 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
        df = df.dropna(subset=['timestamp'])
        total = len(df)
        df = df.drop_duplicates(subset=['timestamp']).sort_values('timestamp').reset_index(drop=True)
        if meta_list:
            meta_list[0].update({'rows_used': len(df), 'rows_dropped': total - len(df), 'source': 'real_data'})
    return df, meta_list

# =============================================================================
# MODEL REGISTRY
# =============================================================================

def load_model_registry() -> dict:
    if os.path.exists(MODEL_REGISTRY_FILE):
        with open(MODEL_REGISTRY_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_model_registry(registry: dict) -> None:
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(MODEL_REGISTRY_FILE))
    with os.fdopen(fd, 'w') as f:
        json.dump(registry, f, indent=2)
    shutil.move(tmp, MODEL_REGISTRY_FILE)

model_registry = load_model_registry()

# =============================================================================
# MASTER TRAINING ORCHESTRATOR
# =============================================================================

def _prepare_membrane_features(df: pd.DataFrame, plant_id: str, cfg: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Returns (feature_matrix, k_i_targets, k_c_targets) using the named
    MEMBRANE_FEATURES layout — no more unlabeled magic-index columns."""
    dsw, wash_rec = compute_dsw_and_recovery(df['timestamp'], plant_id)

    temp = df['temp'].to_numpy(dtype=float)
    ph   = df['ph'].to_numpy(dtype=float)
    cond = df['conductivity'].to_numpy(dtype=float)
    ca   = df['ca_hardness'].to_numpy(dtype=float)
    alk  = df['alkalinity'].to_numpy(dtype=float) if 'alkalinity' in df.columns else np.full(len(df), np.nan)
    flux = df['flux'].to_numpy(dtype=float)
    tmp  = df['tmp'].to_numpy(dtype=float)
    sdi  = df['sdi'].to_numpy(dtype=float)
    asc  = df['antiscalant_dose'].to_numpy(dtype=float)

    lsi = np.array([calc_lsi(temp[i], ph[i], cond[i], ca[i], alk[i] if not np.isnan(alk[i]) else None)
                     for i in range(len(df))])

    p_obs = flux / np.clip(tmp, 1e-3, None)
    norm_perm = np.array([normalise_permeability(p_obs[i], temp[i]) for i in range(len(df))])

    features = np.column_stack([temp, lsi, asc, dsw, wash_rec, sdi, flux, norm_perm, tmp])
    k_i, k_c = fit_hermia_targets(dsw, norm_perm)  # FIX-0

    last_known_state[plant_id] = {
        'temp': float(temp[-1]), 'lsi': float(lsi[-1]), 'antiscalant_dose': float(asc[-1]),
        'sdi': float(sdi[-1]), 'dsw': float(dsw[-1]), 'wash_recovery': float(wash_rec[-1]),
        'norm_permeability': float(norm_perm[-1]), 'tmp': float(tmp[-1]),
        'conductivity': float(cond[-1]), 'flux': float(flux[-1]),  # for risk_matrix
    }  # FIX-13: used later to seed forecasts with real values, not magic numbers

    return features, k_i, k_c, dsw, norm_perm

def initialize_all_models() -> dict:
    global training_done
    training_done = False
    trained_on_list = []
    critical_cols = ['flux', 'tmp', 'pressure', 'ph', 'conductivity', 'temp']

    for plant_id, cfg in PLANT_CONFIGS.items():
        if any(v == "_TODO_CALIBRATE" for v in cfg.values()):
            log.info(f"[{plant_id}] Skipping — plants_config.json calibration incomplete.")
            continue

        log.info(f"[{plant_id}] Loading data...")
        df, meta_list = load_real_data(plant_id)
        if df is None or len(df) == 0:
            log.info(f"[{plant_id}] No training data uploaded yet — skipping.")
            continue

        for col in EXPECTED_SCHEMA:
            if col not in df.columns:
                df[col] = np.nan  # FIX-11: NaN, not a silently-wrong 0

        df = clean_for_training(df, critical_cols)
        if len(df) < MIN_TRAINING_ROWS:  # FIX-10
            log.warning(f"[{plant_id}] Only {len(df)} usable rows after cleaning "
                        f"(need >= {MIN_TRAINING_ROWS}) — skipping to avoid an overfit model.")
            continue

        log.info(f"[{plant_id}] Training on {len(df)} usable rows.")
        features, k_i, k_c, dsw, norm_perm = _prepare_membrane_features(df, plant_id, cfg)
        targets = np.column_stack([k_i, k_c])

        train_membrane_lstm(plant_id, features, targets)
        train_energy_xgboost(plant_id, df, cfg)
        train_finance_xgboost(plant_id, df, dsw, norm_perm, cfg)

        for m in meta_list:
            trained_on_list.append({
                'filename': m.get('filename'), 'uuid': m.get('uuid'),
                'rows_used': m.get('rows_used', m.get('original_rows')),
                'rows_dropped': m.get('rows_dropped', 0), 'source': 'real_data',
            })

    training_done = True
    log.info("All eligible plants trained.")
    return {'trained_on': trained_on_list, 'fallback_used': len(trained_on_list) == 0}

# =============================================================================
# FORECAST HELPERS
# =============================================================================

def _run_membrane_forecast(plant_id: str, cfg: dict, forecast_days: int, mc_samples: int = 50):
    """Shared MC-dropout forecast loop used by both /predict-membrane and
    /predict-finances so the two endpoints can never silently disagree.
    FIX-13: seeds the recursive forecast with the plant's real last-known
    temp/lsi/antiscalant/sdi instead of hardcoded magic numbers."""
    model    = membrane_models[plant_id]
    scaler_X = membrane_scalers[plant_id]['X']
    scaler_y = membrane_scalers[plant_id]['y']
    state    = last_known_state[plant_id]

    base_np    = cfg['base_np']
    base_np_aw = base_np * state['wash_recovery']
    Z95        = 1.96

    # Rebuild a LOOKBACK-length window purely from the last known real state
    # (constant-carried-forward — a genuine "next N days if nothing about
    # feed chemistry changes" scenario, clearly labeled as such downstream).
    row = np.array([state['temp'], state['lsi'], state['antiscalant_dose'], state['dsw'],
                     state['wash_recovery'], state['sdi'], state['norm_permeability'] * state['tmp'],
                     state['norm_permeability'], state['tmp']])
    feat_win = np.tile(row, (LOOKBACK, 1))

    model.train()  # intentional: MC Dropout needs dropout active at inference
    mc_preds = []
    with torch.no_grad():
        for _ in range(mc_samples):
            win = scaler_X.transform(feat_win)
            dsw = state['dsw']
            running_inv = 1.0 / max(state['norm_permeability'], 1e-3)
            traj = []
            for _day in range(forecast_days):
                x_t   = torch.FloatTensor(win).unsqueeze(0)
                rates = scaler_y.inverse_transform([model(x_t).numpy()[0]])[0]
                k_i, k_c = float(rates[0]), float(rates[1])
                dsw += 1
                running_inv += (k_i + k_c)
                cur_np  = max(cfg['np_hard_floor'] * base_np, 1.0 / running_inv)
                target_flux = state['norm_permeability'] * state['tmp']
                cur_tmp = target_flux / max(cur_np, 1e-3)
                cur_flux = target_flux
                traj.append([cur_np, cur_tmp])
                new_row = [state['temp'], state['lsi'], state['antiscalant_dose'], dsw,
                           state['wash_recovery'], state['sdi'], cur_flux, cur_np, cur_tmp]
                win = np.vstack((win[1:], scaler_X.transform([new_row])[0]))
            mc_preds.append(traj)
    model.eval()

    mc_arr = np.array(mc_preds)
    return np.mean(mc_arr, axis=0), np.std(mc_arr, axis=0), Z95

# =============================================================================
# PREDICTION ENDPOINTS
# =============================================================================

@app.route('/api/predict-membrane', methods=['GET'])
def predict_membrane():
    if not training_done:
        return jsonify({"error": "Models not yet trained"}), 503
    plant_id = request.args.get('plantId')
    try:
        cfg = get_plant_config_or_404(plant_id)  # FIX-5
        if plant_id not in membrane_models:
            return jsonify({"error": f"No trained model for '{plant_id}' yet — upload training data first."}), 404
    except LookupError as e:
        return jsonify({"error": str(e)}), 404

    FORECAST_DAYS = 30
    mean_arr, std_arr, Z95 = _run_membrane_forecast(plant_id, cfg, FORECAST_DAYS)
    state = last_known_state[plant_id]

    now = datetime.now()
    out = []
    for i in range(FORECAST_DAYS):
        d      = now + timedelta(days=i + 1)
        pm, ps = float(mean_arr[i, 0]), float(std_arr[i, 0])
        dm, ds = float(mean_arr[i, 1]), float(std_arr[i, 1])
        out.append({
            "date": d.strftime('%Y-%m-%d'),
            "permeability": round(pm, 3), "permeability_lower": round(max(0.1, pm - Z95 * ps), 3),
            "permeability_upper": round(pm + Z95 * ps, 3),
            "dp": round(dm, 3), "dp_lower": round(max(0.0, dm - Z95 * ds), 3), "dp_upper": round(dm + Z95 * ds, 3),
            "saltPassage": round(0.5 + dm * 0.2, 2), "isProjection": True,
        })

    first_np, last_np = float(mean_arr[0, 0]), float(mean_arr[-1, 0])
    flux_decline_rate  = max((first_np - last_np) / max(FORECAST_DAYS, 1), 0.0)  # FIX-9: real, not 0.0
    first_dp, last_dp  = float(mean_arr[0, 1]), float(mean_arr[-1, 1])
    tmp_rise_rate       = (last_dp - first_dp) / max(FORECAST_DAYS, 1)

    cip_trigger = cfg['cip_tmp_trigger'] * cfg['base_tmp']
    days_to_cip = next((idx + 1 for idx, (_, dp) in enumerate(mean_arr) if dp >= cip_trigger), None)
    cip_analysis = evaluate_cip_scaling_type(tmp_rise_rate, flux_decline_rate)

    current_tds = state.get('conductivity', 0.0) * 0.65 if 'conductivity' in state else None
    # FIX-4: derive from the plant's actual latest conductivity reading, stored via last_known_state
    if current_tds is None or current_tds <= 0:
        current_tds = 0.0
        log.warning(f"[{plant_id}] No recent conductivity available for osmotic pressure calc.")
    osmotic_pressure = calculate_osmotic_pressure_pitzer(current_tds, state['temp'])
    
    risk_matrix = calculate_risk_matrix(state, tmp_rise_rate, flux_decline_rate)

    return jsonify({
        "trajectory": out,
        "cip_forecast": {"days_to_cip": days_to_cip, "tmp_rise_rate": round(tmp_rise_rate, 4),
                          "fouling_analysis": cip_analysis},
        "osmotic_pressure_bar": round(osmotic_pressure, 2),
        "validation_mae": membrane_val_mae.get(plant_id),
        "risk_matrix": risk_matrix
    })

@app.route('/api/predict-energy', methods=['GET'])
def predict_energy():
    if not training_done:
        return jsonify({"error": "Models not yet trained"}), 503
    plant_id = request.args.get('plantId')
    try:
        cfg = get_plant_config_or_404(plant_id)  # FIX-5
        if plant_id not in energy_models:
            return jsonify({"error": f"No trained model for '{plant_id}' yet."}), 404
    except LookupError as e:
        return jsonify({"error": str(e)}), 404

    model     = energy_models[plant_id]
    scaler    = energy_scalers[plant_id]
    baselines = energy_baselines.get(plant_id, {})
    state     = last_known_state.get(plant_id, {})
    FORECAST_HOURS = 24
    Z95 = 1.96
    out = []
    for i in range(FORECAST_HOURS):
        hour = (datetime.now().hour + i) % 24
        bl = baselines.get(hour, {})
        vfd          = 45.0 + (i % 5)
        vfd_current  = vfd * 2.5 * 1.05  # placeholder projection until live VFD current feed is wired in
        pf_mean      = bl.get('pf_mean', 0.95)
        x_in         = scaler.transform([[vfd, vfd_current, pf_mean]])
        predicted_eta = float(np.clip(model.predict(x_in)[0], 0.30, 0.95))

        flow_feed     = state.get('flow_feed', 50.0)
        flow_permeate = state.get('flow_permeate', 37.5)
        pressure      = state.get('pressure', 12.0)
        sec_mean, sec_std = compute_sec(pressure, flow_feed, flow_permeate, predicted_eta)

        pf_std    = bl.get('pf_std', 0.01)
        thdV_mean, thdV_std = bl.get('thdV_mean', 3.0), bl.get('thdV_std', 0.3)
        thdC_mean, thdC_std = bl.get('thdC_mean', 5.0), bl.get('thdC_std', 0.5)
        out.append({
            "hour": f"+{i + 1}h",
            "pf": round(pf_mean, 3), "pf_lower": round(max(0.0, pf_mean - 2 * pf_std), 3),
            "pf_upper": round(min(1.0, pf_mean + 2 * pf_std), 3),
            "thd_v": round(thdV_mean, 2), "thd_v_lower": round(max(0.0, thdV_mean - 2 * thdV_std), 2),
            "thd_v_upper": round(thdV_mean + 2 * thdV_std, 2),
            "thd_c": round(thdC_mean, 2), "thd_c_lower": round(max(0.0, thdC_mean - 2 * thdC_std), 2),
            "thd_c_upper": round(thdC_mean + 2 * thdC_std, 2),
            "sec": round(sec_mean, 4), "sec_lower": round(max(0.0, sec_mean - Z95 * sec_std), 4),
            "sec_upper": round(sec_mean + Z95 * sec_std, 4),
            "pump_efficiency": round(predicted_eta * 100, 1),
            "anomaly_detected": bool(predicted_eta < 0.70),
        })
    return jsonify(out)

@app.route('/api/predict-finances', methods=['GET'])
def predict_finances():
    if not training_done:
        return jsonify({"error": "Models not yet trained"}), 503
    plant_id = request.args.get('plantId')
    try:
        cfg = get_plant_config_or_404(plant_id)  # FIX-5
        if plant_id not in finance_models or plant_id not in membrane_models:
            return jsonify({"error": f"No trained model for '{plant_id}' yet."}), 404
    except LookupError as e:
        return jsonify({"error": str(e)}), 404

    cip_cost = cfg['cip_cost_inr']
    fin_models = finance_models[plant_id]
    FORECAST_MONTHS = 6
    FORECAST_DAYS   = 30 * FORECAST_MONTHS

    mean_arr, _, _ = _run_membrane_forecast(plant_id, cfg, FORECAST_DAYS)
    base_np = cfg['base_np']
    cip_trigger_tmp = cfg['base_tmp'] * cfg['cip_tmp_trigger']
    cip_trigger_np  = base_np * cfg['cip_np_trigger']
    cip_days = [i for i, (npv, dp) in enumerate(mean_arr) if dp > cip_trigger_tmp or npv < cip_trigger_np]

    now = datetime.now()
    out = []
    for i in range(FORECAST_MONTHS):
        d = now + timedelta(days=30 * (i + 1))
        month_idx = d.month - 1
        state = last_known_state[plant_id]
        fouling_index = float(np.clip(1.0 - (mean_arr[min(i * 30, len(mean_arr) - 1), 0] / max(base_np, 1e-6)), 0.0, 1.0))
        days_since_replacement = state['dsw'] + i * 30
        chem_rate = 2.0 + fouling_index * 1.5

        x_in = np.array([[month_idx, fouling_index, days_since_replacement, chem_rate]])
        p10, p50, p90 = (float(fin_models[q].predict(x_in)[0]) for q in ('p10', 'p50', 'p90'))

        m_start, m_end = i * 30, (i + 1) * 30
        cips = sum(1 for dday in cip_days if m_start <= dday < m_end)
        inj  = cips * cip_cost
        capex = 0.0  # populate from a real capex schedule / asset register, not a hardcoded month-0 spike

        out.append({
            "month": d.strftime('%b %Y'),
            "opex": round(p50 + inj, 0), "opex_lower": round(p10 + inj, 0), "opex_upper": round(p90 + inj, 0),
            "capex": round(capex, 0), "cip_events": cips, "cip_cost_injected": round(inj, 0),
            "isProjection": True,
        })
    return jsonify(out)

# =============================================================================
# DATA MANAGEMENT ENDPOINTS
# =============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "online", "service": "ml_engine", "training_done": training_done}), 200

@app.route('/api/training-data/upload', methods=['POST'])
def upload_training_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400
    plant_id = request.form.get('plantId')
    if plant_id not in PLANT_CONFIGS:
        return jsonify({'error': f"Unknown plantId '{plant_id}' — add it to plants_config.json first."}), 400
    try:
        fname = file.filename.lower()
        if fname.endswith('.csv'):
            df = pd.read_csv(file)
        elif fname.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(file)
        else:
            return jsonify({'error': 'Unsupported format — use .csv, .xls, or .xlsx'}), 400

        cols_found   = list(df.columns)
        missing_cols = [c for c in EXPECTED_SCHEMA if c not in cols_found]
        # FIX-11: no more fillna(0) on raw storage — keep gaps as real nulls,
        # cleaning happens only at training time in clean_for_training().
        df = df.where(pd.notnull(df), None)

        dataset_id = str(uuid.uuid4()) + '.json'
        fpath      = os.path.join(TRAINING_DATA_DIR, dataset_id)
        payload    = {'name': secure_filename(file.filename), 'plantId': plant_id, 'rows': df.to_dict('records')}
        with open(fpath, 'w') as f:
            json.dump(payload, f)
        return jsonify({'id': dataset_id, 'name': file.filename, 'rows': len(df),
                         'columns': cols_found, 'missing_columns': missing_cols})
    except Exception as e:
        log.exception("Upload parse error")
        return jsonify({'error': f'Parse error: {str(e)}'}), 500

@app.route('/api/training-data/upload-json', methods=['POST'])
def upload_training_json():
    data = request.json
    if not data or 'rows' not in data:
        return jsonify({'error': 'No rows provided'}), 400
    plant_id = data.get('plantId')
    if plant_id not in PLANT_CONFIGS:
        return jsonify({'error': f"Unknown plantId '{plant_id}'"}), 400
    try:
        df = pd.DataFrame(data['rows'])
        df = fuzzy_map_columns(df)
        cols_found = list(df.columns)
        missing_cols = [c for c in EXPECTED_SCHEMA if c not in cols_found]
        df = df.where(pd.notnull(df), None)
        
        filename = data.get('fileName', 'uploaded_file.json')
        dataset_id = str(uuid.uuid4()) + '.json'
        fpath = os.path.join(TRAINING_DATA_DIR, dataset_id)
        payload = {'name': secure_filename(filename), 'plantId': plant_id, 'rows': df.to_dict('records')}
        with open(fpath, 'w') as f:
            json.dump(payload, f)
        return jsonify({'id': dataset_id, 'name': filename, 'rows': len(df),
                        'columns': cols_found, 'missing_columns': missing_cols})
    except Exception as e:
        log.exception("JSON Upload error")
        return jsonify({'error': f'JSON Parse error: {str(e)}'}), 500

@app.route('/api/training-datasets', methods=['GET'])
def get_training_datasets():
    datasets = []
    for fname in os.listdir(TRAINING_DATA_DIR):
        if not fname.endswith('.json'):
            continue
        fpath = os.path.join(TRAINING_DATA_DIR, fname)
        stat  = os.stat(fpath)
        try:
            with open(fpath, 'r') as f:
                blob = json.load(f)
            rows, plant_id, name = len(blob.get('rows', [])), blob.get('plantId', 'unknown'), blob.get('name', fname)
        except Exception:
            rows, plant_id, name = 0, 'unknown', fname
        datasets.append({'id': fname, 'name': name, 'plantId': plant_id, 'rows': rows,
                          'used_in': model_registry.get(fname, []),
                          'dateAdded': datetime.fromtimestamp(stat.st_ctime).isoformat()})
    return jsonify(datasets)

@app.route('/api/dataset/<dataset_id>', methods=['DELETE'])
def delete_dataset(dataset_id):
    fpath = os.path.join(TRAINING_DATA_DIR, dataset_id)
    if os.path.exists(fpath):
        os.remove(fpath)
        return jsonify({'status': 'success'})
    return jsonify({'error': 'Not found'}), 404

# =============================================================================
# RETRAIN ENDPOINTS
# =============================================================================

@app.route('/api/retrain/status', methods=['GET'])
def get_retrain_status():
    return jsonify(retrain_state)

@app.route('/api/retrain', methods=['POST'])
def trigger_retrain():
    global training_done
    training_done = False
    def retrain_task():
        global retrain_state, model_registry
        retrain_state.update({"status": "running", "progress": 0, "error": None})
        try:
            retrain_state["progress"] = 10
            time.sleep(0.5)
            report = initialize_all_models()
            retrain_state["progress"] = 85
            version  = "v" + datetime.now().strftime("%y.%m.%d")
            registry = load_model_registry()
            for fname in os.listdir(TRAINING_DATA_DIR):
                if fname.endswith('.json'):
                    registry.setdefault(fname, [])
                    if version not in registry[fname]:
                        registry[fname].append(version)
            save_model_registry(registry)
            model_registry = registry
            retrain_state.update({"status": "complete", "progress": 100, "model_version": version,
                                   "trained_on": report["trained_on"], "fallback_used": report["fallback_used"],
                                   "epochs_completed": 50})
        except Exception as e:
            retrain_state.update({"status": "failed", "error": str(e)})
            log.error(traceback.format_exc())
    threading.Thread(target=retrain_task, daemon=True).start()
    return jsonify({'status': 'success', 'message': 'Retraining started in background'})

# =============================================================================
# CIP LOG ENDPOINTS
# =============================================================================

@app.route('/api/cip-logs', methods=['GET'])
def get_cip_logs():
    plant_id = request.args.get('plantId')
    if plant_id not in PLANT_CONFIGS:
        return jsonify({'error': f"Unknown plantId '{plant_id}'"}), 404
    fpath = os.path.join(CIP_LOGS_DIR, f"{plant_id}_logs.json")
    if os.path.exists(fpath):
        with open(fpath, 'r') as f:
            return jsonify(json.load(f))
    return jsonify([])

@app.route('/api/cip-logs', methods=['POST'])
def save_cip_log():
    data = request.json
    plant_id = data.get('plantId')
    if plant_id not in PLANT_CONFIGS:
        return jsonify({'error': f"Unknown plantId '{plant_id}'"}), 404
    fpath = os.path.join(CIP_LOGS_DIR, f"{plant_id}_logs.json")
    logs = []
    if os.path.exists(fpath):
        with open(fpath, 'r') as f:
            logs = json.load(f)
    tmp_before   = float(data.get('tmpBefore', 0))
    tmp_after    = float(data.get('tmpAfter', 0))
    recovery_pct = ((tmp_before - tmp_after) / tmp_before * 100) if tmp_before > 0 else 0
    new_log = {
        'id': f"CIP-{int(time.time())}", 'date': data.get('date'), 'stage': data.get('stage'),
        'type': data.get('chemicalName'), 'concentration': data.get('concentration'),
        'duration': data.get('soakDuration'), 'tmpBefore': tmp_before, 'tmpAfter': tmp_after,
        'recoveryPct': round(recovery_pct, 1), 'reason': data.get('reason'),
        'cost': float(data.get('cost', 15000)), 'status': 'Completed',
        'perf': data.get('performedBy', 'Operator'), 'app': data.get('approvedBy', 'Manager'),
    }
    logs.append(new_log)
    with open(fpath, 'w') as f:
        json.dump(logs, f, indent=2)
    return jsonify({'status': 'success', 'log': new_log})

# =============================================================================
# ENTRY POINT
# =============================================================================
if __name__ == '__main__':
    log.info("Starting Permasense Digital Twin ML Server v2.1...")
    initialize_all_models()
    app.run(port=5000, debug=True, use_reloader=False)
