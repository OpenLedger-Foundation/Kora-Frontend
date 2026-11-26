import { describe, it, expect } from "vitest";

import {
  buildMarketplaceFilterFingerprint,
  decodeMarketplaceFilterFingerprint,
  FILTER_FINGERPRINT_VERSION,
  SUPPORTED_FINGERPRINT_VERSIONS,
} from "@/lib/marketplaceFilterFingerprint";
import { DEFAULT_FILTERS } from "@/store/invoiceStore";
import type { FilterState } from "@/store/invoiceStore";

const base: FilterState = {
  categories: [],
  jurisdictions: [],
  riskTiers: [],
  aprRange: [0, 50],
  activeOnly: false,
  showExpired: false,
};

describe("buildMarketplaceFilterFingerprint", () => {
  it("is stable for equal filter state", () => {
    expect(buildMarketplaceFilterFingerprint(base)).toBe(
      buildMarketplaceFilterFingerprint({ ...base })
    );
  });

  it("is order-insensitive for multi-select arrays", () => {
    const a = buildMarketplaceFilterFingerprint({
      ...base,
      categories: ["technology", "healthcare"],
    });
    const b = buildMarketplaceFilterFingerprint({
      ...base,
      categories: ["healthcare", "technology"],
    });
    expect(a).toBe(b);
  });

  it("changes when a category is added", () => {
    expect(
      buildMarketplaceFilterFingerprint({ ...base, categories: ["technology"] })
    ).not.toBe(buildMarketplaceFilterFingerprint(base));
  });

  it("changes when the APR range changes", () => {
    expect(
      buildMarketplaceFilterFingerprint({ ...base, aprRange: [10, 40] })
    ).not.toBe(buildMarketplaceFilterFingerprint(base));
  });

  it("changes when boolean filters flip", () => {
    expect(
      buildMarketplaceFilterFingerprint({ ...base, activeOnly: true })
    ).not.toBe(buildMarketplaceFilterFingerprint(base));
    expect(
      buildMarketplaceFilterFingerprint({ ...base, showExpired: true })
    ).not.toBe(buildMarketplaceFilterFingerprint(base));
  });

  it("includes the search query", () => {
    expect(
      buildMarketplaceFilterFingerprint(base, "safaricom")
    ).not.toBe(buildMarketplaceFilterFingerprint(base, ""));
  });

  it("ignores surrounding whitespace in the search query", () => {
    expect(buildMarketplaceFilterFingerprint(base, "  safaricom ")).toBe(
      buildMarketplaceFilterFingerprint(base, "safaricom")
    );
  });
});

// ─── Versioning (Issue: shareable, release-stable fingerprints) ───────────────

describe("buildMarketplaceFilterFingerprint — versioning", () => {
  it("stamps the current schema version on every fingerprint", () => {
    const parsed = JSON.parse(buildMarketplaceFilterFingerprint(base));
    expect(parsed.v).toBe(FILTER_FINGERPRINT_VERSION);
  });

  it("emits a deterministic, byte-identical payload for equal state", () => {
    const once = buildMarketplaceFilterFingerprint(
      { ...base, categories: ["technology", "healthcare"] },
      "acme"
    );
    const twice = buildMarketplaceFilterFingerprint(
      { ...base, categories: ["healthcare", "technology"] },
      " acme "
    );
    expect(twice).toBe(once);
  });
});

describe("decodeMarketplaceFilterFingerprint", () => {
  it("round-trips its own output back to the original state", () => {
    // The encoder normalises lists (trimmed + sorted), so the round-trip is
    // asserted against already-normalised input to compare like-with-like.
    const filters: FilterState = {
      categories: ["healthcare", "technology"],
      jurisdictions: ["KE", "NG"],
      riskTiers: ["AAA"],
      aprRange: [5, 30],
      activeOnly: true,
      showExpired: false,
    };
    const decoded = decodeMarketplaceFilterFingerprint(
      buildMarketplaceFilterFingerprint(filters, "safaricom")
    );

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.version).toBe(FILTER_FINGERPRINT_VERSION);
    expect(decoded.filters).toEqual(filters);
    expect(decoded.searchQuery).toBe("safaricom");
    // Re-encoding the decoded state reproduces the same fingerprint.
    expect(buildMarketplaceFilterFingerprint(decoded.filters, decoded.searchQuery)).toBe(
      buildMarketplaceFilterFingerprint(filters, "safaricom")
    );
  });

  it("decodes a legacy (unversioned / v1) link", () => {
    const legacy = JSON.stringify({
      categories: ["technology"],
      jurisdictions: [],
      riskTiers: [],
      minApr: 10,
      maxApr: 40,
      activeOnly: false,
      showExpired: true,
      q: "acme",
    });

    const decoded = decodeMarketplaceFilterFingerprint(legacy);

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.version).toBe(1);
    expect(decoded.filters).toEqual({
      ...base,
      categories: ["technology"],
      aprRange: [10, 40],
      showExpired: true,
    });
    expect(decoded.searchQuery).toBe("acme");
  });

  it("tolerates a legacy link that omits optional fields", () => {
    const decoded = decodeMarketplaceFilterFingerprint(
      JSON.stringify({ categories: ["retail"] })
    );

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.filters).toEqual({ ...DEFAULT_FILTERS, categories: ["retail"] });
    expect(decoded.searchQuery).toBe("");
  });

  it("rejects an unknown/unsupported future version with a fallback state", () => {
    const decoded = decodeMarketplaceFilterFingerprint(
      JSON.stringify({ v: 999, categories: ["technology"] })
    );

    expect(decoded.ok).toBe(false);
    if (decoded.ok) return;
    expect(decoded.version).toBe(999);
    expect(decoded.reason).toBe("unsupported-version");
    expect(decoded.filters).toEqual(DEFAULT_FILTERS);
    expect(decoded.searchQuery).toBe("");
  });

  it("rejects malformed JSON without throwing", () => {
    const decoded = decodeMarketplaceFilterFingerprint("{not-json");
    expect(decoded.ok).toBe(false);
    if (decoded.ok) return;
    expect(decoded.reason).toBe("malformed");
    expect(decoded.filters).toEqual(DEFAULT_FILTERS);
  });

  it("rejects empty / missing input", () => {
    for (const input of [null, undefined, "", "   "]) {
      const decoded = decodeMarketplaceFilterFingerprint(input);
      expect(decoded.ok).toBe(false);
      if (decoded.ok) return;
      expect(decoded.reason).toBe("empty");
    }
  });

  it("fails closed on a structurally invalid payload", () => {
    const cases: unknown[] = [
      [1, 2, 3],
      { v: FILTER_FINGERPRINT_VERSION, categories: "technology" },
      { v: FILTER_FINGERPRINT_VERSION, minApr: "low" },
      { v: FILTER_FINGERPRINT_VERSION, minApr: 30, maxApr: 10 },
      { v: FILTER_FINGERPRINT_VERSION, maxApr: 120 },
      { v: "2" },
    ];

    for (const payload of cases) {
      const decoded = decodeMarketplaceFilterFingerprint(JSON.stringify(payload));
      expect(decoded.ok).toBe(false);
      if (decoded.ok) return;
      expect(decoded.reason).toBe("invalid-shape");
      expect(decoded.filters).toEqual(DEFAULT_FILTERS);
    }
  });

  it("only advertises the versions it can decode", () => {
    expect(SUPPORTED_FINGERPRINT_VERSIONS).toContain(FILTER_FINGERPRINT_VERSION);
  });
});
