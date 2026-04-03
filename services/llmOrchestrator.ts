/**
 * LLM Orchestrator
 *
 * Central layer used by ALL AI calls in the app.
 *
 * Features
 * ─────────
 * • Prompt compaction & canonical-instruction deduplication
 * • Char-based token estimation with per-call budgeting
 * • Deterministic seeded randomness (mulberry32 PRNG)
 * • Response cache persisted in IndexedDB (keyed by normalised prompt + model + params + schema)
 * • Telemetry: estimated in/out tokens, cache hits, per-step totals accumulated in memory + persisted
 * • Jittered exponential-backoff retry
 */

import { GenerateContentResponse } from '@google/genai';
import { initDB } from './storageService';

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_STORE = 'llm_cache';
const TELEMETRY_STORE = 'llm_telemetry';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
/** ~4 chars per token (rough BPE approximation) */
const CHARS_PER_TOKEN = 4;
const MAX_CACHE_ENTRIES = 500;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CallOptions {
  model?: string;
  maxInputTokens?: number;   // guard – throw if exceeded
  maxOutputTokens?: number;
  temperature?: number;
  seed?: number;
  /** If true, skip cache and always call the API */
  skipCache?: boolean;
  /** Arbitrary extra params included in cache key */
  cacheParams?: Record<string, unknown>;
}

export interface TelemetryEntry {
  id: string;
  timestamp: number;
  model: string;
  task: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  cacheHit: boolean;
  durationMs: number;
}

export interface ProjectTelemetry {
  projectId: string;
  entries: TelemetryEntry[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheHits: number;
  totalCalls: number;
}

// ─── In-memory telemetry accumulator ─────────────────────────────────────────

const _sessionEntries: TelemetryEntry[] = [];

export function getSessionTelemetry(): TelemetryEntry[] {
  return [..._sessionEntries];
}

export function clearSessionTelemetry(): void {
  _sessionEntries.length = 0;
}

// ─── Token estimation ─────────────────────────────────────────────────────────

/** Estimate token count from a text string using char-based approximation */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Estimate JSON schema overhead in tokens */
export function estimateSchemaTokens(schema: unknown): number {
  return estimateTokens(JSON.stringify(schema ?? ''));
}

// ─── Prompt compaction ────────────────────────────────────────────────────────

/** Normalise whitespace and deduplicate repeated instruction blocks */
export function compactPrompt(prompt: string): string {
  // 1. Normalise line endings
  let s = prompt.replace(/\r\n?/g, '\n');
  // 2. Collapse runs of blank lines to one
  s = s.replace(/\n{3,}/g, '\n\n');
  // 3. Trim each line
  s = s.split('\n').map(l => l.trimEnd()).join('\n');
  // 4. Deduplicate consecutive identical non-empty lines
  const lines = s.split('\n');
  const deduped: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] && lines[i] === lines[i - 1]) continue;
    deduped.push(lines[i]);
  }
  return deduped.join('\n').trim();
}

// ─── Canonical system-instruction blocks ─────────────────────────────────────

const CANON_INSTRUCTIONS = {
  jsonOnly: 'Return ONLY valid JSON matching the schema. No prose, no markdown fences.',
  markdownChapter: 'Format: Markdown. Do not include the chapter title as a heading.',
  preservePlot: 'Preserve all plot facts and character names from the context.',
  noPageRefs: 'Avoid references to physical pages or turning of pages.',
} as const;

/** Append a canonical instruction block if not already present */
export function withCanon(prompt: string, ...keys: (keyof typeof CANON_INSTRUCTIONS)[]): string {
  let p = prompt;
  for (const k of keys) {
    const instr = CANON_INSTRUCTIONS[k];
    if (!p.includes(instr)) p += `\n${instr}`;
  }
  return p;
}

// ─── Cache key generation ─────────────────────────────────────────────────────

function stableStringify(obj: unknown): string {
  if (typeof obj !== 'object' || obj === null) return String(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify((obj as any)[k])).join(',') + '}';
}

export function buildCacheKey(prompt: string, model: string, opts?: CallOptions, schema?: unknown): string {
  const compact = compactPrompt(prompt);
  const paramStr = stableStringify({
    model,
    temp: opts?.temperature ?? 1,
    seed: opts?.seed,
    schema: schema ? stableStringify(schema) : null,
    extra: opts?.cacheParams ? stableStringify(opts.cacheParams) : null,
  });
  // Simple djb2-style hash for a compact string key
  return `llm:${_hash(compact + '|' + paramStr)}`;
}

function _hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(36);
}

// ─── IndexedDB cache helpers ─────────────────────────────────────────────────

async function getCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('LlmCacheDB', 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

interface CacheRecord { key: string; value: string; ts: number }

export async function getCached(key: string): Promise<string | null> {
  try {
    const db = await getCacheDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CACHE_STORE, 'readonly');
      const req = tx.objectStore(CACHE_STORE).get(key);
      req.onsuccess = () => {
        const rec: CacheRecord | undefined = req.result;
        if (!rec) return resolve(null);
        if (Date.now() - rec.ts > CACHE_TTL_MS) return resolve(null);
        resolve(rec.value);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setCached(key: string, value: string): Promise<void> {
  try {
    const db = await getCacheDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      const store = tx.objectStore(CACHE_STORE);
      store.put({ key, value, ts: Date.now() } satisfies CacheRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // silently fail – cache is best-effort
  }
}

/** Evict oldest entries if cache is too large */
async function evictCacheIfNeeded(): Promise<void> {
  try {
    const db = await getCacheDB();
    const all: CacheRecord[] = await new Promise((resolve) => {
      const tx = db.transaction(CACHE_STORE, 'readonly');
      const req = tx.objectStore(CACHE_STORE).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve([]);
    });
    if (all.length <= MAX_CACHE_ENTRIES) return;
    all.sort((a, b) => a.ts - b.ts);
    const toDelete = all.slice(0, all.length - MAX_CACHE_ENTRIES);
    const tx = db.transaction(CACHE_STORE, 'readwrite');
    const store = tx.objectStore(CACHE_STORE);
    for (const r of toDelete) store.delete(r.key);
  } catch {
    // best-effort
  }
}

// ─── Seeded PRNG (mulberry32) ─────────────────────────────────────────────────

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

/** Return integer in [min, max] inclusive */
export function seededIntInRange(seed: number, min: number, max: number): number {
  const rng = mulberry32(seed);
  return min + Math.floor(rng() * (max - min + 1));
}

/** Derive a numeric seed from string inputs */
export function deriveNumericSeed(...parts: (string | number)[]): number {
  const s = parts.map(String).join('|');
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return h >>> 0;
}

/** Deterministic scene count: 11-14 inclusive per (projectSeed, chapterNum, outlineHash, rerollNonce) */
export function deterministicSceneCount(
  projectSeed: string,
  chapterNumber: number,
  outlineHash: string,
  rerollNonce: number,
  min = 11,
  max = 14,
): number {
  const seed = deriveNumericSeed(projectSeed, chapterNumber, outlineHash, rerollNonce);
  return seededIntInRange(seed, min, max);
}

// ─── Jittered exponential-backoff retry ──────────────────────────────────────

export async function retryWithJitter<T>(
  fn: () => Promise<T>,
  retries = 4,
  baseDelayMs = 800,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === retries - 1) break;
      const delay = baseDelayMs * Math.pow(2, i) + Math.random() * baseDelayMs;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ─── Budget guard ────────────────────────────────────────────────────────────

/** Throw a clear error if estimated input tokens would exceed the budget */
export function assertTokenBudget(prompt: string, maxTokens: number): void {
  const est = estimateTokens(prompt);
  if (est > maxTokens) {
    throw new Error(
      `Token budget exceeded: estimated ${est} tokens but limit is ${maxTokens}. ` +
      `Consider shortening the prompt or using a summary instead of full text.`
    );
  }
}

// ─── Core orchestrated call ──────────────────────────────────────────────────

/**
 * Orchestrated LLM call with caching, budgeting, telemetry, and retry.
 *
 * @param task      Human-readable label (used in telemetry)
 * @param prompt    The prompt text (will be compacted automatically)
 * @param apiFn     Function that returns a GenerateContentResponse promise
 * @param schema    Optional schema used in cache key
 * @param opts      Budget / cache / telemetry options
 */
export async function orchestratedCall(
  task: string,
  prompt: string,
  apiFn: (compactedPrompt: string) => Promise<GenerateContentResponse>,
  schema?: unknown,
  opts: CallOptions = {},
): Promise<string> {
  const model = opts.model ?? 'gemini-2.5-flash';
  const compacted = compactPrompt(prompt);

  // Budget guard
  if (opts.maxInputTokens) {
    assertTokenBudget(compacted, opts.maxInputTokens);
  }

  const cacheKey = buildCacheKey(compacted, model, opts, schema);
  const t0 = Date.now();
  let cacheHit = false;
  let rawText: string;

  if (!opts.skipCache) {
    const cached = await getCached(cacheKey);
    if (cached) {
      cacheHit = true;
      rawText = cached;
    } else {
      const response = await retryWithJitter(() => apiFn(compacted));
      rawText = response.text ?? '';
      await setCached(cacheKey, rawText);
      evictCacheIfNeeded(); // async, no await
    }
  } else {
    const response = await retryWithJitter(() => apiFn(compacted));
    rawText = response.text ?? '';
  }

  // Telemetry
  const entry: TelemetryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    model,
    task,
    estimatedInputTokens: estimateTokens(compacted),
    estimatedOutputTokens: estimateTokens(rawText),
    cacheHit,
    durationMs: Date.now() - t0,
  };
  _sessionEntries.push(entry);

  // Persist telemetry to IndexedDB (best-effort, async)
  persistTelemetryEntry(entry);

  return rawText;
}

// ─── Telemetry persistence ────────────────────────────────────────────────────

async function persistTelemetryEntry(entry: TelemetryEntry): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction(['app_state'], 'readwrite');
    const store = tx.objectStore('app_state');
    const key = 'telemetry_session';
    const req = store.get(key);
    req.onsuccess = () => {
      const existing: TelemetryEntry[] = req.result ?? [];
      existing.push(entry);
      // Keep last 2000 entries to avoid bloat
      const trimmed = existing.slice(-2000);
      store.put(trimmed, key);
    };
  } catch {
    // best-effort
  }
}

export async function loadPersistedTelemetry(): Promise<TelemetryEntry[]> {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(['app_state'], 'readonly');
      const req = tx.objectStore('app_state').get('telemetry_session');
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function clearPersistedTelemetry(): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction(['app_state'], 'readwrite');
    tx.objectStore('app_state').delete('telemetry_session');
  } catch {
    // best-effort
  }
}
