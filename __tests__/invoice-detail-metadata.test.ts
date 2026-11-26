/**
 * Invoice detail route metadata — Issue #375
 *
 * Exercises the real `generateMetadata` wired through `lib/invoiceSeo`, covering:
 *  - invalid route id / missing invoice → deterministic `noindex` heads
 *  - published invoice → privacy-safe OG / Twitter tags
 *  - private debtor fields (name for anonymized invoices, addresses, wallet keys)
 *    never leak into titles, descriptions or social tags
 *  - missing / unreachable / invalid IPFS metadata falls back cleanly and the
 *    page still renders a usable head instead of throwing
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchInvoiceById = vi.fn();
vi.mock("@/services/invoiceService", () => ({
  fetchInvoiceById: (...args: unknown[]) => fetchInvoiceById(...args),
}));

import { generateMetadata } from "@/app/marketplace/[id]/metadata";
import { MOCK_INVOICES } from "@/services/mockData";
import { publicDebtorLabel } from "@/lib/invoiceSeo";

/** Invoke the route's `generateMetadata` with the App Router param shape. */
function callMetadata(id: string) {
  return generateMetadata({ params: Promise.resolve({ id }) });
}

beforeEach(() => {
  fetchInvoiceById.mockReset();
  // Stay offline by default: mock mode short-circuits IPFS hydration, and the
  // stubbed fetch backs up any path that still attempts a request.
  vi.stubEnv("NEXT_PUBLIC_ENABLE_MOCK_DATA", "true");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network in tests")));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("generateMetadata — invalid route id", () => {
  it("returns a noindex fallback and never calls the service", async () => {
    const meta = await callMetadata("bad id!");

    expect(meta.title).toBe("Invalid Invoice | Kora Protocol");
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.openGraph).toBeUndefined();
    expect(fetchInvoiceById).not.toHaveBeenCalled();
  });
});

describe("generateMetadata — missing invoice", () => {
  it("returns a noindex not-found head", async () => {
    fetchInvoiceById.mockResolvedValueOnce(null);

    const meta = await callMetadata("9999");

    expect(meta.title).toBe("Invoice Not Found | Kora Protocol");
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.openGraph).toBeUndefined();
  });
});

describe("generateMetadata — published invoice", () => {
  it("builds OG / Twitter tags and keeps private addresses out of the head", async () => {
    const invoice = MOCK_INVOICES[0];
    fetchInvoiceById.mockResolvedValueOnce(invoice);

    const meta = await callMetadata(invoice.id);
    const blob = JSON.stringify(meta);

    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.openGraph).toBeDefined();
    expect((meta.twitter as { card?: string })?.card).toBe("summary_large_image");
    expect(String(meta.title)).toContain(publicDebtorLabel(invoice));

    expect(blob).not.toContain(invoice.metadata.debtorAddress);
    expect(blob).not.toContain(invoice.ownerAddress);
    expect(blob).not.toContain(invoice.metadata.issuerAddress);
  });

  it("redacts the real debtor name for anonymized invoices", async () => {
    const invoice = MOCK_INVOICES.find((i) => i.debtorPrivacy === "anonymized")!;
    fetchInvoiceById.mockResolvedValueOnce(invoice);

    const meta = await callMetadata(invoice.id);
    const blob = JSON.stringify(meta);

    expect(String(meta.title)).toContain(publicDebtorLabel(invoice));
    expect((meta.openGraph as { title?: string })?.title).toContain(
      publicDebtorLabel(invoice)
    );

    expect(blob).not.toContain(invoice.metadata.debtorName);
    expect(blob).not.toContain(invoice.metadata.debtorAddress);
    expect(blob).not.toContain(invoice.ownerAddress);
  });
});

describe("generateMetadata — IPFS metadata fallback", () => {
  const unstub = () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  };

  afterEach(unstub);

  it("falls back to invoice-record SEO when the IPFS gateway is unreachable", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MOCK_DATA", "false");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const invoice = MOCK_INVOICES[1];
    fetchInvoiceById.mockResolvedValueOnce(invoice);

    const meta = await callMetadata(invoice.id);

    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(String(meta.title)).toContain(publicDebtorLabel(invoice));
    expect(meta.openGraph).toBeDefined();
  });

  it("falls back when IPFS responds with a non-OK status", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MOCK_DATA", "false");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 504, json: async () => ({}) })
    );

    const invoice = MOCK_INVOICES[1];
    fetchInvoiceById.mockResolvedValueOnce(invoice);

    const meta = await callMetadata(invoice.id);

    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(String(meta.title)).toContain(publicDebtorLabel(invoice));
  });

  it("ignores IPFS metadata that fails schema validation without leaking it", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MOCK_DATA", "false");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          metadata_version: "1.0",
          description: "secret-ish payload",
          // missing required amount/currency/due_date/issuer → validation fails
        }),
      })
    );

    const invoice = MOCK_INVOICES[1];
    fetchInvoiceById.mockResolvedValueOnce(invoice);

    const meta = await callMetadata(invoice.id);
    const blob = JSON.stringify(meta);

    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(blob).not.toContain("secret-ish payload");
  });

  it("uses no IPFS hydration in mock mode yet still emits deterministic SEO", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MOCK_DATA", "true");

    const invoice = MOCK_INVOICES[0];
    fetchInvoiceById.mockResolvedValueOnce(invoice);

    const meta = await callMetadata(invoice.id);

    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(String(meta.title)).toContain(publicDebtorLabel(invoice));
  });
});

describe("generateMetadata — unexpected failure", () => {
  it("returns a generic indexable head instead of throwing", async () => {
    fetchInvoiceById.mockRejectedValueOnce(new Error("boom"));

    const meta = await callMetadata("123");

    expect(meta.title).toBe("Invoice Details | Kora Protocol");
    expect(meta.robots).toEqual({ index: true, follow: true });
  });
});
