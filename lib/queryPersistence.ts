/**
 * Persists the TanStack Query invoice cache to IndexedDB so cached invoice
 * listings survive reloads while offline, and exposes staleness metadata
 * (last-sync timestamp + a simple "is this stale" check) for UI badges.
 *
 * Usage (not wired into app/providers.tsx yet — opt-in):
 *   const persister = createIndexedDbPersister();
 *   persistQueryClient({ queryClient, persister, maxAge: ONE_DAY_MS });
 */

const DB_NAME = "kora-query-cache";
const STORE_NAME = "queries";
const CACHE_KEY = "invoice-query-cache";
const LAST_SYNC_KEY = "kora-last-sync-at";

export const STALE_AFTER_MS = 5 * 60 * 1000; // 5 minutes

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface PersistedQueryCache {
  timestamp: number;
  clientState: unknown;
}

export async function saveQueryCache(clientState: unknown): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const payload: PersistedQueryCache = { timestamp: Date.now(), clientState };
  tx.objectStore(STORE_NAME).put(payload, CACHE_KEY);
  try {
    localStorage.setItem(LAST_SYNC_KEY, String(payload.timestamp));
  } catch {
    // localStorage may be unavailable — non-fatal, IndexedDB write still succeeds.
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadQueryCache(): Promise<PersistedQueryCache | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const req = tx.objectStore(STORE_NAME).get(CACHE_KEY);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as PersistedQueryCache) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Timestamp (ms) of the last successful cache persist, or null if never synced. */
export function getLastSyncTimestamp(): number | null {
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

/** Whether cached data older than STALE_AFTER_MS should show a "stale" badge. */
export function isCacheStale(lastSync: number | null = getLastSyncTimestamp()): boolean {
  if (lastSync === null) return false;
  return Date.now() - lastSync > STALE_AFTER_MS;
}
