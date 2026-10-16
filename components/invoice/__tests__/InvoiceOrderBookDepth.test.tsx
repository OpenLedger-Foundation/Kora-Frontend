import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceOrderBookDepth } from "../InvoiceOrderBookDepth";
import type { PositionListingMeta } from "@/store/positionListingStore";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock next-intl translations
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, any>) => {
    if (key === "depthBarAria" && params) {
      return `Depth at ${params.price}: ${params.volume} cumulative volume (${params.percent}%)`;
    }
    if (key === "title") return "Order Book Depth";
    if (key === "askCount" && params) return `${params.count} Asks`;
    if (key === "description") return "Secondary-market positions available for this invoice.";
    if (key === "empty.title") return "No listings yet";
    if (key === "empty.description") return "No positions have been listed for sale on this invoice.";
    if (key === "tableLabel") return "Order book depth for this invoice";
    if (key === "columns.askPrice") return "Ask Price";
    if (key === "columns.discount") return "Discount";
    if (key === "columns.cumulativeVolume") return "Cum. Volume";
    if (key === "columns.action") return "Action";
    if (key === "best") return "Best";
    if (key === "acquireAria" && params) return `Acquire position ${params.positionId} at ${params.price}`;
    if (key === "acquire") return "Acquire";
    if (key === "footer.faceValue") return "Face value per position:";
    if (key === "footer.totalDepth") return "Total ask depth:";
    return key;
  },
}));

let mockListings: PositionListingMeta[] = [];

vi.mock("@/store/positionListingStore", () => ({
  usePositionListingStore: () => ({
    getListingsByInvoiceToken: (tokenId: string) =>
      mockListings.filter((l) => l.invoiceTokenId === tokenId),
  }),
}));

describe("InvoiceOrderBookDepth - Order Book Depth Bar Semantics (Issue #962)", () => {
  beforeEach(() => {
    mockListings = [];
  });

  it("renders empty state without progressbars when listings are empty", () => {
    render(<InvoiceOrderBookDepth invoiceTokenId="token-empty" currency="USDC" />);

    expect(screen.getByText("No listings yet")).toBeInTheDocument();
    expect(
      screen.getByText("No positions have been listed for sale on this invoice.")
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
  });

  it("exposes progressbar role with valuenow, valuemin, valuemax, and descriptive aria-label for multiple listings", () => {
    mockListings = [
      {
        positionId: "pos-1",
        invoiceTokenId: "token-1",
        askPrice: 200,
        impliedDiscount: 0.05,
        listedAt: "2026-10-01T00:00:00Z",
        sellerAddress: "GSELLER1",
        status: "active",
      } as unknown as PositionListingMeta,
      {
        positionId: "pos-2",
        invoiceTokenId: "token-1",
        askPrice: 300,
        impliedDiscount: 0.03,
        listedAt: "2026-10-02T00:00:00Z",
        sellerAddress: "GSELLER2",
        status: "active",
      } as unknown as PositionListingMeta,
      {
        positionId: "pos-3",
        invoiceTokenId: "token-1",
        askPrice: 500,
        impliedDiscount: 0.01,
        listedAt: "2026-10-03T00:00:00Z",
        sellerAddress: "GSELLER3",
        status: "active",
      } as unknown as PositionListingMeta,
    ];

    render(
      <InvoiceOrderBookDepth
        invoiceTokenId="token-1"
        currency="USDC"
        positionFaceValue={1000}
      />
    );

    const progressbars = screen.getAllByRole("progressbar");
    expect(progressbars).toHaveLength(3);

    // Row 1: cumulative 200 / 1000 = 20%
    expect(progressbars[0]).toHaveAttribute("aria-valuenow", "20");
    expect(progressbars[0]).toHaveAttribute("aria-valuemin", "0");
    expect(progressbars[0]).toHaveAttribute("aria-valuemax", "100");
    expect(progressbars[0].getAttribute("aria-label")).toContain("20%");
    expect(progressbars[0].getAttribute("aria-label")).toContain("USDC");

    // Row 2: cumulative (200 + 300) = 500 / 1000 = 50%
    expect(progressbars[1]).toHaveAttribute("aria-valuenow", "50");
    expect(progressbars[1].getAttribute("aria-label")).toContain("50%");

    // Row 3: cumulative (200 + 300 + 500) = 1000 / 1000 = 100%
    expect(progressbars[2]).toHaveAttribute("aria-valuenow", "100");
    expect(progressbars[2].getAttribute("aria-label")).toContain("100%");
  });

  it("handles single listing edge case where max equals min volume (100%)", () => {
    mockListings = [
      {
        positionId: "pos-single",
        invoiceTokenId: "token-single",
        askPrice: 750,
        impliedDiscount: 0.04,
        listedAt: "2026-10-01T00:00:00Z",
        sellerAddress: "GSELLER_SINGLE",
        status: "active",
      } as unknown as PositionListingMeta,
    ];

    render(
      <InvoiceOrderBookDepth invoiceTokenId="token-single" currency="USDC" />
    );

    const progressbars = screen.getAllByRole("progressbar");
    expect(progressbars).toHaveLength(1);
    expect(progressbars[0]).toHaveAttribute("aria-valuenow", "100");
    expect(progressbars[0]).toHaveAttribute("aria-valuemin", "0");
    expect(progressbars[0]).toHaveAttribute("aria-valuemax", "100");
    expect(progressbars[0].getAttribute("aria-label")).toContain("100%");
  });

  it("handles very small percentage edge case rounding to zero valuenow", () => {
    mockListings = [
      {
        positionId: "pos-dust",
        invoiceTokenId: "token-dust",
        askPrice: 0.01,
        impliedDiscount: 0.05,
        listedAt: "2026-10-01T00:00:00Z",
        sellerAddress: "GSELLER_DUST",
        status: "active",
      } as unknown as PositionListingMeta,
      {
        positionId: "pos-whale",
        invoiceTokenId: "token-dust",
        askPrice: 100000,
        impliedDiscount: 0.01,
        listedAt: "2026-10-02T00:00:00Z",
        sellerAddress: "GSELLER_WHALE",
        status: "active",
      } as unknown as PositionListingMeta,
    ];

    render(
      <InvoiceOrderBookDepth invoiceTokenId="token-dust" currency="USDC" />
    );

    const progressbars = screen.getAllByRole("progressbar");
    expect(progressbars).toHaveLength(2);
    // 0.01 / 100000.01 * 100 rounds to 0
    expect(progressbars[0]).toHaveAttribute("aria-valuenow", "0");
    expect(progressbars[0].getAttribute("aria-label")).toContain("0%");
  });

  it("ensures progressbar elements are not keyboard focusable (no keyboard traps)", () => {
    mockListings = [
      {
        positionId: "pos-1",
        invoiceTokenId: "token-kb",
        askPrice: 100,
        impliedDiscount: 0.05,
        listedAt: "2026-10-01T00:00:00Z",
        sellerAddress: "GSELLER1",
        status: "active",
      } as unknown as PositionListingMeta,
    ];

    render(
      <InvoiceOrderBookDepth invoiceTokenId="token-kb" currency="USDC" />
    );

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).not.toHaveAttribute("tabindex");
    expect(progressbar.tagName.toLowerCase()).toBe("span");
  });

  it("includes RTL directional classes for RTL layout compatibility", () => {
    mockListings = [
      {
        positionId: "pos-1",
        invoiceTokenId: "token-rtl",
        askPrice: 100,
        impliedDiscount: 0.05,
        listedAt: "2026-10-01T00:00:00Z",
        sellerAddress: "GSELLER1",
        status: "active",
      } as unknown as PositionListingMeta,
    ];

    render(
      <InvoiceOrderBookDepth invoiceTokenId="token-rtl" currency="USDC" />
    );

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar.className).toContain("rtl:left-auto");
    expect(progressbar.className).toContain("rtl:right-0");
  });
});
