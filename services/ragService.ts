/// <reference types="vite/client" />
// @ts-ignore – @xenova/transformers ships its own types but they aren't always resolved
import { pipeline } from '@xenova/transformers';
import { BookBible, BibleCharacter, BibleLocation, BibleEvent } from '../types';
import { truncateToTokenBudget } from './tokenOptimizer';

// ---------------------------------------------------------------------------
// Module-level vector store: maps chapterIndex → { content, embedding }
// ---------------------------------------------------------------------------
const vectorStore: Map<number, { content: string; embedding: number[] }> = new Map();

// Lazy-loaded embedder singleton
let embedderInstance: any = null;

async function getEmbedder(): Promise<any> {
  if (!embedderInstance) {
    embedderInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedderInstance;
}

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Embed a chapter and store its vector. Returns the embedding (empty on failure). */
export async function embedChapter(chapterIndex: number, content: string): Promise<number[]> {
  try {
    const embedder = await getEmbedder();
    const output = await embedder(content.substring(0, 2000), { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data) as number[];
    vectorStore.set(chapterIndex, { content, embedding });
    return embedding;
  } catch (e) {
    console.warn('[RAG] Embedding failed:', e);
    return [];
  }
}

/** Retrieve the top-K most semantically relevant chapter excerpts. */
export async function retrieveRelevantContext(
  query: string,
  topK = 3
): Promise<{ chapterIndex: number; excerpt: string; similarity: number }[]> {
  try {
    if (vectorStore.size === 0) return [];
    const embedder = await getEmbedder();
    const output = await embedder(query, { pooling: 'mean', normalize: true });
    const queryEmbedding = Array.from(output.data) as number[];

    const results: { chapterIndex: number; excerpt: string; similarity: number }[] = [];
    for (const [idx, { content, embedding }] of vectorStore.entries()) {
      if (embedding.length === 0) continue;
      results.push({
        chapterIndex: idx,
        excerpt: truncateToTokenBudget(content, 500),
        similarity: cosineSimilarity(queryEmbedding, embedding),
      });
    }
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  } catch (e) {
    console.warn('[RAG] Retrieve failed:', e);
    return [];
  }
}

/** Clear the vector store (call when starting a new book). */
export function clearVectorStore(): void {
  vectorStore.clear();
}

/** Extract Bible entries from a chapter using Gemini, merge with existing Bible. */
export async function extractBibleEntries(
  chapterContent: string,
  chapterNumber: number,
  existingBible: BookBible,
  bookTitle: string
): Promise<BookBible> {
  try {
    // Dynamic import to avoid circular dep (ragService ← geminiService ← ragService)
    const { getAi } = await import('./geminiService');
    const { Type } = await import('@google/genai');
    const { truncateToTokenBudget: ttb } = await import('./tokenOptimizer');

    const ai = getAi();
    const excerpt = ttb(chapterContent, 1000);
    const prompt = `Extract story bible entries from Chapter ${chapterNumber} of "${bookTitle}".

Chapter excerpt:
${excerpt}

Existing characters: ${existingBible.characters.map(c => c.name).join(', ') || 'none'}
Existing locations: ${existingBible.locations.map(l => l.name).join(', ') || 'none'}

Return JSON with NEW or UPDATED entries only. Include characters (name, description, role, firstAppearance), locations (name, description), keyEvents (chapter, summary), and themes.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  role: { type: Type.STRING },
                  firstAppearance: { type: Type.NUMBER },
                },
              },
            },
            locations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
              },
            },
            keyEvents: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  chapter: { type: Type.NUMBER },
                  summary: { type: Type.STRING },
                },
              },
            },
            themes: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
    });

    const newEntries = JSON.parse(response.text || '{}');

    // Merge characters
    const mergedCharacters = [...existingBible.characters];
    for (const nc of (newEntries.characters || []) as BibleCharacter[]) {
      const idx = mergedCharacters.findIndex(c => c.name.toLowerCase() === nc.name.toLowerCase());
      if (idx >= 0) mergedCharacters[idx] = { ...mergedCharacters[idx], ...nc };
      else mergedCharacters.push(nc);
    }

    // Merge locations
    const mergedLocations = [...existingBible.locations];
    for (const nl of (newEntries.locations || []) as BibleLocation[]) {
      const idx = mergedLocations.findIndex(l => l.name.toLowerCase() === nl.name.toLowerCase());
      if (idx >= 0) mergedLocations[idx] = { ...mergedLocations[idx], ...nl };
      else mergedLocations.push(nl);
    }

    // Merge events (no duplicates for same chapter)
    const mergedEvents: BibleEvent[] = [
      ...existingBible.keyEvents,
      ...(newEntries.keyEvents || []).filter(
        (e: BibleEvent) => !existingBible.keyEvents.some(k => k.chapter === e.chapter)
      ),
    ];

    const mergedThemes = Array.from(
      new Set([...existingBible.themes, ...(newEntries.themes || [])])
    );

    return {
      characters: mergedCharacters,
      locations: mergedLocations,
      keyEvents: mergedEvents,
      themes: mergedThemes,
      timeline: existingBible.timeline,
    };
  } catch (e) {
    console.warn('[RAG] Bible extraction failed:', e);
    return existingBible;
  }
}

/** Build a compact Bible context string for prompt injection. */
export function buildBibleContext(bible: BookBible, maxTokens = 200): string {
  const parts: string[] = [];

  if (bible.characters.length > 0) {
    const chars = bible.characters
      .slice(0, 6)
      .map(c => `${c.name} (${c.role}): ${c.description.substring(0, 60)}`)
      .join('; ');
    parts.push(`Characters: ${chars}`);
  }

  if (bible.locations.length > 0) {
    const locs = bible.locations
      .slice(0, 4)
      .map(l => `${l.name}: ${l.description.substring(0, 40)}`)
      .join('; ');
    parts.push(`Locations: ${locs}`);
  }

  if (bible.themes.length > 0) {
    parts.push(`Themes: ${bible.themes.slice(0, 5).join(', ')}`);
  }

  return truncateToTokenBudget(parts.join('\n'), maxTokens);
}
