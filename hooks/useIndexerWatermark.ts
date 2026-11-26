"use client";

import { useEffect, useState } from "react";
import { indexerClient } from "@/lib/stellar/indexerClient";

/** Indexer data older than this is considered stale. */
export const INDEXER_STALE_THRESHOLD_MS = 2 * 60_000;

const POLL_INTERVAL_MS = 15_000;

export interface IndexerWatermark {
  ledger: number;
  syncedAt: number | null;
  isStale: boolean;
}

/**
 * Reads the live indexer's last successful sync and flags it as stale when it
 * is older than {@link INDEXER_STALE_THRESHOLD_MS}.
 */
export function useIndexerWatermark(): IndexerWatermark {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const { ledger, syncedAt } = indexerClient.getSyncWatermark();
  const isStale = syncedAt !== null && now - syncedAt > INDEXER_STALE_THRESHOLD_MS;

  return { ledger, syncedAt, isStale };
}
