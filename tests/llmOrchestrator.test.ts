/**
 * Unit tests for LLM orchestration utilities.
 *
 * These are plain TS/JS tests that run in Node.js without a DOM.
 * Run with: node --experimental-vm-modules tests/llmOrchestrator.test.ts
 * Or via a test runner if one is added to the project.
 *
 * Each test section is written as a self-contained function so it
 * can be ported to any test framework (Vitest, Jest, etc.) easily.
 */

// ─── Import helpers from the orchestrator (path-compatible with Node) ─────────

// Node-compatible inline copies of pure functions (no IndexedDB / browser APIs)

/** ~4 chars per token */
const CHARS_PER_TOKEN = 4;
function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function compactPrompt(prompt: string): string {
  let s = prompt.replace(/\r\n?/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.split('\n').map((l: string) => l.trimEnd()).join('\n');
  const lines = s.split('\n');
  const deduped: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] && lines[i] === lines[i - 1]) continue;
    deduped.push(lines[i]);
  }
  return deduped.join('\n').trim();
}

function stableStringify(obj: unknown): string {
  if (typeof obj !== 'object' || obj === null) return String(obj);
  if (Array.isArray(obj)) return '[' + (obj as unknown[]).map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + keys.map((k: string) => JSON.stringify(k) + ':' + stableStringify((obj as any)[k])).join(',') + '}';
}

function _hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(36);
}

function buildCacheKey(prompt: string, model: string, temperature = 1, seed?: number, schema?: unknown): string {
  const compact = compactPrompt(prompt);
  const paramStr = stableStringify({ model, temp: temperature, seed, schema: schema ? stableStringify(schema) : null, extra: null });
  return `llm:${_hash(compact + '|' + paramStr)}`;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

function seededIntInRange(seed: number, min: number, max: number): number {
  const rng = mulberry32(seed);
  return min + Math.floor(rng() * (max - min + 1));
}

function deriveNumericSeed(...parts: (string | number)[]): number {
  const s = parts.map(String).join('|');
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return h >>> 0;
}

function deterministicSceneCount(
  projectSeed: string, chapterNumber: number, outlineHash: string,
  rerollNonce: number, min = 11, max = 14,
): number {
  const seed = deriveNumericSeed(projectSeed, chapterNumber, outlineHash, rerollNonce);
  return seededIntInRange(seed, min, max);
}

function hashOutline(titles: string[]): string {
  let h = 0;
  const s = titles.join('|');
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return (h >>> 0).toString(36);
}

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function assertEqual<T>(a: T, b: T, label: string) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (ok) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}  (expected ${JSON.stringify(b)}, got ${JSON.stringify(a)})`);
    failed++;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('\n=== Token Estimation ===');
assert(estimateTokens('') === 0, 'empty string = 0 tokens');
assert(estimateTokens('abcd') === 1, '4 chars = 1 token');
assert(estimateTokens('abcde') === 2, '5 chars = 2 tokens (ceil)');
assert(estimateTokens('a'.repeat(400)) === 100, '400 chars = 100 tokens');

console.log('\n=== Prompt Compaction ===');
{
  const raw = 'Hello\n\n\n\nWorld\n  trailing  ';
  const compact = compactPrompt(raw);
  assert(!compact.includes('\n\n\n'), 'triple newlines collapsed');
  assert(!compact.endsWith(' '), 'no trailing whitespace');
}
{
  const dupLines = 'Rule A\nRule A\nRule B';
  const compact = compactPrompt(dupLines);
  const count = compact.split('\n').filter(l => l === 'Rule A').length;
  assertEqual(count, 1, 'consecutive duplicate lines deduped');
}
{
  const noChange = 'Line 1\nLine 2\nLine 3';
  assertEqual(compactPrompt(noChange), noChange, 'already-clean prompt unchanged');
}

console.log('\n=== Cache Key Stability ===');
{
  const k1 = buildCacheKey('Hello world', 'gemini-2.5-flash');
  const k2 = buildCacheKey('Hello world', 'gemini-2.5-flash');
  assertEqual(k1, k2, 'same prompt + model = same cache key');
}
{
  const k1 = buildCacheKey('Hello world', 'gemini-2.5-flash');
  const k2 = buildCacheKey('Hello world', 'gemini-2.5-pro');
  assert(k1 !== k2, 'different model = different cache key');
}
{
  const k1 = buildCacheKey('Hello\n\n\nworld', 'gemini-2.5-flash');
  const k2 = buildCacheKey('Hello\n\nworld', 'gemini-2.5-flash');
  assertEqual(k1, k2, 'normalised whitespace produces same cache key');
}
{
  const k1 = buildCacheKey('Prompt', 'model', 1, undefined, { type: 'object', properties: { a: 1 } });
  const k2 = buildCacheKey('Prompt', 'model', 1, undefined, { properties: { a: 1 }, type: 'object' });
  assertEqual(k1, k2, 'schema key ordering irrelevant (stable stringify)');
}
{
  const k1 = buildCacheKey('Prompt', 'model', 0.5);
  const k2 = buildCacheKey('Prompt', 'model', 1);
  assert(k1 !== k2, 'different temperature = different cache key');
}

console.log('\n=== Seeded RNG (mulberry32) ===');
{
  const rng = mulberry32(42);
  const a = rng();
  const b = mulberry32(42)();
  assertEqual(a, b, 'same seed produces same first value');
}
{
  const a = mulberry32(1)();
  const b = mulberry32(2)();
  assert(a !== b, 'different seeds produce different values');
}
{
  const vals = Array.from({ length: 1000 }, () => mulberry32(Math.random() * 1e9 | 0)());
  assert(vals.every(v => v >= 0 && v < 1), 'all values in [0,1)');
}

console.log('\n=== Deterministic Scene Count ===');
{
  const c1 = deterministicSceneCount('myProject', 1, 'abc', 0);
  const c2 = deterministicSceneCount('myProject', 1, 'abc', 0);
  assertEqual(c1, c2, 'same inputs = same scene count');
}
{
  for (let ch = 1; ch <= 20; ch++) {
    const count = deterministicSceneCount('proj', ch, 'hash', 0);
    assert(count >= 11 && count <= 14, `ch${ch}: count ${count} in [11,14]`);
  }
}
{
  const c0 = deterministicSceneCount('proj', 3, 'hash', 0);
  const c1 = deterministicSceneCount('proj', 3, 'hash', 1);
  // With different nonces the seeds differ (result may or may not be the same number but the derivation is different)
  const seed0 = deriveNumericSeed('proj', 3, 'hash', 0);
  const seed1 = deriveNumericSeed('proj', 3, 'hash', 1);
  assert(seed0 !== seed1, 'reroll nonce changes the seed');
}
{
  // Custom range
  for (let ch = 1; ch <= 10; ch++) {
    const count = deterministicSceneCount('proj', ch, 'hash', 0, 3, 5);
    assert(count >= 3 && count <= 5, `custom range [3,5]: count ${count}`);
  }
}

console.log('\n=== Chunking Budget Guard ===');
{
  function assertTokenBudget(prompt: string, maxTokens: number): void {
    const est = estimateTokens(prompt);
    if (est > maxTokens) throw new Error(`Token budget exceeded: ${est} > ${maxTokens}`);
  }
  let threw = false;
  try { assertTokenBudget('a'.repeat(10000), 100); } catch { threw = true; }
  assert(threw, 'throws when prompt exceeds token budget');

  let ok = true;
  try { assertTokenBudget('a'.repeat(400), 100); } catch { ok = false; }
  assert(ok, 'does not throw when prompt fits in budget');
}

console.log('\n=== Outline Hash Stability ===');
{
  const h1 = hashOutline(['Chapter One', 'Chapter Two', 'Chapter Three']);
  const h2 = hashOutline(['Chapter One', 'Chapter Two', 'Chapter Three']);
  assertEqual(h1, h2, 'same titles = same hash');
  const h3 = hashOutline(['Chapter One', 'Chapter Two']);
  assert(h1 !== h3, 'different titles = different hash');
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
