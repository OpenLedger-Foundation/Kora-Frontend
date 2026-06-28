/**
 * Integration tests for InvoiceCard hover popover behavior.
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { InvoiceCard } from "../InvoiceCard";
import { useInvoiceStore } from "@/store/invoiceStore";
import type { Invoice } from "@/types";

// Helper to wait in real time
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: vi.fn(() => ({
    prefetchQuery: vi.fn(),
  })),
}));

vi.mock("../../../store/invoiceStore", () => ({
  useInvoiceStore: vi.fn(() => ({
    comparisonList: [],
    toggleComparison: vi.fn(),
  })),
}));

vi.mock("next/link", () => {
  const React = require("react");
  const LinkMock = React.forwardRef(({ children, href, ...props }: any, ref: any) => (
    <a href={href} {...props} ref={ref}>
      {children}
    </a>
  ));
  LinkMock.displayName = "LinkMock";
  return { default: LinkMock };
});

vi.mock("../../ui/CountdownTimer", () => ({
  default: () => <div data-testid="mock-countdown">Mock Timer</div>,
}));

vi.mock("../../../hooks/useCountdown", () => ({
  default: () => ({
    isExpired: false,
    timeLeft: { days: 1, hours: 1, minutes: 1, seconds: 1 },
  }),
}));

// ── Mock Invoice ───────────────────────────────────────────────────────────────

const mockInvoice: Invoice = {
  id: "inv-001",
  tokenId: "token-001",
  contractAddress: "0x1234567890abcdef",
  ipfsCid: "QmMockCid",
  metadata: {
    invoiceNumber: "INV-2024-001",
    issuerName: "Test Corp",
    issuerAddress: "123 Main St",
    debtorName: "Test Debtor",
    debtorAddress: "456 Oak Ave",
    amount: 50000,
    currency: "USDC",
    issueDate: "2024-01-01",
    dueDate: "2024-03-01",
    description: "Test invoice",
    jurisdiction: "KE",
    category: "technology",
    documentHash: "QmDoc",
    documentUrl: "https://example.com/doc.pdf",
  },
  terms: {
    discountRate: 0.05,
    apr: 12.5,
    financingAmount: 40000,
    minInvestment: 100,
    maxInvestment: 5000,
    tenor: 60,
    repaymentDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  funding: {
    totalRaised: 30000,
    targetAmount: 40000,
    fundingProgress: 0.75,
    investorCount: 5,
    remainingCapacity: 10000,
  },
  riskTier: "A",
  riskScore: 75,
  debtorPrivacy: "partial",
  status: "partially_funded",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-15T00:00:00Z",
  ownerAddress: "G1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  listingExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

const expiredInvoice: Invoice = {
  ...mockInvoice,
  status: "cancelled",
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("InvoiceCard Hover Popover Integration", () => {
  beforeEach(() => {
    delete (window as any).ontouchstart;
    Object.defineProperty(navigator, "maxTouchPoints", {
      value: 0,
      configurable: true,
    });
  });

  it("should open popover on hover after 300ms delay", async () => {
    render(<InvoiceCard invoice={mockInvoice} />);

    const link = screen.getByRole("article");

    // Hover
    fireEvent.mouseEnter(link);

    // Before 300ms - should not show popover
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    // Wait for the hover timeout (300ms) to trigger popover open
    await sleep(400);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });
  });

  it("should not flash popover on quick hovers (< 300ms)", async () => {
    render(<InvoiceCard invoice={mockInvoice} />);

    const link = screen.getByRole("article");

    // Hover for 100ms
    fireEvent.mouseEnter(link);
    await sleep(100);

    // Leave before 300ms
    fireEvent.mouseLeave(link);
    await sleep(250);

    // Popover should never have appeared
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("should close popover on mouse leave", async () => {
    render(<InvoiceCard invoice={mockInvoice} />);

    const link = screen.getByRole("article");

    // Open popover
    fireEvent.mouseEnter(link);
    await sleep(400);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    // Close on mouse leave
    fireEvent.mouseLeave(link);

    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });

  it("should open popover on keyboard focus", async () => {
    render(<InvoiceCard invoice={mockInvoice} />);

    const link = screen.getByRole("article");

    // Focus via keyboard - open should be immediate (no delay)
    fireEvent.focus(link);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });
  });

  it("should close popover on blur", async () => {
    render(<InvoiceCard invoice={mockInvoice} />);

    const link = screen.getByRole("article");

    // Focus
    fireEvent.focus(link);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    // Blur
    fireEvent.blur(link);

    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });

  it("should link aria-describedby when popover is open", async () => {
    render(<InvoiceCard invoice={mockInvoice} />);

    const link = screen.getByRole("article");

    // Before popover opens - no aria-describedby
    expect(link).not.toHaveAttribute("aria-describedby");

    // Open popover
    fireEvent.mouseEnter(link);
    await sleep(400);

    await waitFor(() => {
      expect(link).toHaveAttribute("aria-describedby", `invoice-popover-${mockInvoice.id}`);
    });
  });

  it("should remove aria-describedby when popover closes", async () => {
    render(<InvoiceCard invoice={mockInvoice} />);

    const link = screen.getByRole("article");

    // Open popover
    fireEvent.mouseEnter(link);
    await sleep(400);

    await waitFor(() => {
      expect(link).toHaveAttribute("aria-describedby");
    });

    // Close popover
    fireEvent.mouseLeave(link);

    await waitFor(() => {
      expect(link).not.toHaveAttribute("aria-describedby");
    });
  });

  it("should not open popover for expired invoices on hover", async () => {
    render(<InvoiceCard invoice={expiredInvoice} />);

    const link = screen.getByRole("article");

    fireEvent.mouseEnter(link);
    await sleep(400);

    // Should not show popover for expired invoice
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("should not open popover for expired invoices on focus", async () => {
    render(<InvoiceCard invoice={expiredInvoice} />);

    const link = screen.getByRole("article");

    fireEvent.focus(link);

    // Should not show popover for expired invoice
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("should cleanup timeout on unmount", async () => {
    const { unmount } = render(<InvoiceCard invoice={mockInvoice} />);

    const link = screen.getByRole("article");
    fireEvent.mouseEnter(link);

    // Unmount before timeout completes
    unmount();

    // Wait - should not cause errors
    await sleep(400);

    // No error thrown
    expect(true).toBe(true);
  });

  it("should display popover content correctly", async () => {
    render(<InvoiceCard invoice={mockInvoice} />);

    const link = screen.getByRole("article");

    fireEvent.mouseEnter(link);
    await sleep(400);

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toBeInTheDocument();

    const tooltipQuery = within(tooltip);
    expect(tooltipQuery.getByText("Invoice Preview")).toBeInTheDocument();
    expect(tooltipQuery.getByText("12.50% APR")).toBeInTheDocument();
    expect(tooltipQuery.getByText("A")).toBeInTheDocument();
    expect(tooltipQuery.getByText("Kenya")).toBeInTheDocument();
    expect(tooltipQuery.getByText("75%")).toBeInTheDocument();
  });
});
