/**
 * Critic Agent
 *
 * Returns compact directives JSON: issues, severity, target scene/section, fixes.
 * Does NOT rewrite text – it emits directives for other agents to act on.
 */

import { orchestratedCall, withCanon } from '../services/llmOrchestrator';
import { getAi } from '../services/geminiService';
import { Type } from '@google/genai';

export type IssueSeverity = 'critical' | 'major' | 'minor' | 'suggestion';

export interface CriticDirective {
  severity: IssueSeverity;
  category: 'pacing' | 'character' | 'plot' | 'clarity' | 'style' | 'continuity' | 'emotion';
  target: string;       // e.g. "Scene 3, paragraph 2" or "opening"
  issue: string;        // compact description ≤60 chars
  fix: string;          // specific actionable directive ≤100 chars
}

export interface CriticReport {
  overallScore: number; // 1-10
  directives: CriticDirective[];
  scholarsImpression: string; // 1-2 sentences
}

const CRITIC_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.NUMBER },
    scholarsImpression: { type: Type.STRING },
    directives: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          severity:  { type: Type.STRING },
          category:  { type: Type.STRING },
          target:    { type: Type.STRING },
          issue:     { type: Type.STRING },
          fix:       { type: Type.STRING },
        },
        required: ['severity', 'category', 'target', 'issue', 'fix'],
      },
    },
  },
  required: ['overallScore', 'directives', 'scholarsImpression'],
};

export async function runCriticAgent(
  chapterTitle: string,
  content: string,
  bookTitle: string,
): Promise<CriticReport> {
  const truncated = content.length > 4000 ? content.slice(0, 4000) + '…' : content;

  const prompt = withCanon(
    `You are an elite literary critic for the book "${bookTitle}".\n` +
    `Analyse chapter "${chapterTitle}" and return ONLY a compact directives JSON.\n\n` +
    `Content:\n---\n${truncated}\n---\n\n` +
    `Identify up to 8 issues. For each: severity (critical|major|minor|suggestion), ` +
    `category, target location, a ≤60-char issue description, and a ≤100-char fix directive.\n` +
    `Also provide overallScore (1-10) and scholarsImpression (1-2 sentences).`,
    'jsonOnly',
  );

  const raw = await orchestratedCall(
    `agent:critic:${chapterTitle.slice(0, 20)}`,
    prompt,
    (p) => getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: p,
      config: { responseMimeType: 'application/json', responseSchema: CRITIC_SCHEMA },
    }),
    CRITIC_SCHEMA,
    { maxInputTokens: 3000 },
  );

  try {
    return JSON.parse(raw) as CriticReport;
  } catch {
    return { overallScore: 7, directives: [], scholarsImpression: 'Analysis unavailable.' };
  }
}
