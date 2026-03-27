/**
 * sceneWriter.ts
 *
 * Drafts a single scene given:
 *   - The scene plan entry
 *   - A rolling micro-summary from the previous scene (≤ 120 tokens)
 *   - Minimal continuity facts (by ID + 1 line each)
 *   - The global voice contract
 *
 * Returns: scene markdown + new micro-summary + continuity delta
 */

import { GoogleGenAI, Type } from '@google/genai';
import { getAi } from '../../services/geminiService';
import { orchestratedCall } from '../../services/llmOrchestrator';
import { ScenePlan } from '../../types';

export interface SceneWriteOptions {
  scene: ScenePlan;
  prevMicroSummary: string;    // ≤ 120 tokens from the prior scene
  voiceContract: string;
  /** Map of factId -> one-line description */
  factMap: Record<string, string>;
  bookTitle: string;
  chapterTitle: string;
}

export interface SceneWriteResult {
  sceneMarkdown: string;
  microSummary: string;        // ≤ 120 tokens — pass to the next scene
  continuityDelta: string[];   // New facts introduced in this scene
}

const SCENE_WRITE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    sceneMarkdown:    { type: Type.STRING },
    microSummary:     { type: Type.STRING },
    continuityDelta:  { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['sceneMarkdown', 'microSummary', 'continuityDelta'],
};

/**
 * Drafts one scene, keeping the prompt size bounded by including only the
 * facts that the scene plan specifically references.
 */
export async function writeScene(
  options: SceneWriteOptions,
  ai?: GoogleGenAI
): Promise<SceneWriteResult> {
  const {
    scene,
    prevMicroSummary,
    voiceContract,
    factMap,
    bookTitle,
    chapterTitle,
  } = options;

  // Include only required facts to keep prompt lean
  const requiredFacts = (scene.requiredFactIds ?? [])
    .map((id) => factMap[id] ? `[${id}] ${factMap[id]}` : null)
    .filter(Boolean)
    .join('\n');

  const factsBlock = requiredFacts
    ? `\nRequired continuity facts:\n${requiredFacts}`
    : '';

  const prevBlock = prevMicroSummary
    ? `\nPrevious scene summary (≤120 tokens): ${prevMicroSummary}`
    : '';

  const prompt = `You are writing a scene for the book "${bookTitle}", chapter "${chapterTitle}".

Voice contract: ${voiceContract}

Scene plan:
- Purpose: ${scene.purpose}
- Conflict: ${scene.conflict}
- Turn: ${scene.turn}
- Style notes: ${scene.styleNotes ?? ''}
- Ending handoff: ${scene.endingHandoff}
- Target word count: ~${scene.wordTarget} words
${prevBlock}${factsBlock}

Instructions:
1. Write the scene in Markdown prose — no headings, no preamble.
2. Show, don't tell. Use subtext and sensory detail.
3. Do NOT exceed ${Math.round(scene.wordTarget * 1.1)} words.
4. After the scene, produce a micro-summary in ≤120 tokens capturing what happened and the emotional state.
5. List any NEW named characters/places/rules introduced as continuityDelta strings (empty array if none).

Return strict JSON with fields: sceneMarkdown, microSummary, continuityDelta.`;

  const instance = ai ?? getAi();
  const text = await orchestratedCall(instance, {
    step: 'scene_write',
    model: 'gemini-2.5-flash',
    prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: SCENE_WRITE_SCHEMA,
    },
  });

  const parsed = JSON.parse(text || '{}');
  return {
    sceneMarkdown: parsed.sceneMarkdown ?? '',
    microSummary:  parsed.microSummary  ?? '',
    continuityDelta: parsed.continuityDelta ?? [],
  };
}
