/**
 * URL <-> analytics cohort filter conversion.
 *
 * The analytics page treats the URL as the single source of truth so a filtered
 * view can be shared or reloaded. Unknown/invalid values must fall back to
 * defaults instead of reaching the charts as unsupported cohorts.
 */

export type RiskTierFilter = "all" | "AAA" | "AA" | "A" | "BBB" | "BB" | "B";
export type JurisdictionFilter = "all" | "NG" | "KE" | "GH" | "ZA" | "IN" | "BR";
export type CategoryFilter = "all" | "trade" | "services" | "manufacturing" | "retail";
export type PresetRange = "7d" | "30d" | "90d" | "1y" | "ytd" | "all";

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface AnalyticsFilters {
  riskTier: RiskTierFilter;
  jurisdiction: JurisdictionFilter;
  category: CategoryFilter;
  dateRange: PresetRange | "custom";
  customDateRange?: DateRange;
}

export const DEFAULT_FILTERS: AnalyticsFilters = {
  riskTier: "all",
  jurisdiction: "all",
  category: "all",
  dateRange: "30d",
};

export const RISK_TIER_VALUES = [
  "all", "AAA", "AA", "A", "BBB", "BB", "B",
] as const satisfies readonly RiskTierFilter[];

export const JURISDICTION_VALUES = [
  "all", "NG", "KE", "GH", "ZA", "IN", "BR",
] as const satisfies readonly JurisdictionFilter[];

export const CATEGORY_VALUES = [
  "all", "trade", "services", "manufacturing", "retail",
] as const satisfies readonly CategoryFilter[];

export const PRESET_RANGE_VALUES = [
  "7d", "30d", "90d", "1y", "ytd", "all",
] as const satisfies readonly PresetRange[];

const FILTER_PARAM_KEYS = ["risk", "jurisdiction", "category", "range", "from", "to"] as const;

function oneOf<T extends string>(values: readonly T[], value: string | null, fallback: T): T {
  return value !== null && (values as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** Strict YYYY-MM-DD parse; rejects dates that JavaScript would silently roll over. */
function parseDateOnly(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function filtersFromParams(params: URLSearchParams): AnalyticsFilters {
  const dateRange = oneOf(
    [...PRESET_RANGE_VALUES, "custom"] as const,
    params.get("range"),
    DEFAULT_FILTERS.dateRange,
  );

  const result: AnalyticsFilters = {
    riskTier: oneOf(RISK_TIER_VALUES, params.get("risk"), DEFAULT_FILTERS.riskTier),
    jurisdiction: oneOf(JURISDICTION_VALUES, params.get("jurisdiction"), DEFAULT_FILTERS.jurisdiction),
    category: oneOf(CATEGORY_VALUES, params.get("category"), DEFAULT_FILTERS.category),
    dateRange,
  };

  if (dateRange === "custom") {
    const from = parseDateOnly(params.get("from"));
    const to = parseDateOnly(params.get("to"));
    if (from && to && from <= to) {
      result.customDateRange = { from, to };
    } else {
      // A custom range without both valid, ordered dates would show unbounded
      // data while claiming to be filtered — fall back to the safe default.
      result.dateRange = DEFAULT_FILTERS.dateRange;
    }
  }

  return result;
}

/**
 * Serialize filters, optionally preserving unrelated query params (e.g. UTMs)
 * already present on the page. Defaults are omitted so the canonical shared
 * URL stays short.
 */
export function filtersToParams(
  filters: AnalyticsFilters,
  base?: URLSearchParams,
): URLSearchParams {
  const params = new URLSearchParams(base);
  FILTER_PARAM_KEYS.forEach((key) => params.delete(key));

  if (filters.riskTier !== DEFAULT_FILTERS.riskTier) params.set("risk", filters.riskTier);
  if (filters.jurisdiction !== DEFAULT_FILTERS.jurisdiction) params.set("jurisdiction", filters.jurisdiction);
  if (filters.category !== DEFAULT_FILTERS.category) params.set("category", filters.category);

  let dateRange: AnalyticsFilters["dateRange"] = filters.dateRange;
  if (dateRange === "custom") {
    const from = filters.customDateRange?.from;
    const to = filters.customDateRange?.to;
    if (from && to && from <= to) {
      params.set("from", toDateOnly(from));
      params.set("to", toDateOnly(to));
    } else {
      dateRange = DEFAULT_FILTERS.dateRange;
    }
  }
  if (dateRange !== DEFAULT_FILTERS.dateRange) params.set("range", dateRange);

  return params;
}
