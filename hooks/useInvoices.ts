"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useInvoiceStore } from "@/store/invoiceStore";
import {
  fetchInvoices,
  fetchInvoiceById,
  fetchInvoicesByOwner,
  fetchInvestorPositions,
  prepareCreateInvoice,
  prepareFundInvoice,
} from "@/services/invoiceService";
import type { CreateInvoiceFormData, MarketplaceSortKey } from "@/types";

const STALE_30S = 30_000;
const GC_5MIN = 5 * 60 * 1000;

const SORT_KEY_MAP: Record<string, MarketplaceSortKey> = {
  apr: "apr",
  amount: "amount",
  dueDate: "duration",
  listed: "createdAt",
};

// ─── List ─────────────────────────────────────────────────────────────────────

export function useInvoices(pageOrOpts?: number | { refetchInterval?: number }, opts?: { refetchInterval?: number }) {
  const page = typeof pageOrOpts === "number" ? pageOrOpts : 1;
  const refetchInterval = typeof pageOrOpts === "object" ? pageOrOpts?.refetchInterval : opts?.refetchInterval;
  const { filters, sort } = useInvoiceStore();
  return useQuery({
    queryKey: queryKeys.invoices.list(filters, sort, page),
    queryFn: () =>
      fetchInvoices(
        filters,
        { key: SORT_KEY_MAP[sort.sortBy] ?? "apr", direction: sort.sortDir },
        page
      ),
    staleTime: STALE_30S,
    gcTime: GC_5MIN,
    refetchInterval,
  });
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export function useInvoice(id: string) {
  return useQuery({
    queryKey: queryKeys.invoices.detail(id),
    queryFn: () => fetchInvoiceById(id),
    enabled: !!id,
    staleTime: STALE_30S,
    gcTime: GC_5MIN,
  });
}

/** Call on InvoiceCard mouseEnter to warm the cache before navigation. */
export function usePrefetchInvoice() {
  const queryClient = useQueryClient();
  return (id: string) =>
    queryClient.prefetchQuery({
      queryKey: queryKeys.invoices.detail(id),
      queryFn: () => fetchInvoiceById(id),
      staleTime: STALE_30S,
    });
}

// ─── SME invoices ─────────────────────────────────────────────────────────────

export function useSMEInvoices(address: string | undefined) {
  return useQuery({
    queryKey: queryKeys.invoices.byOwner(address ?? ""),
    queryFn: () => fetchInvoicesByOwner(address!),
    enabled: !!address,
    staleTime: STALE_30S,
    refetchInterval: STALE_30S,
    gcTime: GC_5MIN,
  });
}

// ─── Investor positions ───────────────────────────────────────────────────────

export function useInvestorPositions(address: string | undefined) {
  return useQuery({
    queryKey: queryKeys.invoices.positions(address ?? ""),
    queryFn: () => fetchInvestorPositions(address!),
    enabled: !!address,
    staleTime: STALE_30S,
    gcTime: GC_5MIN,
  });
}

// ─── Create invoice mutation ──────────────────────────────────────────────────

export function useInvoiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      formData,
      ownerAddress,
      onProgress,
    }: {
      formData: CreateInvoiceFormData;
      ownerAddress: string;
      onProgress?: (p: number) => void;
    }) => prepareCreateInvoice(formData, ownerAddress, onProgress),

    onSuccess: () => {
      // Invalidate all invoice lists so they refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

// ─── Fund invoice mutation ────────────────────────────────────────────────────

export function useFundInvoiceMutation() {
  const queryClient = useQueryClient();
  const { updateInvoiceFunding } = useInvoiceStore();

  return useMutation({
    mutationFn: ({
      tokenId,
      amount,
      investorAddress,
    }: {
      tokenId: string;
      amount: number;
      investorAddress: string;
    }) => prepareFundInvoice(tokenId, amount, investorAddress),

    onMutate: async ({ tokenId, amount }) => {
      // Optimistic update — immediately reflect new funding in the store
      const { invoices } = useInvoiceStore.getState();
      const invoice = invoices.find((i) => i.tokenId === tokenId);
      if (invoice) {
        updateInvoiceFunding(invoice.id, invoice.funding.totalRaised + amount);
      }
    },

    onSettled: (_data, _err, { tokenId }) => {
      // Refetch the specific invoice to sync server state
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.detail(tokenId),
      });
    },
  });
}
