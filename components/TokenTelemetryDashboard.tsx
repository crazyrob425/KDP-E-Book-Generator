import React, { useEffect, useState, useCallback } from 'react';
import { TelemetryEntry } from '../types';
import { getSessionTelemetry, loadPersistedTelemetry, clearPersistedTelemetry, clearSessionTelemetry } from '../services/llmOrchestrator';

interface TokenTelemetryDashboardProps {
  /** If provided, shows only entries with this project prefix in the task name */
  projectId?: string;
}

const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
const pct = (a: number, b: number) => b === 0 ? '0%' : `${Math.round((a / b) * 100)}%`;

const TokenTelemetryDashboard: React.FC<TokenTelemetryDashboardProps> = ({ projectId }) => {
  const [entries, setEntries] = useState<TelemetryEntry[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  const load = useCallback(async () => {
    const session = getSessionTelemetry();
    const persisted = await loadPersistedTelemetry();
    // Merge: session takes precedence (it's more fresh)
    const ids = new Set(session.map(e => e.id));
    const merged = [...session, ...persisted.filter(e => !ids.has(e.id))];
    merged.sort((a, b) => b.timestamp - a.timestamp);
    setEntries(merged);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = projectId
    ? entries.filter(e => e.task.includes(projectId))
    : entries;

  const totalIn = filtered.reduce((s, e) => s + e.estimatedInputTokens, 0);
  const totalOut = filtered.reduce((s, e) => s + e.estimatedOutputTokens, 0);
  const cacheHits = filtered.filter(e => e.cacheHit).length;
  const totalCalls = filtered.length;
  const hitRate = pct(cacheHits, totalCalls);

  const handleClear = async () => {
    clearSessionTelemetry();
    await clearPersistedTelemetry();
    setEntries([]);
  };

  if (totalCalls === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg text-xs overflow-hidden">
      {/* Summary bar */}
      <button
        onClick={() => setShowDetails(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800 transition-colors"
      >
        <span className="text-slate-400 font-mono">
          🪙 Tokens: <span className="text-violet-400">{fmt(totalIn)}</span> in /
          <span className="text-emerald-400"> {fmt(totalOut)}</span> out ·
          Cache hits: <span className="text-cyan-400">{hitRate}</span> ({cacheHits}/{totalCalls})
        </span>
        <span className="text-slate-500">{showDetails ? '▲' : '▼'}</span>
      </button>

      {/* Detailed table */}
      {showDetails && (
        <div className="border-t border-slate-700 p-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-400">Last {Math.min(filtered.length, 20)} calls</span>
            <button
              onClick={handleClear}
              className="text-slate-500 hover:text-red-400 transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="overflow-auto max-h-48">
            <table className="w-full text-slate-400">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700">
                  <th className="text-left py-1">Task</th>
                  <th className="text-right py-1">In</th>
                  <th className="text-right py-1">Out</th>
                  <th className="text-right py-1">Cache</th>
                  <th className="text-right py-1">ms</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 20).map((e) => (
                  <tr key={e.id} className="border-b border-slate-800 hover:bg-slate-800">
                    <td className="py-0.5 font-mono truncate max-w-[120px]" title={e.task}>
                      {e.task}
                    </td>
                    <td className="text-right text-violet-400">{fmt(e.estimatedInputTokens)}</td>
                    <td className="text-right text-emerald-400">{fmt(e.estimatedOutputTokens)}</td>
                    <td className="text-center">{e.cacheHit ? '✓' : '—'}</td>
                    <td className="text-right text-slate-500">{e.durationMs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenTelemetryDashboard;
