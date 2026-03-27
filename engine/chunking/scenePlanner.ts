/**
 * scenePlanner.ts
 *
 * Generates a compact, structured JSON scene plan for a chapter.
 * Uses deterministic seeded randomness to pick 11–14 scenes per chapter,
 * which produces "humanising" variation without sacrificing cache stability.
 *
 * Seed formula:
 *   seed = murmurHash(projectSeed + ":" + chapterNumber + ":" + outlineHash + ":" + rerollNonce)
 *
 * The same inputs always produce the same scene count.
 * Incrementing rerollNonce re-randomises the count intentionally.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { getAi } from '../../services/geminiService';
import { orchestratedCall } from '../../services/llmOrchestrator';
import { ScenePlan, ChapterScenePlan, GenerationSettings } from '../../types';

// ---------------------------------------------------------------------------
// Deterministic seeded RNG (mulberry32)
// ---------------------------------------------------------------------------

/** Lightweight 32-bit hash (djb2) for stable seeding */
export function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0; // unsigned 32-bit
  }
  return h;
}

/** Mulberry32 PRNG — deterministic, seeded */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function () {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let z = Math.imul(state ^ (state >>> 15), 1 | state);
    z = (z ^ (z + Math.imul(z ^ (z >>> 7), 61 | z))) >>> 0;
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  };
}

/**
 * Returns a deterministic integer in [min, max] (inclusive) for the given inputs.
 * Identical inputs → identical result; change rerollNonce to regenerate.
 */
export function deterministicSceneCount(
  projectSeed: string,
  chapterNumber: number,
  outlineHash: string,
  rerollNonce: number,
  min: number,
  max: number
): number {
  const seedStr = `${projectSeed}:${chapterNumber}:${outlineHash}:${rerollNonce}`;
  const seed = hashString(seedStr);
  const rng = mulberry32(seed);
  const range = max - min + 1;
  return min + Math.floor(rng() * range);
}

// ---------------------------------------------------------------------------
// Scene Plan API
// ---------------------------------------------------------------------------

const SCENE_PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    scenes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id:             { type: Type.STRING },
          purpose:        { type: Type.STRING },
          conflict:       { type: Type.STRING },
          turn:           { type: Type.STRING },
          requiredFactIds:{ type: Type.ARRAY, items: { type: Type.STRING } },
          wordTarget:     { type: Type.NUMBER },
          styleNotes:     { type: Type.STRING },
          endingHandoff:  { type: Type.STRING },
        },
        required: ['id','purpose','conflict','turn','wordTarget','endingHandoff'],
      },
    },
  },
  required: ['scenes'],
};

export interface ScenePlannerOptions {
  chapterTitle: string;
  chapterSummary: string;
  bookTitle: string;
  /** Short voice contract (POV, tense, tone) */
  voiceContract: string;
  sceneCount: number;
  /** Optional: existing continuity facts (1 line each) */
  continuityFacts?: string[];
}

/**
 * Calls the LLM to produce a structured scene plan for one chapter.
 * Returns the raw ScenePlan array.
 */
export async function planChapterScenes(
  options: ScenePlannerOptions,
  ai?: GoogleGenAI
): Promise<ScenePlan[]> {
  const {
    chapterTitle,
    chapterSummary,
    bookTitle,
    voiceContract,
    sceneCount,
    continuityFacts = [],
  } = options;

  const factsBlock =
    continuityFacts.length > 0
      ? `\nKey continuity facts:\n${continuityFacts.map((f) => `- ${f}`).join('\n')}`
      : '';

  const prompt = `You are a scene planner for the book "${bookTitle}".
Voice contract: ${voiceContract}
Chapter title: "${chapterTitle}"
Chapter summary: ${chapterSummary}${factsBlock}

Plan exactly ${sceneCount} scenes for this chapter. For each scene provide:
- id (scene_1 … scene_${sceneCount})
- purpose (one sentence: what this scene accomplishes)
- conflict (the obstacle or tension)
- turn (how it ends or pivots)
- requiredFactIds (list of continuity-fact IDs needed; use empty array if none)
- wordTarget (suggested word count, 300–700)
- styleNotes (brief tone/pacing note, ≤ 15 words)
- endingHandoff (one line: what must be true at the start of the NEXT scene)

Return strict JSON. No preamble.`;

  const instance = ai ?? getAi();
  const text = await orchestratedCall(instance, {
    step: 'scene_plan',
    model: 'gemini-2.5-flash',
    prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: SCENE_PLAN_SCHEMA,
    },
  });

  const parsed = JSON.parse(text || '{"scenes":[]}');
  return (parsed.scenes ?? []) as ScenePlan[];
}

/**
 * High-level function: determine scene count deterministically then fetch the plan.
 * Returns a full ChapterScenePlan (includes sceneCount + rerollNonce for storage).
 */
export async function buildChapterScenePlan(
  chapterNumber: number,
  chapterTitle: string,
  chapterSummary: string,
  bookTitle: string,
  voiceContract: string,
  settings: GenerationSettings,
  outlineHash: string,
  rerollNonce: number = 0,
  continuityFacts: string[] = [],
  ai?: GoogleGenAI
): Promise<ChapterScenePlan> {
  const sceneCount = deterministicSceneCount(
    settings.projectSeed,
    chapterNumber,
    outlineHash,
    rerollNonce,
    settings.sceneCountMin,
    settings.sceneCountMax
  );

  const scenes = await planChapterScenes(
    {
      chapterTitle,
      chapterSummary,
      bookTitle,
      voiceContract,
      sceneCount,
      continuityFacts,
    },
    ai
  );

  return { chapterNumber, sceneCount, scenes, rerollNonce };
}
