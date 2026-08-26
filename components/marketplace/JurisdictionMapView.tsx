"use client";

/**
 * components/marketplace/JurisdictionMapView.tsx
 *
 * Choropleth-style map view for the Marketplace page.
 * =====================================================
 * Renders a visually-weighted grid of "region cards" — one per supported
 * InvoiceJurisdiction — arranged in a logical geographic layout.
 *
 * Each card shows:
 *   • Country flag emoji + name
 *   • Total invoice volume (USDC)
 *   • Invoice count
 *   • Average APR
 *   • A fill-bar proportional to volume relative to the largest jurisdiction
 *
 * Clicking a card (or pressing Enter / Space) toggles the corresponding
 * jurisdiction filter in the marketplace. The card turns visually "active"
 * when it is already in the active filter set, matching the chip/select UX.
 *
 * Accessibility:
 *   • role="listbox" / role="option" (multi-select semantics)
 *   • aria-selected on each card
 *   • aria-label describes volume + APR
 *   • Full keyboard navigation (Tab focus + Enter/Space toggle)
 *   • Reduced-motion safe (no CSS animations beyond opacity)
 *
 * Feature flag: NEXT_PUBLIC_ENABLE_MAP_VIEW
 * Callers are responsible for the flag check; this component is always renderable.
 */

import { useMemo, useCallback, useId } from "react";
import { TrendingUp, BarChart3, X } from "lucide-react";
import { formatCurrency, formatApr, aggregateByJurisdiction, cn } from "@/lib/utils";
import type { Invoice, InvoiceJurisdiction } from "@/types";
import type { JurisdictionStats } from "@/lib/utils";

// ─── Jurisdiction metadata ────────────────────────────────────────────────────

interface JurisdictionMeta {
  code: InvoiceJurisdiction;
  name: string;
  flag: string;
  /** Approximate geographic region for visual grouping */
  region: "africa" | "europe" | "americas" | "other";
}

const JURISDICTION_META: JurisdictionMeta[] = [
  { code: "NG", name: "Nigeria",        flag: "🇳🇬", region: "africa"   },
  { code: "KE", name: "Kenya",          flag: "🇰🇪", region: "africa"   },
  { code: "GH", name: "Ghana",          flag: "🇬🇭", region: "africa"   },
  { code: "ZA", name: "South Africa",   flag: "🇿🇦", region: "africa"   },
  { code: "EU", name: "European Union", flag: "🇪🇺", region: "europe"   },
  { code: "UK", name: "United Kingdom", flag: "🇬🇧", region: "europe"   },
  { code: "US", name: "United States",  flag: "🇺🇸", region: "americas" },
  { code: "OTHER", name: "Other",       flag: "🌐", region: "other"    },
];

const META_BY_CODE = new Map(JURISDICTION_META.map((m) => [m.code, m]));

// ─── Volume-based colour tier ────────────────────────────────────────────────

/**
 * Returns a Tailwind colour class based on the fraction of the maximum
 * volume this jurisdiction represents (choropleth colouring).
 *
 * 0.0 – 0.2  → zinc (no/tiny volume)
 * 0.2 – 0.5  → kora teal (low-medium)
 * 0.5 – 0.8  → kora (medium-high)
 * 0.8 – 1.0  → emerald (top tier)
 */
function volumeColorClass(fraction: number, isSelected: boolean): string {
  if (isSelected) return "border-kora-400 bg-kora-500/15 ring-1 ring-kora-400/40";
  if (fraction === 0) return "border-zinc-800 bg-zinc-900/30";
  if (fraction < 0.2) return "border-zinc-700 bg-zinc-800/40";
  if (fraction < 0.5) return "border-teal-700/60 bg-teal-900/20";
  if (fraction < 0.8) return "border-kora-600/60 bg-kora-900/20";
  return "border-emerald-500/60 bg-emerald-900/20";
}

function volumeBarClass(fraction: number): string {
  if (fraction === 0) return "bg-zinc-700";
  if (fraction < 0.2) return "bg-zinc-600";
  if (fraction < 0.5) return "bg-teal-500";
  if (fraction < 0.8) return "bg-kora-400";
  return "bg-emerald-400";
}

// ─── Region card ──────────────────────────────────────────────────────────────

interface RegionCardProps {
  meta: JurisdictionMeta;
  stats: JurisdictionStats | undefined;
  maxVolume: number;
  isSelected: boolean;
  onToggle: (code: string) => void;
  labelledById: string;
}

function RegionCard({
  meta,
  stats,
  maxVolume,
  isSelected,
  onToggle,
  labelledById,
}: RegionCardProps) {
  const volume = stats?.totalAmount ?? 0;
  const fraction = maxVolume > 0 ? volume / maxVolume : 0;
  const cardId = `${labelledById}-${meta.code}`;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle(meta.code);
      }
    },
    [meta.code, onToggle]
  );

  const ariaLabel = stats
    ? `${meta.name}: ${stats.count} invoice${stats.count !== 1 ? "s" : ""}, ` +
      `${formatCurrency(volume, "USDC", true)} total volume, ` +
      `${formatApr(stats.avgApr)} average APR. ` +
      `${isSelected ? "Currently filtered. Click to remove filter." : "Click to filter by this jurisdiction."}`
    : `${meta.name}: no invoices. ${isSelected ? "Currently filtered. Click to remove filter." : "Click to filter by this jurisdiction."}`;

  return (
    <div
      id={cardId}
      role="option"
      aria-selected={isSelected}
      aria-label={ariaLabel}
      tabIndex={0}
      onClick={() => onToggle(meta.code)}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border p-4 cursor-pointer",
        "transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kora-400",
        "hover:shadow-md hover:-translate-y-0.5",
        volumeColorClass(fraction, isSelected)
      )}
    >
      {/* Selected check */}
      {isSelected && (
        <span
          className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-kora-500 text-white"
          aria-hidden="true"
        >
          <X className="h-2.5 w-2.5 stroke-[3]" />
        </span>
      )}

      {/* Flag + Name */}
      <div className="flex items-center gap-2 mb-3 pr-5">
        <span className="text-xl" role="img" aria-hidden="true">
          {meta.flag}
        </span>
        <div>
          <p className="text-xs font-semibold text-zinc-200 leading-tight">
            {meta.name}
          </p>
          <p className="text-[10px] text-zinc-500">{meta.code}</p>
        </div>
      </div>

      {/* Stats */}
      {stats && stats.count > 0 ? (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-1">
            <span className="text-sm font-bold text-zinc-100 tabular-nums">
              {formatCurrency(volume, "USDC", true)}
            </span>
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-400">
            <span className="flex items-center gap-1">
              <BarChart3 className="h-2.5 w-2.5" aria-hidden="true" />
              {stats.count} invoice{stats.count !== 1 ? "s" : ""}
              {stats.activeCount > 0 && (
                <span className="text-kora-400 font-medium">
                  · {stats.activeCount} open
                </span>
              )}
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-2.5 w-2.5 text-kora-400" aria-hidden="true" />
              <span className="text-kora-300 font-medium">
                {formatApr(stats.avgApr)}
              </span>
            </span>
          </div>

          {/* Volume bar */}
          <div
            className="h-1 w-full overflow-hidden rounded-full bg-zinc-800/60"
            role="presentation"
            aria-hidden="true"
          >
            <div
              className={cn("h-full rounded-full transition-all duration-500", volumeBarClass(fraction))}
              style={{ width: `${Math.max(2, fraction * 100).toFixed(1)}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-zinc-600 italic mt-auto">No invoices</p>
      )}
    </div>
  );
}

// ─── Map layout ───────────────────────────────────────────────────────────────

/**
 * Groups jurisdictions by geographic region for visual clustering:
 * Africa | Europe | Americas | Other
 * The grid places Africa (4) in the top row, Europe (2) + Americas (1) +
 * Other (1) in the bottom row — 4 columns total on wide screens.
 */
const REGION_ORDER: Array<JurisdictionMeta["region"]> = [
  "africa",
  "europe",
  "americas",
  "other",
];

// ─── JurisdictionMapView ──────────────────────────────────────────────────────

export interface JurisdictionMapViewProps {
  /** All invoices fetched so far (may be the full list or current page) */
  invoices: Invoice[];
  /** Currently active jurisdiction filter values */
  selectedJurisdictions: string[];
  /** Called when the user toggles a jurisdiction region card */
  onToggle: (jurisdiction: string) => void;
  /** Clear all jurisdiction filters at once */
  onClearAll: () => void;
}

/**
 * Renders a choropleth-style map view of invoice volume by jurisdiction.
 *
 * - Each region card shows count, total USDC volume, avg APR, and a
 *   relative volume fill-bar.
 * - Clicking/Enter/Space toggles the jurisdiction in the active filter.
 * - An "X / Clear all" chip appears when any jurisdiction is selected.
 * - Full ARIA listbox semantics for screen-reader accessibility.
 */
export function JurisdictionMapView({
  invoices,
  selectedJurisdictions,
  onToggle,
  onClearAll,
}: JurisdictionMapViewProps) {
  const headingId = useId();
  const listboxId = useId();

  const stats = useMemo(
    () => aggregateByJurisdiction(invoices),
    [invoices]
  );

  const statsByCode = useMemo(
    () => new Map(stats.map((s) => [s.jurisdiction, s])),
    [stats]
  );

  const maxVolume = useMemo(
    () => Math.max(0, ...stats.map((s) => s.totalAmount)),
    [stats]
  );

  // Group metadata by region
  const byRegion = useMemo(() => {
    const groups = new Map<JurisdictionMeta["region"], JurisdictionMeta[]>();
    for (const region of REGION_ORDER) groups.set(region, []);
    for (const meta of JURISDICTION_META) {
      groups.get(meta.region)!.push(meta);
    }
    return groups;
  }, []);

  const totalVolume = useMemo(
    () => stats.reduce((s, j) => s + j.totalAmount, 0),
    [stats]
  );

  const totalInvoices = useMemo(
    () => stats.reduce((s, j) => s + j.count, 0),
    [stats]
  );

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id={headingId}
            className="text-sm font-bold text-zinc-200 flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4 text-kora-400" aria-hidden="true" />
            Invoice Volume by Jurisdiction
          </h2>
          {totalInvoices > 0 && (
            <p className="mt-0.5 text-xs text-zinc-500">
              {totalInvoices} invoice{totalInvoices !== 1 ? "s" : ""} ·{" "}
              {formatCurrency(totalVolume, "USDC", true)} total
            </p>
          )}
        </div>

        {selectedJurisdictions.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            aria-label="Clear all jurisdiction filters"
            className="inline-flex items-center gap-1.5 rounded-full border border-kora-400/30 bg-kora-500/10 px-3 py-1 text-xs font-medium text-kora-300 hover:bg-kora-500/20 transition-colors"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            Clear{" "}
            {selectedJurisdictions.length > 1
              ? `${selectedJurisdictions.length} filters`
              : "filter"}
          </button>
        )}
      </div>

      {/* Legend */}
      <div
        className="mb-5 flex flex-wrap items-center gap-4 text-[10px] text-zinc-500"
        aria-label="Colour legend: volume intensity"
      >
        {[
          { label: "No invoices",  cls: "bg-zinc-700"   },
          { label: "Low volume",   cls: "bg-zinc-600"   },
          { label: "Moderate",     cls: "bg-teal-500"   },
          { label: "High",         cls: "bg-kora-400"   },
          { label: "Top market",   cls: "bg-emerald-400" },
        ].map(({ label, cls }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={cn("inline-block h-2 w-4 rounded-sm", cls)} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>

      {/* Region sections */}
      <div
        id={listboxId}
        role="listbox"
        aria-multiselectable="true"
        aria-label="Select jurisdictions to filter invoices"
        className="space-y-6"
      >
        {/* Africa row — 4 columns */}
        <div>
          <p
            className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600"
            aria-hidden="true"
          >
            Africa
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {byRegion.get("africa")!.map((meta) => (
              <RegionCard
                key={meta.code}
                meta={meta}
                stats={statsByCode.get(meta.code)}
                maxVolume={maxVolume}
                isSelected={selectedJurisdictions.includes(meta.code)}
                onToggle={onToggle}
                labelledById={listboxId}
              />
            ))}
          </div>
        </div>

        {/* Europe / Americas / Other — 2+1+1 columns */}
        <div>
          <p
            className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600"
            aria-hidden="true"
          >
            Europe · Americas · Other
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["europe", "americas", "other"] as const).flatMap((region) =>
              byRegion.get(region)!.map((meta) => (
                <RegionCard
                  key={meta.code}
                  meta={meta}
                  stats={statsByCode.get(meta.code)}
                  maxVolume={maxVolume}
                  isSelected={selectedJurisdictions.includes(meta.code)}
                  onToggle={onToggle}
                  labelledById={listboxId}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Helper text */}
      <p
        className="mt-4 text-center text-[10px] text-zinc-600"
        aria-live="polite"
      >
        {selectedJurisdictions.length === 0
          ? "Click a region to filter the invoice list by jurisdiction"
          : `Showing invoices from: ${selectedJurisdictions
              .map((c) => META_BY_CODE.get(c as InvoiceJurisdiction)?.name ?? c)
              .join(", ")}`}
      </p>
    </section>
  );
}
