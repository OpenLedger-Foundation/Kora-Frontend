import { describe, it, expect } from "vitest";
import {
  getFilteredInvoices,
  toQueryParams,
  fromQueryParams,
  DEFAULT_FILTERS,
} from "@/store/invoiceStore";
import type { Invoice } from "@/types";

// Minimal invoice factory
function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv_test",
    tokenId: "1",
    contractAddress: "C...",
    ipfsCid: "QmTest",
    metadata: {
      invoiceNumber: "INV-001",
      issuerName: "Test Co",
      issuerAddress: "G...",
      debtorName: "Debtor Inc",
      debtorAddress: "123 St",
      amount: 10000,
      currency: "USDC",
      issueDate: "2025-01-01",
      dueDate: "2025-06-01",
      description: "Test",
      jurisdiction: "US",
      category: "technology",
      documentHash: "QmTest",
      documentUrl: "https://ipfs.io/ipfs/QmTest",
    },
    terms: {
      discountRate: 0.05,
      apr: 20,
      financingAmount: 9500,
      minInvestment: 100,
      maxInvestment: 5000,
      tenor: 90,
      repaymentDate: "2025-06-01",
    },
    funding: {
      totalRaised: 0,
      targetAmount: 9500,
      fundingProgress: 0,
      investorCount: 0,
      remainingCapacity: 9500,
    },
    riskTier: "A",
    riskScore: 75,
    status: "listed",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ownerAddress: "G...",
    ...overrides,
  } as Invoice;
}

const invoices: Invoice[] = [
  makeInvoice({ id: "1", metadata: { ...makeInvoice().metadata, category: "technology", jurisdiction: "US" }, terms: { ...makeInvoice().terms, apr: 20 }, riskTier: "A", status: "listed" }),
  makeInvoice({ id: "2", metadata: { ...makeInvoice().metadata, category: "logistics", jurisdiction: "KE" }, terms: { ...makeInvoice().terms, apr: 35 }, riskTier: "BBB", status: "partially_funded" }),
  makeInvoice({ id: "3", metadata: { ...makeInvoice().metadata, category: "healthcare", jurisdiction: "EU" }, terms: { ...makeInvoice().terms, apr: 10 }, riskTier: "AAA", status: "repaid" }),
];

describe("getFilteredInvoices", () => {
  it("returns all invoices with default filters", () => {
    expect(getFilteredInvoices(invoices, DEFAULT_FILTERS, { sortBy: "apr", sortDir: "desc" })).toHaveLength(3);
  });

  it("filters by category", () => {
    const result = getFilteredInvoices(invoices, { ...DEFAULT_FILTERS, categories: ["technology"] }, { sortBy: "apr", sortDir: "desc" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters by jurisdiction", () => {
    const result = getFilteredInvoices(invoices, { ...DEFAULT_FILTERS, jurisdictions: ["KE"] }, { sortBy: "apr", sortDir: "desc" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("filters by riskTier", () => {
    const result = getFilteredInvoices(invoices, { ...DEFAULT_FILTERS, riskTiers: ["AAA"] }, { sortBy: "apr", sortDir: "desc" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });

  it("filters by aprRange", () => {
    const result = getFilteredInvoices(invoices, { ...DEFAULT_FILTERS, aprRange: [15, 40] }, { sortBy: "apr", sortDir: "desc" });
    expect(result.map((i) => i.id)).toEqual(expect.arrayContaining(["1", "2"]));
    expect(result).toHaveLength(2);
  });

  it("filters activeOnly", () => {
    const result = getFilteredInvoices(invoices, { ...DEFAULT_FILTERS, activeOnly: true }, { sortBy: "apr", sortDir: "desc" });
    expect(result.every((i) => i.status === "listed" || i.status === "partially_funded")).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("sorts by apr asc", () => {
    const result = getFilteredInvoices(invoices, DEFAULT_FILTERS, { sortBy: "apr", sortDir: "asc" });
    expect(result.map((i) => i.terms.apr)).toEqual([10, 20, 35]);
  });

  it("sorts by apr desc", () => {
    const result = getFilteredInvoices(invoices, DEFAULT_FILTERS, { sortBy: "apr", sortDir: "desc" });
    expect(result.map((i) => i.terms.apr)).toEqual([35, 20, 10]);
  });

  it("filters by search query on debtor name", () => {
    const result = getFilteredInvoices(invoices, DEFAULT_FILTERS, { sortBy: "apr", sortDir: "desc" }, "debtor");
    expect(result).toHaveLength(3); // all have "Debtor Inc"
  });
});

describe("URL serialization", () => {
  it("round-trips filters and sort through query params", () => {
    const filters = { categories: ["technology"], jurisdictions: ["US"], riskTiers: ["A"], aprRange: [5, 30] as [number, number], activeOnly: true };
    const sort = { sortBy: "amount" as const, sortDir: "asc" as const };
    const params = toQueryParams(filters, sort);
    const { filters: f2, sort: s2 } = fromQueryParams(params);
    expect(f2.categories).toEqual(["technology"]);
    expect(f2.jurisdictions).toEqual(["US"]);
    expect(f2.riskTiers).toEqual(["A"]);
    expect(f2.aprRange).toEqual([5, 30]);
    expect(f2.activeOnly).toBe(true);
    expect(s2.sortBy).toBe("amount");
    expect(s2.sortDir).toBe("asc");
  });

  it("returns defaults for empty params", () => {
    const { filters, sort } = fromQueryParams(new URLSearchParams());
    expect(filters).toEqual(DEFAULT_FILTERS);
    expect(sort).toEqual({ sortBy: "apr", sortDir: "desc" });
  });
});
