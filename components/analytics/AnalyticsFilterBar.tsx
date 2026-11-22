"use client";

import * as React from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { DateRangePicker, type PresetRange, type DateRange } from "./DateRangePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskTierFilter = "all" | "AAA" | "AA" | "A" | "BBB" | "BB" | "B";
export type JurisdictionFilter = "all" | "NG" | "KE" | "GH" | "ZA" | "IN" | "BR";
export type CategoryFilter = "all" | "trade" | "services" | "manufacturing" | "retail";

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

interface AnalyticsFilterBarProps {
  filters: AnalyticsFilters;
  onChange: (filters: AnalyticsFilters) => void;
  className?: string;
}

const RISK_TIERS: { labelKey: string; value: RiskTierFilter }[] = [
  { labelKey: "filters.all", value: "all" },
  { labelKey: "filters.riskTiers.AAA", value: "AAA" },
  { labelKey: "filters.riskTiers.AA", value: "AA" },
  { labelKey: "filters.riskTiers.A", value: "A" },
  { labelKey: "filters.riskTiers.BBB", value: "BBB" },
  { labelKey: "filters.riskTiers.BB", value: "BB" },
  { labelKey: "filters.riskTiers.B", value: "B" },
];

const JURISDICTIONS: { labelKey: string; value: JurisdictionFilter }[] = [
  { labelKey: "filters.allRegions", value: "all" },
  { labelKey: "filters.jurisdictions.NG", value: "NG" },
  { labelKey: "filters.jurisdictions.KE", value: "KE" },
  { labelKey: "filters.jurisdictions.GH", value: "GH" },
  { labelKey: "filters.jurisdictions.ZA", value: "ZA" },
  { labelKey: "filters.jurisdictions.IN", value: "IN" },
  { labelKey: "filters.jurisdictions.BR", value: "BR" },
];

const CATEGORIES: { labelKey: string; value: CategoryFilter }[] = [
  { labelKey: "filters.allCategories", value: "all" },
  { labelKey: "filters.categories.trade", value: "trade" },
  { labelKey: "filters.categories.services", value: "services" },
  { labelKey: "filters.categories.manufacturing", value: "manufacturing" },
  { labelKey: "filters.categories.retail", value: "retail" },
];

// ─── Active filter summary ────────────────────────────────────────────────────

type AnalyticsTranslator = (key: string, values?: Record<string, string | number>) => string;

function buildSummary(filters: AnalyticsFilters, t: AnalyticsTranslator): string {
  const parts: string[] = [];

  if (filters.riskTier !== "all") parts.push(t("filterSummary.riskTier", { tier: filters.riskTier }));
  if (filters.jurisdiction !== "all") {
    const j = JURISDICTIONS.find((j) => j.value === filters.jurisdiction);
    if (j) parts.push(t(j.labelKey));
  }
  if (filters.category !== "all") {
    const c = CATEGORIES.find((c) => c.value === filters.category);
    if (c) parts.push(t(c.labelKey));
  }

  const period = filters.dateRange === "custom"
    ? t("filterSummary.customRange")
    : filters.dateRange === "ytd"
      ? t("filterSummary.ytd")
      : filters.dateRange === "all"
        ? t("filterSummary.allTime")
        : t("filterSummary.lastDays", { days: Number.parseInt(filters.dateRange, 10) });

  const activeFilters = parts.length > 0 ? parts.join(t("filterSummary.separator")) : t("filterSummary.allData");
  return t("filterSummary.summary", { filters: activeFilters, period });
}

function hasActiveFilters(filters: AnalyticsFilters): boolean {
  return (
    filters.riskTier !== "all" ||
    filters.jurisdiction !== "all" ||
    filters.category !== "all" ||
    filters.dateRange !== "30d"
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AnalyticsFilterBar — filter bar for the analytics page.
 * Renders risk tier chips, jurisdiction dropdown, category dropdown,
 * and a date range picker. Calls onChange on every filter change.
 */
export function AnalyticsFilterBar({ filters, onChange, className }: AnalyticsFilterBarProps) {
  const t = useTranslations("analytics");
  const translate = t as unknown as AnalyticsTranslator;
  const update = (patch: Partial<AnalyticsFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className={cn("space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4", className)}>
      {/* Row 1: Risk tiers + dropdowns */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Risk tier chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-zinc-500 mr-1">{t("filters.riskLabel")}</span>
          {RISK_TIERS.map((tier) => (
            <button
              key={tier.value}
              type="button"
              onClick={() => update({ riskTier: tier.value })}
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                filters.riskTier === tier.value
                  ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
              )}
            >
              {translate(tier.labelKey)}
            </button>
          ))}
        </div>

        {/* Jurisdiction dropdown */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-500">{t("filters.regionLabel")}</span>
          <select
            value={filters.jurisdiction}
            onChange={(e) => update({ jurisdiction: e.target.value as JurisdictionFilter })}
            className="max-w-[60vw] truncate rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label={t("a11y.filterJurisdiction")}
          >
            {JURISDICTIONS.map((j) => (
              <option key={j.value} value={j.value}>
                {translate(j.labelKey)}
              </option>
            ))}
          </select>
        </div>

        {/* Category dropdown */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-500">{t("filters.categoryLabel")}</span>
          <select
            value={filters.category}
            onChange={(e) => update({ category: e.target.value as CategoryFilter })}
            className="max-w-[60vw] truncate rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label={t("a11y.filterCategory")}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {translate(c.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Date range picker */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">{t("filters.periodLabel")}</span>
        <DateRangePicker
          value={filters.dateRange}
          customRange={filters.customDateRange}
          onChange={(preset, range) =>
            update({ dateRange: preset, customDateRange: range })
          }
        />
      </div>

      {/* Active filter summary + clear */}
      {hasActiveFilters(filters) && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-zinc-800/60 px-3 py-1.5">
          <p className="text-xs text-zinc-400" aria-live="polite">{buildSummary(filters, translate)}</p>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200 transition-colors"
            aria-label={t("a11y.clearFilters")}
          >
            <X className="h-3 w-3" />
            {t("filters.clear")}
          </button>
        </div>
      )}
    </div>
  );
}
