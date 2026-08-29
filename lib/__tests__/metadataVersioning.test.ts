/**
 * Tests for IPFS metadata schema versioning & migration (#392).
 *
 * Covers:
 *  - detectMetadataVersion: v1 / legacy / unknown
 *  - migrateLegacyToV1 field mapping
 *  - parseAnyInvoiceMetadata: v1 passthrough, legacy migration, unknown error
 *  - metadataVersionBadge descriptors
 */
import { describe, it, expect } from "vitest";
import {
  detectMetadataVersion,
  migrateLegacyToV1,
  parseAnyInvoiceMetadata,
  metadataVersionBadge,
  legacyInvoiceMetadataSchema,
  METADATA_VERSION,
  type InvoiceMetadataV1,
} from "../invoiceMetadata";

const ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

const V1_METADATA: InvoiceMetadataV1 = {
  metadata_version: "1.0",
  name: "Invoice INV-2024-0001",
  description: "Tokenized invoice for services",
  image: "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
  invoice_number: "INV-2024-0001",
  amount: 250000,
  currency: "USDC",
  due_date: "2025-03-01",
  issuer: { address: ISSUER, name: "TechBridge Ltd" },
  debtor: { name: "Safaricom PLC", privacy: "full" },
};

/** A pre-versioned (legacy) metadata object using camelCase keys. */
const LEGACY_METADATA = {
  name: "Invoice Asset",
  description: "Legacy tokenized invoice",
  image: "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
  invoiceNumber: "INV-2023-0099",
  issuerName: "Old Corp",
  issuerAddress: ISSUER,
  debtorName: "Legacy Debtor Co",
  debtorAddress: "123 Old Street, Nairobi",
  amount: 12000,
  currency: "usdc", // lower-case to exercise normalization
  issueDate: "2023-01-01T00:00:00.000Z",
  dueDate: "2023-06-01T00:00:00.000Z", // full ISO to exercise date-only coercion
  jurisdiction: "KE",
  category: "technology",
  documentHash: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
};

describe("detectMetadataVersion", () => {
  it("detects v1 metadata", () => {
    expect(detectMetadataVersion(V1_METADATA)).toBe("1.0");
  });

  it("detects legacy metadata (no version field, camelCase fields)", () => {
    expect(detectMetadataVersion(LEGACY_METADATA)).toBe("legacy");
  });

  it("returns unknown for an unrecognized shape", () => {
    expect(detectMetadataVersion({ foo: "bar" })).toBe("unknown");
    expect(detectMetadataVersion(null)).toBe("unknown");
    expect(detectMetadataVersion("string")).toBe("unknown");
  });

  it("returns unknown for an unsupported future version", () => {
    expect(detectMetadataVersion({ metadata_version: "2.0" })).toBe("unknown");
  });
});

describe("migrateLegacyToV1", () => {
  it("maps camelCase legacy fields to the V1 input shape", () => {
    const parsed = legacyInvoiceMetadataSchema.parse(LEGACY_METADATA);
    const migrated = migrateLegacyToV1(parsed);

    expect(migrated.invoice_number).toBe("INV-2023-0099");
    expect(migrated.amount).toBe(12000);
    expect(migrated.currency).toBe("USDC"); // normalized to upper-case
    expect(migrated.due_date).toBe("2023-06-01"); // coerced to YYYY-MM-DD
    expect(migrated.issuer.address).toBe(ISSUER);
    expect(migrated.debtor.name).toBe("Legacy Debtor Co");
    expect(migrated.ipfs_document_cid).toBe(LEGACY_METADATA.documentHash);
  });
});

describe("parseAnyInvoiceMetadata", () => {
  it("renders v1 metadata directly", () => {
    const { version, data } = parseAnyInvoiceMetadata(V1_METADATA);
    expect(version).toBe("1.0");
    expect(data.metadata_version).toBe(METADATA_VERSION);
    expect(data.invoice_number).toBe("INV-2024-0001");
  });

  it("migrates and renders legacy metadata as valid v1", () => {
    const { version, data } = parseAnyInvoiceMetadata(LEGACY_METADATA);
    expect(version).toBe("legacy");
    expect(data.metadata_version).toBe(METADATA_VERSION);
    expect(data.invoice_number).toBe("INV-2023-0099");
    expect(data.currency).toBe("USDC");
    // Migration auto-builds NFT attributes.
    expect(Array.isArray(data.attributes)).toBe(true);
  });

  it("throws a clear error for unknown metadata", () => {
    expect(() => parseAnyInvoiceMetadata({ foo: "bar" })).toThrow(
      /Unrecognized invoice metadata schema/
    );
  });

  it("throws a clear error when legacy data is invalid after migration", () => {
    const broken = { ...LEGACY_METADATA, issuerAddress: "not-a-stellar-key" };
    expect(() => parseAnyInvoiceMetadata(broken)).toThrow();
  });
});

describe("metadataVersionBadge", () => {
  it("labels v1 as a success badge", () => {
    const badge = metadataVersionBadge("1.0");
    expect(badge.label).toBe(`Schema v${METADATA_VERSION}`);
    expect(badge.tone).toBe("success");
  });

  it("labels legacy as a warning badge", () => {
    const badge = metadataVersionBadge("legacy");
    expect(badge.label).toBe("Legacy schema");
    expect(badge.tone).toBe("warning");
  });

  it("labels unknown as an info badge", () => {
    expect(metadataVersionBadge("unknown").tone).toBe("info");
  });
});
