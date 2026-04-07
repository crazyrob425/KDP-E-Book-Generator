
// A lightweight wrapper around IndexedDB for handling large datasets (images, audio, manuscript)
// This bypasses the 5MB localStorage limit, allowing for GBs of data.

const DB_NAME = 'BookFactoryDB';
const STORE_NAME = 'app_state';
// Bump DB_VERSION when adding new object stores or indexes so onupgradeneeded fires.
// Migration logic below handles transitions between versions.
const DB_VERSION = 2;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject('IndexedDB error: ' + (event.target as any).errorCode);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      // Version 1 → initial schema
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      }

      // Version 2 → add a dedicated 'projects' store for multi-project support
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
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

// ---------------------------------------------------------------------------
// Schema versioning helpers
// ---------------------------------------------------------------------------

/** Supported persisted payload versions. */
export type PersistedVersion = 1 | 2;

/**
 * Migrate a raw persisted blob from an older schema version to the current one.
 * Returns the migrated object (does not persist it – the caller must re-save).
 *
 * Version history:
 *   v1 → v2: Wraps legacy flat payload in a { version, ...state } envelope and
 *             normalises the `covers` field introduced in ProjectFileV2.
 */
export const migrateState = (raw: any): any => {
  if (!raw || typeof raw !== 'object') return raw;

  // Already at current version – nothing to do.
  if (raw.version === 2) return raw;

  // v1 (or unversioned) → v2
  const migrated: any = {
    version: 2 as PersistedVersion,
    lastSaved: raw.date ?? raw.lastSaved ?? new Date().toISOString(),
    bookOutline: raw.bookOutline ?? null,
    marketReport: raw.marketReport ?? null,
    authorProfile: raw.authorProfile ?? null,
    marketingInfo: raw.kdpMarketingInfo ?? raw.marketingInfo ?? null,
    covers: raw.covers ?? {
      current: raw.bookCoverUrl ?? null,
      history: raw.covers?.history ?? (raw.bookCoverUrl ? [raw.bookCoverUrl] : []),
    },
    uiState: raw.uiState ?? {
      currentStep: raw.currentStep ?? 0,
      pagesPerChapter: raw.pagesPerChapter ?? '8-12',
      selectedGenre: raw.selectedGenre ?? null,
    },
  };

  return migrated;
};

/**
 * Load a persisted state value and automatically migrate it to the current
 * schema version.  Wraps `loadState` with corruption recovery: if the stored
 * value cannot be migrated (e.g. corrupted JSON stored as a raw object), the
 * function returns `null` and logs a warning instead of throwing.
 */
export const loadStateVersioned = async (key: string): Promise<any | null> => {
  try {
    const raw = await loadState(key);
    if (raw == null) return null;
    return migrateState(raw);
  } catch (e) {
    console.warn(`[storageService] Failed to load/migrate state for key "${key}". Returning null.`, e);
    return null;
  }
};
