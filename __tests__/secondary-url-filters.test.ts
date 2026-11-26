/**
 * Unit tests for secondary market URL filter persistence (#643).
 */

import { describe, it, expect } from "vitest";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import arMessages from "@/messages/ar.json";
import ptBrMessages from "@/messages/pt-BR.json";
import {
  CATEGORIES,
  JURISDICTIONS,
  TENOR_OPTIONS,
  YIELD_OPTIONS,
} from "@/components/marketplace/filters";
import {
  parseTenorParam,
  parseYieldParam,
  parseTextParam,
  parseSecondaryFiltersFromSearchParams,
  secondaryFiltersToQueryString,
  DEFAULT_SECONDARY_FILTERS,
  type SecondaryUrlFilters,
} from "@/lib/secondaryUrlFilters";
import { SECONDARY_SORT_OPTIONS } from "@/lib/secondarySort";

describe("secondaryUrlFilters (#643)", () => {
    it("defines every secondary filter label in all supported locales", () => {
      const locales = [enMessages, esMessages, arMessages, ptBrMessages] as const;

      for (const messages of locales) {
        const filters = messages.secondary.filters;
        for (const option of TENOR_OPTIONS) {
          expect(filters.tenor).toHaveProperty(option.labelKey);
        }
        for (const option of YIELD_OPTIONS) {
          expect(filters.yield).toHaveProperty(option.labelKey);
        }
        for (const jurisdiction of JURISDICTIONS) {
          expect(messages.marketplace.jurisdictionLabels).toHaveProperty(
            jurisdiction.labelKey,
          );
        }
        for (const category of CATEGORIES) {
          expect(messages.marketplace.categoryLabels).toHaveProperty(
            category.labelKey,
          );
        }
      }
    });

  it("falls back safely for invalid tenor and yield params", () => {
    expect(parseTenorParam("bogus")).toBe("all");
    expect(parseTenorParam("nope-90")).toBe("all");
    expect(parseYieldParam("999")).toBe("0");
    expect(parseYieldParam("abc")).toBe("0");
  });

  it("preserves valid tenor and yield params", () => {
    expect(parseTenorParam("0-30")).toBe("0-30");
    expect(parseTenorParam("90+")).toBe("90+");
    expect(parseYieldParam("10")).toBe("10");
    expect(parseYieldParam("15")).toBe("15");
  });

  it("sanitizes free-text params and strips control characters", () => {
    expect(parseTextParam("hello\u0000world")).toBe("helloworld");
    expect(parseTextParam(null)).toBe("");
  });

  it("hydrates filters from a shared URL search string", () => {
    const params = new URLSearchParams(
      "q=tech&tenor=31-60&yield=10&seller=GSELLER111&highlight=pos_101"
    );
    expect(parseSecondaryFiltersFromSearchParams(params)).toEqual({
      q: "tech",
      tenor: "31-60",
      yield: "10",
      seller: "GSELLER111",
      highlight: "pos_101",
      sort: "listed_desc",
    });
  });

  it("normalizes invalid params when hydrating from URL", () => {
    const params = new URLSearchParams("tenor=nope&yield=999&q=ok");
    expect(parseSecondaryFiltersFromSearchParams(params)).toEqual({
      ...DEFAULT_SECONDARY_FILTERS,
      q: "ok",
    });
  });

  it("omits defaults from the query string so reset clears URL params", () => {
    expect(secondaryFiltersToQueryString(DEFAULT_SECONDARY_FILTERS)).toBe("");
    expect(
      secondaryFiltersToQueryString({
        q: "agri",
        tenor: "0-30",
        yield: "5",
        seller: "GABC",
        highlight: "",
      })
    ).toBe("q=agri&tenor=0-30&yield=5&seller=GABC");
  });

  it("drops invalid select values when serializing to the URL", () => {
    expect(
      secondaryFiltersToQueryString({
        q: "",
        tenor: "invalid",
        yield: "bad",
        seller: "",
        highlight: "",
      })
    ).toBe("");
  });

  // ── Sort param round-trips (#1136) ───────────────────────────────────────

  const roundTrip = (filters: SecondaryUrlFilters) =>
    parseSecondaryFiltersFromSearchParams(
      new URLSearchParams(secondaryFiltersToQueryString(filters))
    );

  it.each(SECONDARY_SORT_OPTIONS.map((o) => o.value))(
    "round-trips sort=%s through the query string",
    (sort) => {
      const filters = { ...DEFAULT_SECONDARY_FILTERS, sort };
      expect(roundTrip(filters)).toEqual(filters);
    }
  );

  it("omits the default sort from the query string", () => {
    expect(
      secondaryFiltersToQueryString({ ...DEFAULT_SECONDARY_FILTERS, sort: "listed_desc" })
    ).toBe("");
  });

  it("treats a missing sort field as the default", () => {
    const { sort: _omit, ...withoutSort } = DEFAULT_SECONDARY_FILTERS;
    expect(secondaryFiltersToQueryString(withoutSort)).toBe("");
  });

  it("serializes a non-default sort alongside other filters", () => {
    expect(
      secondaryFiltersToQueryString({
        ...DEFAULT_SECONDARY_FILTERS,
        q: "agri",
        tenor: "0-30",
        sort: "ask_price_asc",
      })
    ).toBe("q=agri&tenor=0-30&sort=ask_price_asc");
  });

  it.each(["price", "ASK_PRICE_ASC", "listed_desc; drop", ""])(
    "falls back to the default sort for invalid sort=%j",
    (raw) => {
      const parsed = parseSecondaryFiltersFromSearchParams(new URLSearchParams({ sort: raw }));
      expect(parsed.sort).toBe("listed_desc");
      expect(secondaryFiltersToQueryString({ ...DEFAULT_SECONDARY_FILTERS, sort: raw })).toBe("");
    }
  );

  it("strips control characters before whitelisting sort", () => {
    const parsed = parseSecondaryFiltersFromSearchParams(
      new URLSearchParams({ sort: "discount_desc\u0007" })
    );
    expect(parsed.sort).toBe("discount_desc");
  });

  it("round-trips every filter at once, including sort", () => {
    const filters: SecondaryUrlFilters = {
      q: "medical supplies",
      tenor: "61-90",
      yield: "10",
      seller: "GSELLER111",
      highlight: "pos-7",
      sort: "tenor_desc",
    };
    expect(roundTrip(filters)).toEqual(filters);
  });
});
