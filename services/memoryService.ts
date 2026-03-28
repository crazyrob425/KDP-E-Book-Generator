/**
 * Memory Service – "Memory without tokens"
 *
 * After each scene/chapter:
 *  1. Extract a micro-summary (≤3 sentences)
 *  2. Extract a delta of continuity facts (character states, locations, events)
 *
 * These are stored in project state (IndexedDB) and injected into subsequent
 * generation calls instead of re-sending the full previous text.
 */

import { orchestratedCall } from './llmOrchestrator';
import { getAi } from './geminiService';
import { Type } from '@google/genai';
import { saveState, loadState } from './storageService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContinuityFact {
  id: string;          // stable ID derived from entity + property
  entity: string;      // e.g. "Elena" / "The Red Tower"
  property: string;    // e.g. "location" / "emotional_state" / "is_alive"
  value: string;       // e.g. "the forest" / "grieving" / "true"
  sourceChapter: number;
}

export interface ChapterMemory {
  chapterNumber: number;
  microSummary: string;       // ≤3 sentences
  facts: ContinuityFact[];    // delta for this chapter
}

export interface ProjectMemory {
  projectId: string;
  chapters: ChapterMemory[];  // ordered by chapter number
  /** Running lore synopsis (updated after each chapter) */
  synopsis: string;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

function memoryKey(projectId: string): string {
  return `project_memory_${projectId}`;
}

// ─── Load / save ──────────────────────────────────────────────────────────────

export async function loadProjectMemory(projectId: string): Promise<ProjectMemory> {
  try {
    const saved = await loadState(memoryKey(projectId));
    if (saved) return saved as ProjectMemory;
  } catch {
    // ignore
  }
  return { projectId, chapters: [], synopsis: '' };
}

export async function saveProjectMemory(memory: ProjectMemory): Promise<void> {
  await saveState(memoryKey(memory.projectId), memory);
}

// ─── Extraction ───────────────────────────────────────────────────────────────

const MICRO_SUMMARY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    microSummary: { type: Type.STRING },
    facts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          entity:   { type: Type.STRING },
          property: { type: Type.STRING },
          value:    { type: Type.STRING },
        },
        required: ['entity', 'property', 'value'],
      },
    },
  },
  required: ['microSummary', 'facts'],
};

/**
 * Extract a micro-summary and continuity-facts delta from a chapter or scene.
 * Returns compact data for injection into future prompts.
 */
export async function extractChapterMemory(
  chapterNumber: number,
  chapterTitle: string,
  content: string,
): Promise<ChapterMemory> {
  const truncated = content.length > 6000 ? content.slice(0, 6000) + '…' : content;

  const prompt =
    `Extract a micro-summary (≤3 sentences) and key continuity facts from the chapter below.\n` +
    `Chapter ${chapterNumber}: "${chapterTitle}"\n---\n${truncated}\n---\n` +
    `Return ONLY valid JSON matching the schema. No prose, no markdown fences.\n` +
    `For each fact: entity is the character/place/item name; property is the attribute; ` +
    `value is the current state after this chapter.`;

  const raw = await orchestratedCall(
    `memory:ch${chapterNumber}`,
    prompt,
    (p) => getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: p,
      config: {
        responseMimeType: 'application/json',
        responseSchema: MICRO_SUMMARY_SCHEMA,
      },
    }),
    MICRO_SUMMARY_SCHEMA,
    { maxInputTokens: 2500 },
  );

  let parsed: { microSummary: string; facts: Omit<ContinuityFact, 'id' | 'sourceChapter'>[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { microSummary: raw.slice(0, 200), facts: [] };
  }

  const facts: ContinuityFact[] = (parsed.facts ?? []).map((f) => ({
    ...f,
    id: `${f.entity}::${f.property}`.toLowerCase().replace(/\s+/g, '_'),
    sourceChapter: chapterNumber,
  }));

  return { chapterNumber, microSummary: parsed.microSummary ?? '', facts };
}

/**
 * Update project memory after a chapter is complete.
 * Merges new facts (newer source wins for same entity::property).
 */
export async function updateProjectMemory(
  projectId: string,
  chapterMemory: ChapterMemory,
): Promise<ProjectMemory> {
  const memory = await loadProjectMemory(projectId);

  // Replace existing entry for the same chapter, or append
  const idx = memory.chapters.findIndex(c => c.chapterNumber === chapterMemory.chapterNumber);
  if (idx >= 0) {
    memory.chapters[idx] = chapterMemory;
  } else {
    memory.chapters.push(chapterMemory);
  }
  memory.chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);

  // Update synopsis – keep last 5 chapter summaries as running context
  const recent = memory.chapters.slice(-5).map(c => `Ch${c.chapterNumber}: ${c.microSummary}`);
  memory.synopsis = recent.join('\n');

  await saveProjectMemory(memory);
  return memory;
}

/**
 * Build a compact rolling-context string for injection into a generation prompt.
 * Uses micro-summaries + deduplicated latest fact values – no full text.
 */
export function buildRollingContext(memory: ProjectMemory, upToChapter: number): string {
  const chapters = memory.chapters.filter(c => c.chapterNumber < upToChapter);
  if (chapters.length === 0) return '';

  // Deduplicate facts: keep the most-recent value for each entity::property
  const latestFacts = new Map<string, ContinuityFact>();
  for (const ch of chapters) {
    for (const f of ch.facts) {
      latestFacts.set(f.id, f);
    }
  }

  const summaryLines = chapters.slice(-3).map(c => `• Ch${c.chapterNumber}: ${c.microSummary}`);
  const factLines = [...latestFacts.values()].slice(0, 20).map(
    f => `• ${f.entity} [${f.property}]: ${f.value}`
  );

  let ctx = '=== Story So Far ===\n' + summaryLines.join('\n');
  if (factLines.length > 0) {
    ctx += '\n\n=== Continuity Facts ===\n' + factLines.join('\n');
  }
  return ctx;
}
