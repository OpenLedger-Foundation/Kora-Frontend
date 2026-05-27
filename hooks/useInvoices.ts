"use client";

import { useQuery } from "@tanstack/react-query";
import { useInvoiceStore } from "@/store";
import { fetchInvoices, fetchInvoiceById } from "@/services/invoiceService";

import type { MarketplaceSort } from "@/types";

export function mapSortByToSort(sortBy: string): MarketplaceSort {
  switch (sortBy) {
    case "apr_asc":
      return { key: "apr", direction: "asc" };
    case "amount_desc":
      return { key: "amount", direction: "desc" };
    case "amount_asc":
      return { key: "amount", direction: "asc" };
    case "due_soonest":
      return { key: "duration", direction: "asc" };
    case "due_latest":
      return { key: "duration", direction: "desc" };
    case "newest":
      return { key: "createdAt", direction: "desc" };
    case "apr_desc":
    default:
      return { key: "apr", direction: "desc" };
  }
}

export function useInvoices() {
  const { filters, sortBy } = useInvoiceStore();
  const sort = mapSortByToSort(sortBy);

  return useQuery({
    queryKey: ["invoices", filters, sort],
    queryFn: () => fetchInvoices(filters, sort),
    staleTime: 30_000,
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ["invoice", id],
    queryFn: () => fetchInvoiceById(id),
    enabled: !!id,
    staleTime: 60_000,
  });
}
