/**
 * TokenDashboard.tsx
 *
 * Shows live token usage, cache hit rate, and estimated savings.
 * Reads from the llmOrchestrator's in-memory metrics store.
 */

import React from 'react';
import { getTotals, getMetrics } from '../../services/llmOrchestrator';
import { TokenMetrics } from '../../types';

interface Props {
  /** Pass this to force re-render after new calls */
  refreshKey?: number;
}

function formatK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function pct(part: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

/** Baseline single-pass estimate: assume 8k input tokens per chapter */
const SINGLE_PASS_BASELINE = 8_000;

const TokenDashboard: React.FC<Props> = ({ refreshKey }) => {
  const totals = React.useMemo(() => getTotals(), [refreshKey]);
  const metrics: TokenMetrics[] = React.useMemo(() => getMetrics(), [refreshKey]);

  const totalCalls = totals.cacheHits + totals.cacheMisses;
  const singlePassBaseline = metrics.filter((m) => m.step === 'scene_write' || m.step === 'scene_plan').length > 0
    ? SINGLE_PASS_BASELINE * Math.max(1, metrics.filter((m) => m.step === 'polish').length)
    : 0;
  const tokensSaved = Math.max(0, singlePassBaseline - totals.totalEstimatedInput);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
      <h3 className="text-base font-semibold text-white flex items-center gap-2">
        <span>📊</span> Token Dashboard
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Est. Input Tokens" value={formatK(totals.totalEstimatedInput)} color="blue" />
        <Stat label="Est. Output Tokens" value={formatK(totals.totalEstimatedOutput)} color="purple" />
        <Stat label="Cache Hits" value={`${totals.cacheHits} / ${totalCalls}`} color="green" />
        <Stat label="Cache Hit Rate" value={pct(totals.cacheHits, totalCalls)} color="green" />
      </div>

      {tokensSaved > 0 && (
        <div className="bg-green-900/30 border border-green-700 rounded-md px-3 py-2 text-sm text-green-300">
          ✨ Est. <strong>{formatK(tokensSaved)}</strong> tokens saved vs. single-pass baseline
        </div>
      )}

      {/* Per-step breakdown */}
      {metrics.length > 0 && (
        <details className="text-xs text-gray-400">
          <summary className="cursor-pointer hover:text-gray-200 select-none">
            Per-call breakdown ({metrics.length} calls)
          </summary>
          <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
            {[...metrics].reverse().slice(0, 50).map((m, i) => (
              <div
                key={i}
                className="flex justify-between border-b border-gray-700 pb-1"
              >
                <span className={m.cacheHit ? 'text-green-400' : 'text-gray-300'}>
                  {m.cacheHit ? '✓' : '·'} {m.step}
                </span>
                <span>
                  {formatK(m.estimatedInputTokens)} in / {formatK(m.estimatedOutputTokens)} out
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

interface StatProps {
  label: string;
  value: string;
  color: 'blue' | 'purple' | 'green' | 'yellow';
}

const colorMap: Record<StatProps['color'], string> = {
  blue:   'text-blue-400',
  purple: 'text-purple-400',
  green:  'text-green-400',
  yellow: 'text-yellow-400',
};

const Stat: React.FC<StatProps> = ({ label, value, color }) => (
  <div className="bg-gray-700/50 rounded-md px-3 py-2">
    <div className={`text-lg font-bold ${colorMap[color]}`}>{value}</div>
    <div className="text-xs text-gray-400">{label}</div>
  </div>
);

export default TokenDashboard;
