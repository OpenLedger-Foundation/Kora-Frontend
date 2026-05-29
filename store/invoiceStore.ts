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
  showExpired: boolean;
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
  showExpired: false,
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
  
  // Filter by expiry status
  if (!filters.showExpired) {
    const now = new Date();
    result = result.filter((i) => {
      if (i.status === "cancelled") return false;
      if (!i.listingExpiry) return true;
      return new Date(i.listingExpiry) > now;
    });
  }
  
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(
      (i) =>
        i.metadata.debtorName.toLowerCase().includes(q) ||
        i.metadata.invoiceNumber.toLowerCase().includes(q) ||
        i.metadata.jurisdiction.toLowerCase().includes(q)
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
  if (filters.showExpired) p.set("showExpired", "1");
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
      showExpired: params.get("showExpired") === "1",
    },
    sort: {
      sortBy: (params.get("sortBy") as SortState["sortBy"]) ?? "apr",
      sortDir: (params.get("sortDir") as SortState["sortDir"]) ?? "desc",
    },
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

const SEARCH_HISTORY_KEY = "kora-search-history";
const MAX_HISTORY = 5;

function loadSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveSearchHistory(history: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

interface InvoiceStore {
  invoices: Invoice[];
  filters: FilterState;
  sort: SortState;
  sortBy: string;
  searchQuery: string;
  searchHistory: string[];
  selectedInvoice: Invoice | null;
  createDraft: InvoiceCreateDraft;

  // Actions
  setInvoices: (invoices: Invoice[]) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  updateSingleFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
  setSort: (sort: Partial<SortState>) => void;
  setSortBy: (sortBy: string) => void;
  setSearchQuery: (q: string) => void;
  clearSearchHistory: () => void;
  setSelectedInvoice: (invoice: Invoice | null) => void;
  updateInvoiceFunding: (id: string, newAmount: number) => void;
  rollbackInvoiceFunding: (id: string) => void;
  // internal backup map (not persisted)
  _fundingBackup?: Record<string, any>;
  setCreateDraft: (draft: Partial<InvoiceCreateDraft>) => void;
  clearCreateDraft: () => void;

  // Derived
  getFiltered: () => Invoice[];
}

export const useInvoiceStore = create<InvoiceStore>()(
  persist(
    (set, get) => ({
      invoices: [],
      filters: DEFAULT_FILTERS,
      sort: DEFAULT_SORT,
      sortBy: "apr_desc",
      searchQuery: "",
      searchHistory: loadSearchHistory(),
      selectedInvoice: null,
      createDraft: { currency: "USDC" },

      setInvoices: (invoices) => set({ invoices }),

      setFilters: (filters) =>
        set((s) => ({ filters: { ...s.filters, ...filters } })),

      updateSingleFilter: (key, value) =>
        set((s) => ({ filters: { ...s.filters, [key]: value } })),

      resetFilters: () =>
        set({ filters: DEFAULT_FILTERS, searchQuery: "", sortBy: "apr_desc" }),

      setSort: (sort) =>
        set((s) => ({ sort: { ...s.sort, ...sort } })),

      setSortBy: (sortBy) => set({ sortBy }),

      setSearchQuery: (searchQuery) =>
        set((s) => {
          const trimmed = searchQuery.trim();
          let history = s.searchHistory;
          if (trimmed && !history.includes(trimmed)) {
            history = [trimmed, ...history].slice(0, MAX_HISTORY);
            saveSearchHistory(history);
          }
          return { searchQuery, searchHistory: history };
        }),

      clearSearchHistory: () => {
        saveSearchHistory([]);
        set({ searchHistory: [] });
      },

      setSelectedInvoice: (selectedInvoice) => set({ selectedInvoice }),

      /** Optimistic update — instantly reflects new funding amount in UI */
      updateInvoiceFunding: (id, newAmount) =>
        set((s) => {
          const prev = s.invoices.find((i) => i.id === id);
          const backup = prev ? { ...prev.funding, status: prev.status } : undefined;
          const nextInvoices = s.invoices.map((inv) => {
            if (inv.id !== id) return inv;
            const totalRaised = Math.min(newAmount, inv.funding.targetAmount);
            const isFull = totalRaised >= inv.funding.targetAmount;
            return {
              ...inv,
              status: isFull ? "fully_funded" : inv.status,
              funding: {
                ...inv.funding,
                totalRaised,
                fundingProgress: totalRaised / inv.funding.targetAmount,
                remainingCapacity: inv.funding.targetAmount - totalRaised,
                investorCount: inv.funding.investorCount + 1,
              },
            };
          });
          return {
            invoices: nextInvoices,
            _fundingBackup: backup ? { ...(s._fundingBackup || {}), [id]: backup } : s._fundingBackup,
          } as any;
        }),

      rollbackInvoiceFunding: (id) =>
        set((s) => {
          const backup = s._fundingBackup?.[id];
          if (!backup) return {} as any;
          const invoices = s.invoices.map((inv) => {
            if (inv.id !== id) return inv;
            return {
              ...inv,
              status: backup.status ?? inv.status,
              funding: {
                ...inv.funding,
                totalRaised: backup.totalRaised ?? inv.funding.totalRaised,
                fundingProgress: backup.fundingProgress ?? inv.funding.fundingProgress,
                remainingCapacity: backup.remainingCapacity ?? inv.funding.remainingCapacity,
                investorCount: backup.investorCount ?? inv.funding.investorCount,
              },
            } as Invoice;
          });
          const nextBackup = { ...(s._fundingBackup || {}) };
          delete nextBackup[id];
          return { invoices, _fundingBackup: nextBackup } as any;
        }),

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
