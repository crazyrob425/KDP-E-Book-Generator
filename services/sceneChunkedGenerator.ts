/**
 * Scene-Chunked Chapter Generator
 *
 * Default generation strategy:
 *  1. Plan scenes (JSON schema, deterministic count 11-14)
 *  2. Draft each scene with rolling micro-context
 *  3. Stitch scenes locally
 *  4. Polish pass: enhance emotion, improve flow, cap expansion at ~6%
 */

import { orchestratedCall, deterministicSceneCount, withCanon, estimateTokens } from './llmOrchestrator';
import { buildRollingContext, ProjectMemory } from './memoryService';
import { buildLoreContext } from './loreEngine';
import { getAi } from './geminiService';
import { Type } from '@google/genai';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScenePlan {
  index: number;       // 1-based
  title: string;
  purpose: string;     // narrative function of this scene
  emotionalBeat: string;
  openingHook: string;
}

export interface GenerationSettings {
  strategy: 'chunked' | 'single';
  sceneMin: number;         // default 11
  sceneMax: number;         // default 14
  emotionalPolish: boolean; // default true
  expansionCapPct: number;  // default 6
  projectSeed: string;
  rerollNonces: Record<number, number>; // chapterNumber -> nonce
}

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  strategy: 'chunked',
  sceneMin: 11,
  sceneMax: 14,
  emotionalPolish: true,
  expansionCapPct: 6,
  projectSeed: 'default',
  rerollNonces: {},
};

export interface ChunkGenerationProgress {
  stage: 'planning' | 'drafting' | 'stitching' | 'polishing' | 'done';
  sceneIndex?: number;
  totalScenes?: number;
  message: string;
}

// ─── Scene planning ───────────────────────────────────────────────────────────

const SCENE_PLAN_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      index:        { type: Type.NUMBER },
      title:        { type: Type.STRING },
      purpose:      { type: Type.STRING },
      emotionalBeat:{ type: Type.STRING },
      openingHook:  { type: Type.STRING },
    },
    required: ['index', 'title', 'purpose', 'emotionalBeat', 'openingHook'],
  },
};

async function planScenes(
  chapterTitle: string,
  chapterSummary: string,
  sceneCount: number,
  rollingContext: string,
  loreContext: string,
): Promise<ScenePlan[]> {
  const context = [loreContext, rollingContext].filter(Boolean).join('\n\n');
  const contextBlock = context ? `\n\n${context}\n` : '';

  const prompt = withCanon(
    `Plan ${sceneCount} scenes for this chapter.\n` +
    `Chapter: "${chapterTitle}"\nSummary: ${chapterSummary}` +
    contextBlock +
    `\nFor each scene: index (1-based), title, purpose (narrative role), emotionalBeat, openingHook (≤1 sentence).`,
    'jsonOnly',
  );

  const raw = await orchestratedCall(
    `scenes:plan:${chapterTitle.slice(0, 20)}`,
    prompt,
    (p) => getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: p,
      config: { responseMimeType: 'application/json', responseSchema: SCENE_PLAN_SCHEMA },
    }),
    SCENE_PLAN_SCHEMA,
    { maxInputTokens: 3000 },
  );

  try {
    return JSON.parse(raw) as ScenePlan[];
  } catch {
    // Fallback: generate minimal plan
    return Array.from({ length: sceneCount }, (_, i) => ({
      index: i + 1,
      title: `Scene ${i + 1}`,
      purpose: 'advance the plot',
      emotionalBeat: 'neutral',
      openingHook: '',
    }));
  }
}

// ─── Per-scene drafting ───────────────────────────────────────────────────────

async function draftScene(
  chapterTitle: string,
  scene: ScenePlan,
  prevSceneSummary: string,
  loreContext: string,
  lengthGuidance: string,
): Promise<string> {
  const contextLines: string[] = [];
  if (loreContext) contextLines.push(loreContext);
  if (prevSceneSummary) contextLines.push(`Previous scene recap: ${prevSceneSummary}`);

  const contextBlock = contextLines.length > 0 ? '\n\n' + contextLines.join('\n') + '\n' : '';

  const prompt = withCanon(
    `Write scene ${scene.index} of the chapter "${chapterTitle}".\n` +
    `Scene title: ${scene.title}\n` +
    `Narrative purpose: ${scene.purpose}\n` +
    `Emotional beat: ${scene.emotionalBeat}\n` +
    (scene.openingHook ? `Opening hook: ${scene.openingHook}\n` : '') +
    contextBlock +
    `Target length: ${lengthGuidance}.\n` +
    `Write in Markdown. Do not include a heading.`,
    'markdownChapter',
    'preservePlot',
    'noPageRefs',
  );

  return orchestratedCall(
    `scenes:draft:${scene.index}`,
    prompt,
    (p) => getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: p,
    }),
    undefined,
    { maxInputTokens: 4000 },
  );
}

// ─── Polish pass ──────────────────────────────────────────────────────────────

async function polishChapter(
  chapterTitle: string,
  draft: string,
  expansionCapPct: number,
): Promise<string> {
  const maxOutputChars = Math.round(draft.length * (1 + expansionCapPct / 100));

  const prompt = withCanon(
    `Polish the chapter "${chapterTitle}".\n` +
    `Tasks: enhance emotional depth, improve narrative flow, remove repetition, ` +
    `ensure consistent voice, fix any abrupt scene transitions.\n` +
    `HARD RULE: the output MUST NOT exceed ${maxOutputChars} characters ` +
    `(≤${expansionCapPct}% expansion from the ${draft.length}-char draft).\n` +
    `Return ONLY the polished Markdown text.\n\n` +
    `Draft:\n---\n${draft}\n---`,
    'markdownChapter',
    'preservePlot',
    'noPageRefs',
  );

  const polished = await orchestratedCall(
    `polish:${chapterTitle.slice(0, 20)}`,
    prompt,
    (p) => getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: p,
    }),
    undefined,
    { maxInputTokens: 8000, skipCache: true },
  );

  // Enforce cap: if the model still produced too much, truncate gracefully
  if (polished.length > maxOutputChars * 1.1) {
    return polished.slice(0, maxOutputChars);
  }
  return polished;
}

// ─── Extract brief scene summary (for rolling context) ───────────────────────

function quickSummary(sceneText: string): string {
  // Take first 2 sentences as a cheap summary without an extra API call
  const sentences = sceneText.match(/[^.!?]+[.!?]+/g) ?? [];
  return sentences.slice(0, 2).join(' ').trim();
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Generate chapter content using scene-chunked strategy.
 *
 * @param chapterNumber  1-based chapter index
 * @param chapterTitle   Title of the chapter
 * @param chapterSummary Outline summary
 * @param lengthGuidance e.g. "3-5 pages (medium)"
 * @param settings       Generation settings (includes project seed and reroll nonces)
 * @param memory         Project memory for rolling context
 * @param projectId      Used to load lore context
 * @param outlineHash    Stable hash of the outline (for seed determinism)
 * @param onProgress     Progress callback
 */
export async function generateChapterChunked(
  chapterNumber: number,
  chapterTitle: string,
  chapterSummary: string,
  lengthGuidance: string,
  settings: GenerationSettings,
  memory: ProjectMemory,
  projectId: string,
  outlineHash: string,
  onProgress: (p: ChunkGenerationProgress) => void,
): Promise<string> {
  const rerollNonce = settings.rerollNonces[chapterNumber] ?? 0;
  const sceneCount = deterministicSceneCount(
    settings.projectSeed,
    chapterNumber,
    outlineHash,
    rerollNonce,
    settings.sceneMin,
    settings.sceneMax,
  );

  // Rolling context from previous chapters
  const rollingContext = buildRollingContext(memory, chapterNumber);

  // Lore context
  let loreContext = '';
  try { loreContext = await buildLoreContext(projectId, 25); } catch { /* non-fatal */ }

  // Scene length guidance: split total guidance across scenes
  const perSceneGuidance = `short paragraph (${Math.round(250 / sceneCount * 10) / 10} words approx)`;

  // ── Stage 1: Plan scenes ─────────────────────────────────────────────────
  onProgress({ stage: 'planning', totalScenes: sceneCount, message: `Planning ${sceneCount} scenes…` });
  const scenes = await planScenes(chapterTitle, chapterSummary, sceneCount, rollingContext, loreContext);

  // ── Stage 2: Draft each scene ─────────────────────────────────────────────
  const draftedScenes: string[] = [];
  let prevSceneSummary = '';

  for (const scene of scenes) {
    onProgress({
      stage: 'drafting',
      sceneIndex: scene.index,
      totalScenes: sceneCount,
      message: `Drafting scene ${scene.index}/${sceneCount}: "${scene.title}"…`,
    });

    const sceneDraft = await draftScene(
      chapterTitle,
      scene,
      prevSceneSummary,
      loreContext,
      perSceneGuidance,
    );
    draftedScenes.push(sceneDraft);
    prevSceneSummary = quickSummary(sceneDraft);
  }

  // ── Stage 3: Stitch ───────────────────────────────────────────────────────
  onProgress({ stage: 'stitching', message: 'Stitching scenes…' });
  const stitched = draftedScenes.join('\n\n');

  // ── Stage 4: Polish ───────────────────────────────────────────────────────
  if (settings.emotionalPolish) {
    onProgress({ stage: 'polishing', message: 'Polishing for emotion & flow…' });
    const polished = await polishChapter(chapterTitle, stitched, settings.expansionCapPct);
    onProgress({ stage: 'done', message: 'Chapter complete.' });
    return polished;
  }

  onProgress({ stage: 'done', message: 'Chapter complete.' });
  return stitched;
}

// ─── Outline hash ─────────────────────────────────────────────────────────────

/** Stable string hash of the chapter titles for seed determinism */
export function hashOutline(titles: string[]): string {
  let h = 0;
  const s = titles.join('|');
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return (h >>> 0).toString(36);
}
