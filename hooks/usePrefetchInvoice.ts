"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getInvoiceDataSource, queryKeys } from "@/lib/queryKeys";
import { fetchInvoiceById } from "@/services/invoiceService";

const STALE_30S = 30_000;

/** Delay before a hover/focus prefetch fires (avoids flash on quick passes). */
export const PREFETCH_DELAY_MS = 200;

/** Hard cap on in-flight marketplace invoice detail prefetches. */
export const MAX_CONCURRENT_PREFETCHES = 3;

/** Module-level set shared across hook instances for global concurrency. */
const activePrefetches = new Set<string>();

function isFinePointerDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: fine)").matches;
}

function markPrefetchTiming(id: string, phase: "start" | "end"): void {
  if (typeof performance === "undefined" || typeof performance.mark !== "function") {
    return;
  }
  performance.mark(`invoice-prefetch-${phase}-${id}`);
  if (phase === "end") {
    try {
      performance.measure(
        `invoice-prefetch-${id}`,
        `invoice-prefetch-start-${id}`,
        `invoice-prefetch-end-${id}`
      );
    } catch {
      // Marks may be missing if start was skipped; ignore.
    }
  }
}

/** Test-only helper to clear shared concurrency state between cases. */
export function __resetPrefetchStateForTests(): void {
  activePrefetches.clear();
}

/**
 * Prefetch invoice detail data for marketplace → detail navigation.
 *
 * - Desktop fine-pointer only (skips touch)
 * - 200ms hover/focus delay
 * - Max 3 concurrent prefetches (global)
 * - Skips duplicates (cached, in-flight, or already scheduled)
 * - Uses mock- vs live-namespaced query keys
 */
export function usePrefetchInvoice() {
  const queryClient = useQueryClient();
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduledIdRef = useRef<string | null>(null);

  const cancelPrefetch = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    scheduledIdRef.current = null;
  }, []);

  const prefetch = useCallback(
    (id: string) => {
      cancelPrefetch();
      if (!id || !isFinePointerDevice()) return;

      scheduledIdRef.current = id;
      hoverTimerRef.current = setTimeout(() => {
        if (scheduledIdRef.current !== id) return;

        const source = getInvoiceDataSource();
        const queryKey = queryKeys.invoices.detail(id, source);

        // Skip when already cached or already fetching this key
        if (queryClient.getQueryData(queryKey)) return;
        const state = queryClient.getQueryState(queryKey);
        if (state?.fetchStatus === "fetching") return;

        // No duplicate in-flight prefetches for the same id
        if (activePrefetches.has(id)) return;
        if (activePrefetches.size >= MAX_CONCURRENT_PREFETCHES) return;

        activePrefetches.add(id);
        markPrefetchTiming(id, "start");

        void queryClient
          .prefetchQuery({
            queryKey,
            queryFn: () => fetchInvoiceById(id),
            staleTime: STALE_30S,
          })
          .finally(() => {
            activePrefetches.delete(id);
            markPrefetchTiming(id, "end");
          });
      }, PREFETCH_DELAY_MS);
    },
    [queryClient, cancelPrefetch]
  );

  useEffect(() => () => cancelPrefetch(), [cancelPrefetch]);

  return { prefetch, cancelPrefetch };
}
