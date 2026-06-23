import type { FilterState, SortState } from "@/store/invoiceStore";

export const queryKeys = {
  invoices: {
    all: ["invoices"] as const,
    list: (filters: FilterState, sort: SortState, page: number) =>
      ["invoices", "list", filters, sort, page] as const,
    detail: (id: string) => ["invoices", "detail", id] as const,
    byOwner: (address: string) => ["invoices", "owner", address] as const,
    positions: (address: string) => ["invoices", "positions", address] as const,
    batch: (tokenIds: string[]) =>
      ["invoices", "batch", [...tokenIds].sort().join(",")] as const,
  },
} as const;
