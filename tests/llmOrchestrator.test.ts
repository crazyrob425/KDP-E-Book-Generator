/**
 * llmOrchestrator.test.ts
 *
 * Unit tests for the core LLM orchestration utilities:
 *   • Prompt compaction
 *   • Token estimation
 *   • Cache key stability
 *   • Token budget trimming
 *   • Deterministic RNG (scene count)
 *   • Telemetry aggregation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  compactPrompt,
  estimateTokens,
  buildCacheKey,
  applyBudget,
  TOKEN_BUDGETS,
  recordMetric,
  getTotals,
  clearMetrics,
} from '../services/llmOrchestrator';
import {
  hashString,
  mulberry32,
  deterministicSceneCount,
} from '../engine/chunking/scenePlanner';
import { stitchScenes } from '../engine/chunking/stitcher';

// ---------------------------------------------------------------------------
// Prompt compaction
// ---------------------------------------------------------------------------

describe('compactPrompt', () => {
  it('collapses multiple spaces to one', () => {
    expect(compactPrompt('Hello   World')).toBe('Hello World');
  });

  it('trims leading and trailing whitespace', () => {
    expect(compactPrompt('  hello  ')).toBe('hello');
  });

  it('collapses 3+ blank lines to 2', () => {
    const input = 'line1\n\n\n\n\nline2';
    const result = compactPrompt(input);
    expect(result).toBe('line1\n\nline2');
  });

  it('removes consecutive duplicate lines', () => {
    const input = 'Write a book.\nWrite a book.\nBe creative.';
    const result = compactPrompt(input);
    expect(result).toBe('Write a book.\nBe creative.');
  });

  it('normalises CRLF to LF', () => {
    const input = 'line1\r\nline2\r\nline3';
    const result = compactPrompt(input);
    expect(result).toBe('line1\nline2\nline3');
  });

  it('preserves non-duplicate lines', () => {
    const input = 'First\nSecond\nThird';
    expect(compactPrompt(input)).toBe('First\nSecond\nThird');
  });
});

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

describe('estimateTokens', () => {
  it('returns ceil(length / 4)', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('is proportional to text length', () => {
    const short = 'Hello world';
    const long = 'Hello world'.repeat(100);
    expect(estimateTokens(long)).toBeGreaterThan(estimateTokens(short) * 90);
  });
});

// ---------------------------------------------------------------------------
// Cache key stability
// ---------------------------------------------------------------------------

describe('buildCacheKey', () => {
  it('produces identical key for identical inputs', () => {
    const k1 = buildCacheKey('gemini-2.5-flash', 'Hello world', { temp: 0.7 });
    const k2 = buildCacheKey('gemini-2.5-flash', 'Hello world', { temp: 0.7 });
    expect(k1).toBe(k2);
  });

  it('produces different keys for different models', () => {
    const k1 = buildCacheKey('gemini-2.5-flash', 'Hello');
    const k2 = buildCacheKey('gemini-2.5-pro', 'Hello');
    expect(k1).not.toBe(k2);
  });

  it('is insensitive to extra whitespace in prompt', () => {
    const k1 = buildCacheKey('model', 'Hello   World\n\n\n');
    const k2 = buildCacheKey('model', 'Hello World');
    expect(k1).toBe(k2);
  });

  it('sorts object keys for stability', () => {
    const k1 = buildCacheKey('model', 'p', { b: 2, a: 1 });
    const k2 = buildCacheKey('model', 'p', { a: 1, b: 2 });
    expect(k1).toBe(k2);
  });
});

// ---------------------------------------------------------------------------
// Token budget trimming
// ---------------------------------------------------------------------------

describe('applyBudget', () => {
  it('returns prompt unchanged when within budget', () => {
    const short = 'Short prompt';
    expect(applyBudget(short, 'default')).toBe(short);
  });

  it('hard-truncates prompts over the budget', () => {
    // scene_write allows 4000 tokens → 16000 chars
    const huge = 'x'.repeat(100_000);
    const result = applyBudget(huge, 'scene_write');
    expect(estimateTokens(result)).toBeLessThanOrEqual(
      TOKEN_BUDGETS['scene_write'].maxInputTokens + 50 // allow small overshoot from suffix
    );
  });

  it('strips optional sections before hard-truncating', () => {
    const prompt =
      'Required instructions here.\n--- optional ---\nThis is optional.\n--- /optional ---';
    const result = applyBudget(prompt, 'default');
    expect(result).not.toContain('This is optional.');
    expect(result).toContain('Required instructions here.');
  });
});

// ---------------------------------------------------------------------------
// Deterministic RNG
// ---------------------------------------------------------------------------

describe('hashString', () => {
  it('produces the same hash for identical strings', () => {
    expect(hashString('hello')).toBe(hashString('hello'));
  });

  it('produces different hashes for different strings', () => {
    expect(hashString('hello')).not.toBe(hashString('world'));
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = hashString('test');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xFFFFFFFF);
  });
});

describe('mulberry32', () => {
  it('produces deterministic sequences', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    expect(rng1()).toBe(rng2());
    expect(rng1()).toBe(rng2());
  });

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(1234);
    for (let i = 0; i < 20; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1)();
    const b = mulberry32(2)();
    expect(a).not.toBe(b);
  });
});

describe('deterministicSceneCount', () => {
  it('always returns a value within [min, max]', () => {
    for (let ch = 1; ch <= 20; ch++) {
      const count = deterministicSceneCount('seed', ch, 'hash', 0, 11, 14);
      expect(count).toBeGreaterThanOrEqual(11);
      expect(count).toBeLessThanOrEqual(14);
    }
  });

  it('returns the same count for identical inputs', () => {
    const c1 = deterministicSceneCount('proj', 3, 'outline', 0, 11, 14);
    const c2 = deterministicSceneCount('proj', 3, 'outline', 0, 11, 14);
    expect(c1).toBe(c2);
  });

  it('returns a different count when rerollNonce changes', () => {
    const counts = new Set<number>();
    for (let n = 0; n < 20; n++) {
      counts.add(deterministicSceneCount('proj', 5, 'outline', n, 11, 14));
    }
    // With 20 different nonces, we expect more than 1 distinct count
    expect(counts.size).toBeGreaterThan(1);
  });

  it('returns a different count for different chapters', () => {
    const counts = new Set<number>();
    for (let ch = 1; ch <= 20; ch++) {
      counts.add(deterministicSceneCount('proj', ch, 'outline', 0, 11, 14));
    }
    // With 20 different chapters, expect variation
    expect(counts.size).toBeGreaterThan(1);
  });

  it('returns min when min === max', () => {
    const count = deterministicSceneCount('proj', 1, 'outline', 0, 12, 12);
    expect(count).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// Telemetry aggregation
// ---------------------------------------------------------------------------

describe('telemetry (recordMetric / getTotals)', () => {
  beforeEach(() => clearMetrics());

  it('starts with zero totals', () => {
    const t = getTotals();
    expect(t.totalEstimatedInput).toBe(0);
    expect(t.totalEstimatedOutput).toBe(0);
    expect(t.cacheHits).toBe(0);
    expect(t.cacheMisses).toBe(0);
  });

  it('accumulates metrics correctly', () => {
    recordMetric({ estimatedInputTokens: 100, estimatedOutputTokens: 200, cacheHit: false, step: 'scene_write', timestamp: 0 });
    recordMetric({ estimatedInputTokens: 50,  estimatedOutputTokens: 80,  cacheHit: true,  step: 'scene_plan',  timestamp: 1 });
    const t = getTotals();
    expect(t.totalEstimatedInput).toBe(150);
    expect(t.totalEstimatedOutput).toBe(280);
    expect(t.cacheHits).toBe(1);
    expect(t.cacheMisses).toBe(1);
  });

  it('can be cleared', () => {
    recordMetric({ estimatedInputTokens: 99, estimatedOutputTokens: 99, cacheHit: false, step: 'test', timestamp: 0 });
    clearMetrics();
    const t = getTotals();
    expect(t.totalEstimatedInput).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Stitcher
// ---------------------------------------------------------------------------

describe('stitchScenes', () => {
  it('returns empty string for empty array', () => {
    const { markdown, wordCount } = stitchScenes([]);
    expect(markdown).toBe('');
    expect(wordCount).toBe(0);
  });

  it('joins scenes with scene-break markers', () => {
    const { markdown } = stitchScenes(['Scene one.', 'Scene two.']);
    expect(markdown).toContain('---');
  });

  it('strips preamble artefacts', () => {
    const { markdown } = stitchScenes(['Here is the scene: actual content here.']);
    expect(markdown).not.toMatch(/^here is/i);
  });

  it('counts words approximately', () => {
    const scene = 'One two three four five.';
    const { wordCount } = stitchScenes([scene]);
    expect(wordCount).toBe(5);
  });

  it('collapses triple blank lines', () => {
    const { markdown } = stitchScenes(['Line A.\n\n\n\n\nLine B.', 'Scene 2.']);
    expect(markdown).not.toMatch(/\n{3,}/);
  });
});
