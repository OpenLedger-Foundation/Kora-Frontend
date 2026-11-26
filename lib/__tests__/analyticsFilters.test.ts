/**
 * Unit tests for `lib/analyticsFilters` — Issue #1178.
 *
 * Analytics cohort filters are serialized into the URL so filtered views can
 * be reloaded and shared. These tests lock down the allowlists, custom date
 * validation, default omission, and preservation of unrelated query params.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_FILTERS,
  filtersFromParams,
  filtersToParams,
  type AnalyticsFilters,
} from "@/lib/analyticsFilters";

describe("filtersFromParams", () => {
  it("falls back to defaults for an empty query string", () => {
    expect(filtersFromParams(new URLSearchParams())).toEqual(DEFAULT_FILTERS);
  });

  it("hydrates every supported cohort filter", () => {
    const params = new URLSearchParams(
      "risk=AA&jurisdiction=KE&category=services&range=90d"
    );
    expect(filtersFromParams(params)).toEqual({
      riskTier: "AA",
      jurisdiction: "KE",
      category: "services",
      dateRange: "90d",
    });
  });

  it.each([
    "risk",
    "jurisdiction",
    "category",
    "range",
  ])("rejects an unsupported %s value", (key) => {
    const params = new URLSearchParams(`${key}=not-a-real-value`);
    expect(filtersFromParams(params)).toEqual(DEFAULT_FILTERS);
  });

  it("hydrates a valid ordered custom range", () => {
    const params = new URLSearchParams(
      "range=custom&from=2026-01-01&to=2026-01-31"
    );
    const filters = filtersFromParams(params);
    expect(filters.dateRange).toBe("custom");
    expect(filters.customDateRange?.from?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(filters.customDateRange?.to?.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it.each([
    ["missing dates", "range=custom"],
    ["only from", "range=custom&from=2026-01-01"],
    ["reversed dates", "range=custom&from=2026-02-01&to=2026-01-01"],
    ["invalid calendar date", "range=custom&from=2026-02-30&to=2026-03-01"],
    ["non-ISO date", "range=custom&from=01%2F01%2F2026&to=2026-03-01"],
  ])("falls back from an invalid custom range: %s", (_label, query) => {
    expect(filtersFromParams(new URLSearchParams(query)).dateRange).toBe(
      DEFAULT_FILTERS.dateRange
    );
  });
});

describe("filtersToParams", () => {
  it("omits default values to keep shared URLs short", () => {
    expect(filtersToParams(DEFAULT_FILTERS).toString()).toBe("");
  });

  it("serializes non-default filters in a stable shape", () => {
    const filters: AnalyticsFilters = {
      riskTier: "BBB",
      jurisdiction: "ZA",
      category: "retail",
      dateRange: "ytd",
    };
    expect(filtersToParams(filters).toString()).toBe(
      "risk=BBB&jurisdiction=ZA&category=retail&range=ytd"
    );
  });

  it("serializes custom date bounds as YYYY-MM-DD", () => {
    const filters: AnalyticsFilters = {
      ...DEFAULT_FILTERS,
      dateRange: "custom",
      customDateRange: {
        from: new Date("2026-01-01T15:30:00.000Z"),
        to: new Date("2026-01-31T08:45:00.000Z"),
      },
    };
    expect(filtersToParams(filters).toString()).toBe(
      "from=2026-01-01&to=2026-01-31&range=custom"
    );
  });

  it("preserves unrelated query params and replaces stale filter params", () => {
    const base = new URLSearchParams("utm_source=email&risk=AAA&range=7d");
    const params = filtersToParams(
      { ...DEFAULT_FILTERS, riskTier: "B", dateRange: "1y" },
      base
    );
    expect(params.get("utm_source")).toBe("email");
    expect(params.get("risk")).toBe("B");
    expect(params.get("range")).toBe("1y");
    expect(base.get("risk")).toBe("AAA");
  });

  it("round-trips a fully specified filter set", () => {
    const filters: AnalyticsFilters = {
      riskTier: "A",
      jurisdiction: "IN",
      category: "manufacturing",
      dateRange: "custom",
      customDateRange: {
        from: new Date("2026-03-01T00:00:00.000Z"),
        to: new Date("2026-03-31T00:00:00.000Z"),
      },
    };
    expect(filtersFromParams(filtersToParams(filters))).toEqual(filters);
  });
});
