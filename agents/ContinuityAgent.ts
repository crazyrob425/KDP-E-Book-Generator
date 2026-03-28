/**
 * Continuity Agent
 *
 * Checks chapter content against LoreEngine facts, flags conflicts,
 * and proposes minimal edits to fix them.
 */

import { orchestratedCall, withCanon } from '../services/llmOrchestrator';
import { getAi } from '../services/geminiService';
import { getAllLoreEntities, LoreEntity } from '../services/loreEngine';
import { Type } from '@google/genai';

export interface ContinuityConflict {
  entity: string;
  property: string;
  valueInLore: string;
  valueInText: string;
  location: string;  // where in the chapter
  proposedFix: string;
}

export interface ContinuityReport {
  conflicts: ContinuityConflict[];
  summary: string;
}

const CONTINUITY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    conflicts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          entity:        { type: Type.STRING },
          property:      { type: Type.STRING },
          valueInLore:   { type: Type.STRING },
          valueInText:   { type: Type.STRING },
          location:      { type: Type.STRING },
          proposedFix:   { type: Type.STRING },
        },
        required: ['entity', 'property', 'valueInLore', 'valueInText', 'location', 'proposedFix'],
      },
    },
    summary: { type: Type.STRING },
  },
  required: ['conflicts', 'summary'],
};

export async function runContinuityAgent(
  projectId: string,
  chapterTitle: string,
  content: string,
): Promise<ContinuityReport> {
  let loreEntities: LoreEntity[] = [];
  try { loreEntities = await getAllLoreEntities(projectId); } catch { /* non-fatal */ }

  if (loreEntities.length === 0) {
    return { conflicts: [], summary: 'No lore data available for continuity check.' };
  }

  // Build compact lore snapshot for injection
  const loreBlock = loreEntities.slice(0, 30).map(e => {
    const attrs = Object.entries(e.attributes ?? {}).slice(0, 3)
      .map(([k, v]) => `${k}=${v}`).join(', ');
    return `• [${e.type}] ${e.name}: ${e.description}${attrs ? ' | ' + attrs : ''}`;
  }).join('\n');

  const truncated = content.length > 3500 ? content.slice(0, 3500) + '…' : content;

  const prompt = withCanon(
    `You are a continuity editor.\n` +
    `Check the chapter "${chapterTitle}" for conflicts against the lore bible.\n\n` +
    `Lore Bible:\n${loreBlock}\n\n` +
    `Chapter Content:\n---\n${truncated}\n---\n\n` +
    `List any conflicts: entity, property, what the lore says vs what the text says, ` +
    `where in the chapter, and a proposed minimal fix.\n` +
    `If no conflicts, return empty conflicts array with a clear summary.`,
    'jsonOnly',
  );

  const raw = await orchestratedCall(
    `agent:continuity:${chapterTitle.slice(0, 20)}`,
    prompt,
    (p) => getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: p,
      config: { responseMimeType: 'application/json', responseSchema: CONTINUITY_SCHEMA },
    }),
    CONTINUITY_SCHEMA,
    { maxInputTokens: 3000 },
  );

  try {
    return JSON.parse(raw) as ContinuityReport;
  } catch {
    return { conflicts: [], summary: 'Continuity analysis unavailable.' };
  }
}
