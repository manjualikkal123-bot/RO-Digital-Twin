import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Database, Trash2, RefreshCw, Layers, Upload, FileText, CheckCircle2, AlertTriangle,
  Download, Copy, ChevronDown, ChevronRight, Loader2, BarChart3, Search, Radio, Target,
  Play, Plus, Info, Server
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ScatterChart, Scatter, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import SmartUploader from '../components/SmartUploader';

// Prediction targets the backend regression models are trained against.
const PREDICTION_TARGETS = [
  { key: 'tmp_bar', label: 'TMP (bar)' },
  { key: 'flux_lmh', label: 'Flux (LMH)' },
  { key: 'recovery_rate', label: 'Recovery Rate' },
  { key: 'sec', label: 'SEC (kWh/m³)' },
];

const ModelTuning = () => {
  const { selectedFacility } = useAppStore();

  const [datasets, setDatasets] = useState([]);
  const [isRetraining, setIsRetraining] = useState(false);
  const [retrainStatus, setRetrainStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const [uploadState, setUploadState] = useState('idle'); // idle, uploading, parsing, ready, error
  const [uploadError, setUploadError] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isSchemaExpanded, setIsSchemaExpanded] = useState(false);
  const [targetPlant, setTargetPlant] = useState(selectedFacility || 'jetl_hyderabad');

  // ── AI Model Performance & Explainability state ────────────────────────────
  const [selectedTarget, setSelectedTarget] = useState('tmp_bar');
  const [perf, setPerf] = useState(null);
  const [perfLoading, setPerfLoading] = useState(true);
  const [perfError, setPerfError] = useState('');

  const [shap, setShap] = useState(null);
  const [shapLoading, setShapLoading] = useState(true);

  const [anomalies, setAnomalies] = useState(null);
  const [anomLoading, setAnomLoading] = useState(true);

  const [featureImportance, setFeatureImportance] = useState(null);
  const [fiLoading, setFiLoading] = useState(true);

  const fetchModelPerformance = async (plantId, target) => {
    setPerfLoading(true);
    setPerfError('');
    try {
      const res = await fetch(`/api/model-performance?plant=${plantId}&target=${target}`);
      if (res.ok) {
        const data = await res.json();
        setPerf(data);
      } else if (res.status === 404) {
        setPerf(null);
        setPerfError('No trained model found for this target yet. Upload data and retrain.');
      } else {
        setPerfError(`Backend Error: ${res.status} ${res.statusText}`);
      }
    } catch (e) {
      setPerfError('ML Engine unreachable. Is the Python backend running?');
    } finally {
      setPerfLoading(false);
    }
  };

  const fetchShap = async (plantId, target) => {
    setShapLoading(true);
    try {
      const res = await fetch(`/api/model-shap?plant=${plantId}&target=${target}`);
      if (res.ok) setShap(await res.json());
      else setShap(null);
    } catch (e) {
      setShap(null);
    } finally {
      setShapLoading(false);
    }
  };

  const fetchAnomalies = async (plantId, target) => {
    setAnomLoading(true);
    try {
      const res = await fetch(`/api/anomalies?plant=${plantId}&target=${target}`);
      if (res.ok) setAnomalies(await res.json());
      else setAnomalies(null);
    } catch (e) {
      setAnomalies(null);
    } finally {
      setAnomLoading(false);
    }
  };

  const fetchFeatureImportance = async (plantId, target) => {
    setFiLoading(true);
    try {
      const res = await fetch(`/api/feature-importance?plant=${plantId}&target=${target}`);
      if (res.ok) setFeatureImportance(await res.json());
      else setFeatureImportance(null);
    } catch (e) {
      setFeatureImportance(null);
    } finally {
      setFiLoading(false);
    }
  };

  useEffect(() => {
    const plantId = selectedFacility || targetPlant;
    fetchModelPerformance(plantId, selectedTarget);
    fetchShap(plantId, selectedTarget);
    fetchAnomalies(plantId, selectedTarget);
    fetchFeatureImportance(plantId, selectedTarget);
  }, [selectedFacility, targetPlant, selectedTarget, retrainStatus?.status]);

  const fetchDatasets = async () => {
    try {
      const res = await fetch('/api/training-datasets');
      if (res.ok) setDatasets(await res.json());
    } catch (e) {
      console.error(e);
      toast.error('Failed to fetch datasets. Check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRetrainStatus = async () => {
    try {
      const res = await fetch('/api/retrain/status');
      if (res.ok) {
        const data = await res.json();
        setRetrainStatus(data);
        if (data.status === 'running') {
          setIsRetraining(true);
        } else {
          if (isRetraining && data.status === 'complete') {
            toast.success('Retraining complete!', { duration: 5000 });
            fetchDatasets();
          }
          setIsRetraining(false);
        }
      } else {
        // If the endpoint exists but fails
        setRetrainStatus({ status: 'failed', error: `Server Error ${res.status}` });
        setIsRetraining(false);
      }
    } catch (e) {
      setRetrainStatus({ status: 'failed', error: 'ML Engine unreachable.' });
      setIsRetraining(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  useEffect(() => {
    fetchRetrainStatus();
    const interval = setInterval(fetchRetrainStatus, 3000);
    return () => clearInterval(interval);
  }, [isRetraining]);

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/dataset/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Dataset deleted');
        fetchDatasets();
      } else {
        toast.error('Failed to delete dataset');
      }
    } catch (e) {
      toast.error('Error deleting dataset');
    }
  };

  const handleRetrain = async () => {
    setIsRetraining(true);
    setRetrainStatus({ status: 'running', progress: 0 });

    try {
      const res = await fetch('/api/retrain', { method: 'POST' });
      if (res.ok) {
        toast.success('Model retraining started in the background!', { duration: 3000 });
      } else {
        // Deep error extraction
        let errorMsg = res.statusText;
        try {
          const errData = await res.json();
          errorMsg = errData.error || errorMsg;
        } catch (parseErr) { }

        toast.error(`ML Retrain Failed: ${errorMsg}`);
        setRetrainStatus({ status: 'failed', error: errorMsg });
        setIsRetraining(false);
      }
    } catch (e) {
      toast.error('Network Error: Could not connect to ML Engine.');
      setRetrainStatus({ status: 'failed', error: 'Network Error: Server offline or blocking request.' });
      setIsRetraining(false);
    }
  };

  const handleUploadComplete = async (rows, fileName) => {
    setUploadState('parsing');
    setUploadedFileName(fileName);
    setUploadError('');

    console.log("SENDING TO BACKEND:", { rows_count: rows.length });

    try {
      const token = localStorage.getItem('dt_token');
      const res = await fetch('/api/training-data/upload-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ plantId: targetPlant, data: { rows, fileName, plantId: targetPlant } })
      });
      const data = await res.json();

      if (res.ok) {
        setUploadState('ready');
        toast.success(`${fileName} uploaded successfully!`);
        fetchDatasets();

        // Auto-trigger model retraining with the new data
        setTimeout(() => {
          handleRetrain();
          setUploadState('idle');
          fetchDatasets();
        }, 3000);
      } else {
        const errMsg = data.error || 'Server rejected the file.';
        setUploadError(errMsg);
        toast.error(`Upload Failed: ${errMsg}`);
        setUploadState('error');
      }
    } catch (e) {
      setUploadError('Network error. Is the backend server running?');
      toast.error('Network Error during upload.');
      setUploadState('error');
    }
  };

  const downloadTemplate = () => {
    const headers = "timestamp,flux,tmp,pf,thdV,thdC,sec,opex,capex\n";
    const blob = new Blob([headers], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'training_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col shrink-0 relative bg-theme-panel p-6 text-theme-text rounded-xl min-h-full shadow-xl">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-medium text-theme-text tracking-tight flex items-center gap-3">
            <Layers className="text-cyan-700 dark:text-cyan-500" size={28} />
            Model Training Data
          </h1>
          <p className="text-theme-muted text-sm mt-1">Manage historical datasets used for training the Digital Twin ML models.</p>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="bg-theme-panel border border-theme-border rounded-xl mb-6 flex flex-col shrink-0 overflow-hidden">
        <div className="flex justify-between items-center bg-black/20 px-4 py-2 border-b border-theme-border">
          <span className="text-xs font-bold text-theme-muted uppercase tracking-wider">Data Source Configuration</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-theme-muted font-medium">Target plant for this dataset:</span>
            <select
              value={targetPlant}
              onChange={(e) => setTargetPlant(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800 border border-theme-border text-theme-text text-xs rounded-md px-2 py-1 outline-none focus:border-cyan-500"
            >
              <option value="jetl_hyderabad">JETL Hyderabad</option>
              <option value="waaree_chikhli">Waaree Chikhli</option>
              <option value="nia_nandesari">NIA Nandesari</option>
            </select>
          </div>
        </div>

        <div className="p-4">
          {uploadState === 'error' && (
            <div className="mb-4 p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg flex items-center gap-3 text-sm font-medium">
              <AlertTriangle size={18} className="shrink-0" />
              <div>
                <p>Data Ingestion Failed</p>
                <p className="text-xs opacity-80 mt-0.5">{uploadError}</p>
              </div>
            </div>
          )}

          {uploadState === 'idle' || uploadState === 'error' ? (
            <SmartUploader onUploadComplete={handleUploadComplete} plantId={targetPlant} />
          ) : uploadState === 'ready' ? (
            <div className="p-8 m-4 border border-emerald-500/30 bg-emerald-900/10 rounded-xl flex flex-col items-center justify-center">
              <CheckCircle2 size={48} className="text-emerald-700 dark:text-emerald-500 mb-3" />
              <h3 className="text-lg font-bold text-theme-text">Dataset Ready</h3>
              <p className="text-sm text-emerald-700 dark:text-emerald-400">{uploadedFileName} successfully parsed and added.</p>
              <p className="text-xs text-theme-muted mt-4">Resetting for next file...</p>
            </div>
          ) : (
            <div className="p-8 m-4 border border-theme-border bg-theme-panel rounded-xl flex flex-col items-center justify-center">
              <Loader2 size={40} className="text-cyan-700 dark:text-cyan-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-theme-text mb-2">Saving to database...</h3>
              <p className="text-sm text-theme-muted">{uploadedFileName}</p>
            </div>
          )}
        </div>

        {/* Expected Schema Section */}
        <div className="border-t border-theme-border bg-theme-panel">
          <button
            onClick={() => setIsSchemaExpanded(!isSchemaExpanded)}
            className="w-full px-6 py-3 flex items-center justify-between hover:bg-slate-100 dark:bg-slate-80050 transition-colors"
          >
            <span className="font-bold text-sm text-theme-text flex items-center gap-2">
              <FileText size={16} className="text-theme-muted" />
              Expected schema
            </span>
            <ChevronDown size={16} className={`text-theme-muted transition-transform ${isSchemaExpanded ? 'rotate-180' : ''}`} />
          </button>
          {isSchemaExpanded && (
            <div className="px-6 pb-6 pt-2">
              <div className="bg-theme-panel rounded-lg border border-theme-border p-4">
                <p className="text-xs text-theme-muted mb-4">Ensure your CSV contains the following exact column headers to be parsed properly. Missing columns will be filled with zeros.</p>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {['timestamp', 'flux', 'tmp', 'pf', 'thdV', 'thdC', 'sec', 'opex', 'capex'].map(col => (
                    <div key={col} className="bg-slate-100 dark:bg-slate-80050 border border-theme-border px-3 py-1.5 rounded flex items-center justify-between">
                      <span className="text-xs font-mono text-cyan-700 dark:text-cyan-400">{col}</span>
                      <span className="text-[10px] text-theme-muted uppercase">{col === 'timestamp' ? 'datetime' : 'float'}</span>
                    </div>
                  ))}
                </div>
                <button onClick={downloadTemplate} className="flex items-center gap-2 text-xs font-bold text-theme-text bg-slate-100 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 transition-colors">
                  <Download size={14} /> Download template CSV
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex justify-end mb-4 shrink-0">
        <div className="flex flex-col items-end">
          <button
            onClick={handleRetrain}
            disabled={isRetraining}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-lg disabled:opacity-50 ${datasets.some(ds => ds.rows >= 30) ? 'bg-[#185FA5] hover:bg-[#124b85] text-theme-text border-none' : 'bg-transparent text-theme-text hover:text-theme-text border border-theme-border hover:border-slate-500'}`}
          >
            <RefreshCw size={16} className={isRetraining ? 'animate-spin' : ''} />
            {isRetraining ? 'Retraining...' : 'Retrain Models'}
          </button>

          {retrainStatus && retrainStatus.status === 'running' ? (
            <div className="mt-2 text-xs text-indigo-300 flex flex-col items-end min-w-[400px]">
              <div className="flex items-center justify-end gap-1.5 font-medium mb-1 whitespace-nowrap">
                <Loader2 size={12} className="animate-spin shrink-0" />
                Retraining in progress — estimated 1 min remaining. Do not close this tab.
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${retrainStatus.progress}%` }}></div>
              </div>
            </div>
          ) : retrainStatus && retrainStatus.status === 'failed' ? (
            <div className="mt-2 text-xs text-rose-700 dark:text-rose-400 flex items-center justify-end gap-1.5 font-medium">
              <AlertTriangle size={12} />
              {retrainStatus.error}
            </div>
          ) : (
            <div className="mt-2 text-xs flex flex-col items-end">
              <div className="mt-2 text-[12px] text-theme-muted flex items-center justify-end gap-1.5 font-medium">
                Last retrained: {retrainStatus?.status === 'complete' ? new Date().toLocaleString() + ' — ' + retrainStatus.model_version + ' deployed' : '— No retrain history'}
              </div>
              {retrainStatus?.status === 'complete' && retrainStatus.trained_on && (
                <div className={`mt-2 text-[12px] flex items-center gap-2 px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-80050 border ${retrainStatus.fallback_used ? 'border-amber-500/50 text-amber-700 dark:text-amber-400' : 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400'}`}>
                  <Database size={12} className="shrink-0" />
                  {retrainStatus.fallback_used ? (
                    <span>Warning: no real dataset was found — model was trained on synthetic data.</span>
                  ) : (
                    <span>
                      Trained on {retrainStatus.trained_on.reduce((sum, t) => sum + t.rows_used, 0)} rows from {retrainStatus.trained_on.map(t => t.filename).join(', ')} · {retrainStatus.trained_on.reduce((sum, t) => sum + t.rows_dropped, 0)} rows dropped (duplicate timestamps)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-theme-panel border border-theme-border rounded-xl overflow-hidden flex flex-col shrink-0 h-auto">
        <div className="px-6 py-4 border-b border-theme-border bg-theme-panel flex justify-between items-center">
          <h2 className="font-bold text-theme-text flex items-center gap-2">
            <Database size={18} className="text-emerald-700 dark:text-emerald-500" />
            Active datasets
          </h2>
          <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-theme-muted px-2 py-1 rounded">
            {datasets.length} Total
          </span>
        </div>

        <div className="overflow-auto h-auto">
          {loading ? (
            <div className="flex justify-center items-center h-40 text-theme-muted">Loading datasets...</div>
          ) : datasets.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-40 text-theme-muted border border-dashed border-theme-border rounded-xl m-6">
              <Database size={32} className="mb-2 opacity-50 text-theme-muted" />
              <p>No active datasets found.</p>
              <p className="text-xs mt-1 text-theme-muted">Upload a CSV above to begin.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-theme-border text-[11px] font-medium text-theme-muted bg-theme-panel">
                  <th className="p-3">Dataset name</th>
                  <th className="p-3 text-center">Plant ID</th>
                  <th className="p-3 text-center">Data points (rows)</th>
                  <th className="p-3 text-center">Used in</th>
                  <th className="p-3 text-right">Date added</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {datasets.map((ds) => (
                  <tr key={ds.id} className="hover:bg-slate-100 dark:bg-slate-80030 transition-colors group">
                    <td className="p-3">
                      <div className="font-medium text-theme-text flex items-center gap-2">
                        {ds.name}
                        <button
                          onClick={() => { navigator.clipboard.writeText(ds.id); toast.success('UUID copied'); }}
                          className="text-theme-muted hover:text-theme-text opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Copy UUID"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-center">
                      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-400 rounded-full text-[11px] font-medium border-0">
                        {ds.plantId === 'jetl_hyderabad' ? 'JETL' : ds.plantId}
                      </span>
                    </td>
                    <td className="p-3 text-sm font-mono text-center">
                      <span className="text-theme-text mr-2">{ds.rows.toLocaleString()}</span>
                      {ds.rows >= 30 ? (
                        <span className="text-[11px] font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400 px-3 py-1 rounded-full border-0 font-sans">Training ready</span>
                      ) : (
                        <span className="text-[11px] font-medium bg-amber-500/20 text-amber-700 dark:text-amber-400 px-3 py-1 rounded-full border-0 font-sans cursor-help" title="Minimum 30 rows required for LSTM training">Low Data</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {ds.used_in && ds.used_in.length > 0 ? (
                        <div className="flex flex-wrap gap-1 justify-center">
                          {ds.used_in.map(v => (
                            <span key={v} className="px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-full text-[10px] font-bold">
                              {v}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-theme-muted italic font-medium">Not yet trained</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-theme-muted text-right">
                      {new Date(ds.dateAdded).toLocaleString()}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleDelete(ds.id)}
                        className="text-theme-muted hover:text-rose-700 dark:text-rose-400 transition-colors p-2 rounded hover:bg-rose-500/10"
                        title="Delete Dataset"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── AI Model Performance & Explainability ──────────────────────────── */}
      <div className="mt-8 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-theme-text tracking-tight flex items-center gap-2">
              <BarChart3 className="text-cyan-700 dark:text-cyan-500" size={22} />
              AI Model Performance &amp; Explainability
            </h2>
            <p className="text-theme-muted text-xs mt-1">
              Regression accuracy, SHAP explainability, and anomaly detection for the currently deployed model — {selectedFacility || targetPlant}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-theme-muted font-medium">Prediction target:</span>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800 border border-theme-border text-theme-text text-xs font-bold rounded-md px-3 py-2 outline-none focus:border-cyan-500 min-w-[160px]"
            >
              {PREDICTION_TARGETS.map(t => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Regression Model Performance */}
        <div className="bg-theme-panel border border-theme-border rounded-xl p-5 shadow-lg">
          <h3 className="text-[10px] font-bold tracking-widest text-theme-muted uppercase mb-3 flex items-center gap-2">
            <Target size={14} className="text-blue-700 dark:text-blue-500" /> Regression Model Performance
          </h3>

          {perfLoading ? (
            <div className="flex items-center gap-2 text-theme-muted text-sm py-6"><Loader2 size={16} className="animate-spin" /> Loading model performance...</div>
          ) : perfError ? (
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-sm font-medium">
              <AlertTriangle size={16} className="shrink-0" /> {perfError}
            </div>
          ) : perf ? (
            <>
              <div className="border border-theme-border rounded-lg p-4 bg-theme-main mb-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-theme-muted mb-1">MODEL: {selectedTarget.toUpperCase()}</div>
                <div className="flex items-baseline gap-4 flex-wrap">
                  <span className="text-3xl font-extrabold text-theme-text">R² {typeof perf.r2 === 'number' ? perf.r2.toFixed(3) : '--'}</span>
                  <span className="text-sm text-theme-muted font-mono">MAE {typeof perf.mae === 'number' ? perf.mae.toFixed(4) : '--'}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${perf.trained ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' : 'bg-slate-500/15 text-slate-400 border-slate-500/30'}`}>
                    {perf.trained ? 'TRAINED' : 'NOT TRAINED'}
                  </span>
                  {perf.last_trained && <span className="text-[10px] text-theme-muted">Last trained: {perf.last_trained}</span>}
                </div>
              </div>

              {Array.isArray(perf.actual_vs_predicted) && perf.actual_vs_predicted.length > 0 ? (
                <>
                  <h4 className="text-xs font-bold text-theme-text mb-3">Actual vs Predicted — {selectedTarget}</h4>
                  <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-panel)" opacity={0.3} />
                        <XAxis type="number" dataKey="actual" name="Actual" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                        <YAxis type="number" dataKey="predicted" name="Predicted" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                        <RechartsTooltip
                          cursor={{ strokeDasharray: '3 3' }}
                          contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-panel)', borderRadius: '8px', color: 'var(--text-main)' }}
                          formatter={(v) => Number(v).toFixed(3)}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Scatter name="Predictions" data={perf.actual_vs_predicted} fill="#22d3ee" />
                        {perf.ideal_line && (
                          <Line type="linear" dataKey="predicted" data={perf.ideal_line} name="Ideal" stroke="#94a3b8" strokeDasharray="5 5" dot={false} legendType="line" />
                        )}
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <p className="text-xs text-theme-muted italic">No actual-vs-predicted samples returned by the backend for this target.</p>
              )}
            </>
          ) : (
            <p className="text-xs text-theme-muted italic">No model performance data available.</p>
          )}
        </div>

        {/* SHAP Explainability */}
        <div className="bg-theme-panel border border-theme-border rounded-xl p-5 shadow-lg">
          <h3 className="text-[10px] font-bold tracking-widest text-theme-muted uppercase mb-3 flex items-center gap-2">
            <Search size={14} className="text-purple-700 dark:text-purple-500" /> SHAP Explainability
          </h3>
          {shapLoading ? (
            <div className="flex items-center gap-2 text-theme-muted text-sm py-4"><Loader2 size={16} className="animate-spin" /> Loading SHAP values...</div>
          ) : shap?.available && Array.isArray(shap.values) && shap.values.length > 0 ? (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shap.values} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-panel)" opacity={0.3} horizontal={false} />
                  <XAxis type="number" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis type="category" dataKey="feature" width={100} stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-panel)', borderRadius: '8px', color: 'var(--text-main)' }} />
                  <Bar dataKey="shap_value" fill="#a855f7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 font-mono">
              SHAP plot unavailable{shap?.reason ? `: ${shap.reason}` : ' — backend did not return SHAP values for this target.'}
            </div>
          )}
        </div>

        {/* Anomaly Detection */}
        <div className="bg-theme-panel border border-theme-border rounded-xl p-5 shadow-lg">
          <h3 className="text-[10px] font-bold tracking-widest text-theme-muted uppercase mb-3 flex items-center gap-2">
            <Radio size={14} className="text-rose-700 dark:text-rose-500" /> Anomaly Detection
          </h3>
          {anomLoading ? (
            <div className="flex items-center gap-2 text-theme-muted text-sm py-4"><Loader2 size={16} className="animate-spin" /> Loading anomaly scan...</div>
          ) : anomalies ? (
            <>
              <div className="border border-rose-500/30 rounded-lg p-4 bg-theme-main mb-4 inline-flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-theme-muted">Anomalies Detected</span>
                <span className="text-3xl font-extrabold text-theme-text">{anomalies.count ?? 0}</span>
                {anomalies.severity && (
                  <span className={`mt-1 self-start text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${anomalies.severity === 'CRITICAL' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                    }`}>{anomalies.severity}</span>
                )}
              </div>

              {Array.isArray(anomalies.series) && anomalies.series.length > 0 ? (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={anomalies.series} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-panel)" opacity={0.3} />
                      <XAxis dataKey="timestamp" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} minTickGap={40} />
                      <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} domain={['auto', 'auto']} />
                      <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-panel)', borderRadius: '8px', color: 'var(--text-main)' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="value" name={selectedTarget} stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Scatter
                        name="Anomaly"
                        data={anomalies.series.filter(d => d.is_anomaly)}
                        dataKey="value"
                        fill="#ef4444"
                        shape="cross"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-theme-muted italic">No time-series returned for this target.</p>
              )}
            </>
          ) : (
            <p className="text-xs text-theme-muted italic">No anomaly detection data available.</p>
          )}
        </div>

        {/* Feature Importance */}
        <div className="bg-theme-panel border border-theme-border rounded-xl p-5 shadow-lg">
          <h3 className="text-[10px] font-bold tracking-widest text-theme-muted uppercase mb-3 flex items-center gap-2">
            <Layers size={14} className="text-blue-700 dark:text-blue-500" /> Feature Importance
          </h3>
          {fiLoading ? (
            <div className="flex items-center gap-2 text-theme-muted text-sm py-4"><Loader2 size={16} className="animate-spin" /> Loading feature importances...</div>
          ) : Array.isArray(featureImportance) && featureImportance.length > 0 ? (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureImportance} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-panel)" opacity={0.3} vertical={false} />
                  <XAxis dataKey="feature" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 'bold' }} />
                  <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} label={{ value: 'Importance', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 10 }} />
                  <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-panel)', borderRadius: '8px', color: 'var(--text-main)' }} />
                  <Bar dataKey="importance" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-theme-muted italic">No feature importance data available for this target yet — retrain the model once enough real data is loaded.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelTuning;