import type { FilterState, SortState } from "@/store/invoiceStore";
import { getNetworkMode, type NetworkMode } from "@/lib/featureFlags";

/**
 * Whether invoice queries resolve from mock data or the live indexer.
 *
 * Alias of {@link NetworkMode} — the data source and the network mode are the
 * same axis, and Issue #436 made `@/lib/featureFlags` the single definition so
 * key namespacing and query tuning can never disagree about which mode is
 * active. Kept as a named export for existing import sites.
 */
export type InvoiceDataSource = NetworkMode;

/**
 * Resolve the active invoice data source.
 *
 * Delegates to `getNetworkMode()`, which stays a plain env read so query keys
 * remain usable on the client and in unit tests without pulling in the full Zod
 * env module.
 */
export function getInvoiceDataSource(): InvoiceDataSource {
  return getNetworkMode();
}

export const queryKeys = {
  invoices: {
    all: ["invoices"] as const,
    list: (filters: FilterState, sort: SortState, page: number) =>
      ["invoices", "list", filters, sort, page] as const,
    infinite: (filters: FilterState, sort: string | SortState, pageSize: number) =>
      ["invoices", "infinite", filters, sort, pageSize] as const,
    /**
     * Infinite-scroll query key — includes filters, sortBy string, and page
     * size so any filter/sort change resets pagination automatically.
     */
    infinite: (filters: FilterState, sortBy: string, pageSize: number) =>
      ["invoices", "infinite", filters, sortBy, pageSize] as const,
    /**
     * Detail keys are namespaced by data source so mock and live indexer
     * responses never collide in the TanStack Query cache.
     */
    detail: (id: string, source: InvoiceDataSource = getInvoiceDataSource()) =>
      ["invoices", "detail", source, id] as const,
    byOwner: (address: string) => ["invoices", "owner", address] as const,
    positions: (address: string) => ["invoices", "positions", address] as const,
    batch: (tokenIds: string[]) =>
      ["invoices", "batch", [...tokenIds].sort().join(",")] as const,
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
