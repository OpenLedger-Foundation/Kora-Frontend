"use client";

/**
 * ActiveFilterChips — renders a dismissible chip for each active filter.
 *
 * Constraints:
 *  - × button removes only that specific filter from invoiceStore immediately
 *  - "Clear all" removes all active filters at once
 *  - Must NOT cause full-page re-render — only the grid updates via store subscription
 *  - Chip removals are announced to screen readers via aria-live="polite"
 *
 * Keyboard model (#440):
 *  - The chip remove buttons form a single roving-tabindex group (one Tab stop,
 *    arrow keys / Home / End to move within it) via `useRovingTabIndex`.
 *  - `Delete` and `Backspace` dismiss the focused chip and move focus to the
 *    chip that slides into its slot (or the previous chip); when the last chip
 *    is dismissed focus falls back to `fallbackFocusId` so it is never dropped
 *    onto `<body>`.
 */

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { useInvoiceStore } from "@/store/invoiceStore";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useRovingTabIndex } from "@/hooks/useRovingTabIndex";
import { cn } from "@/lib/utils";

export interface FilterChip {
  /** Stable unique key, e.g. "category:technology" */
  key: string;
  /** Human-readable label, e.g. "Technology" */
  label: string;
  /** Which store filter key this chip belongs to */
  filterKey: keyof import("@/store/invoiceStore").FilterState;
  /** The value to remove from the filter array (undefined for boolean filters) */
  value?: string;
}

interface ActiveFilterChipsProps {
  /** Chips derived from the current filter state — passed in so the parent
   *  controls label formatting, but removal is handled by the store directly. */
  chips?: FilterChip[];
  /** Additional className for the wrapper */
  className?: string;
  /**
   * Element id to focus when the last remaining chip is dismissed (the chip
   * group itself unmounts, so focus would otherwise drop to `<body>`).
   */
  fallbackFocusId?: string;
}

/**
 * Derives chips from the Zustand filter state.
 * Exported so consumers can reuse without duplicating logic.
 */
export function deriveChips(
  filters: import("@/store/invoiceStore").FilterState,
  t?: (key: string, values?: Record<string, string | number>) => string
): FilterChip[] {
  const chips: FilterChip[] = [];

  const translateOr = (key: string, fallback: string, values?: Record<string, string | number>) => {
    const translated = t?.(key, values);
    return translated && translated !== key ? translated : fallback;
  };

  for (const cat of filters.categories) {
    chips.push({
      key: `category:${cat}`,
      label: translateOr(`categoryLabels.${cat}`, cat.charAt(0).toUpperCase() + cat.slice(1)),
      filterKey: "categories",
      value: cat,
    });
  }

  for (const jur of filters.jurisdictions) {
    chips.push({
      key: `jurisdiction:${jur}`,
      label: translateOr(`jurisdictionLabels.${jur}`, jur),
      filterKey: "jurisdictions",
      value: jur,
    });
  }

  for (const tier of filters.riskTiers) {
    chips.push({
      key: `riskTier:${tier}`,
      label: translateOr("activeFilterRiskTier", `Risk: ${tier}`, { tier }),
      filterKey: "riskTiers",
      value: tier,
    });
  }

  if (filters.aprRange[0] > 0 || filters.aprRange[1] < 50) {
    chips.push({
      key: "aprRange",
      label: translateOr(
        "activeFilterAprRange",
        `APR: ${filters.aprRange[0]}%–${filters.aprRange[1]}%`,
        { min: filters.aprRange[0], max: filters.aprRange[1] }
      ),
      filterKey: "aprRange",
    });
  }

  if (filters.activeOnly) {
    chips.push({
      key: "activeOnly",
      label: t ? t("activeOnly") : "Active Only",
      filterKey: "activeOnly",
    });
  }

  if (filters.showExpired) {
    chips.push({
      key: "showExpired",
      label: t ? t("showExpired") : "Show Expired",
      filterKey: "showExpired",
    });
  }

  return chips;
}

/**
 * Motion props for an individual chip. Extracted so the reduced-motion branch
 * is unit-testable without depending on Framer's animation timing in jsdom.
 *
 * When reduced motion is requested the chip still mounts/unmounts — it just
 * does so with zero-duration opacity changes instead of a scaled translate,
 * and the "Clear all" layout animation is dropped by the caller.
 */
export function getChipMotionProps(prefersReducedMotion: boolean) {
  if (prefersReducedMotion) {
    return {
      initial: false as const,
      animate: { opacity: 1, scale: 1, y: 0 },
      exit: { opacity: 1, scale: 1, y: 0 },
      transition: { duration: 0 },
    };
  }

  return {
    initial: { opacity: 0, scale: 0.9, y: -4 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.9, y: -4 },
    transition: { duration: 0.15 },
  };
}

export default function ActiveFilterChips({
  chips: externalChips,
  className,
  fallbackFocusId,
}: ActiveFilterChipsProps) {
  const t = useTranslations("marketplace");
  const { filters, updateSingleFilter, resetFilters } = useInvoiceStore();
  const announcerId = useId();
  const hintId = useId();
  const prefersReducedMotion = usePrefersReducedMotion();
  const chipMotion = getChipMotionProps(prefersReducedMotion);
  const containerRef = useRef<HTMLDivElement>(null);

  // Derive chips from store if not provided externally
  const chips = externalChips ?? deriveChips(filters, t);

  // One Tab stop for the whole chip group; arrow keys move within it.
  const { registerRef, handleKeyDown, getTabIndex, setActiveIndex } =
    useRovingTabIndex(chips.length);

  // Where focus should land once the store update has re-rendered the group:
  // the chip key that takes the removed chip's slot (or the previous chip), or
  // "fallback" when no chips remain. Keys (not indices) are used because
  // AnimatePresence keeps the exiting chip in the DOM until its exit animation
  // finishes, so positional indices would still point at the dismissed button.
  const [pendingFocus, setPendingFocus] = useState<{ key: string } | "fallback" | null>(
    null
  );

  const announce = useCallback(
    (message: string) => {
      const el = document.getElementById(announcerId);
      if (el) el.textContent = message;
    },
    [announcerId]
  );

  const handleRemove = useCallback(
    (chip: FilterChip) => {
      const key = chip.filterKey;

      if (key === "categories" || key === "jurisdictions" || key === "riskTiers") {
        const current = filters[key] as string[];
        updateSingleFilter(key, current.filter((v) => v !== chip.value));
        return;
      }

      if (key === "aprRange") {
        updateSingleFilter("aprRange", [0, 50]);
        return;
      }

      if (key === "activeOnly") {
        updateSingleFilter("activeOnly", false);
        return;
      }

      if (key === "showExpired") {
        updateSingleFilter("showExpired", false);
      }
    },
    [filters, updateSingleFilter]
  );

  /** Remove the chip at `index` and queue predictable focus for after re-render. */
  const dismissAt = useCallback(
    (index: number) => {
      const chip = chips[index];
      if (!chip) return;

      handleRemove(chip);

      const remaining = chips.filter((_, i) => i !== index);
      if (remaining.length === 0) {
        // The whole group unmounts — hand focus to the configured fallback.
        setPendingFocus("fallback");
      } else {
        // Prefer the chip that slides into this slot; otherwise the previous one.
        const target = remaining[Math.min(index, remaining.length - 1)];
        setPendingFocus({ key: target.key });
      }

      const translated = t?.("filterRemoved", { label: chip.label });
      announce(
        translated && translated !== "filterRemoved"
          ? translated
          : `Filter "${chip.label}" removed`
      );
    },
    [announce, chips, handleRemove, t]
  );

  // Apply queued focus after the DOM reflects the removal. Runs even when the
  // group unmounts (chips.length === 0) so the fallback still receives focus.
  useEffect(() => {
    if (pendingFocus === null) return;
    setPendingFocus(null);

    const focusFallback = () => {
      const fallback = fallbackFocusId ? document.getElementById(fallbackFocusId) : null;
      fallback?.focus();
    };

    if (pendingFocus === "fallback") {
      focusFallback();
      return;
    }

    // Resolve by chip key, not position — the exiting chip is still mounted.
    const selector = `[data-chip-key="${pendingFocus.key}"]`;
    const target = containerRef.current?.querySelector<HTMLElement>(selector);
    if (target) {
      const nextIndex = chips.findIndex((c) => c.key === pendingFocus.key);
      if (nextIndex >= 0) setActiveIndex(nextIndex);
      target.focus();
    } else {
      focusFallback();
    }
  }, [pendingFocus, fallbackFocusId, setActiveIndex, chips]);

  if (chips.length === 0) return null;

  return (
    <>
      {/* Screen-reader live region — announces filter removals without page reload */}
      <div
        id={announcerId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="filter-chips-announcer"
      />

      <div
        ref={containerRef}
        className={cn("mt-3 flex flex-wrap items-center gap-2", className)}
        role="group"
        aria-label={t ? t("activeFilters") : "Active filters"}
        aria-describedby={hintId}
        data-testid="active-filter-chips"
        data-reduced-motion={prefersReducedMotion}
      >
        <p id={hintId} className="sr-only" data-testid="filter-chips-hint">
          {t
            ? t("activeFiltersKeyboardHint")
            : "Use arrow keys to move between filters and press Delete or Backspace to remove one."}
        </p>

        <AnimatePresence initial={false}>
          {chips.map((chip, index) => (
            <motion.div
              key={chip.key}
              {...chipMotion}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            >
              <span>{chip.label}</span>
              <button
                type="button"
                ref={registerRef(index)}
                tabIndex={getTabIndex(index)}
                aria-label={
                  t ? t("removeFilterAria", { label: chip.label }) : `Remove filter: ${chip.label}`
                }
                data-chip-remove
                data-chip-key={chip.key}
                onFocus={() => setActiveIndex(index)}
                onClick={() => dismissAt(index)}
                onKeyDown={(event) => {
                  if (event.key === "Delete" || event.key === "Backspace") {
                    event.preventDefault();
                    dismissAt(index);
                    return;
                  }
                  handleKeyDown(event, index);
                }}
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full",
                  "text-primary/70 transition-colors",
                  "hover:bg-primary/20 hover:text-primary",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                )}
                data-testid={`remove-chip-${chip.key}`}
              >
                <X className="h-2.5 w-2.5" aria-hidden="true" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Clear all */}
        <motion.button
          layout={!prefersReducedMotion}
          type="button"
          onClick={() => {
            resetFilters();
            const translated = t?.("allFiltersCleared");
            announce(
              translated && translated !== "allFiltersCleared"
                ? translated
                : "All filters cleared"
            );
          }}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium",
            "bg-destructive/10 text-destructive",
            "hover:bg-destructive/20 transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
          )}
          aria-label={t ? t("clearAllFiltersAria") : "Clear all active filters"}
          data-testid="clear-all-filters"
        >
          Clear all
        </motion.button>
      </div>
    </>
  );
}
