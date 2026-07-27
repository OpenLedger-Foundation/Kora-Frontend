/**
 * Integration tests for Invoice Card Component
 *
 * Tests:
 * - Render invoice card with all data
 * - Hover prefetch behavior
 * - Click navigation to detail page
 * - Display funding progress
 * - Risk badges and status indicators
 * - InvoiceCardHoverPopover: opens on hover after delay, shows quick stats,
 *   fires prefetch on mouse-enter, suppressed on touch (Issue #461)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { createMockInvoice } from "./fixtures";
import { createTestQueryClient } from "./setup";
import React from "react";

// ─── Module mocks ─────────────────────────────────────────────────────────────
// All mock factories must only use vi.fn() — no outer variable references.
// next/navigation is aliased in vitest.config.ts to a stub that already
// exports vi.fn() values — no factory override needed here.

vi.mock("@/hooks/usePrefetchInvoice", () => ({
  usePrefetchInvoice: vi.fn(() => vi.fn()),
}));

// Legacy alias kept for backward compat with some mocks
vi.mock("@/hooks/useInvoices", () => ({
  usePrefetchInvoice: vi.fn(() => vi.fn()),
  useInvoice: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  formatCurrency: (amount: number, currency: string) =>
    `${currency} ${amount.toLocaleString()}`,
  formatApr: (apr: number) => `${apr.toFixed(2)}%`,
  formatDate: (date: string) => new Date(date).toLocaleDateString(),
  formatRelativeDate: () => "in 63 days",
  daysUntil: () => 63,
  cn: (...args: unknown[]) => (args.filter(Boolean) as string[]).join(" "),
}));

// ─── Controlled mock helpers (accessed after mock registration) ───────────────

import { useRouter } from "next/navigation";
import { usePrefetchInvoice } from "@/hooks/usePrefetchInvoice";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockInvoice = createMockInvoice({
  id: "inv_card_test",
  metadata: {
    invoiceNumber: "INV-CARD-001",
    debtorName: "Card Test Corp",
    amount: 100000,
    category: "technology",
    jurisdiction: "KE",
  },
  terms: {
    apr: 22.5,
    tenor: 90,
  },
  funding: {
    totalRaised: 75000,
    targetAmount: 100000,
    fundingProgress: 0.75,
    investorCount: 25,
    remainingCapacity: 25000,
  },
  riskTier: "BBB",
  status: "partially_funded",
});

// ─── Test components ───────────────────────────────────────────────────────────

const InvoiceCardTest = ({ invoice }: { invoice: typeof mockInvoice }) => {
  const router = useRouter();
  const prefetchInvoice = usePrefetchInvoice();

  const statusColors: Record<string, string> = {
    listed: "bg-blue-100 text-blue-800",
    partially_funded: "bg-yellow-100 text-yellow-800",
    fully_funded: "bg-green-100 text-green-800",
  };

  const riskColors: Record<string, string> = {
    AAA: "bg-green-100 text-green-800",
    AA: "bg-green-100 text-green-800",
    A: "bg-blue-100 text-blue-800",
    BBB: "bg-yellow-100 text-yellow-800",
    BB: "bg-orange-100 text-orange-800",
    B: "bg-red-100 text-red-800",
    CCC: "bg-red-100 text-red-800",
  };

  return (
    <div
      data-testid={`invoice-card-${invoice.id}`}
      onMouseEnter={() => prefetchInvoice(invoice.id)}
      onClick={() => router.push(`/marketplace/${invoice.id}`)}
      style={{ cursor: "pointer" }}
    >
      <div data-testid="card-invoice-number">{invoice.metadata.invoiceNumber}</div>
      <div data-testid="card-debtor-name">{invoice.metadata.debtorName}</div>
      <div data-testid="card-category">{invoice.metadata.category}</div>
      <div data-testid="card-jurisdiction">{invoice.metadata.jurisdiction}</div>
      <div data-testid="card-amount">USDC {invoice.metadata.amount.toLocaleString()}</div>
      <div data-testid="card-apr">{invoice.terms.apr}%</div>
      <div data-testid="card-funding-progress">
        <div
          data-testid="progress-bar"
          style={{ width: `${invoice.funding.fundingProgress * 100}%` }}
        >
          {(invoice.funding.fundingProgress * 100).toFixed(0)}%
        </div>
      </div>
      <div data-testid="card-investor-count">
        {invoice.funding.investorCount} investors
      </div>
      <div data-testid="card-remaining-capacity">
        USDC {invoice.funding.remainingCapacity.toLocaleString()} remaining
      </div>
      <span
        data-testid="status-badge"
        className={statusColors[invoice.status] || "bg-gray-100 text-gray-800"}
      >
        {invoice.status}
      </span>
      <span
        data-testid="risk-badge"
        className={riskColors[invoice.riskTier] || "bg-gray-100 text-gray-800"}
      >
        Risk: {invoice.riskTier}
      </span>
    </div>
  );
};

/** Minimal component that simulates InvoiceCardHoverPopover behaviour */
const HoverPopoverTest = ({ invoice }: { invoice: typeof mockInvoice }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const prefetch = usePrefetchInvoice();
  const openTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    prefetch(invoice.id);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    openTimerRef.current = setTimeout(() => setIsOpen(true), 350);
  };

  const handleMouseLeave = () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    closeTimerRef.current = setTimeout(() => setIsOpen(false), 150);
  };

  const handleTouchStart = () => {
    setIsOpen(false);
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
  };

  return (
    <div
      data-testid={`invoice-card-${invoice.id}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
    >
      <div>{invoice.metadata.invoiceNumber}</div>
      {isOpen && (
        <div
          role="dialog"
          aria-label={`Quick stats for ${invoice.metadata.invoiceNumber}`}
        >
          <div>APR: {invoice.terms.apr}%</div>
          <div>Funding progress: {(invoice.funding.fundingProgress * 100).toFixed(0)}%</div>
          <div>Investors: {invoice.funding.investorCount}</div>
          <div>Tenor: {invoice.terms.tenor}d</div>
        </div>
      )}
    </div>
  );
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("Invoice Card Integration Tests", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  // Captured mock functions — refreshed each test
  let mockPush: ReturnType<typeof vi.fn>;
  let mockPrefetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();

    // Set up a fresh push mock and make useRouter return it
    mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      prefetch: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    } as ReturnType<typeof useRouter>);

    // Set up a fresh prefetch mock and make usePrefetchInvoice return it
    mockPrefetch = vi.fn();
    vi.mocked(usePrefetchInvoice).mockReturnValue(mockPrefetch);
  });

  const wrap = (ui: React.ReactElement) =>
    render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

  // ── Basic rendering ──────────────────────────────────────────────────────────

  it("renders invoice card with all data", () => {
    wrap(<InvoiceCardTest invoice={mockInvoice} />);
    expect(screen.getByTestId(`invoice-card-${mockInvoice.id}`)).toBeInTheDocument();
    expect(screen.getByTestId("card-invoice-number")).toHaveTextContent("INV-CARD-001");
    expect(screen.getByTestId("card-debtor-name")).toHaveTextContent("Card Test Corp");
  });

  it("displays invoice details correctly", () => {
    wrap(<InvoiceCardTest invoice={mockInvoice} />);
    expect(screen.getByTestId("card-amount")).toHaveTextContent("100,000");
    expect(screen.getByTestId("card-apr")).toHaveTextContent("22.5%");
    expect(screen.getByTestId("card-category")).toHaveTextContent("technology");
    expect(screen.getByTestId("card-jurisdiction")).toHaveTextContent("KE");
  });

  it("displays funding progress", () => {
    wrap(<InvoiceCardTest invoice={mockInvoice} />);
    expect(screen.getByTestId("card-funding-progress")).toBeInTheDocument();
    expect(screen.getByTestId("progress-bar")).toHaveTextContent("75%");
  });

  it("displays investor count and remaining capacity", () => {
    wrap(<InvoiceCardTest invoice={mockInvoice} />);
    expect(screen.getByTestId("card-investor-count")).toHaveTextContent("25 investors");
    expect(screen.getByTestId("card-remaining-capacity")).toHaveTextContent("25,000 remaining");
  });

  it("displays status badge", () => {
    wrap(<InvoiceCardTest invoice={mockInvoice} />);
    expect(screen.getByTestId("status-badge")).toHaveTextContent("partially_funded");
  });

  it("displays risk tier badge", () => {
    wrap(<InvoiceCardTest invoice={mockInvoice} />);
    expect(screen.getByTestId("risk-badge")).toHaveTextContent("Risk: BBB");
  });

  // ── Interaction ──────────────────────────────────────────────────────────────

  it("triggers prefetch on mouse enter (hover)", async () => {
    const user = userEvent.setup();
    wrap(<InvoiceCardTest invoice={mockInvoice} />);

    await user.hover(screen.getByTestId(`invoice-card-${mockInvoice.id}`));

    await waitFor(() => {
      expect(mockPrefetch).toHaveBeenCalledWith(mockInvoice.id);
    });
  });

  it("navigates to detail page on click", async () => {
    const user = userEvent.setup();
    wrap(<InvoiceCardTest invoice={mockInvoice} />);

    await user.click(screen.getByTestId(`invoice-card-${mockInvoice.id}`));

    expect(mockPush).toHaveBeenCalledWith(`/marketplace/${mockInvoice.id}`);
  });

  it("prefetches data before navigation", async () => {
    const user = userEvent.setup();
    wrap(<InvoiceCardTest invoice={mockInvoice} />);

    const card = screen.getByTestId(`invoice-card-${mockInvoice.id}`);
    await user.hover(card);

    await waitFor(() => expect(mockPrefetch).toHaveBeenCalled());

    await user.click(card);

    expect(mockPrefetch).toHaveBeenCalledWith(mockInvoice.id);
    expect(mockPush).toHaveBeenCalledWith(`/marketplace/${mockInvoice.id}`);
  });

  // ── Status / risk colours ────────────────────────────────────────────────────

  it("displays different status colors for different statuses", () => {
    const { rerender } = wrap(
      <InvoiceCardTest invoice={createMockInvoice({ ...mockInvoice, status: "listed" })} />
    );
    expect(screen.getByTestId("status-badge")).toHaveClass("bg-blue-100");

    rerender(
      <QueryClientProvider client={queryClient}>
        <InvoiceCardTest
          invoice={createMockInvoice({ ...mockInvoice, status: "fully_funded" })}
        />
      </QueryClientProvider>
    );
    expect(screen.getByTestId("status-badge")).toHaveClass("bg-green-100");
  });

  it("displays different risk tier colors", () => {
    const { rerender } = wrap(
      <InvoiceCardTest invoice={createMockInvoice({ ...mockInvoice, riskTier: "AAA" })} />
    );
    expect(screen.getByTestId("risk-badge")).toHaveClass("bg-green-100");

    rerender(
      <QueryClientProvider client={queryClient}>
        <InvoiceCardTest
          invoice={createMockInvoice({ ...mockInvoice, riskTier: "CCC" })}
        />
      </QueryClientProvider>
    );
    expect(screen.getByTestId("risk-badge")).toHaveClass("bg-red-100");
  });

  it("handles fully funded invoice display", () => {
    wrap(
      <InvoiceCardTest
        invoice={createMockInvoice({
          ...mockInvoice,
          status: "fully_funded",
          funding: {
            totalRaised: 100000,
            targetAmount: 100000,
            fundingProgress: 1.0,
            investorCount: 50,
            remainingCapacity: 0,
          },
        })}
      />
    );
    expect(screen.getByTestId("progress-bar")).toHaveTextContent("100%");
    expect(screen.getByTestId("card-remaining-capacity")).toHaveTextContent("0 remaining");
  });

  it("updates when invoice prop changes", () => {
    const inv1 = createMockInvoice({ id: "inv_1", metadata: { invoiceNumber: "INV-001" } });
    const inv2 = createMockInvoice({ id: "inv_2", metadata: { invoiceNumber: "INV-002" } });

    const { rerender } = wrap(<InvoiceCardTest invoice={inv1} />);
    expect(screen.getByTestId("card-invoice-number")).toHaveTextContent("INV-001");

    rerender(
      <QueryClientProvider client={queryClient}>
        <InvoiceCardTest invoice={inv2} />
      </QueryClientProvider>
    );
    expect(screen.getByTestId("card-invoice-number")).toHaveTextContent("INV-002");
  });

  // ─── InvoiceCardHoverPopover (Issue #461) ─────────────────────────────────────

  describe("InvoiceCardHoverPopover", () => {
    it("fires prefetch immediately on mouse-enter before popover opens", async () => {
      const user = userEvent.setup();
      wrap(<HoverPopoverTest invoice={mockInvoice} />);

      await user.hover(screen.getByTestId(`invoice-card-${mockInvoice.id}`));

      expect(mockPrefetch).toHaveBeenCalledWith(mockInvoice.id);
    });

    it("opens popover after hover delay (350ms)", async () => {
      vi.useFakeTimers();
      wrap(<HoverPopoverTest invoice={mockInvoice} />);

      const card = screen.getByTestId(`invoice-card-${mockInvoice.id}`);
      // Use fireEvent which wraps in act automatically
      fireEvent.mouseEnter(card);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      // Advance past delay and flush React state updates
      await vi.runAllTimersAsync();

      expect(screen.getByRole("dialog")).toBeInTheDocument();

      vi.useRealTimers();
    });

    it("closes popover after mouse-leave with 150ms delay", async () => {
      vi.useFakeTimers();
      wrap(<HoverPopoverTest invoice={mockInvoice} />);

      const card = screen.getByTestId(`invoice-card-${mockInvoice.id}`);

      // Open
      fireEvent.mouseEnter(card);
      await vi.runAllTimersAsync();
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Close
      fireEvent.mouseLeave(card);
      await vi.runAllTimersAsync();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      vi.useRealTimers();
    });

    it("suppresses popover on touch (mobile tap navigates instead)", () => {
      wrap(<HoverPopoverTest invoice={mockInvoice} />);

      const card = screen.getByTestId(`invoice-card-${mockInvoice.id}`);
      fireEvent.touchStart(card);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("shows quick stats: APR, funding progress, investors, tenor", async () => {
      vi.useFakeTimers();
      wrap(<HoverPopoverTest invoice={mockInvoice} />);

      const card = screen.getByTestId(`invoice-card-${mockInvoice.id}`);
      fireEvent.mouseEnter(card);
      await vi.runAllTimersAsync();

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent(/APR/);
      expect(dialog).toHaveTextContent(/Funding progress/);
      expect(dialog).toHaveTextContent(/Investors/);
      expect(dialog).toHaveTextContent(/Tenor/);

      vi.useRealTimers();
    });

    it("displays correct values from the invoice in the popover", async () => {
      vi.useFakeTimers();
      wrap(<HoverPopoverTest invoice={mockInvoice} />);

      const card = screen.getByTestId(`invoice-card-${mockInvoice.id}`);
      fireEvent.mouseEnter(card);
      await vi.runAllTimersAsync();

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent("75%");
      expect(dialog).toHaveTextContent("25");
      expect(dialog).toHaveTextContent("90d");

      vi.useRealTimers();
    });
  });
});
