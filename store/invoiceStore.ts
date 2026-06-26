import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Invoice } from "@/types";
import type { InvoiceDetailsStepSchema } from "@/lib/validations/invoice";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilterState {
  categories: string[];
  jurisdictions: string[];
  riskTiers: string[];
  aprRange: [number, number];
  activeOnly: boolean;
}

export interface SortState {
  sortBy: "apr" | "amount" | "dueDate" | "listed";
  sortDir: "asc" | "desc";
}

export type InvoiceCreateDraft = Partial<InvoiceDetailsStepSchema> & {
  currency?: "USDC" | "EURC" | "XLM";
  issueDate?: string;
  discountRate?: number;
  minInvestment?: number;
  listingExpiryDate?: string;
  description?: string;
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_FILTERS: FilterState = {
  categories: [],
  jurisdictions: [],
  riskTiers: [],
  aprRange: [0, 50],
  activeOnly: false,
};

const DEFAULT_SORT: SortState = { sortBy: "apr", sortDir: "desc" };

// ─── Pure selector ────────────────────────────────────────────────────────────

export function getFilteredInvoices(
  invoices: Invoice[],
  filters: FilterState,
  sort: SortState,
  searchQuery = ""
): Invoice[] {
  let result = invoices;

  if (filters.categories.length > 0) {
    result = result.filter((i) => filters.categories.includes(i.metadata.category));
  }
  if (filters.jurisdictions.length > 0) {
    result = result.filter((i) => filters.jurisdictions.includes(i.metadata.jurisdiction));
  }
  if (filters.riskTiers.length > 0) {
    result = result.filter((i) => filters.riskTiers.includes(i.riskTier));
  }
  const [minApr, maxApr] = filters.aprRange;
  result = result.filter((i) => i.terms.apr >= minApr && i.terms.apr <= maxApr);
  if (filters.activeOnly) {
    result = result.filter((i) => i.status === "listed" || i.status === "partially_funded");
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(
      (i) =>
        i.metadata.debtorName.toLowerCase().includes(q) ||
        i.metadata.invoiceNumber.toLowerCase().includes(q)
    );
  }

  return [...result].sort((a, b) => {
    let aVal: number, bVal: number;
    switch (sort.sortBy) {
      case "apr":
        aVal = a.terms.apr; bVal = b.terms.apr; break;
      case "amount":
        aVal = a.metadata.amount; bVal = b.metadata.amount; break;
      case "dueDate":
        aVal = new Date(a.metadata.dueDate).getTime();
        bVal = new Date(b.metadata.dueDate).getTime();
        break;
      case "listed":
      default:
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
    }
    return sort.sortDir === "asc" ? aVal - bVal : bVal - aVal;
  });
}

// ─── URL serialization ────────────────────────────────────────────────────────

export function toQueryParams(filters: FilterState, sort: SortState): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.categories.length) p.set("categories", filters.categories.join(","));
  if (filters.jurisdictions.length) p.set("jurisdictions", filters.jurisdictions.join(","));
  if (filters.riskTiers.length) p.set("riskTiers", filters.riskTiers.join(","));
  if (filters.aprRange[0] !== 0) p.set("aprMin", String(filters.aprRange[0]));
  if (filters.aprRange[1] !== 50) p.set("aprMax", String(filters.aprRange[1]));
  if (filters.activeOnly) p.set("activeOnly", "1");
  if (sort.sortBy !== "apr") p.set("sortBy", sort.sortBy);
  if (sort.sortDir !== "desc") p.set("sortDir", sort.sortDir);
  return p;
}

export function fromQueryParams(params: URLSearchParams): {
  filters: FilterState;
  sort: SortState;
} {
  return {
    filters: {
      categories: params.get("categories")?.split(",").filter(Boolean) ?? [],
      jurisdictions: params.get("jurisdictions")?.split(",").filter(Boolean) ?? [],
      riskTiers: params.get("riskTiers")?.split(",").filter(Boolean) ?? [],
      aprRange: [
        Number(params.get("aprMin") ?? 0),
        Number(params.get("aprMax") ?? 50),
      ],
      activeOnly: params.get("activeOnly") === "1",
    },
    sort: {
      sortBy: (params.get("sortBy") as SortState["sortBy"]) ?? "apr",
      sortDir: (params.get("sortDir") as SortState["sortDir"]) ?? "desc",
    },
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface InvoiceStore {
  invoices: Invoice[];
  filters: FilterState;
  sort: SortState;
  searchQuery: string;
  selectedInvoice: Invoice | null;
  createDraft: InvoiceCreateDraft;

  // Actions
  setInvoices: (invoices: Invoice[]) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  setSort: (sort: Partial<SortState>) => void;
  setSearchQuery: (q: string) => void;
  setSelectedInvoice: (invoice: Invoice | null) => void;
  updateInvoiceFunding: (id: string, newAmount: number) => void;
  setCreateDraft: (draft: Partial<InvoiceCreateDraft>) => void;
  clearCreateDraft: () => void;
  // Marketplace page aliases
  sortBy: string;
  setSortBy: (sortBy: string) => void;
  updateSingleFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;

  // Derived
  getFiltered: () => Invoice[];
}

export const useInvoiceStore = create<InvoiceStore>()(
  persist(
    (set, get) => ({
      invoices: [],
      filters: DEFAULT_FILTERS,
      sort: DEFAULT_SORT,
      sortBy: DEFAULT_SORT.sortBy,
      searchQuery: "",
      selectedInvoice: null,
      createDraft: { currency: "USDC" },

      setInvoices: (invoices) => set({ invoices }),

      setFilters: (filters) =>
        set((s) => ({ filters: { ...s.filters, ...filters } })),

      resetFilters: () =>
        set({ filters: DEFAULT_FILTERS, searchQuery: "" }),

      setSort: (sort) =>
        set((s) => ({ sort: { ...s.sort, ...sort }, sortBy: sort.sortBy ?? s.sort.sortBy })),

      setSearchQuery: (searchQuery) => set({ searchQuery }),

      setSelectedInvoice: (selectedInvoice) => set({ selectedInvoice }),

      // Marketplace page aliases
      sortBy: DEFAULT_SORT.sortBy,
      setSortBy: (sortBy) => set((s) => ({ sort: { ...s.sort, sortBy: sortBy as SortState["sortBy"] }, sortBy: sortBy as SortState["sortBy"] })),
      updateSingleFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),

      /** Optimistic update — instantly reflects new funding amount in UI */
      updateInvoiceFunding: (id, newAmount) =>
        set((s) => ({
          invoices: s.invoices.map((inv) => {
            if (inv.id !== id) return inv;
            const totalRaised = Math.min(newAmount, inv.funding.targetAmount);
            return {
              ...inv,
              funding: {
                ...inv.funding,
                totalRaised,
                fundingProgress: totalRaised / inv.funding.targetAmount,
                remainingCapacity: inv.funding.targetAmount - totalRaised,
              },
            };
          }),
        })),

      setCreateDraft: (draft) =>
        set((s) => ({ createDraft: { ...s.createDraft, ...draft } })),

      clearCreateDraft: () => set({ createDraft: { currency: "USDC" } }),

      getFiltered: () => {
        const { invoices, filters, sort, searchQuery } = get();
        return getFilteredInvoices(invoices, filters, sort, searchQuery);
      },
    }),
    {
      name: "kora-invoice-store",
      partialize: (state) => ({ createDraft: state.createDraft }),
    }
  )
);
