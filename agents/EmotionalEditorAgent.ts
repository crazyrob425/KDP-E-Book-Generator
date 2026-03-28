/**
 * Emotional Editor Agent
 *
 * Emits directives to heighten emotional impact.
 * Operates on compact representations — directives only, no rewrite.
 */

import { orchestratedCall, withCanon } from '../services/llmOrchestrator';
import { getAi } from '../services/geminiService';
import { Type } from '@google/genai';

export interface EmotionalDirective {
  target: string;    // paragraph / scene reference
  currentEmotion: string;
  desiredEmotion: string;
  technique: string; // e.g. "add internal monologue", "slow pacing with short sentences"
  exampleLine?: string; // optional replacement line
}

export interface EmotionalEditorReport {
  directives: EmotionalDirective[];
  overallEmotionalArc: string; // 1-sentence assessment
}

const EMOTIONAL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overallEmotionalArc: { type: Type.STRING },
    directives: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          target:          { type: Type.STRING },
          currentEmotion:  { type: Type.STRING },
          desiredEmotion:  { type: Type.STRING },
          technique:       { type: Type.STRING },
          exampleLine:     { type: Type.STRING },
        },
        required: ['target', 'currentEmotion', 'desiredEmotion', 'technique'],
      },
    },
  },
  required: ['overallEmotionalArc', 'directives'],
};

export async function runEmotionalEditorAgent(
  chapterTitle: string,
  content: string,
): Promise<EmotionalEditorReport> {
  const truncated = content.length > 4000 ? content.slice(0, 4000) + '…' : content;

  const prompt = withCanon(
    `You are an expert emotional editor.\n` +
    `Analyse chapter "${chapterTitle}" for emotional resonance.\n` +
    `Content:\n---\n${truncated}\n---\n\n` +
    `Return up to 6 directives to heighten emotional impact. ` +
    `For each: target location, currentEmotion, desiredEmotion, technique (≤80 chars), optional exampleLine.\n` +
    `Also summarise the overall emotional arc in one sentence.`,
    'jsonOnly',
  );

  const raw = await orchestratedCall(
    `agent:emotional:${chapterTitle.slice(0, 20)}`,
    prompt,
    (p) => getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: p,
      config: { responseMimeType: 'application/json', responseSchema: EMOTIONAL_SCHEMA },
    }),
    EMOTIONAL_SCHEMA,
    { maxInputTokens: 2500 },
  );

  try {
    return JSON.parse(raw) as EmotionalEditorReport;
  } catch {
    return { directives: [], overallEmotionalArc: 'Analysis unavailable.' };
  }
}
