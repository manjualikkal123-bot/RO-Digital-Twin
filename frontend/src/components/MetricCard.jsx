import React from 'react';
import { formatFloat } from '../utils/formatters';

/**
 * Universal Metric Card
 * Guarantees that a metric (like SEC or Turbidity) looks and formats identically
 * everywhere it is used in the app, preventing "Schrödinger's Data".
 */
export default function MetricCard({ title, value, unit, colorClass = "text-cyan", precision = 2 }) {
 return (
 <div className="glass-panel premium-card p-4">
 <h2 className="text-theme-muted text-[10px] uppercase tracking-widest mb-1">{title}</h2>
 <div style={{ fontSize: '2rem', fontWeight: 700 }} className={colorClass}>
 {formatFloat(value, precision)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>{unit}</span>
 </div>
 </div>
 );
}
