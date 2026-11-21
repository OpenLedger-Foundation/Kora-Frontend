import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { Invoice, InvoiceFunding, InvoiceStatus } from "@/types";
import type { InvoiceDetailsStepSchema } from "@/lib/validations/invoice";
import {
  createPersistentJSONStorage,
  safeStorageGetItem,
  safeStorageSetItem,
} from "./storageAdapter";
import {
  normalizeComparisonList,
  toggleComparisonId,
} from "@/lib/comparison";
import { useSettingsStore } from "./settingsStore";

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

/**
 * Persisted wizard draft envelope. `version` is a monotonically increasing
 * counter bumped on every autosave so we can detect stale/conflicting drafts
 * (e.g. another tab wrote a newer draft, or a crash left a partial write).
 */
export interface InvoiceDraftEnvelope {
  data: InvoiceCreateDraft;
  version: number;
  updatedAt: string;
}

export type InvoiceDraftConflict = {
  /** Draft currently held in memory by this tab. */
  local: InvoiceDraftEnvelope;
  /** Newer draft discovered in persisted storage. */
  remote: InvoiceDraftEnvelope;
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
export const MAX_WATCHLIST_ITEMS = 50;
export const MAX_SAVED_PRESETS = 20;

/**
 * @deprecated Watchlist alert preferences are owned by `settingsStore`. This
 * shape is retained for the legacy setter shim below; read
 * `useSettingsStore((s) => s.notifications)` instead.
 */
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

type FilterCacheEntry = {
  invoicesRef: Invoice[];
  filters: FilterState;
  sort: SortState;
  searchQuery: string;
  result: Invoice[];
};

let filterCache: FilterCacheEntry | null = null;

function readFilteredInvoices(
  invoices: Invoice[],
  filters: FilterState,
  sort: SortState,
  searchQuery: string
): Invoice[] {
  if (
    filterCache &&
    filterCache.invoicesRef === invoices &&
    filterCache.filters === filters &&
    filterCache.sort === sort &&
    filterCache.searchQuery === searchQuery
  ) {
    return filterCache.result;
  }

  const result = getFilteredInvoices(invoices, filters, sort, searchQuery);
  filterCache = { invoicesRef: invoices, filters, sort, searchQuery, result };
  return result;
}

/** React hook — memoized filtered invoice list keyed on store filter state. */
export function useFilteredInvoices(): Invoice[] {
  const { invoices, filters, sort, searchQuery } = useInvoiceStore(
    useShallow((state) => ({
      invoices: state.invoices,
      filters: state.filters,
      sort: state.sort,
      searchQuery: state.searchQuery,
    }))
  );

  return useMemo(
    () => getFilteredInvoices(invoices, filters, sort, searchQuery),
    [invoices, filters, sort, searchQuery]
  );
}

// ─── URL serialization ────────────────────────────────────────────────────────

export function toQueryParams(
  filters: FilterState,
  sort: SortState,
  searchQuery = ""
): URLSearchParams {
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
  if (searchQuery.trim()) p.set("q", searchQuery.trim());
  return p;
}

/** Serialized filter state as a shareable `?a=b` string — empty when nothing is active. */
export function toQueryString(
  filters: FilterState,
  sort: SortState,
  searchQuery = ""
): string {
  return toQueryParams(filters, sort, searchQuery).toString();
}

export function fromQueryParams(params: URLSearchParams): {
  filters: FilterState;
  sort: SortState;
  searchQuery: string;
} {
  const aprMin = Number(params.get("aprMin") ?? 0);
  const aprMax = Number(params.get("aprMax") ?? 50);
  return {
    filters: {
      categories: params.get("categories")?.split(",").filter(Boolean) ?? [],
      jurisdictions: params.get("jurisdictions")?.split(",").filter(Boolean) ?? [],
      riskTiers: params.get("riskTiers")?.split(",").filter(Boolean) ?? [],
      aprRange: [
        Number.isFinite(aprMin) ? aprMin : 0,
        Number.isFinite(aprMax) ? aprMax : 50,
      ],
      activeOnly: params.get("activeOnly") === "1",
      showExpired: params.get("showExpired") === "1",
    },
    sort: {
      sortBy: (params.get("sortBy") as SortState["sortBy"]) ?? "apr",
      sortDir: (params.get("sortDir") as SortState["sortDir"]) ?? "desc",
    },
    searchQuery: params.get("q") ?? "",
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
  return parsed.filter(
    (p): p is SavedMarketplacePreset =>
      !!p && typeof p === "object" && typeof (p as SavedMarketplacePreset).id === "string"
  );
}

// ─── Invoice wizard draft helpers ─────────────────────────────────────────────

const INVOICE_DRAFT_STORAGE_KEY = "kora.invoice.wizard.draft";

function isDraftEnvelope(value: unknown): value is InvoiceDraftEnvelope {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<InvoiceDraftEnvelope>;
  return (
    typeof v.version === "number" &&
    typeof v.updatedAt === "string" &&
    !!v.data &&
    typeof v.data === "object"
  );
}

/** Read the persisted wizard draft envelope, tolerating corrupt/partial writes. */
export function readPersistedInvoiceDraft(): InvoiceDraftEnvelope | null {
  const raw = safeStorageGetItem(INVOICE_DRAFT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isDraftEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Persist a wizard draft envelope. Returns the written envelope. */
export function writePersistedInvoiceDraft(
  data: InvoiceCreateDraft,
  version: number
): InvoiceDraftEnvelope {
  const envelope: InvoiceDraftEnvelope = {
    data,
    version,
    updatedAt: new Date().toISOString(),
  };
  safeStorageSetItem(INVOICE_DRAFT_STORAGE_KEY, JSON.stringify(envelope));
  return envelope;
}

/** Remove the persisted wizard draft (e.g. after successful submit). */
export function clearPersistedInvoiceDraft(): void {
  safeStorageSetItem(INVOICE_DRAFT_STORAGE_KEY, "");
}

/**
 * Compare a local draft against the persisted draft and report a conflict when
 * the persisted copy is newer (another tab wrote it, or a crash left a newer
 * write). Returns `null` when there is no conflict.
 */
export function detectInvoiceDraftConflict(
  local: InvoiceDraftEnvelope | null
): InvoiceDraftConflict | null {
  const remote = readPersistedInvoiceDraft();
  if (!remote) return null;
  if (!local) return null;
  if (remote.version > local.version) {
    return { local, remote };
  }
  return null;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export interface InvoiceStoreState {
  invoices: Invoice[];
  funding: Record<string, InvoiceFunding>;
  filters: FilterState;
  sort: SortState;
  searchQuery: string;
  watchlist: string[];
  savedPresets: SavedMarketplacePreset[];
  comparisonIds: string[];
  /** In-memory wizard draft envelope (autosaved to storage). */
  invoiceDraft: InvoiceDraftEnvelope | null;
  /** Pending conflict awaiting user resolution. */
  invoiceDraftConflict: InvoiceDraftConflict | null;
  setInvoices: (invoices: Invoice[]) => void;
  setFunding: (funding: Record<string, InvoiceFunding>) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  setSort: (sort: SortState) => void;
  setSearchQuery: (q: string) => void;
  toggleWatchlist: (id: string) => void;
  addSavedPreset: (preset: SavedMarketplacePreset) => void;
  removeSavedPreset: (id: string) => void;
  toggleComparison: (id: string) => void;
  clearComparison: () => void;
  /** Autosave the wizard draft (bumps version, persists to storage). */
  saveInvoiceDraft: (data: InvoiceCreateDraft) => void;
  /** Restore the persisted draft on wizard mount; surfaces conflicts. */
  restoreInvoiceDraft: () => InvoiceDraftEnvelope | null;
  /** Resolve a pending conflict by keeping the local or remote draft. */
  resolveInvoiceDraftConflict: (choice: "local" | "remote") => void;
  /** Clear the draft after successful submit. */
  clearInvoiceDraft: () => void;
}

export const useInvoiceStore = create<InvoiceStoreState>()(
  persist(
    (set, get) => ({
      invoices: [],
      funding: {},
      filters: DEFAULT_FILTERS,
      sort: DEFAULT_SORT,
      searchQuery: "",
      watchlist: [],
      savedPresets: [],
      comparisonIds: [],
      invoiceDraft: null,
      invoiceDraftConflict: null,
      setInvoices: (invoices) => set({ invoices }),
      setFunding: (funding) => set({ funding }),
      setFilters: (filters) =>
        set((state) => ({ filters: { ...state.filters, ...filters } })),
      setSort: (sort) => set({ sort }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      toggleWatchlist: (id) =>
        set((state) => {
          if (state.watchlist.includes(id)) {
            return { watchlist: state.watchlist.filter((w) => w !== id) };
          }
          if (state.watchlist.length >= MAX_WATCHLIST_ITEMS) return state;
          return { watchlist: [...state.watchlist, id] };
        }),
      addSavedPreset: (preset) =>
        set((state) => ({
          savedPresets: [preset, ...state.savedPresets].slice(0, MAX_SAVED_PRESETS),
        })),
      removeSavedPreset: (id) =>
        set((state) => ({
          savedPresets: state.savedPresets.filter((p) => p.id !== id),
        })),
      toggleComparison: (id) =>
        set((state) => ({
          comparisonIds: toggleComparisonId(state.comparisonIds, id),
        })),
      clearComparison: () => set({ comparisonIds: [] }),
      saveInvoiceDraft: (data) => {
        const current = get().invoiceDraft;
        const nextVersion = (current?.version ?? 0) + 1;
        const envelope = writePersistedInvoiceDraft(data, nextVersion);
        set({ invoiceDraft: envelope });
      },
      restoreInvoiceDraft: () => {
        const persisted = readPersistedInvoiceDraft();
        if (!persisted) return null;
        const local = get().invoiceDraft;
        if (local && persisted.version > local.version) {
          set({ invoiceDraftConflict: { local, remote: persisted } });
          return local;
        }
        set({ invoiceDraft: persisted, invoiceDraftConflict: null });
        return persisted;
      },
      resolveInvoiceDraftConflict: (choice) => {
        const conflict = get().invoiceDraftConflict;
        if (!conflict) return;
        if (choice === "remote") {
          set({ invoiceDraft: conflict.remote, invoiceDraftConflict: null });
        } else {
          // Keep local but bump past remote so it wins on next autosave.
          const envelope = writePersistedInvoiceDraft(
            conflict.local.data,
            conflict.remote.version + 1
          );
          set({ invoiceDraft: envelope, invoiceDraftConflict: null });
        }
      },
      clearInvoiceDraft: () => {
        clearPersistedInvoiceDraft();
        set({ invoiceDraft: null, invoiceDraftConflict: null });
      },
    }),
    {
      name: "kora-invoice-store",
      storage: createPersistentJSONStorage(),
      partialize: (state) => ({
        watchlist: state.watchlist,
        savedPresets: state.savedPresets,
        comparisonIds: normalizeComparisonList(state.comparisonIds),
      }),
    }
  )
);
