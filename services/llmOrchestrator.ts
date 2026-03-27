/**
 * llmOrchestrator.ts
 *
 * Central orchestration layer that sits between every agent/step and the raw
 * Gemini API.  Provides:
 *   • Prompt canonicalization & deduplication (compaction)
 *   • Token budget enforcement (hard limits by step type)
 *   • Persistent local cache (IndexedDB)
 *   • Per-call telemetry (estimated tokens, cache hit/miss)
 *   • Jittered exponential-backoff retry
 */

import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { TokenMetrics } from '../types';

// ---------------------------------------------------------------------------
// Cache helpers (IndexedDB)
// ---------------------------------------------------------------------------

const CACHE_DB_NAME = 'LLMCacheDB';
const CACHE_STORE = 'llm_cache';
const CACHE_DB_VERSION = 1;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
  key: string;
  value: string;
  ts: number;
}

let cacheDbInstance: IDBDatabase | null = null;

async function openCacheDb(): Promise<IDBDatabase> {
  if (cacheDbInstance) return cacheDbInstance;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => {
      cacheDbInstance = req.result;
      resolve(req.result);
    };
  });
}

async function cacheGet(key: string): Promise<string | null> {
  try {
    const db = await openCacheDb();
    return new Promise((resolve) => {
      const tx = db.transaction(CACHE_STORE, 'readonly');
      const req = tx.objectStore(CACHE_STORE).get(key);
      req.onsuccess = () => {
        const entry: CacheEntry | undefined = req.result;
        if (!entry) return resolve(null);
        if (Date.now() - entry.ts > CACHE_TTL_MS) return resolve(null); // expired
        resolve(entry.value);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function cachePut(key: string, value: string): Promise<void> {
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      const entry: CacheEntry = { key, value, ts: Date.now() };
      const req = tx.objectStore(CACHE_STORE).put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Cache write failure is non-fatal
  }
}

// ---------------------------------------------------------------------------
// Prompt compaction
// ---------------------------------------------------------------------------

/**
 * Canonicalises a prompt so cache keys stay stable and token waste is reduced:
 *   1. Collapse runs of whitespace (incl. \r, \t) to single spaces
 *   2. Deduplicate identical adjacent lines
 *   3. Trim
 */
export function compactPrompt(raw: string): string {
  const lines = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim());

  // Remove consecutive duplicate lines
  const deduped: string[] = [];
  for (const line of lines) {
    if (deduped.length === 0 || line !== deduped[deduped.length - 1]) {
      deduped.push(line);
    }
  }

  return deduped.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------------------
// Token estimation (chars/4 heuristic — fast, good-enough for budgeting)
// ---------------------------------------------------------------------------

/** Estimate token count from a string using the 4-chars-per-token heuristic */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// Token budgets per step (input only — output is bounded by model defaults)
// ---------------------------------------------------------------------------

export interface BudgetConfig {
  maxInputTokens: number;
  /** Priority list for context trimming (high index = drop first) */
  trimPriority?: string[];
}

/** Hard token-input budgets per step label */
export const TOKEN_BUDGETS: Record<string, BudgetConfig> = {
  market_research:  { maxInputTokens: 2_000 },
  outline:          { maxInputTokens: 3_000 },
  scene_plan:       { maxInputTokens: 2_500 },
  scene_write:      { maxInputTokens: 4_000 },
  polish:           { maxInputTokens: 8_000 },
  critique:         { maxInputTokens: 5_000 },
  rewrite:          { maxInputTokens: 5_000 },
  default:          { maxInputTokens: 6_000 },
};

/**
 * Trims a prompt to fit within the budget for the given step.
 * Always strips optional sections (delimited by "--- optional ---") first,
 * then hard-truncates if still over budget.
 */
export function applyBudget(prompt: string, step: string): string {
  const budget = TOKEN_BUDGETS[step] ?? TOKEN_BUDGETS.default;

  // Always strip optional sections (they are explicitly opt-in context)
  let trimmed = prompt.replace(/--- optional ---[\s\S]*?--- \/optional ---/gi, '').trim();

  if (estimateTokens(trimmed) <= budget.maxInputTokens) return trimmed;

  // Hard truncate keeping the head (instructions stay, large context dropped)
  const maxChars = budget.maxInputTokens * 4;
  return trimmed.slice(0, maxChars) + '\n[context trimmed for token budget]';
}

// ---------------------------------------------------------------------------
// Cache key generation
// ---------------------------------------------------------------------------

/** Stable cache key: model + sorted-param-string + compacted prompt */
export function buildCacheKey(model: string, prompt: string, extraParams?: object): string {
  const normalised = compactPrompt(prompt);
  const paramStr = extraParams
    ? JSON.stringify(Object.fromEntries(Object.entries(extraParams).sort()))
    : '';
  return `${model}|${paramStr}|${normalised}`;
}

// ---------------------------------------------------------------------------
// Telemetry sink
// ---------------------------------------------------------------------------

const _metrics: TokenMetrics[] = [];

export function recordMetric(metric: TokenMetrics): void {
  _metrics.push(metric);
}

export function getMetrics(): TokenMetrics[] {
  return [..._metrics];
}

export function clearMetrics(): void {
  _metrics.length = 0;
}

export function getTotals() {
  return _metrics.reduce(
    (acc, m) => {
      acc.totalEstimatedInput += m.estimatedInputTokens;
      acc.totalEstimatedOutput += m.estimatedOutputTokens;
      if (m.cacheHit) acc.cacheHits++;
      else acc.cacheMisses++;
      return acc;
    },
    { totalEstimatedInput: 0, totalEstimatedOutput: 0, cacheHits: 0, cacheMisses: 0 }
  );
}

// ---------------------------------------------------------------------------
// Main orchestrated call
// ---------------------------------------------------------------------------

export interface OrchestratorCallOptions {
  /** Step label — used for budgeting and telemetry */
  step: string;
  model: string;
  /** Raw prompt (will be compacted + budget-trimmed automatically) */
  prompt: string;
  /** Gemini config block (responseMimeType, schema, temperature, …) */
  config?: object;
  /** If true, bypass cache even if a hit exists */
  noCache?: boolean;
  /** Max retries (default 4) */
  maxRetries?: number;
}

/**
 * Makes a single Gemini call through the orchestration layer:
 *   compact → budget → cache-check → call → cache-store → metrics
 */
export async function orchestratedCall(
  ai: GoogleGenAI,
  options: OrchestratorCallOptions
): Promise<string> {
  const { step, model, config, noCache = false, maxRetries = 4 } = options;

  // 1. Compact + budget
  const compacted = compactPrompt(options.prompt);
  const budgeted = applyBudget(compacted, step);

  const inputTokens = estimateTokens(budgeted);

  // 2. Cache lookup
  const cacheKey = buildCacheKey(model, budgeted, config as object | undefined);
  if (!noCache) {
    const cached = await cacheGet(cacheKey);
    if (cached !== null) {
      recordMetric({
        estimatedInputTokens: inputTokens,
        estimatedOutputTokens: estimateTokens(cached),
        cacheHit: true,
        step,
        timestamp: Date.now(),
      });
      return cached;
    }
  }

  // 3. Call with jittered exponential backoff
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response: GenerateContentResponse = await (ai.models as any).generateContent({
        model,
        contents: budgeted,
        ...(config ? { config } : {}),
      });
      const text = response.text ?? '';
      const outputTokens = estimateTokens(text);

      // 4. Store in cache & record metric
      if (!noCache) await cachePut(cacheKey, text);
      recordMetric({
        estimatedInputTokens: inputTokens,
        estimatedOutputTokens: outputTokens,
        cacheHit: false,
        step,
        timestamp: Date.now(),
      });

      return text;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        // Jittered exponential backoff: base 500ms, max 16s
        const base = Math.min(500 * Math.pow(2, attempt), 16_000);
        const jitter = Math.random() * base * 0.3;
        await new Promise((r) => setTimeout(r, base + jitter));
      }
    }
  }
  throw lastError;
}
