/**
 * Freshness math for the live Soroban event indexer (#1244).
 *
 * Kept as pure helpers so the threshold and the stale/fresh decision can be
 * tested without a clock or a component tree. The UI only formats the result.
 */

/** Consider indexed availability stale after five minutes without a sync. */
export const INDEXER_STALE_AFTER_MS = 5 * 60 * 1000;

export interface IndexerFreshness {
  lastSyncedAt: number | null;
  /** Milliseconds since the last sync, or `null` when never synced. */
  ageMs: number | null;
  isStale: boolean;
}

export function getIndexerFreshness(
  lastSyncedAt: number | null | undefined,
  now: number = Date.now(),
  staleAfterMs: number = INDEXER_STALE_AFTER_MS
): IndexerFreshness {
  if (typeof lastSyncedAt !== "number" || !Number.isFinite(lastSyncedAt)) {
    return { lastSyncedAt: null, ageMs: null, isStale: false };
  }

  const ageMs = Math.max(0, now - lastSyncedAt);
  return {
    lastSyncedAt,
    ageMs,
    isStale: ageMs > staleAfterMs,
  };
}
