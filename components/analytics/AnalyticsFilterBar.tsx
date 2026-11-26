"use client";

import * as React from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useRovingTabIndex } from "@/hooks/useRovingTabIndex";
import {
  DEFAULT_FILTERS,
  type AnalyticsFilters,
  type RiskTierFilter,
  type JurisdictionFilter,
  type CategoryFilter,
} from "@/lib/analyticsFilters";
import { DateRangePicker } from "./DateRangePicker";

// Re-exported for existing component consumers; the canonical definitions now
// live next to the URL serialization helpers.
export { DEFAULT_FILTERS };
export type { AnalyticsFilters, RiskTierFilter, JurisdictionFilter, CategoryFilter };

// ─── Types ────────────────────────────────────────────────────────────────────

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

  const chipRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const { getTabIndex, onKeyDown: onRovingKeyDown, focusIndex } = useRovingTabIndex({
    count: RISK_TIERS.length,
    orientation: "horizontal",
  });

  const selectedChipIndex = RISK_TIERS.findIndex((tier) => tier.value === filters.riskTier);

  const selectChip = React.useCallback(
    (index: number) => {
      const tier = RISK_TIERS[index];
      if (!tier) return;
      update({ riskTier: tier.value });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters]
  );

  const clearChip = React.useCallback(
    (index: number) => {
      const tier = RISK_TIERS[index];
      if (!tier || tier.value === "all") return;
      // Reset to "all" and move focus to the "all" chip (index 0).
      update({ riskTier: "all" });
      focusIndex(0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters, focusIndex]
  );

  const handleChipKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case "Enter":
      case " ":
      case "Spacebar":
        event.preventDefault();
        selectChip(index);
        return;
      case "Delete":
      case "Backspace":
        event.preventDefault();
        clearChip(index);
        return;
      default:
        onRovingKeyDown(event);
    }
  };

  return (
    <div className={cn("space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4", className)}>
      {/* Row 1: Risk tiers + dropdowns */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Risk tier chips */}
        <div
          role="toolbar"
          aria-label={t("a11y.riskTierGroup")}
          aria-orientation="horizontal"
          className="flex flex-wrap items-center gap-1.5"
        >
          <span className="text-xs text-zinc-500 mr-1" aria-hidden="true">
            {t("filters.riskLabel")}
          </span>
          {RISK_TIERS.map((tier, index) => {
            const isSelected = filters.riskTier === tier.value;
            return (
              <button
                key={tier.value}
                ref={(el) => {
                  chipRefs.current[index] = el;
                }}
                type="button"
                role="button"
                aria-pressed={isSelected}
                aria-label={t("a11y.riskTierChip", { tier: translate(tier.labelKey) })}
                tabIndex={getTabIndex(index)}
                onClick={() => selectChip(index)}
                onKeyDown={(event) => handleChipKeyDown(event, index)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-900",
                  isSelected
                    ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                )}
              >
                {translate(tier.labelKey)}
              </button>
            );
          })}
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
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("filters.periodLabel")}>
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
            onClick={() => {
              onChange(DEFAULT_FILTERS);
              focusIndex(0);
            }}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-900"
            aria-label={t("a11y.clearFilters")}
          >
            <X className="h-3 w-3" aria-hidden="true" />
            {t("filters.clear")}
          </button>
        </div>
      )}
    </div>
  );
}
