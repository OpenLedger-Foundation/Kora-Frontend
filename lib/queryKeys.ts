import type { FilterState, SortState } from "@/store/invoiceStore";

export const queryKeys = {
  invoices: {
    all: ["invoices"] as const,
    list: (filters: FilterState, sort: SortState, page: number) =>
      ["invoices", "list", filters, sort, page] as const,
    detail: (id: string) => ["invoices", "detail", id] as const,
    byOwner: (address: string) => ["invoices", "owner", address] as const,
    positions: (address: string) => ["invoices", "positions", address] as const,
  },
  account: {
    all: (address: string) => ["account", address] as const,
    balances: (address: string) => ["account", address, "balances"] as const,
    transactions: (address: string, limit?: number, cursor?: string) =>
      ["account", address, "transactions", limit, cursor] as const,
    exists: (address: string) => ["account", address, "exists"] as const,
    usdcBalance: (address: string) => ["account", address, "usdc"] as const,
  },
} as const;
