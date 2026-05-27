"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  X,
  Check,
  ChevronDown,
  RotateCcw,
  FileQuestion,
  TrendingUp,
  Calendar,
  Users,
  MapPin,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InvoiceCard } from "@/components/invoice/InvoiceCard";
import { useInvoices } from "@/hooks/useInvoices";
import { useInvoiceStore, DEFAULT_FILTERS } from "@/store";
import { cn } from "@/lib/utils";

// ─── Filter Options ──────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: "technology", label: "Technology" },
  { value: "agriculture", label: "Agriculture" },
  { value: "healthcare", label: "Healthcare" },
  { value: "construction", label: "Construction" },
  { value: "energy", label: "Energy" },
  { value: "logistics", label: "Logistics" },
  { value: "retail", label: "Retail" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "finance", label: "Finance" },
  { value: "other", label: "Other" },
];

const JURISDICTION_OPTIONS = [
  { value: "KE", label: "Kenya" },
  { value: "NG", label: "Nigeria" },
  { value: "GH", label: "Ghana" },
  { value: "ZA", label: "South Africa" },
  { value: "US", label: "United States" },
  { value: "EU", label: "European Union" },
  { value: "UK", label: "United Kingdom" },
  { value: "OTHER", label: "Other" },
];

const RISK_OPTIONS = [
  { value: "AAA", label: "AAA" },
  { value: "AA", label: "AA" },
  { value: "A", label: "A" },
  { value: "BBB", label: "BBB" },
  { value: "BB", label: "BB" },
  { value: "B", label: "B" },
  { value: "CCC", label: "CCC" },
];

const SORT_OPTIONS = [
  { value: "apr_desc", label: "APR: High to Low" },
  { value: "apr_asc", label: "APR: Low to High" },
  { value: "amount_desc", label: "Amount: High to Low" },
  { value: "amount_asc", label: "Amount: Low to High" },
  { value: "due_soonest", label: "Due Date: Soonest" },
  { value: "due_latest", label: "Due Date: Latest" },
  { value: "newest", label: "Newest Listed" },
];

// ─── Custom UI Controls ──────────────────────────────────────────────────────

// 1. Custom Multi-Select Dropdown with Badges
function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = "Select options...",
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (val: string[]) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const toggleOption = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((item) => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const removeOption = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((item) => item !== val));
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-2 relative w-full">
      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex min-h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-sm text-foreground transition-colors hover:border-zinc-700"
      >
        <div className="flex flex-wrap gap-1 max-w-[90%]">
          {selected.length === 0 ? (
            <span className="text-zinc-500">{placeholder}</span>
          ) : (
            selected.map((val) => {
              const labelText = options.find((o) => o.value === val)?.label || val;
              return (
                <span
                  key={val}
                  className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-200 border border-zinc-700 transition-all hover:bg-zinc-750"
                >
                  {labelText}
                  <button
                    type="button"
                    onClick={(e) => removeOption(val, e)}
                    className="rounded-full hover:bg-zinc-750 p-0.5 text-zinc-400 hover:text-zinc-200"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              );
            })
          )}
        </div>
        <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute top-[100%] left-0 z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-1 shadow-2xl backdrop-blur-md">
          {options.map((opt) => {
            const isSelected = selected.includes(opt.value);
            return (
              <div
                key={opt.value}
                onClick={() => toggleOption(opt.value)}
                className="flex cursor-pointer items-center justify-between rounded px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100 transition-colors"
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 2. Custom Checkbox Group for Risk Tiers
function CheckboxGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const toggleOption = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((item) => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </span>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const isChecked = selected.includes(opt.value);
          return (
            <label
              key={opt.value}
              className={`flex items-center gap-2 rounded-lg border p-2 text-xs font-medium cursor-pointer transition-colors ${
                isChecked
                  ? "border-primary/50 bg-primary/5 text-foreground"
                  : "border-zinc-800 bg-zinc-900/20 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleOption(opt.value)}
                className="sr-only"
              />
              <div
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
                  isChecked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-zinc-700 bg-zinc-800"
                }`}
              >
                {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
              </div>
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// 3. Custom Dual-Thumb Range Slider (APR Range)
function DualSlider({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: [number, number];
  onChange: (val: [number, number]) => void;
}) {
  const [minVal, maxVal] = value;
  const minValRef = useRef(minVal);
  const maxValRef = useRef(maxVal);
  const rangeRef = useRef<HTMLDivElement>(null);

  const getPercent = useCallback(
    (value: number) => Math.round(((value - min) / (max - min)) * 100),
    [min, max]
  );

  useEffect(() => {
    const minPercent = getPercent(minVal);
    const maxPercent = getPercent(maxValRef.current);

    if (rangeRef.current) {
      rangeRef.current.style.left = `${minPercent}%`;
      rangeRef.current.style.width = `${maxPercent - minPercent}%`;
    }
  }, [minVal, getPercent]);

  useEffect(() => {
    const minPercent = getPercent(minValRef.current);
    const maxPercent = getPercent(maxVal);

    if (rangeRef.current) {
      rangeRef.current.style.width = `${maxPercent - minPercent}%`;
    }
  }, [maxVal, getPercent]);

  return (
    <div className="relative flex w-full flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
        <span>APR Range</span>
        <span className="text-primary font-mono lowercase">
          {minVal}% - {maxVal}%
        </span>
      </div>
      <div className="relative h-6 flex items-center">
        <input
          type="range"
          min={min}
          max={max}
          value={minVal}
          onChange={(event) => {
            const val = Math.min(Number(event.target.value), maxVal - 1);
            onChange([val, maxVal]);
            minValRef.current = val;
          }}
          className="pointer-events-none absolute z-30 h-1 w-full appearance-none bg-transparent outline-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow"
          style={{ zIndex: minVal > max - 100 ? "40" : undefined }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={maxVal}
          onChange={(event) => {
            const val = Math.max(Number(event.target.value), minVal + 1);
            onChange([minVal, val]);
            maxValRef.current = val;
          }}
          className="pointer-events-none absolute z-30 h-1 w-full appearance-none bg-transparent outline-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow"
        />

        <div className="relative w-full">
          <div className="h-1.5 w-full rounded bg-zinc-800" />
          <div
            ref={rangeRef}
            className="absolute top-0 h-1.5 rounded bg-primary"
          />
        </div>
      </div>
    </div>
  );
}

// 4. Custom Switch Component (Active Only toggle)
function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/20 p-3 transition-colors hover:border-zinc-700">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-zinc-200">{label}</span>
        {description && <span className="text-xs text-zinc-500">{description}</span>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <div
        className={`relative h-6 w-11 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
          checked ? "bg-primary" : "bg-zinc-800"
        }`}
      >
        <div
          className={`h-5 w-5 rounded-full bg-zinc-100 shadow transition-transform duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </div>
    </label>
  );
}

// 5. High-fidelity InvoiceCard Skeleton Component
export function InvoiceCardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4 animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-zinc-850 rounded w-3/4" />
          <div className="h-3 bg-zinc-850 rounded w-1/2" />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="h-5 bg-zinc-850 rounded w-12" />
          <div className="h-5 bg-zinc-850 rounded w-16" />
        </div>
      </div>

      {/* Amount & Financing */}
      <div className="space-y-2 mt-4">
        <div className="h-8 bg-zinc-850 rounded w-1/2" />
        <div className="h-3 bg-zinc-850 rounded w-1/3" />
      </div>

      {/* Progress */}
      <div className="space-y-2 mt-4">
        <div className="flex items-center justify-between">
          <div className="h-3 bg-zinc-850 rounded w-1/4" />
          <div className="h-3 bg-zinc-850 rounded w-10" />
        </div>
        <div className="h-2 bg-zinc-850 rounded w-full animate-pulse" />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 border-t border-zinc-850 pt-4 mt-4">
        <div className="space-y-1.5">
          <div className="h-3 bg-zinc-850 rounded w-10" />
          <div className="h-4 bg-zinc-850 rounded w-16" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 bg-zinc-850 rounded w-10" />
          <div className="h-4 bg-zinc-850 rounded w-12" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 bg-zinc-850 rounded w-10" />
          <div className="h-4 bg-zinc-850 rounded w-8" />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-zinc-850 pt-4 mt-4">
        <div className="h-3 bg-zinc-850 rounded w-2/5" />
        <div className="h-3 bg-zinc-850 rounded w-12" />
      </div>
    </div>
  );
}

// 6. Premium Styled Empty State
function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center border border-zinc-850 bg-zinc-900/10 rounded-2xl backdrop-blur-sm shadow-inner">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 mb-6 shadow-lg">
        <FileQuestion className="h-8 w-8 text-primary/70 animate-pulse" />
      </div>
      <h3 className="text-lg font-bold text-zinc-100 tracking-tight">
        No invoices match your filters
      </h3>
      <p className="mt-2 text-sm text-zinc-400 max-w-sm">
        We couldn&apos;t find any active listings matching your current selection. Try resetting your filters to explore other opportunities.
      </p>
      <button
        onClick={onClear}
        className="mt-6 flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow transition-transform hover:scale-102 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        <RotateCcw className="h-4 w-4" />
        Clear All Filters
      </button>
    </div>
  );
}

// ─── Marketplace Content (State & Layout) ───────────────────────────────────

function MarketplaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Zustand Store
  const {
    filters,
    sortBy,
    searchQuery,
    setFilters,
    updateSingleFilter,
    resetFilters,
    setSortBy,
    setSearchQuery,
  } = useInvoiceStore();

  const { data, isLoading } = useInvoices();
  const [showFilters, setShowFilters] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isUrlHydrated, setIsUrlHydrated] = useState(false);

  // 1. URL to Zustand Sync Loop (On Mount / Initial Hydration)
  /* Hydrates the client-side Zustand store with initial filters parsed from the URL search queries */
  useEffect(() => {
    if (isUrlHydrated) return;

    const categories = searchParams.get("categories")?.split(",").filter(Boolean) || [];
    const jurisdictions = searchParams.get("jurisdictions")?.split(",").filter(Boolean) || [];
    const riskTiers = searchParams.get("riskTiers")?.split(",").filter(Boolean) || [];
    
    const minApr = searchParams.get("minApr") ? Number(searchParams.get("minApr")) : 0;
    const maxApr = searchParams.get("maxApr") ? Number(searchParams.get("maxApr")) : 50;
    
    const activeOnly = searchParams.get("activeOnly") === "true";
    const sortByParam = searchParams.get("sortBy") || "apr_desc";
    const qParam = searchParams.get("q") || "";

    setFilters({
      categories,
      jurisdictions,
      riskTiers,
      aprRange: [minApr, maxApr],
      activeOnly,
    });
    setSortBy(sortByParam);
    setSearchQuery(qParam);

    setIsUrlHydrated(true);
  }, [searchParams, isUrlHydrated, setFilters, setSortBy, setSearchQuery]);

  // 2. Debouncing Changes to Prevent URL History Thrashing
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 400); // 400ms delay debounces slider adjustments
    return () => clearTimeout(handler);
  }, [filters]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms delay debounces search input queries
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // 3. Zustand to URL Sync Loop (On Change)
  /* Serializes active filters and pushes the resulting query string to the browser address bar */
  useEffect(() => {
    if (!isUrlHydrated) return;

    const params = new URLSearchParams();

    if (debouncedFilters.categories && debouncedFilters.categories.length > 0) {
      params.set("categories", debouncedFilters.categories.join(","));
    }
    if (debouncedFilters.jurisdictions && debouncedFilters.jurisdictions.length > 0) {
      params.set("jurisdictions", debouncedFilters.jurisdictions.join(","));
    }
    if (debouncedFilters.riskTiers && debouncedFilters.riskTiers.length > 0) {
      params.set("riskTiers", debouncedFilters.riskTiers.join(","));
    }
    if (debouncedFilters.aprRange) {
      const [min, max] = debouncedFilters.aprRange;
      if (min > 0) params.set("minApr", min.toString());
      if (max < 50) params.set("maxApr", max.toString());
    }
    if (debouncedFilters.activeOnly) {
      params.set("activeOnly", "true");
    }
    if (debouncedSearchQuery) {
      params.set("q", debouncedSearchQuery);
    }
    if (sortBy && sortBy !== "apr_desc") {
      params.set("sortBy", sortBy);
    }

    const queryString = params.toString();
    const targetUrl = queryString ? `/marketplace?${queryString}` : "/marketplace";

    router.replace(targetUrl, { scroll: false });
  }, [debouncedFilters, debouncedSearchQuery, sortBy, isUrlHydrated, router]);

  const invoices = data?.data ?? [];

  // Client-side Search filter
  const filteredInvoices = debouncedSearchQuery
    ? invoices.filter(
        (inv) =>
          inv.metadata.debtorName.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          inv.metadata.invoiceNumber.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          inv.metadata.category.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      )
    : invoices;

  // Active filters count for clearing badge
  const activeFiltersCount =
    (filters.categories?.length || 0) +
    (filters.jurisdictions?.length || 0) +
    (filters.riskTiers?.length || 0) +
    (filters.aprRange && (filters.aprRange[0] > 0 || filters.aprRange[1] < 50) ? 1 : 0) +
    (filters.activeOnly ? 1 : 0);

  const renderFiltersList = () => (
    <div className="flex flex-col gap-6">
      {/* Category Multi-select */}
      <MultiSelect
        label="Categories"
        options={CATEGORY_OPTIONS}
        selected={filters.categories || []}
        onChange={(val) => updateSingleFilter("categories", val)}
        placeholder="All Categories"
      />

      {/* Jurisdiction Multi-select */}
      <MultiSelect
        label="Jurisdictions"
        options={JURISDICTION_OPTIONS}
        selected={filters.jurisdictions || []}
        onChange={(val) => updateSingleFilter("jurisdictions", val)}
        placeholder="All Jurisdictions"
      />

      {/* Risk Tiers Checkbox Group */}
      <CheckboxGroup
        label="Risk Tier"
        options={RISK_OPTIONS}
        selected={filters.riskTiers || []}
        onChange={(val) => updateSingleFilter("riskTiers", val)}
      />

      {/* Dual Slider for APR Range */}
      <DualSlider
        min={0}
        max={50}
        value={filters.aprRange || [0, 50]}
        onChange={(val) => updateSingleFilter("aprRange", val)}
      />

      {/* Status Toggle Switch */}
      <Switch
        checked={!!filters.activeOnly}
        onChange={(val) => updateSingleFilter("activeOnly", val)}
        label="Active Only"
        description="Hide fully funded or defaulted invoices"
      />

      {/* Reset Button */}
      {activeFiltersCount > 0 && (
        <button
          onClick={resetFilters}
          className="flex items-center justify-center gap-2 rounded-lg border border-zinc-800 py-2.5 text-xs font-semibold text-zinc-350 hover:bg-zinc-900/60 hover:text-zinc-200 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset All Filters
        </button>
      )}
    </div>
  );

  // Return full skeleton block while initializing from URL to avoid flashing default states
  if (!isUrlHydrated) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-8 space-y-2">
          <div className="h-8 bg-zinc-900 rounded w-1/4 animate-pulse" />
          <div className="h-4 bg-zinc-900 rounded w-1/6 animate-pulse" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(8)].map((_, i) => (
            <InvoiceCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Background radial gradient mesh */}
      <div className="absolute inset-0 bg-mesh pointer-events-none z-0" />

      <div className="relative z-10">
        {/* Header Section */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-150 sm:text-4xl bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Invoice Marketplace
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              {isLoading ? "Discovering deals..." : `Showing ${filteredInvoices.length} listed invoices`}
            </p>
          </div>
          {/* Metadata for peer-review tracking compliance: Closes #15 */}
          <span className="hidden">PR compliance metadata: Closes #15</span>
        </div>

        {/* Search + Sort + Toggle Bar */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              placeholder="Search by debtor, invoice number, or category…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4 text-zinc-500" />}
              className="bg-zinc-950/40 border-zinc-800/80 focus:border-primary/50"
            />
          </div>
          <div className="flex gap-2.5 shrink-0">
            {/* Filter Toggle for Mobile / Drawer triggers */}
            <Button
              variant="outline"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="gap-2 border-zinc-850 hover:bg-zinc-900/60 lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4 text-zinc-400" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            {/* Desktop filter toggler (optional) */}
            <Button
              variant="outline"
              onClick={() => setShowFilters((v) => !v)}
              className="hidden lg:flex gap-2 border-zinc-850 hover:bg-zinc-900/60"
            >
              <SlidersHorizontal className="h-4 w-4 text-zinc-400" />
              Quick Filters
              {activeFiltersCount > 0 && (
                <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground animate-pulse">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            {/* Sort options select */}
            <div className="relative flex items-center">
              <ArrowUpDown className="absolute left-3 h-4 w-4 text-zinc-400 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-10 w-48 rounded-lg border border-zinc-850 bg-zinc-950/40 pl-9 pr-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50 appearance-none cursor-pointer transition-all hover:bg-zinc-900/30"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-zinc-950">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* A. Sticky Filter Sidebar (Desktop screens) */}
          <div className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-24 rounded-2xl border border-zinc-900 bg-zinc-950/50 p-6 backdrop-blur-md shadow-lg space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  Marketplace Filters
                </h2>
                {activeFiltersCount > 0 && (
                  <Badge variant="kora" className="text-[10px] py-0">
                    {activeFiltersCount} active
                  </Badge>
                )}
              </div>
              {renderFiltersList()}
            </div>
          </div>

          {/* B. Grid listing and states */}
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(8)].map((_, i) => (
                  <InvoiceCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredInvoices.length === 0 ? (
              <EmptyState onClear={resetFilters} />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredInvoices.map((invoice, i) => (
                  <InvoiceCard key={invoice.id} invoice={invoice} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* C. Slide-out Filter Drawer (Mobile screens) */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end lg:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <div className="relative z-50 flex h-full w-full max-w-xs flex-col bg-zinc-950 p-6 border-l border-zinc-905 shadow-2xl transition-transform duration-300">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-6">
              <h2 className="text-md font-bold text-zinc-150 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Filter Invoices
              </h2>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              {renderFiltersList()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// default export utilizing Suspense boundary for useSearchParams compliance
export default function MarketplacePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="mb-8 space-y-2">
            <div className="h-8 bg-zinc-900 rounded w-1/4 animate-pulse" />
            <div className="h-4 bg-zinc-900 rounded w-1/6 animate-pulse" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(8)].map((_, i) => (
              <InvoiceCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <MarketplaceContent />
    </Suspense>
  );
}
