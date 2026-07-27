"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Search, X, CheckSquare, Square, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInvoiceStore } from "@/store/invoiceStore";
import type { InvoiceJurisdiction } from "@/types";

// ─── Jurisdiction data ────────────────────────────────────────────────────────

export interface JurisdictionOption {
  code: InvoiceJurisdiction;
  name: string;
  flag: string;
}

export const JURISDICTION_OPTIONS: JurisdictionOption[] = [
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "EU", name: "European Union", flag: "🇪🇺" },
  { code: "UK", name: "United Kingdom", flag: "🇬🇧" },
  { code: "OTHER", name: "Other", flag: "🌐" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCountsFromInvoices(
  invoices: Array<{ metadata: { jurisdiction: string } }>
): Record<string, number> {
  return invoices.reduce<Record<string, number>>((acc, inv) => {
    const code = inv.metadata.jurisdiction;
    acc[code] = (acc[code] ?? 0) + 1;
    return acc;
  }, {});
}

// ─── URL sync helpers ─────────────────────────────────────────────────────────

function getJurisdictionsFromURL(): string[] {
  if (typeof window === "undefined") return [];
  const params = new URLSearchParams(window.location.search);
  return params.get("jurisdictions")?.split(",").filter(Boolean) ?? [];
}

function setJurisdictionsInURL(jurisdictions: string[]): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (jurisdictions.length > 0) {
    url.searchParams.set("jurisdictions", jurisdictions.join(","));
  } else {
    url.searchParams.delete("jurisdictions");
  }
  window.history.replaceState({}, "", url.toString());
}

// ─── Count badge ──────────────────────────────────────────────────────────────

interface CountBadgeProps {
  count: number;
  selected: boolean;
}

function CountBadge({ count, selected }: CountBadgeProps) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "ml-auto min-w-[1.25rem] rounded-full px-1 py-0 text-center text-[10px] font-semibold leading-5",
        selected
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground"
      )}
      aria-label={`${count} invoice${count === 1 ? "" : "s"}`}
    >
      {count}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export interface JurisdictionFilterProps {
  /** Allow the caller to hide/show the filter panel */
  defaultExpanded?: boolean;
  className?: string;
}

/**
 * JurisdictionFilter
 *
 * A searchable, keyboard-navigable, multi-select jurisdiction filter that:
 * - Filters the country list as the user types
 * - Shows live invoice counts per jurisdiction (sourced from invoiceStore)
 * - Supports "Select all" / "Clear all"
 * - Persists selected jurisdictions to the URL query string
 * - Syncs selections with the invoiceStore filter
 */
export function JurisdictionFilter({
  defaultExpanded = true,
  className,
}: JurisdictionFilterProps) {
  const { invoices, filters, setFilters } = useInvoiceStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState(defaultExpanded);
  const searchRef = useRef<HTMLInputElement>(null);

  // Selected codes come from the store (single source of truth)
  const selected = filters.jurisdictions;

  // Live counts from the current invoice dataset (unfiltered by jurisdiction)
  const counts = useMemo(
    () => getCountsFromInvoices(invoices),
    [invoices]
  );

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return JURISDICTION_OPTIONS;
    return JURISDICTION_OPTIONS.filter(
      (opt) =>
        opt.name.toLowerCase().includes(q) ||
        opt.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Sync from URL on mount
  useEffect(() => {
    const urlJurisdictions = getJurisdictionsFromURL();
    if (urlJurisdictions.length > 0) {
      setFilters({ jurisdictions: urlJurisdictions });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync to URL whenever selection changes
  useEffect(() => {
    setJurisdictionsInURL(selected);
  }, [selected]);

  const handleToggle = useCallback(
    (code: string) => {
      const next = selected.includes(code)
        ? selected.filter((c) => c !== code)
        : [...selected, code];
      setFilters({ jurisdictions: next });
    },
    [selected, setFilters]
  );

  const handleSelectAll = useCallback(() => {
    const visibleCodes = filteredOptions.map((o) => o.code);
    const allSelected = visibleCodes.every((c) => selected.includes(c));
    if (allSelected) {
      // Deselect visible
      setFilters({
        jurisdictions: selected.filter((c) => !visibleCodes.includes(c as any)),
      });
    } else {
      // Select all visible (union with current selection)
      const merged = Array.from(new Set([...selected, ...visibleCodes]));
      setFilters({ jurisdictions: merged });
    }
  }, [filteredOptions, selected, setFilters]);

  const handleClearAll = useCallback(() => {
    setFilters({ jurisdictions: [] });
    setSearchQuery("");
  }, [setFilters]);

  // Keyboard navigation for the list
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      const items = Array.from(
        e.currentTarget.querySelectorAll<HTMLElement>("[data-jurisdiction-item]")
      );
      const focused = document.activeElement as HTMLElement;
      const idx = items.indexOf(focused);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        items[Math.min(idx + 1, items.length - 1)]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (idx <= 0) {
          searchRef.current?.focus();
        } else {
          items[idx - 1]?.focus();
        }
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (focused.dataset.jurisdictionItem) {
          handleToggle(focused.dataset.jurisdictionItem);
        }
      } else if (e.key === "Escape") {
        setSearchQuery("");
        searchRef.current?.focus();
      }
    },
    [handleToggle]
  );

  const visibleSelectedCount = filteredOptions.filter((o) =>
    selected.includes(o.code)
  ).length;
  const allVisibleSelected =
    filteredOptions.length > 0 &&
    filteredOptions.every((o) => selected.includes(o.code));

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card",
        className
      )}
      aria-label="Jurisdiction filter"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors focus-visible:outline-none"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="jurisdiction-filter-body"
        >
          Jurisdiction
          {selected.length > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
              {selected.length}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {selected.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none"
            aria-label="Clear all jurisdiction filters"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {/* Body */}
      {expanded && (
        <div id="jurisdiction-filter-body">
          {/* Search input */}
          <div className="relative px-3 pt-3 pb-1">
            <Search className="pointer-events-none absolute left-5 top-1/2 mt-1 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              ref={searchRef}
              type="search"
              placeholder="Search countries…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full rounded-md border border-input bg-background pl-7 pr-3 py-1.5 text-sm",
                "placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              )}
              aria-label="Search jurisdictions"
              aria-controls="jurisdiction-list"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-5 top-1/2 mt-1 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Select all row */}
          {filteredOptions.length > 0 && (
            <div className="flex items-center justify-between px-4 py-1.5">
              <button
                type="button"
                onClick={handleSelectAll}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none"
                aria-label={allVisibleSelected ? "Deselect all visible jurisdictions" : "Select all visible jurisdictions"}
              >
                {allVisibleSelected ? (
                  <CheckSquare className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
                {allVisibleSelected ? "Deselect all" : "Select all"}
              </button>
              <span className="text-[10px] text-muted-foreground">
                {visibleSelectedCount}/{filteredOptions.length} selected
              </span>
            </div>
          )}

          {/* Country list */}
          <ul
            id="jurisdiction-list"
            role="listbox"
            aria-multiselectable="true"
            aria-label="Available jurisdictions"
            className="max-h-60 overflow-y-auto px-2 pb-3 space-y-0.5"
            onKeyDown={handleKeyDown}
          >
            {filteredOptions.length === 0 && (
              <li className="py-4 text-center text-xs text-muted-foreground">
                No jurisdictions match &quot;{searchQuery}&quot;
              </li>
            )}

            {filteredOptions.map((opt) => {
              const isSelected = selected.includes(opt.code);
              const count = counts[opt.code] ?? 0;

              return (
                <li
                  key={opt.code}
                  role="option"
                  aria-selected={isSelected}
                  data-jurisdiction-item={opt.code}
                  tabIndex={0}
                  onClick={() => handleToggle(opt.code)}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      handleToggle(opt.code);
                    }
                  }}
                  className={cn(
                    "flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
                    "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {/* Checkbox indicator */}
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground bg-transparent"
                    )}
                    aria-hidden="true"
                  >
                    {isSelected && (
                      <svg
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3 w-3"
                      >
                        <polyline points="2,6 5,9 10,3" />
                      </svg>
                    )}
                  </span>

                  {/* Flag */}
                  <span
                    className="text-base leading-none shrink-0"
                    role="img"
                    aria-label={opt.name}
                  >
                    {opt.flag}
                  </span>

                  {/* Name */}
                  <span className="flex-1 truncate">{opt.name}</span>

                  {/* Count badge */}
                  <CountBadge count={count} selected={isSelected} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
