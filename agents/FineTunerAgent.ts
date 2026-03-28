/**
 * Fine-Tuner / Copywriter Agent
 *
 * Handles grammar, tone, rhythm, consistency, and genre conventions.
 * Returns compact directives + an enhanced version of the text.
 */

import { orchestratedCall, withCanon } from '../services/llmOrchestrator';
import { getAi } from '../services/geminiService';
import { Type } from '@google/genai';

export interface CopywriterDirective {
  type: 'grammar' | 'tone' | 'rhythm' | 'consistency' | 'genre';
  location: string;   // e.g. "paragraph 3"
  original: string;   // ≤80 chars
  suggestion: string; // ≤80 chars
}

export interface FineTunerReport {
  directives: CopywriterDirective[];
  enhancedText: string; // polished version with all fixes applied
}

const FINETUNE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    directives: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type:       { type: Type.STRING },
          location:   { type: Type.STRING },
          original:   { type: Type.STRING },
          suggestion: { type: Type.STRING },
        },
        required: ['type', 'location', 'original', 'suggestion'],
      },
    },
    enhancedText: { type: Type.STRING },
  },
  required: ['directives', 'enhancedText'],
};

export async function runFineTunerAgent(
  chapterTitle: string,
  content: string,
  genre: string,
): Promise<FineTunerReport> {
  const truncated = content.length > 5000 ? content.slice(0, 5000) + '…' : content;

  const prompt = withCanon(
    `You are an elite copywriter and genre specialist for "${genre}".\n` +
    `Fine-tune the chapter "${chapterTitle}":\n` +
    `- Fix grammar/punctuation errors\n` +
    `- Align tone to genre conventions\n` +
    `- Improve sentence rhythm and vary structure\n` +
    `- Fix inconsistent character names or POV slips\n\n` +
    `Content:\n---\n${truncated}\n---\n\n` +
    `Return directives (≤8) AND the full enhancedText with all changes applied.`,
    'jsonOnly',
    'markdownChapter',
    'preservePlot',
  );

  const raw = await orchestratedCall(
    `agent:finetune:${chapterTitle.slice(0, 20)}`,
    prompt,
    (p) => getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: p,
      config: { responseMimeType: 'application/json', responseSchema: FINETUNE_SCHEMA },
    }),
    FINETUNE_SCHEMA,
    { maxInputTokens: 4000, skipCache: true },
  );

  try {
    return JSON.parse(raw) as FineTunerReport;
  } catch {
    return { directives: [], enhancedText: content };
  }
}
