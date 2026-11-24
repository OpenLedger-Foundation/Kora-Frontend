"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useRovingTabIndex } from "@/hooks/useRovingTabIndex";
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

// ─── Chip model ───────────────────────────────────────────────────────────────

type ChipKey = "riskTier" | "jurisdiction" | "category";

interface ChipDescriptor {
  key: ChipKey;
  label: string;
}

/**
 * Builds the list of currently-active filter chips. Each chip is removable
 * via keyboard (Delete/Backspace) and participates in roving tabindex nav.
 */
function buildActiveChips(filters: AnalyticsFilters, t: AnalyticsTranslator): ChipDescriptor[] {
  const chips: ChipDescriptor[] = [];

  if (filters.riskTier !== "all") {
    const tier = RISK_TIERS.find((r) => r.value === filters.riskTier);
    if (tier) chips.push({ key: "riskTier", label: t(tier.labelKey) });
  }
  if (filters.jurisdiction !== "all") {
    const j = JURISDICTIONS.find((j) => j.value === filters.jurisdiction);
    if (j) chips.push({ key: "jurisdiction", label: t(j.labelKey) });
  }
  if (filters.category !== "all") {
    const c = CATEGORIES.find((c) => c.value === filters.category);
    if (c) chips.push({ key: "category", label: t(c.labelKey) });
  }

  return chips;
}

/** Options offered by the "add filter" menu, grouped by filter key. */
const ADD_FILTER_OPTIONS: { key: ChipKey; labelKey: string; value: string }[] = [
  ...RISK_TIERS.filter((r) => r.value !== "all").map((r) => ({
    key: "riskTier" as const,
    labelKey: r.labelKey,
    value: r.value,
  })),
  ...JURISDICTIONS.filter((j) => j.value !== "all").map((j) => ({
    key: "jurisdiction" as const,
    labelKey: j.labelKey,
    value: j.value,
  })),
  ...CATEGORIES.filter((c) => c.value !== "all").map((c) => ({
    key: "category" as const,
    labelKey: c.labelKey,
    value: c.value,
  })),
];

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

  const activeChips = React.useMemo(() => buildActiveChips(filters, translate), [filters, translate]);

  // Roving tabindex across the active chips so arrow keys / Home / End move focus.
  const { getTabIndex, onKeyDown: onChipKeyDown, containerRef: chipsRef } = useRovingTabIndex(
    activeChips.length
  );

  // ── Add-filter menu state ──────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuIndex, setMenuIndex] = React.useState(0);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const addButtonRef = React.useRef<HTMLButtonElement>(null);
  const optionRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const closeMenu = React.useCallback((returnFocus = true) => {
    setMenuOpen(false);
    if (returnFocus) addButtonRef.current?.focus();
  }, []);

  const openMenu = React.useCallback(() => {
    setMenuOpen(true);
    setMenuIndex(0);
  }, []);

  // Move focus to the active option whenever the menu opens or index changes.
  React.useEffect(() => {
    if (menuOpen) optionRefs.current[menuIndex]?.focus();
  }, [menuOpen, menuIndex]);

  // Close the menu on outside click.
  React.useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !addButtonRef.current?.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  const selectOption = React.useCallback(
    (option: { key: ChipKey; value: string }) => {
      update({ [option.key]: option.value } as Partial<AnalyticsFilters>);
      closeMenu();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters, onChange]
  );

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setMenuIndex((i) => (i + 1) % ADD_FILTER_OPTIONS.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setMenuIndex((i) => (i - 1 + ADD_FILTER_OPTIONS.length) % ADD_FILTER_OPTIONS.length);
        break;
      case "Home":
        event.preventDefault();
        setMenuIndex(0);
        break;
      case "End":
        event.preventDefault();
        setMenuIndex(ADD_FILTER_OPTIONS.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        closeMenu();
        break;
      case "Tab":
        closeMenu(false);
        break;
      default:
        break;
    }
  };

  const removeChip = (key: ChipKey) => {
    if (key === "riskTier") update({ riskTier: "all" });
    else if (key === "jurisdiction") update({ jurisdiction: "all" });
    else update({ category: "all" });
  };

  const handleChipKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, chip: ChipDescriptor) => {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeChip(chip.key);
      return;
    }
    onChipKeyDown(event);
  };

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
              aria-pressed={filters.riskTier === tier.value}
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
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

      {/* Active filter chips + add-filter control */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500">{t("filters.activeLabel")}</span>
        <div
          ref={chipsRef}
          role="toolbar"
          aria-label={t("a11y.activeFilters")}
          aria-describedby="analytics-chips-help"
          className="flex flex-wrap items-center gap-1.5"
        >
          {activeChips.length === 0 ? (
            <span className="text-xs text-zinc-600">{t("filters.noActiveFilters")}</span>
          ) : (
            activeChips.map((chip, index) => (
              <button
                key={chip.key}
                type="button"
                tabIndex={getTabIndex(index)}
                onKeyDown={(event) => handleChipKeyDown(event, chip)}
                onClick={() => removeChip(chip.key)}
                aria-label={t("a11y.removeFilter", { filter: chip.label })}
                className="flex items-center gap-1 rounded-md bg-teal-500/20 px-2 py-0.5 text-xs font-medium text-teal-400 border border-teal-500/30 transition-colors hover:bg-teal-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {chip.label}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ))
          )}
        </div>
        <span id="analytics-chips-help" className="sr-only">
          {t("a11y.chipsHelp")}
        </span>

        {/* Add filter control */}
        <div className="relative">
          <button
            ref={addButtonRef}
            type="button"
            onClick={() => (menuOpen ? closeMenu() : openMenu())}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openMenu();
              }
            }}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            aria-label={t("a11y.addFilter")}
            className="flex items-center gap-1 rounded-md border border-dashed border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            {t("filters.addFilter")}
          </button>

          {menuOpen && (
            <div
              ref={menuRef}
              role="listbox"
              aria-label={t("a11y.addFilter")}
              onKeyDown={handleMenuKeyDown}
              className="absolute left-0 z-20 mt-1 max-h-64 w-48 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-lg"
            >
              {ADD_FILTER_OPTIONS.map((option, index) => (
                <button
                  key={`${option.key}-${option.value}`}
                  ref={(el) => {
                    optionRefs.current[index] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={menuIndex === index}
                  tabIndex={menuIndex === index ? 0 : -1}
                  onClick={() => selectOption(option)}
                  className={cn(
                    "block w-full px-3 py-1 text-left text-xs transition-colors focus-visible:outline-none",
                    menuIndex === index
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  )}
                >
                  {translate(option.labelKey)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active filter summary + clear */}
      {hasActiveFilters(filters) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-zinc-800/60 px-3 py-1.5">
          <p className="text-xs text-zinc-400" aria-live="polite">{buildSummary(filters, translate)}</p>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
