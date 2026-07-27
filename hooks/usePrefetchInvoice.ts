"use client";

import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { fetchInvoiceById } from "@/services/invoiceService";

const PREFETCH_STALE_MS = 30_000; // 30 s — matches useInvoice staleTime

/**
 * usePrefetchInvoice
 *
 * Returns a stable callback that pre-warms the React Query cache for a given
 * invoice id. Call it on mouseEnter / touchStart so the detail data is ready
 * before the user navigates.
 *
 * @example
 * const prefetch = usePrefetchInvoice();
 * <div onMouseEnter={() => prefetch(invoice.id)} />
 */
export function usePrefetchInvoice() {
  const queryClient = useQueryClient();

  return (id: string) => {
    if (!id) return;
    queryClient.prefetchQuery({
      queryKey: queryKeys.invoices.detail(id),
      queryFn: () => fetchInvoiceById(id),
      staleTime: PREFETCH_STALE_MS,
    });
  };
}
