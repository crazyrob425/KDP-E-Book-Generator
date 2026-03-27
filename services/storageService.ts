
// A lightweight wrapper around IndexedDB for handling large datasets (images, audio, manuscript)
// This bypasses the 5MB localStorage limit, allowing for GBs of data.

import { GenerationSettings, DEFAULT_GENERATION_SETTINGS } from '../types';
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'BookFactoryDB';
const STORE_NAME = 'app_state';
/** app_settings store — persists GenerationSettings and other global prefs */
const SETTINGS_STORE = 'app_settings';
const DB_VERSION = 2; // bumped from 1 to add app_settings store

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject('IndexedDB error: ' + (event.target as any).errorCode);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      // v2 migration: add app_settings store
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE);
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
  });
};

export const saveState = async (key: string, state: any): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(state, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const loadState = async (key: string): Promise<any> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const clearState = async (key: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// ---------------------------------------------------------------------------
// Generation settings persistence
// ---------------------------------------------------------------------------

const SETTINGS_KEY = 'generation_settings';

/**
 * Loads GenerationSettings from IndexedDB.
 * Migrates missing fields to defaults (forward-compatible).
 */
export const loadGenerationSettings = async (): Promise<GenerationSettings> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction([SETTINGS_STORE], 'readonly');
    const req = tx.objectStore(SETTINGS_STORE).get(SETTINGS_KEY);
    req.onsuccess = () => {
      const stored = req.result as Partial<GenerationSettings> | undefined;
      const merged: GenerationSettings = {
        ...DEFAULT_GENERATION_SETTINGS,
        ...stored,
        // Ensure projectSeed is always populated
        projectSeed: stored?.projectSeed || uuidv4(),
      };
      resolve(merged);
    };
    req.onerror = () => resolve({ ...DEFAULT_GENERATION_SETTINGS, projectSeed: uuidv4() });
  });
};

/** Persists GenerationSettings to IndexedDB */
export const saveGenerationSettings = async (settings: GenerationSettings): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([SETTINGS_STORE], 'readwrite');
    const req = tx.objectStore(SETTINGS_STORE).put(settings, SETTINGS_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

// Requests the browser to treat this site's storage as "Persistent"
// This prevents the browser from auto-deleting data when disk space is low.
export const requestPersistentStorage = async (): Promise<boolean> => {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`Persisted storage granted: ${isPersisted}`);
    return isPersisted;
  }
  return false;
};

export const checkStorageQuota = async (): Promise<{ usage: number; quota: number }> => {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0
    };
  }
  return { usage: 0, quota: 0 };
};
