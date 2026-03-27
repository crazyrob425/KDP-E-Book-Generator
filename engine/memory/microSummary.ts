/**
 * microSummary.ts
 *
 * IndexedDB-backed store for per-chapter micro-summaries and continuity deltas.
 * Allows later chapters / rewrites to reference story state without resending
 * large amounts of prose.
 */

import { ChapterMemory } from '../../types';

const DB_NAME = 'ChapterMemoryDB';
const STORE_NAME = 'chapter_memory';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'chapterNumber' });
      }
    };
    req.onsuccess = () => {
      dbInstance = req.result;
      resolve(req.result);
    };
  });
}

/** Persists (or overwrites) a ChapterMemory entry */
export async function saveChapterMemory(memory: ChapterMemory): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(memory);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Returns the stored ChapterMemory for a chapter, or null */
export async function loadChapterMemory(
  chapterNumber: number
): Promise<ChapterMemory | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(chapterNumber);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Returns memories for all chapters up to (but not including) chapterNumber */
export async function loadPriorMemories(
  chapterNumber: number
): Promise<ChapterMemory[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const all: ChapterMemory[] = req.result ?? [];
      resolve(all.filter((m) => m.chapterNumber < chapterNumber));
    };
    req.onerror = () => reject(req.error);
  });
}

/** Clears all chapter memories (e.g. when starting a new book) */
export async function clearAllMemories(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
