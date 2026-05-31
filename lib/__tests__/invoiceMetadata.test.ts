/**
 * Unit tests for lib/invoiceMetadata.ts
 *
 * Covers:
 *  1. invoiceMetadataV1Schema — required field enforcement
 *  2. invoiceMetadataV1Schema — optional field validation
 *  3. invoiceMetadataV1Schema — field format validation
 *  4. validateInvoiceMetadata — success and failure paths
 *  5. parseInvoiceMetadata — throws on invalid input
 *  6. buildInvoiceMetadata — auto-generates attributes
 *  7. METADATA_VERSION constant
 *
 * Closes #121
 */

import { describe, it, expect } from "vitest";
import {
  invoiceMetadataV1Schema,
  validateInvoiceMetadata,
  parseInvoiceMetadata,
  buildInvoiceMetadata,
  METADATA_VERSION,
  type InvoiceMetadataV1,
  type InvoiceMetadataV1Input,
} from "../invoiceMetadata";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal valid metadata object satisfying all required fields. */
const VALID_METADATA: InvoiceMetadataV1 = {
  metadata_version: "1.0",
  name: "Invoice INV-2024-0001",
  description: "Tokenized invoice for enterprise software services Q4 2024",
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

/** Full metadata with all optional fields populated. */
const FULL_METADATA: InvoiceMetadataV1 = {
  ...VALID_METADATA,
  jurisdiction: "KE",
  category: "technology",
  risk_tier: "A",
  discount_rate: 0.06,
  ipfs_document_cid: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
  external_url: "https://kora.finance/marketplace/inv_001",
  attributes: [
    { trait_type: "Invoice Number", value: "INV-2024-0001" },
    { trait_type: "Amount", value: 250000, display_type: "number" },
  ],
};

// ─── 1. Required field enforcement ───────────────────────────────────────────

describe("invoiceMetadataV1Schema — required fields", () => {
  it("accepts a minimal valid metadata object", () => {
    const result = invoiceMetadataV1Schema.safeParse(VALID_METADATA);
    expect(result.success).toBe(true);
  });

  it("rejects when metadata_version is missing", () => {
    const { metadata_version, ...rest } = VALID_METADATA;
    const result = invoiceMetadataV1Schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects when metadata_version is not '1.0'", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      metadata_version: "2.0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when name is missing", () => {
    const { name, ...rest } = VALID_METADATA;
    const result = invoiceMetadataV1Schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects when name is empty string", () => {
    const result = invoiceMetadataV1Schema.safeParse({ ...VALID_METADATA, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects when description is missing", () => {
    const { description, ...rest } = VALID_METADATA;
    const result = invoiceMetadataV1Schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects when image is missing", () => {
    const { image, ...rest } = VALID_METADATA;
    const result = invoiceMetadataV1Schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects when invoice_number is missing", () => {
    const { invoice_number, ...rest } = VALID_METADATA;
    const result = invoiceMetadataV1Schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects when amount is missing", () => {
    const { amount, ...rest } = VALID_METADATA;
    const result = invoiceMetadataV1Schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects when currency is missing", () => {
    const { currency, ...rest } = VALID_METADATA;
    const result = invoiceMetadataV1Schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects when due_date is missing", () => {
    const { due_date, ...rest } = VALID_METADATA;
    const result = invoiceMetadataV1Schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects when issuer is missing", () => {
    const { issuer, ...rest } = VALID_METADATA;
    const result = invoiceMetadataV1Schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects when issuer.address is missing", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      issuer: { name: "Test Co" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects when debtor is missing", () => {
    const { debtor, ...rest } = VALID_METADATA;
    const result = invoiceMetadataV1Schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects when debtor.name is missing", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      debtor: { address: "123 St" },
    });
    expect(result.success).toBe(false);
  });
});

// ─── 2. Optional field validation ────────────────────────────────────────────

describe("invoiceMetadataV1Schema — optional fields", () => {
  it("accepts metadata with all optional fields", () => {
    const result = invoiceMetadataV1Schema.safeParse(FULL_METADATA);
    expect(result.success).toBe(true);
  });

  it("accepts metadata without any optional fields", () => {
    const minimal: InvoiceMetadataV1 = {
      metadata_version: "1.0",
      name: VALID_METADATA.name,
      description: VALID_METADATA.description,
      image: VALID_METADATA.image,
      invoice_number: VALID_METADATA.invoice_number,
      amount: VALID_METADATA.amount,
      currency: VALID_METADATA.currency,
      due_date: VALID_METADATA.due_date,
      issuer: { address: VALID_METADATA.issuer.address },
      debtor: { name: VALID_METADATA.debtor.name },
    };
    const result = invoiceMetadataV1Schema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it("accepts all supported currencies", () => {
    for (const currency of ["USDC", "EURC", "XLM"] as const) {
      const result = invoiceMetadataV1Schema.safeParse({ ...VALID_METADATA, currency });
      expect(result.success, `currency ${currency} should be valid`).toBe(true);
    }
  });

  it("rejects unsupported currency", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      currency: "BTC",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all supported jurisdictions", () => {
    const jurisdictions = ["US", "EU", "UK", "NG", "KE", "GH", "ZA", "OTHER"] as const;
    for (const jurisdiction of jurisdictions) {
      const result = invoiceMetadataV1Schema.safeParse({ ...VALID_METADATA, jurisdiction });
      expect(result.success, `jurisdiction ${jurisdiction} should be valid`).toBe(true);
    }
  });

  it("rejects unsupported jurisdiction", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      jurisdiction: "JP",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all supported categories", () => {
    const categories = [
      "technology", "manufacturing", "logistics", "healthcare",
      "retail", "construction", "agriculture", "energy", "finance", "other",
    ] as const;
    for (const category of categories) {
      const result = invoiceMetadataV1Schema.safeParse({ ...VALID_METADATA, category });
      expect(result.success, `category ${category} should be valid`).toBe(true);
    }
  });

  it("accepts all supported risk tiers", () => {
    const tiers = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC"] as const;
    for (const risk_tier of tiers) {
      const result = invoiceMetadataV1Schema.safeParse({ ...VALID_METADATA, risk_tier });
      expect(result.success, `risk_tier ${risk_tier} should be valid`).toBe(true);
    }
  });

  it("accepts discount_rate of 0", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      discount_rate: 0,
    });
    expect(result.success).toBe(true);
  });

  it("accepts discount_rate of 1 (100%)", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      discount_rate: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects discount_rate above 1", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      discount_rate: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects discount_rate below 0", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      discount_rate: -0.01,
    });
    expect(result.success).toBe(false);
  });

  it("accepts debtor with anonymized privacy", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      debtor: { name: "Technology Company, Kenya", privacy: "anonymized" },
    });
    expect(result.success).toBe(true);
  });

  it("defaults debtor.privacy to 'full' when omitted", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      debtor: { name: "Safaricom PLC" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.debtor.privacy).toBe("full");
    }
  });
});

// ─── 3. Field format validation ───────────────────────────────────────────────

describe("invoiceMetadataV1Schema — field formats", () => {
  it("rejects image that is neither ipfs:// nor https://", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      image: "http://insecure.example.com/image.png",
    });
    expect(result.success).toBe(false);
  });

  it("accepts image with https:// prefix", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      image: "https://gateway.pinata.cloud/ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    });
    expect(result.success).toBe(true);
  });

  it("accepts image with ipfs:// prefix", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      image: "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invoice_number with special characters", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      invoice_number: "INV@#$%",
    });
    expect(result.success).toBe(false);
  });

  it("accepts invoice_number with alphanumeric and hyphens", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      invoice_number: "INV-2024-0001-A",
    });
    expect(result.success).toBe(true);
  });

  it("rejects amount of 0", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      amount: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      amount: -100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects due_date not in YYYY-MM-DD format", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      due_date: "01/03/2025",
    });
    expect(result.success).toBe(false);
  });

  it("accepts due_date in YYYY-MM-DD format", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      due_date: "2025-12-31",
    });
    expect(result.success).toBe(true);
  });

  it("rejects issuer.address that is not a valid Stellar public key", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      issuer: { address: "not-a-stellar-key" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts issuer.address starting with G followed by 55 base32 chars", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      issuer: {
        address: "GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQ",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects ipfs_document_cid that is not a valid CID", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      ipfs_document_cid: "not-a-cid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid CIDv0 (Qm...)", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      ipfs_document_cid: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    });
    expect(result.success).toBe(true);
  });

  it("rejects external_url that is not a valid URL", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      external_url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid external_url", () => {
    const result = invoiceMetadataV1Schema.safeParse({
      ...VALID_METADATA,
      external_url: "https://kora.finance/marketplace/inv_001",
    });
    expect(result.success).toBe(true);
  });
});

// ─── 4. validateInvoiceMetadata ───────────────────────────────────────────────

describe("validateInvoiceMetadata", () => {
  it("returns success: true with typed data for valid metadata", () => {
    const result = validateInvoiceMetadata(VALID_METADATA);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata_version).toBe("1.0");
      expect(result.data.invoice_number).toBe("INV-2024-0001");
    }
  });

  it("returns success: false with errors array for invalid metadata", () => {
    const result = validateInvoiceMetadata({ name: "Missing fields" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain(":");
    }
  });

  it("returns success: false for null input", () => {
    const result = validateInvoiceMetadata(null);
    expect(result.success).toBe(false);
  });

  it("returns success: false for non-object input", () => {
    const result = validateInvoiceMetadata("not an object");
    expect(result.success).toBe(false);
  });

  it("returns success: false for empty object", () => {
    const result = validateInvoiceMetadata({});
    expect(result.success).toBe(false);
    if (!result.success) {
      // Should report all required fields as missing
      expect(result.errors.length).toBeGreaterThan(5);
    }
  });

  it("error messages include the field path", () => {
    const result = validateInvoiceMetadata({
      ...VALID_METADATA,
      amount: -1,
      due_date: "bad-date",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.errors.map((e) => e.split(":")[0]);
      expect(paths).toContain("amount");
      expect(paths).toContain("due_date");
    }
  });

  it("does not throw — always returns a result object", () => {
    expect(() => validateInvoiceMetadata(undefined)).not.toThrow();
    expect(() => validateInvoiceMetadata([])).not.toThrow();
    expect(() => validateInvoiceMetadata(42)).not.toThrow();
  });
});

// ─── 5. parseInvoiceMetadata ──────────────────────────────────────────────────

describe("parseInvoiceMetadata", () => {
  it("returns typed data for valid metadata", () => {
    const data = parseInvoiceMetadata(VALID_METADATA);
    expect(data.metadata_version).toBe("1.0");
    expect(data.invoice_number).toBe("INV-2024-0001");
  });

  it("throws an Error for invalid metadata", () => {
    expect(() => parseInvoiceMetadata({ name: "Incomplete" })).toThrow(Error);
  });

  it("error message includes 'Invalid invoice metadata'", () => {
    expect(() => parseInvoiceMetadata({})).toThrow(/Invalid invoice metadata/);
  });

  it("error message includes the version", () => {
    expect(() => parseInvoiceMetadata({})).toThrow(/v1\.0/);
  });

  it("error message lists all failing fields", () => {
    let errorMessage = "";
    try {
      parseInvoiceMetadata({ metadata_version: "1.0", name: "Test" });
    } catch (e) {
      errorMessage = (e as Error).message;
    }
    expect(errorMessage).toContain("description");
    expect(errorMessage).toContain("image");
  });
});

// ─── 6. buildInvoiceMetadata ──────────────────────────────────────────────────

describe("buildInvoiceMetadata", () => {
  const INPUT: InvoiceMetadataV1Input = {
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
      privacy: "full",
    },
    jurisdiction: "KE",
    category: "technology",
    risk_tier: "A",
    discount_rate: 0.06,
    ipfs_document_cid: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
  };

  it("adds metadata_version: '1.0' automatically", () => {
    const result = buildInvoiceMetadata(INPUT);
    expect(result.metadata_version).toBe("1.0");
  });

  it("preserves all input fields", () => {
    const result = buildInvoiceMetadata(INPUT);
    expect(result.invoice_number).toBe(INPUT.invoice_number);
    expect(result.amount).toBe(INPUT.amount);
    expect(result.currency).toBe(INPUT.currency);
    expect(result.due_date).toBe(INPUT.due_date);
    expect(result.issuer.address).toBe(INPUT.issuer.address);
    expect(result.debtor.name).toBe(INPUT.debtor.name);
  });

  it("auto-generates attributes array when not provided", () => {
    const result = buildInvoiceMetadata(INPUT);
    expect(Array.isArray(result.attributes)).toBe(true);
    expect(result.attributes!.length).toBeGreaterThan(0);
  });

  it("attributes include invoice_number trait", () => {
    const result = buildInvoiceMetadata(INPUT);
    const trait = result.attributes!.find((a) => a.trait_type === "Invoice Number");
    expect(trait).toBeDefined();
    expect(trait!.value).toBe("INV-2024-0001");
  });

  it("attributes include amount trait with display_type: number", () => {
    const result = buildInvoiceMetadata(INPUT);
    const trait = result.attributes!.find((a) => a.trait_type === "Amount");
    expect(trait).toBeDefined();
    expect(trait!.display_type).toBe("number");
    expect(trait!.value).toBe(250000);
  });

  it("attributes include jurisdiction when provided", () => {
    const result = buildInvoiceMetadata(INPUT);
    const trait = result.attributes!.find((a) => a.trait_type === "Jurisdiction");
    expect(trait).toBeDefined();
    expect(trait!.value).toBe("KE");
  });

  it("attributes include risk_tier when provided", () => {
    const result = buildInvoiceMetadata(INPUT);
    const trait = result.attributes!.find((a) => a.trait_type === "Risk Tier");
    expect(trait).toBeDefined();
    expect(trait!.value).toBe("A");
  });

  it("attributes include discount_rate as boost_percentage", () => {
    const result = buildInvoiceMetadata(INPUT);
    const trait = result.attributes!.find((a) => a.trait_type === "Discount Rate");
    expect(trait).toBeDefined();
    expect(trait!.display_type).toBe("boost_percentage");
    expect(trait!.value).toBe(6); // 0.06 * 100
  });

  it("does not add jurisdiction attribute when not provided", () => {
    const { jurisdiction, ...inputWithoutJurisdiction } = INPUT;
    const result = buildInvoiceMetadata(inputWithoutJurisdiction);
    const trait = result.attributes!.find((a) => a.trait_type === "Jurisdiction");
    expect(trait).toBeUndefined();
  });

  it("preserves custom attributes when provided", () => {
    const customAttrs = [{ trait_type: "Custom", value: "test" }];
    const result = buildInvoiceMetadata({ ...INPUT, attributes: customAttrs });
    expect(result.attributes).toEqual(customAttrs);
  });

  it("throws for invalid input", () => {
    expect(() =>
      buildInvoiceMetadata({
        ...INPUT,
        amount: -1,
      })
    ).toThrow();
  });

  it("throws for missing required fields", () => {
    expect(() =>
      buildInvoiceMetadata({
        ...INPUT,
        invoice_number: "",
      })
    ).toThrow();
  });
});

// ─── 7. METADATA_VERSION constant ────────────────────────────────────────────

describe("METADATA_VERSION", () => {
  it("is '1.0'", () => {
    expect(METADATA_VERSION).toBe("1.0");
  });

  it("is a string literal type", () => {
    expect(typeof METADATA_VERSION).toBe("string");
  });
});
