import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Invoice, MarketplaceFilters, MarketplaceSort } from "@/types";
import type { InvoiceDetailsStepSchema } from "@/lib/validations/invoice";

export type InvoiceCreateDraft = Partial<InvoiceDetailsStepSchema> & {
  currency?: "USDC" | "EURC" | "XLM";
  issueDate?: string;
  discountRate?: number;
  minInvestment?: number;
  listingExpiryDate?: string;
  description?: string;
};

export const DEFAULT_FILTERS: MarketplaceFilters = {
  categories: [],
  jurisdictions: [],
  riskTiers: [],
  aprRange: [0, 50],
  activeOnly: false,
};

const DEFAULT_SORT: MarketplaceSort = { key: "apr", direction: "desc" };
const DEFAULT_SORT_BY = "apr_desc";

interface InvoiceStore {
  invoices: Invoice[];
  filters: MarketplaceFilters;
  sort: MarketplaceSort;
  sortBy: string;
  searchQuery: string;
  selectedInvoice: Invoice | null;

  createDraft: InvoiceCreateDraft;
  setCreateDraft: (draft: Partial<InvoiceCreateDraft>) => void;
  clearCreateDraft: () => void;

  setInvoices: (invoices: Invoice[]) => void;
  setFilters: (filters: Partial<MarketplaceFilters>) => void;
  updateSingleFilter: (key: keyof MarketplaceFilters, value: any) => void;
  resetFilters: () => void;
  setSort: (sort: MarketplaceSort) => void;
  setSortBy: (sortBy: string) => void;
  setSearchQuery: (q: string) => void;
  setSelectedInvoice: (invoice: Invoice | null) => void;
}

export const useInvoiceStore = create<InvoiceStore>()(
  persist(
    (set) => ({
      invoices: [],
      filters: DEFAULT_FILTERS,
      sort: DEFAULT_SORT,
      sortBy: DEFAULT_SORT_BY,
      searchQuery: "",
      selectedInvoice: null,

      createDraft: { currency: "USDC" },
      setCreateDraft: (draft) => set((s) => ({ createDraft: { ...s.createDraft, ...draft } })),
      clearCreateDraft: () => set({ createDraft: { currency: "USDC" } }),

      setInvoices: (invoices) => set({ invoices }),
      setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
      updateSingleFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS, searchQuery: "" }),
      setSort: (sort) => set({ sort }),
      setSortBy: (sortBy) => set({ sortBy }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSelectedInvoice: (selectedInvoice) => set({ selectedInvoice }),
    }),
    {
      name: "kora-invoice-store",
      partialize: (state) => ({ createDraft: state.createDraft }),
    }
  )
);
