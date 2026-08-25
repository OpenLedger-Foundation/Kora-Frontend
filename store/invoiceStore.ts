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

export interface SavedMarketplacePreset {
  id: string;
  name: string;
  filters: FilterState;
  sort: SortState;
  createdAt: string;
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
export const MAX_WATCHLIST_ITEMS = 50;
export const MAX_SAVED_PRESETS = 20;

export interface NotificationPreferences {
  fundingProgress: boolean;
  status: boolean;
  apr: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  fundingProgress: true,
  status: true,
  apr: false,
};

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

export function serializePresets(presets: SavedMarketplacePreset[]): string {
  return JSON.stringify(presets);
}

export function hydratePresets(value: unknown): SavedMarketplacePreset[] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.filter((preset): preset is SavedMarketplacePreset => {
    if (!preset || typeof preset !== "object") return false;
    const candidate = preset as SavedMarketplacePreset;
    return (
      typeof candidate.id === "string" &&
      typeof candidate.name === "string" &&
      typeof candidate.createdAt === "string" &&
      !!candidate.filters &&
      Array.isArray(candidate.filters.categories) &&
      Array.isArray(candidate.filters.jurisdictions) &&
      Array.isArray(candidate.filters.riskTiers) &&
      Array.isArray(candidate.filters.aprRange) &&
      typeof candidate.filters.activeOnly === "boolean" &&
      !!candidate.sort &&
      ["apr", "amount", "dueDate", "listed"].includes(candidate.sort.sortBy) &&
      ["asc", "desc"].includes(candidate.sort.sortDir)
    );
  }).slice(0, MAX_SAVED_PRESETS);
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
  watchedInvoiceIds: string[];
  notificationPreferences: NotificationPreferences;
  savedPresets: SavedMarketplacePreset[];

  // Actions
  setInvoices: (invoices: Invoice[]) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  updateSingleFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
  setSort: (sort: Partial<SortState>) => void;
  setSortBy: (sortBy: string) => void;
  savePreset: (name: string) => SavedMarketplacePreset | null;
  renamePreset: (id: string, name: string) => void;
  deletePreset: (id: string) => void;
  loadPreset: (id: string) => boolean;
  setSearchQuery: (q: string) => void;
  clearSearchHistory: () => void;
  setSelectedInvoice: (invoice: Invoice | null) => void;
  upsertInvoice: (invoice: Invoice) => void;
  toggleWatchedInvoice: (id: string) => boolean;
  isInvoiceWatched: (id: string) => boolean;
  setNotificationPreferences: (preferences: Partial<NotificationPreferences>) => void;
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
      watchedInvoiceIds: [],
      notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
      savedPresets: [],

      setInvoices: (invoices) => set({ invoices }),

      setFilters: (filters) =>
        set((s) => ({ filters: { ...s.filters, ...filters } })),

      updateSingleFilter: (key, value) =>
        set((s) => ({ filters: { ...s.filters, [key]: value } })),

      resetFilters: () =>
        set({ filters: DEFAULT_FILTERS, searchQuery: "", sortBy: "apr_desc", sort: DEFAULT_SORT }),

      setSort: (sort) =>
        set((s) => ({ sort: { ...s.sort, ...sort } })),

      setSortBy: (sortBy) => {
        const sortMap: Record<string, SortState> = {
          apr_desc: { sortBy: "apr", sortDir: "desc" },
          apr_asc: { sortBy: "apr", sortDir: "asc" },
          amount_desc: { sortBy: "amount", sortDir: "desc" },
          amount_asc: { sortBy: "amount", sortDir: "asc" },
          due_soonest: { sortBy: "dueDate", sortDir: "asc" },
          due_latest: { sortBy: "dueDate", sortDir: "desc" },
          newest: { sortBy: "listed", sortDir: "desc" },
        };
        const canonicalSort = sortMap[sortBy];
        if (canonicalSort) set({ sortBy, sort: canonicalSort });
      },

      savePreset: (name) => {
        const trimmedName = name.trim();
        if (!trimmedName) return null;
        const state = get();
        const preset: SavedMarketplacePreset = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: trimmedName,
          filters: {
            ...state.filters,
            categories: [...state.filters.categories],
            jurisdictions: [...state.filters.jurisdictions],
            riskTiers: [...state.filters.riskTiers],
            aprRange: [...state.filters.aprRange] as [number, number],
          },
          sort: { ...state.sort },
          createdAt: new Date().toISOString(),
        };
        set((current) => ({ savedPresets: [preset, ...current.savedPresets].slice(0, MAX_SAVED_PRESETS) }));
        return preset;
      },

      renamePreset: (id, name) => {
        const trimmedName = name.trim();
        if (!trimmedName) return;
        set((state) => ({ savedPresets: state.savedPresets.map((preset) => preset.id === id ? { ...preset, name: trimmedName } : preset) }));
      },

      deletePreset: (id) => set((state) => ({ savedPresets: state.savedPresets.filter((preset) => preset.id !== id) })),

      loadPreset: (id) => {
        const preset = get().savedPresets.find((item) => item.id === id);
        if (!preset) return false;
        set({
          filters: {
            ...preset.filters,
            categories: [...preset.filters.categories],
            jurisdictions: [...preset.filters.jurisdictions],
            riskTiers: [...preset.filters.riskTiers],
            aprRange: [...preset.filters.aprRange] as [number, number],
          },
          sort: { ...preset.sort },
          sortBy: `${preset.sort.sortBy}_${preset.sort.sortDir}`,
        });
        return true;
      },

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

      upsertInvoice: (invoice) =>
        set((s) => ({
          invoices: s.invoices.some((item) => item.id === invoice.id)
            ? s.invoices.map((item) => (item.id === invoice.id ? invoice : item))
            : [...s.invoices, invoice],
        })),

      toggleWatchedInvoice: (id) => {
        let watched = false;
        set((s) => {
          watched = s.watchedInvoiceIds.includes(id);
          return {
            watchedInvoiceIds: watched
              ? s.watchedInvoiceIds.filter((item) => item !== id)
              : [...s.watchedInvoiceIds, id].slice(-MAX_WATCHLIST_ITEMS),
          };
        });
        return !watched;
      },

      isInvoiceWatched: (id) => get().watchedInvoiceIds.includes(id),

      setNotificationPreferences: (preferences) =>
        set((s) => ({
          notificationPreferences: { ...s.notificationPreferences, ...preferences },
        })),

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
      partialize: (state) => ({
        createDraft: state.createDraft,
        watchedInvoiceIds: state.watchedInvoiceIds,
        notificationPreferences: state.notificationPreferences,
        savedPresets: state.savedPresets,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<InvoiceStore>),
        savedPresets: hydratePresets((persisted as Partial<InvoiceStore>)?.savedPresets),
      }),
    }
  )
);
