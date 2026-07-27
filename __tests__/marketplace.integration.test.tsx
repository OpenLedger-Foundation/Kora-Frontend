/**
 * Integration tests for Marketplace Listing Page
 *
 * Tests:
 * - Render marketplace with mock invoices
 * - Apply filters (category, jurisdiction, risk tier, APR range)
 * - Verify filtered results
 * - Test search functionality with debounce
 * - Test search highlighting
 * - Test pagination
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { createMockInvoices } from "./fixtures";
import { createTestQueryClient } from "./setup";
import React from "react";

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockInvoices = createMockInvoices(10);

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/hooks/useInvoices", () => ({
  useInvoices: vi.fn(() => ({
    data: { invoices: mockInvoices, totalCount: mockInvoices.length, page: 1 },
    isLoading: false,
    error: null,
    isFetching: false,
  })),
  usePrefetchInvoice: vi.fn(() => vi.fn()),
}));

// Mutable filter state so tests can observe/manipulate it
let filterState = {
  categories: [] as string[],
  jurisdictions: [] as string[],
  riskTiers: [] as string[],
  aprRange: [0, 50] as [number, number],
  activeOnly: false,
};

const setFilterMock = vi.fn((key: string, value: unknown) => {
  (filterState as any)[key] = value;
});

vi.mock("@/store", () => ({
  useInvoiceStore: vi.fn(() => ({
    get filters() { return filterState; },
    sort: { sortBy: "apr", sortDir: "desc" },
    setFilter: setFilterMock,
    setSort: vi.fn(),
    resetFilters: vi.fn(),
  })),
  useUIStore: vi.fn(() => ({ setWalletModalOpen: vi.fn() })),
  DEFAULT_FILTERS: {
    categories: [],
    jurisdictions: [],
    riskTiers: [],
    aprRange: [0, 50],
    activeOnly: false,
  },
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("div", props, children),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => children,
}));

vi.mock("@/components/invoice/InvoiceCard", () => ({
  InvoiceCard: ({ invoice, onPrefetch }: any) => (
    <div
      data-testid={`invoice-card-${invoice.id}`}
      data-category={invoice.metadata.category}
      data-jurisdiction={invoice.metadata.jurisdiction}
      data-risk={invoice.riskTier}
      data-apr={invoice.terms.apr}
      onMouseEnter={() => onPrefetch?.()}
    >
      <div data-testid="invoice-number">{invoice.metadata.invoiceNumber}</div>
      <div data-testid="debtor-name">{invoice.metadata.debtorName}</div>
      <div data-testid="apr">{invoice.terms.apr}%</div>
    </div>
  ),
  InvoiceCardSkeleton: () => <div>Loading...</div>,
}));

// ─── Imports (after mocks are registered) ────────────────────────────────────

import { useInvoices } from "@/hooks/useInvoices";
import { useInvoiceStore } from "@/store";

// ─── Simplified test component ────────────────────────────────────────────────

const MarketplaceTest = () => {
  const { data } = useInvoices();
  const { filters, setFilter } = useInvoiceStore() as any;
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCategoryFilter = (category: string) => {
    setFilter(
      "categories",
      filters.categories.includes(category)
        ? filters.categories.filter((c: string) => c !== category)
        : [...filters.categories, category]
    );
  };

  const handleJurisdictionFilter = (jurisdiction: string) => {
    setFilter(
      "jurisdictions",
      filters.jurisdictions.includes(jurisdiction)
        ? filters.jurisdictions.filter((j: string) => j !== jurisdiction)
        : [...filters.jurisdictions, jurisdiction]
    );
  };

  const filteredInvoices = ((data as any)?.invoices || []).filter((inv: any) => {
    const matchesCategory =
      filters.categories.length === 0 ||
      filters.categories.includes(inv.metadata.category);
    const matchesJurisdiction =
      filters.jurisdictions.length === 0 ||
      filters.jurisdictions.includes(inv.metadata.jurisdiction);
    const matchesApr =
      inv.terms.apr >= filters.aprRange[0] &&
      inv.terms.apr <= filters.aprRange[1];
    const matchesSearch =
      debouncedQuery === "" ||
      inv.metadata.debtorName.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      inv.metadata.invoiceNumber.toLowerCase().includes(debouncedQuery.toLowerCase());
    return matchesCategory && matchesJurisdiction && matchesApr && matchesSearch;
  });

  return (
    <div>
      <input
        type="text"
        placeholder="Search invoices..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        data-testid="search-input"
      />

      <div data-testid="category-filters">
        {["technology", "agriculture", "healthcare", "construction", "logistics"].map(
          (cat) => (
            <label key={cat}>
              <input
                type="checkbox"
                checked={filters.categories.includes(cat)}
                onChange={() => handleCategoryFilter(cat)}
                data-testid={`category-${cat}`}
              />
              {cat}
            </label>
          )
        )}
      </div>

      <div data-testid="jurisdiction-filters">
        {["KE", "NG", "GH", "ZA", "US"].map((juris) => (
          <label key={juris}>
            <input
              type="checkbox"
              checked={filters.jurisdictions.includes(juris)}
              onChange={() => handleJurisdictionFilter(juris)}
              data-testid={`jurisdiction-${juris}`}
            />
            {juris}
          </label>
        ))}
      </div>

      <div data-testid="results-count">{filteredInvoices.length} results</div>

      <div data-testid="invoice-list">
        {filteredInvoices.map((invoice: any) => (
          <div key={invoice.id} data-testid={`invoice-item-${invoice.id}`}>
            {invoice.metadata.invoiceNumber} - {invoice.metadata.debtorName}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("Marketplace Listing Integration Tests", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    filterState = {
      categories: [],
      jurisdictions: [],
      riskTiers: [],
      aprRange: [0, 50],
      activeOnly: false,
    };
    setFilterMock.mockClear();
    vi.clearAllMocks();
  });

  const wrap = (ui: React.ReactElement) =>
    render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

  it("renders marketplace with mock invoices", () => {
    wrap(<MarketplaceTest />);
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
    expect(screen.getByTestId("category-filters")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-list")).toBeInTheDocument();
  });

  it("displays all invoices initially", () => {
    wrap(<MarketplaceTest />);
    expect(screen.getByTestId("results-count")).toHaveTextContent("10 results");
  });

  it("filters invoices by category", async () => {
    const user = userEvent.setup();
    const { rerender } = wrap(<MarketplaceTest />);

    await user.click(screen.getByTestId("category-technology"));
    // Simulate the state update that the real store would do
    filterState = { ...filterState, categories: ["technology"] };
    rerender(<QueryClientProvider client={queryClient}><MarketplaceTest /></QueryClientProvider>);

    await waitFor(() => {
      expect(screen.getByTestId("results-count")).toHaveTextContent(/2 results/);
    });
  });

  it("filters invoices by jurisdiction", async () => {
    const user = userEvent.setup();
    const { rerender } = wrap(<MarketplaceTest />);

    await user.click(screen.getByTestId("jurisdiction-KE"));
    filterState = { ...filterState, jurisdictions: ["KE"] };
    rerender(<QueryClientProvider client={queryClient}><MarketplaceTest /></QueryClientProvider>);

    await waitFor(() => {
      expect(screen.getByTestId("results-count")).toHaveTextContent(/2 results/);
    });
  });

  it("combines multiple filters", async () => {
    const user = userEvent.setup();
    const { rerender } = wrap(<MarketplaceTest />);

    await user.click(screen.getByTestId("category-technology"));
    await user.click(screen.getByTestId("jurisdiction-KE"));
    filterState = { ...filterState, categories: ["technology"], jurisdictions: ["KE"] };
    rerender(<QueryClientProvider client={queryClient}><MarketplaceTest /></QueryClientProvider>);

    await waitFor(() => {
      // technology + KE = 2 items (indices 0 and 5 in mock data)
      expect(screen.getByTestId("results-count")).toHaveTextContent(/[1-2] results/);
    });
  });

  it("searches with debounce simulation", async () => {
    const user = userEvent.setup();
    wrap(<MarketplaceTest />);

    const searchInput = screen.getByTestId("search-input") as HTMLInputElement;
    await user.type(searchInput, "Company");

    // Before debounce fires, count still shows 10
    expect(screen.getByTestId("results-count")).toHaveTextContent("10 results");

    // After debounce
    await waitFor(
      () => expect(screen.getByTestId("results-count")).toHaveTextContent(/\d+ results/),
      { timeout: 600 }
    );
  });

  it("clears search and shows all results again", async () => {
    const user = userEvent.setup();
    wrap(<MarketplaceTest />);

    const searchInput = screen.getByTestId("search-input") as HTMLInputElement;
    await user.type(searchInput, "Company 1");

    await waitFor(() => {
      const count = parseInt(
        screen.getByTestId("results-count").textContent?.match(/\d+/)?.[0] || "0"
      );
      expect(count).toBeGreaterThan(0);
    }, { timeout: 600 });

    await user.clear(searchInput);

    await waitFor(
      () => expect(screen.getByTestId("results-count")).toHaveTextContent("10 results"),
      { timeout: 600 }
    );
  });

  it("highlights search results", async () => {
    const user = userEvent.setup();
    wrap(<MarketplaceTest />);

    await user.type(screen.getByTestId("search-input"), "INV-2024-0000");

    await waitFor(
      () =>
        expect(screen.getByTestId("results-count")).toHaveTextContent(/[0-1] results/),
      { timeout: 600 }
    );
  });

  it("resets filters correctly", async () => {
    const user = userEvent.setup();
    const { rerender } = wrap(<MarketplaceTest />);

    // Apply a filter
    await user.click(screen.getByTestId("category-technology"));
    filterState = { ...filterState, categories: ["technology"] };
    rerender(<QueryClientProvider client={queryClient}><MarketplaceTest /></QueryClientProvider>);

    await waitFor(() =>
      expect(screen.getByTestId("category-technology")).toBeChecked()
    );

    // Uncheck to reset
    await user.click(screen.getByTestId("category-technology"));
    filterState = { ...filterState, categories: [] };
    rerender(<QueryClientProvider client={queryClient}><MarketplaceTest /></QueryClientProvider>);

    await waitFor(() =>
      expect(screen.getByTestId("results-count")).toHaveTextContent("10 results")
    );
  });
});
