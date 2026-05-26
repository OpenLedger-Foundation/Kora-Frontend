import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Invoice, MarketplaceFilters, MarketplaceSort } from "@/types";
import type { InvoiceDetailsStepSchema } from "@/lib/validations/invoice";

export type InvoiceCreateDraft = Partial<InvoiceDetailsStepSchema> & {
  currency?: "USDC" | "EURC" | "XLM";
  issueDate?: string;
  discountRate?: number;
  minInvestment?: number;
  description?: string;
};

interface InvoiceStore {
  invoices: Invoice[];
  filters: MarketplaceFilters;
  sort: MarketplaceSort;
  searchQuery: string;
  selectedInvoice: Invoice | null;

  createDraft: InvoiceCreateDraft;
  setCreateDraft: (draft: Partial<InvoiceCreateDraft>) => void;
  clearCreateDraft: () => void;

  setInvoices: (invoices: Invoice[]) => void;
  setFilters: (filters: Partial<MarketplaceFilters>) => void;
  resetFilters: () => void;
  setSort: (sort: MarketplaceSort) => void;
  setSearchQuery: (q: string) => void;
  setSelectedInvoice: (invoice: Invoice | null) => void;
}

const DEFAULT_SORT: MarketplaceSort = { key: "apr", direction: "desc" };

export const useInvoiceStore = create<InvoiceStore>()(
  persist(
    (set) => ({
      invoices: [],
      filters: {},
      sort: DEFAULT_SORT,
      searchQuery: "",
      selectedInvoice: null,

      createDraft: { currency: "USDC" },
      setCreateDraft: (draft) =>
        set((s) => ({ createDraft: { ...s.createDraft, ...draft } })),
      clearCreateDraft: () => set({ createDraft: { currency: "USDC" } }),

      setInvoices: (invoices) => set({ invoices }),
      setFilters: (filters) =>
        set((s) => ({ filters: { ...s.filters, ...filters } })),
      resetFilters: () => set({ filters: {}, searchQuery: "" }),
      setSort: (sort) => set({ sort }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSelectedInvoice: (selectedInvoice) => set({ selectedInvoice }),
    }),
    {
      name: "kora-invoice-store",
      partialize: (state) => ({ createDraft: state.createDraft }),
    }
  )
);
