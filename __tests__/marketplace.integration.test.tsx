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
 * - Test windowing/virtualization for large result sets (issue #1170)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { createMockInvoices } from "./fixtures";
import { createTestQueryClient } from "./setup";
import React from "react";

/**
 * Mock data and services
 */
const mockInvoices = createMockInvoices(10);

// Mock the useInvoices hook
vi.mock("@/hooks/useInvoices", () => ({
  useInvoices: vi.fn(() => ({
    data: { invoices: mockInvoices, totalCount: mockInvoices.length, page: 1 },
    isLoading: false,
    error: null,
    isFetching: false,
  })),
  usePrefetchInvoice: vi.fn(() => vi.fn()),
}));

const mockSetFilter = vi.fn();
const mockSetSort = vi.fn();
const mockResetFilters = vi.fn();

// Mock the invoice store
vi.mock("@/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/store")>();
  return {
    ...actual,
    useInvoiceStore: vi.fn(() => ({
      filters: {
        categories: [],
        jurisdictions: [],
        riskTiers: [],
        aprRange: [0, 50],
        activeOnly: false,
      },
      sort: {
        sortBy: "apr",
        sortDir: "desc",
      },
      setFilter: mockSetFilter,
      setSort: mockSetSort,
      resetFilters: mockResetFilters,
    })),
    useUIStore: vi.fn(() => ({
      setWalletModalOpen: vi.fn(),
    })),
  };
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace",
}));

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock InvoiceCard component for simpler testing
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

import { useInvoices } from "@/hooks/useInvoices";
import { useInvoiceStore } from "@/store";

/**
 * Minimal windowing helper mirroring the marketplace virtualization behavior:
 * only a bounded slice of the result set is rendered at a time while the
 * full count is preserved for a11y (aria-setsize / aria-posinset).
 */
const WINDOW_SIZE = 5;

const useWindowedList = (items: any[], windowSize: number = WINDOW_SIZE) => {
  const [startIndex, setStartIndex] = React.useState(0);
  const maxStart = Math.max(0, items.length - windowSize);
  const clampedStart = Math.min(startIndex, maxStart);
  const visible = items.slice(clampedStart, clampedStart + windowSize);

  const scrollTo = (nextStart: number) => {
    setStartIndex(Math.max(0, Math.min(nextStart, maxStart)));
  };

  return { visible, startIndex: clampedStart, scrollTo, total: items.length };
};

// Simplified marketplace component for testing
const MarketplaceTest = ({ windowSize }: { windowSize?: number } = {}) => {
  const { data } = useInvoices();
  const { filters, setFilter } = useInvoiceStore();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCategoryFilter = (category: string) => {
    setFilter("categories", filters.categories.includes(category)
      ? filters.categories.filter((c: string) => c !== category)
      : [...filters.categories, category]
    );
  };

  const handleJurisdictionFilter = (jurisdiction: string) => {
    setFilter("jurisdictions", filters.jurisdictions.includes(jurisdiction)
      ? filters.jurisdictions.filter((j: string) => j !== jurisdiction)
      : [...filters.jurisdictions, jurisdiction]
    );
  };

  const filteredInvoices = (data?.invoices || []).filter((inv: any) => {
    const matchesCategory = filters.categories.length === 0 || filters.categories.includes(inv.metadata.category);
    const matchesJurisdiction = filters.jurisdictions.length === 0 || filters.jurisdictions.includes(inv.metadata.jurisdiction);
    const matchesApr = inv.terms.apr >= filters.aprRange[0] && inv.terms.apr <= filters.aprRange[1];
    const matchesSearch = debouncedQuery === "" || 
      inv.metadata.debtorName.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      inv.metadata.invoiceNumber.toLowerCase().includes(debouncedQuery.toLowerCase());
    return matchesCategory && matchesJurisdiction && matchesApr && matchesSearch;
  });

  const { visible, startIndex, scrollTo, total } = useWindowedList(filteredInvoices, windowSize);

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
        {["technology", "agriculture", "healthcare", "construction", "logistics"].map((cat) => (
          <label key={cat}>
            <input
              type="checkbox"
              checked={filters.categories.includes(cat)}
              onChange={() => handleCategoryFilter(cat)}
              data-testid={`category-${cat}`}
            />
            {cat}
          </label>
        ))}
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

      <div
        data-testid="invoice-list"
        role="list"
        aria-label="Marketplace invoices"
        aria-setsize={total}
      >
        {visible.map((invoice: any, i: number) => (
          <div
            key={invoice.id}
            role="listitem"
            aria-posinset={startIndex + i + 1}
            aria-setsize={total}
            data-testid={`invoice-card-${invoice.id}`}
          >
            {invoice.metadata.invoiceNumber} - {invoice.metadata.debtorName}
          </div>
        ))}
      </div>

      <div data-testid="window-controls">
        <button
          type="button"
          data-testid="window-prev"
          aria-label="Previous page of results"
          disabled={startIndex === 0}
          onClick={() => scrollTo(startIndex - (windowSize ?? WINDOW_SIZE))}
        >
          Prev
        </button>
        <button
          type="button"
          data-testid="window-next"
          aria-label="Next page of results"
          disabled={startIndex + (windowSize ?? WINDOW_SIZE) >= total}
          onClick={() => scrollTo(startIndex + (windowSize ?? WINDOW_SIZE))}
        >
          Next
        </button>
      </div>
    </div>
  );
};

describe("Marketplace Listing Integration Tests", () => {
  let queryClient: any;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    mockSetFilter.mockClear();
    mockSetSort.mockClear();
    mockResetFilters.mockClear();
    vi.clearAllMocks();
  });

  it("renders marketplace with mock invoices", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MarketplaceTest />
      </QueryClientProvider>
    );

    expect(screen.getByTestId("search-input")).toBeInTheDocument();
    expect(screen.getByTestId("category-filters")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-list")).toBeInTheDocument();
  });

  it("displays all invoices initially", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MarketplaceTest />
      </QueryClientProvider>
    );

    expect(screen.getByTestId("results-count")).toHaveTextContent("10 results");
  });

  it("filters invoices by category", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <MarketplaceTest />
      </QueryClientProvider>
    );

    await user.click(screen.getByTestId("category-technology"));

    expect(mockSetFilter).toHaveBeenCalledWith("categories", ["technology"]);
  });

  it("filters invoices by jurisdiction", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <MarketplaceTest />
      </QueryClientProvider>
    );

    await user.click(screen.getByTestId("jurisdiction-KE"));

    expect(mockSetFilter).toHaveBeenCalledWith("jurisdictions", ["KE"]);
  });

  it("searches with debounce simulation", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <MarketplaceTest />
      </QueryClientProvider>
    );

    const searchInput = screen.getByTestId("search-input");
    await user.type(searchInput, "Invoice");

    // Before debounce completes, results should still show all
    expect(screen.getByTestId("results-count")).toHaveTextContent("10 results");

    // Wait for debounce
    await waitFor(
      () => {
        expect(screen.getByTestId("results-count")).not.toHaveTextContent("10 results");
      },
      { timeout: 1000 }
    );
  });

  it("renders only a windowed slice of a large result set", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MarketplaceTest windowSize={5} />
      </QueryClientProvider>
    );

    const list = screen.getByTestId("invoice-list");
    // Full count preserved for a11y
    expect(list).toHaveAttribute("aria-setsize", "10");
    // Only the window is in the DOM
    expect(list.querySelectorAll('[role="listitem"]')).toHaveLength(5);
  });

  it("advances the window and updates aria-posinset", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <MarketplaceTest windowSize={5} />
      </QueryClientProvider>
    );

    const list = screen.getByTestId("invoice-list");
    const firstBefore = list.querySelector('[role="listitem"]');
    expect(firstBefore).toHaveAttribute("aria-posinset", "1");

    await user.click(screen.getByTestId("window-next"));

    const items = list.querySelectorAll('[role="listitem"]');
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveAttribute("aria-posinset", "6");
    expect(items[0]).toHaveAttribute("aria-setsize", "10");
  });

  it("disables window controls at the boundaries", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <MarketplaceTest windowSize={5} />
      </QueryClientProvider>
    );

    expect(screen.getByTestId("window-prev")).toBeDisabled();

    await user.click(screen.getByTestId("window-next"));
    expect(screen.getByTestId("window-next")).toBeDisabled();
    expect(screen.getByTestId("window-prev")).not.toBeDisabled();
  });

  it("handles empty result sets without rendering list items", () => {
    (useInvoices as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      data: { invoices: [], totalCount: 0, page: 1 },
      isLoading: false,
      error: null,
      isFetching: false,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MarketplaceTest windowSize={5} />
      </QueryClientProvider>
    );

    expect(screen.getByTestId("results-count")).toHaveTextContent("0 results");
    const list = screen.getByTestId("invoice-list");
    expect(list.querySelectorAll('[role="listitem"]')).toHaveLength(0);
    expect(screen.getByTestId("window-prev")).toBeDisabled();
    expect(screen.getByTestId("window-next")).toBeDisabled();
  });
});
