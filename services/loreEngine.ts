/**
 * Lore Engine – Persistent World-Building Memory
 *
 * Implements LoreStore backed by IndexedDB with stable IDs for:
 *   characters / locations / factions / rules / timeline events
 *
 * Entity extraction from outline + scenes updates the store incrementally.
 * The Continuity Agent uses LoreStore for conflict checking.
 */

import { orchestratedCall } from './llmOrchestrator';
import { getAi } from './geminiService';
import { Type } from '@google/genai';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoreEntityType = 'character' | 'location' | 'faction' | 'rule' | 'event' | 'item';

export interface LoreEntity {
  id: string;          // stable slug, e.g. "char:elena_vasquez"
  type: LoreEntityType;
  name: string;
  description: string;
  attributes: Record<string, string>;  // flexible key-value properties
  introducedInChapter: number;
  lastSeenInChapter: number;
  tags: string[];
}

// ─── IndexedDB store ──────────────────────────────────────────────────────────

const LORE_DB = 'LoreEngineDB';
const LORE_STORE = 'lore_entities';

async function getLoreDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LORE_DB, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(LORE_STORE)) {
        const store = db.createObjectStore(LORE_STORE, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('name', 'name', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

/** Namespace an entity ID for a given project */
function entityId(projectId: string, type: LoreEntityType, name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `${projectId}:${type}:${slug}`;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function upsertLoreEntity(projectId: string, entity: Omit<LoreEntity, 'id'>): Promise<LoreEntity> {
  const db = await getLoreDB();
  const id = entityId(projectId, entity.type, entity.name);
  const full: LoreEntity = { ...entity, id };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(LORE_STORE, 'readwrite');
    const store = tx.objectStore(LORE_STORE);
    // Merge with existing if present
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing: LoreEntity | undefined = getReq.result;
      const merged: LoreEntity = existing
        ? {
            ...existing,
            description: entity.description || existing.description,
            attributes: { ...existing.attributes, ...entity.attributes },
            lastSeenInChapter: Math.max(existing.lastSeenInChapter, entity.lastSeenInChapter),
            tags: [...new Set([...existing.tags, ...entity.tags])],
          }
        : full;
      store.put(merged);
      tx.oncomplete = () => resolve(merged);
      tx.onerror = () => reject(tx.error);
    };
  });
}

export async function getLoreEntity(projectId: string, type: LoreEntityType, name: string): Promise<LoreEntity | null> {
  const db = await getLoreDB();
  const id = entityId(projectId, type, name);
  return new Promise((resolve) => {
    const tx = db.transaction(LORE_STORE, 'readonly');
    const req = tx.objectStore(LORE_STORE).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

export async function getAllLoreEntities(projectId: string, type?: LoreEntityType): Promise<LoreEntity[]> {
  const db = await getLoreDB();
  return new Promise((resolve) => {
    const tx = db.transaction(LORE_STORE, 'readonly');
    const store = tx.objectStore(LORE_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      let all: LoreEntity[] = req.result ?? [];
      all = all.filter(e => e.id.startsWith(projectId + ':'));
      if (type) all = all.filter(e => e.type === type);
      resolve(all);
    };
    req.onerror = () => resolve([]);
  });
}

export async function deleteLoreEntitiesForProject(projectId: string): Promise<void> {
  const all = await getAllLoreEntities(projectId);
  const db = await getLoreDB();
  const tx = db.transaction(LORE_STORE, 'readwrite');
  const store = tx.objectStore(LORE_STORE);
  for (const e of all) store.delete(e.id);
}

// ─── Entity extraction ────────────────────────────────────────────────────────

const EXTRACT_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      type:        { type: Type.STRING },
      name:        { type: Type.STRING },
      description: { type: Type.STRING },
      attributes:  { type: Type.OBJECT },
      tags:        { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['type', 'name', 'description'],
  },
};

/**
 * Extract lore entities from text and upsert them into the LoreStore.
 * `chapterNumber` is the source chapter for lastSeen / introduced tracking.
 */
export async function extractAndStoreLore(
  projectId: string,
  chapterNumber: number,
  text: string,
): Promise<LoreEntity[]> {
  const truncated = text.length > 5000 ? text.slice(0, 5000) + '…' : text;

  const prompt =
    `Extract all named lore entities (characters, locations, factions, rules/magic-systems, ` +
    `timeline events, important items) from the text below.\n` +
    `For each entity return: type (character|location|faction|rule|event|item), name, ` +
    `description (≤2 sentences), attributes (key:value pairs of notable properties), tags.\n` +
    `Text:\n---\n${truncated}\n---\n` +
    `Return ONLY valid JSON matching the schema. No prose, no markdown fences.`;

  const raw = await orchestratedCall(
    `lore:extract:ch${chapterNumber}`,
    prompt,
    (p) => getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: p,
      config: { responseMimeType: 'application/json', responseSchema: EXTRACT_SCHEMA },
    }),
    EXTRACT_SCHEMA,
    { maxInputTokens: 2000 },
  );

  let extracted: Omit<LoreEntity, 'id' | 'introducedInChapter' | 'lastSeenInChapter'>[] = [];
  try { extracted = JSON.parse(raw); } catch { return []; }

  const results: LoreEntity[] = [];
  for (const e of extracted) {
    if (!e.name || !e.type) continue;
    try {
      const entity = await upsertLoreEntity(projectId, {
        ...e,
        type: e.type as LoreEntityType,
        attributes: e.attributes ?? {},
        tags: e.tags ?? [],
        introducedInChapter: chapterNumber,
        lastSeenInChapter: chapterNumber,
      });
      results.push(entity);
    } catch {
      // skip bad entries
    }
  }
  return results;
}

/** Build a compact lore snapshot string for injection into generation prompts */
export async function buildLoreContext(
  projectId: string,
  maxEntities = 30,
): Promise<string> {
  const all = await getAllLoreEntities(projectId);
  if (all.length === 0) return '';

  // Prioritise characters > factions > locations > rules > events > items
  const priority: LoreEntityType[] = ['character', 'faction', 'location', 'rule', 'event', 'item'];
  all.sort((a, b) => priority.indexOf(a.type) - priority.indexOf(b.type));

  const lines = all.slice(0, maxEntities).map(e => {
    const attrs = Object.entries(e.attributes ?? {})
      .slice(0, 3)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
    return `• [${e.type}] ${e.name}: ${e.description}${attrs ? ' | ' + attrs : ''}`;
  });

  return '=== Lore Bible ===\n' + lines.join('\n');
}
