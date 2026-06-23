/**
 * Unit tests for lib/invoiceSvg.ts
 *
 * Covers:
 *  1. generateInvoiceSvg — output structure and required elements
 *  2. generateInvoiceSvg — content correctness
 *  3. generateInvoiceSvg — XSS/injection prevention
 *  4. generateInvoiceSvg — optional fields
 *  5. svgToFile — File object creation
 *  6. svgToDataUri — data URI encoding
 *
 * Closes #121
 */

import { describe, it, expect } from "vitest";
import { generateInvoiceSvg, svgToFile, svgToDataUri } from "../invoiceSvg";
import type { InvoiceMetadataV1 } from "../invoiceMetadata";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_METADATA: InvoiceMetadataV1 = {
  metadata_version: "1.0",
  name: "Invoice INV-2024-0001",
  description: "Enterprise software services",
  image: "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
  invoice_number: "INV-2024-0001",
  amount: 250000,
  currency: "USDC",
  due_date: "2025-03-01",
  issuer: {
    address: "GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQ",
    name: "TechBridge Solutions Ltd",
  },
  debtor: {
    name: "Safaricom PLC",
    address: "Safaricom House, Waiyaki Way, Nairobi, Kenya",
    privacy: "full",
  },
};

const FULL_METADATA: InvoiceMetadataV1 = {
  ...BASE_METADATA,
  jurisdiction: "KE",
  category: "technology",
  risk_tier: "A",
  discount_rate: 0.06,
  ipfs_document_cid: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
  external_url: "https://kora.finance/marketplace/inv_001",
};

// ─── 1. Output structure ──────────────────────────────────────────────────────

describe("generateInvoiceSvg — output structure", () => {
  it("returns a string", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    expect(typeof svg).toBe("string");
  });

  it("starts with XML declaration", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    expect(svg.trim()).toMatch(/^<\?xml/);
  });

  it("contains an <svg> root element", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    expect(svg).toContain("<svg ");
    expect(svg).toContain("</svg>");
  });

  it("includes xmlns attribute", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("includes viewBox attribute", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    expect(svg).toContain("viewBox=");
  });

  it("includes role='img' for accessibility", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    expect(svg).toContain('role="img"');
  });

  it("includes <title> element for accessibility", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    expect(svg).toContain("<title ");
    expect(svg).toContain("</title>");
  });

  it("includes <desc> element for accessibility", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    expect(svg).toContain("<desc ");
    expect(svg).toContain("</desc>");
  });

  it("includes aria-labelledby referencing title and desc", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    expect(svg).toContain("aria-labelledby=");
  });

  it("uses default dimensions of 800x600", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="600"');
  });

  it("respects custom width and height options", () => {
    const svg = generateInvoiceSvg(BASE_METADATA, { width: 400, height: 300 });
    expect(svg).toContain('width="400"');
    expect(svg).toContain('height="300"');
  });

  it("includes <defs> section with gradients", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    expect(svg).toContain("<defs>");
    expect(svg).toContain("<linearGradient ");
  });

  it("includes a <filter> for glow effect", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    expect(svg).toContain("<filter ");
  });
});

// ─── 2. Content correctness ───────────────────────────────────────────────────

describe("generateInvoiceSvg — content", () => {
  it("includes the invoice number", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    expect(svg).toContain("INV-2024-0001");
  });

  it("includes the debtor name", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    expect(svg).toContain("Safaricom PLC");
  });

  it("includes the issuer name", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    expect(svg).toContain("TechBridge Solutions Ltd");
  });

  it("includes the formatted amount", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    // 250000 → "$250.0K USDC"
    expect(svg).toContain("250.0K USDC");
  });

  it("includes the due date", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    // "2025-03-01" → "Mar 1, 2025"
    expect(svg).toContain("Mar 1, 2025");
  });

  it("includes 'Kora Protocol' branding", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    expect(svg).toContain("Kora Protocol");
  });

  it("includes the metadata version", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    expect(svg).toContain("v1.0");
  });

  it("includes jurisdiction tag when provided", () => {
    const svg = generateInvoiceSvg(FULL_METADATA);
    expect(svg).toContain("KE");
  });

  it("includes category tag when provided", () => {
    const svg = generateInvoiceSvg(FULL_METADATA);
    expect(svg).toContain("Technology");
  });

  it("includes risk tier tag when provided", () => {
    const svg = generateInvoiceSvg(FULL_METADATA);
    expect(svg).toContain("Tier A");
  });

  it("includes discount rate when provided", () => {
    const svg = generateInvoiceSvg(FULL_METADATA);
    // 0.06 → "6.0%"
    expect(svg).toContain("6.0%");
  });

  it("includes truncated IPFS document CID when provided", () => {
    const svg = generateInvoiceSvg(FULL_METADATA);
    // CID is truncated: first 8 chars + "…" + last 6 chars
    expect(svg).toContain("QmXoypiz");
    expect(svg).toContain("uco");
  });

  it("does not include IPFS section when ipfs_document_cid is absent", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    expect(svg).not.toContain("IPFS DOCUMENT");
  });

  it("does not include discount rate section when discount_rate is absent", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    expect(svg).not.toContain("DISCOUNT RATE");
  });

  it("formats large amounts as millions", () => {
    const svg = generateInvoiceSvg({ ...BASE_METADATA, amount: 2_500_000 });
    expect(svg).toContain("2.5M USDC");
  });

  it("formats small amounts without compact notation", () => {
    const svg = generateInvoiceSvg({ ...BASE_METADATA, amount: 500 });
    expect(svg).toContain("$500.00 USDC");
  });

  it("uses issuer address as fallback when issuer.name is absent", () => {
    const svg = generateInvoiceSvg({
      ...BASE_METADATA,
      issuer: { address: "GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQ" },
    });
    // Address is truncated to 36 chars
    expect(svg).toContain("GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQK");
  });
});

// ─── 3. XSS / injection prevention ───────────────────────────────────────────

describe("generateInvoiceSvg — XSS prevention", () => {
  it("escapes & in debtor name", () => {
    const svg = generateInvoiceSvg({
      ...BASE_METADATA,
      debtor: { name: "Smith & Jones Ltd", privacy: "full" },
    });
    expect(svg).toContain("Smith &amp; Jones Ltd");
    expect(svg).not.toContain("Smith & Jones Ltd");
  });

  it("escapes < in debtor name", () => {
    const svg = generateInvoiceSvg({
      ...BASE_METADATA,
      debtor: { name: "A<B Corp", privacy: "full" },
    });
    expect(svg).toContain("A&lt;B Corp");
    expect(svg).not.toContain("A<B Corp");
  });

  it("escapes > in debtor name", () => {
    const svg = generateInvoiceSvg({
      ...BASE_METADATA,
      debtor: { name: "A>B Corp", privacy: "full" },
    });
    expect(svg).toContain("A&gt;B Corp");
  });

  it("escapes \" in invoice number", () => {
    const svg = generateInvoiceSvg({
      ...BASE_METADATA,
      invoice_number: 'INV"2024',
    });
    expect(svg).toContain("INV&quot;2024");
  });

  it("escapes ' in issuer name", () => {
    const svg = generateInvoiceSvg({
      ...BASE_METADATA,
      issuer: {
        address: "GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQ",
        name: "O'Brien Ltd",
      },
    });
    expect(svg).toContain("O&apos;Brien Ltd");
  });

  it("truncates very long debtor names to prevent layout overflow", () => {
    const longName = "A".repeat(100);
    const svg = generateInvoiceSvg({
      ...BASE_METADATA,
      debtor: { name: longName, privacy: "full" },
    });
    // Should be truncated to 40 chars + "…"
    expect(svg).toContain("A".repeat(39) + "…");
    expect(svg).not.toContain("A".repeat(100));
  });

  it("truncates very long issuer names", () => {
    const longName = "B".repeat(100);
    const svg = generateInvoiceSvg({
      ...BASE_METADATA,
      issuer: {
        address: "GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQ",
        name: longName,
      },
    });
    expect(svg).toContain("B".repeat(35) + "…");
    expect(svg).not.toContain("B".repeat(100));
  });
});

// ─── 4. Optional fields ───────────────────────────────────────────────────────

describe("generateInvoiceSvg — optional fields", () => {
  it("renders without optional fields (minimal metadata)", () => {
    const minimal: InvoiceMetadataV1 = {
      metadata_version: "1.0",
      name: "Invoice INV-MIN",
      description: "Minimal invoice",
      image: "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
      invoice_number: "INV-MIN",
      amount: 1000,
      currency: "USDC",
      due_date: "2025-06-01",
      issuer: {
        address: "GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQ",
      },
      debtor: { name: "Minimal Debtor" },
    };
    expect(() => generateInvoiceSvg(minimal)).not.toThrow();
    const svg = generateInvoiceSvg(minimal);
    expect(svg).toContain("INV-MIN");
    expect(svg).toContain("Minimal Debtor");
  });

  it("uses different risk colours for different tiers", () => {
    const svgAAA = generateInvoiceSvg({ ...BASE_METADATA, risk_tier: "AAA" });
    const svgCCC = generateInvoiceSvg({ ...BASE_METADATA, risk_tier: "CCC" });
    // AAA uses emerald (#34d399), CCC uses red (#dc2626)
    expect(svgAAA).toContain("#34d399");
    expect(svgCCC).toContain("#dc2626");
  });

  it("uses primary colour when risk_tier is absent", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    // Primary colour is sky-400 (#38bdf8)
    expect(svg).toContain("#38bdf8");
  });

  it("renders EURC currency correctly", () => {
    const svg = generateInvoiceSvg({ ...BASE_METADATA, currency: "EURC" });
    expect(svg).toContain("EURC");
  });

  it("renders XLM currency correctly", () => {
    const svg = generateInvoiceSvg({ ...BASE_METADATA, currency: "XLM" });
    expect(svg).toContain("XLM");
  });
});

// ─── 5. svgToFile ─────────────────────────────────────────────────────────────

describe("svgToFile", () => {
  it("returns a File object", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    const file = svgToFile(svg);
    expect(file).toBeInstanceOf(File);
  });

  it("has the correct MIME type", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    const file = svgToFile(svg);
    expect(file.type).toBe("image/svg+xml");
  });

  it("uses default filename when not specified", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    const file = svgToFile(svg);
    expect(file.name).toBe("invoice-preview.svg");
  });

  it("uses custom filename when specified", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    const file = svgToFile(svg, "custom-name.svg");
    expect(file.name).toBe("custom-name.svg");
  });

  it("file size is greater than 0", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    const file = svgToFile(svg);
    expect(file.size).toBeGreaterThan(0);
  });

  it("file content matches the SVG string", async () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    const file = svgToFile(svg);
    const text = await file.text();
    expect(text).toBe(svg);
  });
});

// ─── 6. svgToDataUri ──────────────────────────────────────────────────────────

describe("svgToDataUri", () => {
  it("returns a string starting with data:image/svg+xml", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    const uri = svgToDataUri(svg);
    expect(uri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  it("URI contains encoded SVG content", () => {
    const svg = "<svg><text>Hello</text></svg>";
    const uri = svgToDataUri(svg);
    expect(uri).toContain(encodeURIComponent("<svg>"));
  });

  it("can be decoded back to the original SVG", () => {
    const svg = generateInvoiceSvg(BASE_METADATA);
    const uri = svgToDataUri(svg);
    const prefix = "data:image/svg+xml;charset=utf-8,";
    const decoded = decodeURIComponent(uri.slice(prefix.length));
    expect(decoded).toBe(svg);
  });
});
