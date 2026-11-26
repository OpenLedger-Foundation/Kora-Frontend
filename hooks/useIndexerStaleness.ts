"use client";

import { useEffect, useState } from "react";
import { indexerClient } from "@/lib/stellar/indexerClient";
import {
  getIndexerFreshness,
  INDEXER_STALE_AFTER_MS,
  type IndexerFreshness,
} from "@/lib/stellar/indexerFreshness";

export interface UseIndexerStalenessOptions {
  /** Age at which indexed data is considered stale (default 5 minutes). */
  staleAfterMs?: number;
  /** How often the clock advances while the page stays open (default 30s). */
  tickMs?: number;
}

/**
 * Reports how recently the live indexer completed a sync.
 *
 * The indexer has no event emitter, so the hook re-reads its timestamp on a
 * light interval; a marketplace query refetch also re-renders the consumer and
 * picks up the newest value immediately.
 */
export function useIndexerStaleness(options: UseIndexerStalenessOptions = {}): IndexerFreshness {
  const { staleAfterMs = INDEXER_STALE_AFTER_MS, tickMs = 30_000 } = options;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(timer);
  }, [tickMs]);

  return getIndexerFreshness(indexerClient.getLastSyncedAt(), now, staleAfterMs);
}
