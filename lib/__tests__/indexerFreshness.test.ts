import { describe, it, expect } from "vitest";
import { getIndexerFreshness, INDEXER_STALE_AFTER_MS } from "@/lib/stellar/indexerFreshness";

describe("getIndexerFreshness", () => {
  const syncedAt = 1_700_000_000_000;

  it("treats a missing timestamp as unknown, not stale", () => {
    expect(getIndexerFreshness(null)).toEqual({
      lastSyncedAt: null,
      ageMs: null,
      isStale: false,
    });
    expect(getIndexerFreshness(undefined).isStale).toBe(false);
  });

  it("reports a recent sync as fresh with its age", () => {
    const result = getIndexerFreshness(syncedAt, syncedAt + 30_000);

    expect(result.lastSyncedAt).toBe(syncedAt);
    expect(result.ageMs).toBe(30_000);
    expect(result.isStale).toBe(false);
  });

  it("crosses into stale only after the threshold", () => {
    expect(getIndexerFreshness(syncedAt, syncedAt + INDEXER_STALE_AFTER_MS).isStale).toBe(false);
    expect(getIndexerFreshness(syncedAt, syncedAt + INDEXER_STALE_AFTER_MS + 1).isStale).toBe(true);
  });

  it("never reports a negative age for a clock that moved backwards", () => {
    expect(getIndexerFreshness(syncedAt, syncedAt - 5_000).ageMs).toBe(0);
  });
});
