"use client";

import { motion } from "framer-motion";
import { useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
const AnalyticsCharts = dynamic(() => import("@/components/analytics/AnalyticsCharts"), {
  ssr: false,
  loading: () => <AnalyticsSkeleton />,
});
import { BarChart3 } from "lucide-react";
import { AnalyticsSkeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { useWallet } from "@/hooks/useWallet";
import { usePositions } from "@/hooks/usePositions";
import { useUIStore, useInvoiceStore, DEFAULT_FILTERS as MARKETPLACE_DEFAULT_FILTERS } from "@/store";
import { Button } from "@/components/ui/button";
import { PrintButton, PrintLayout } from "@/components/ui/print-layout";
import { exportCsv, exportPdf } from "@/lib/export";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  AnalyticsFilterBar,
  DEFAULT_FILTERS,
  type AnalyticsFilters,
  type RiskTierFilter,
  type JurisdictionFilter,
  type CategoryFilter,
} from "@/components/analytics/AnalyticsFilterBar";
import type { PresetRange } from "@/components/analytics/DateRangePicker";
import {
  aggregatePositions,
  marketplacePathForAllocation,
  allocationToMarketplaceFilters,
} from "@/lib/portfolioAllocation";

// ── Mock analytics data (time-series history; risk uses live positions) ───────

const PORTFOLIO_HISTORY = [
  { month: "Jan", value: 0 },
  { month: "Feb", value: 12000 },
  { month: "Mar", value: 25000 },
  { month: "Apr", value: 48000 },
  { month: "May", value: 72000 },
  { month: "Jun", value: 0 },
  { month: "Jul", value: 25000 },
  { month: "Aug", value: 48000 },
  { month: "Sep", value: 72000 },
  { month: "Oct", value: 115000 },
  { month: "Nov", value: 170000 },
  { month: "Dec", value: 210000 },
];

const YIELD_HISTORY = [
  { month: "Jan", yield: 0 },
  { month: "Feb", yield: 180 },
  { month: "Mar", yield: 420 },
  { month: "Apr", yield: 890 },
  { month: "May", yield: 1200 },
  { month: "Jun", yield: 0 },
  { month: "Jul", yield: 420 },
  { month: "Aug", yield: 890 },
  { month: "Sep", yield: 1540 },
  { month: "Oct", yield: 2800 },
  { month: "Nov", yield: 4200 },
  { month: "Dec", yield: 5600 },
];

const MONTHLY_RETURNS = [
  { month: "Jan", return: 0 },
  { month: "Feb", return: 1.50 },
  { month: "Mar", return: 1.68 },
  { month: "Apr", return: 1.85 },
  { month: "May", return: 2.00 },
  { month: "Jun", return: 0 },
  { month: "Jul", return: 1.68 },
  { month: "Aug", return: 1.85 },
  { month: "Sep", return: 2.14 },
  { month: "Oct", return: 2.43 },
  { month: "Nov", return: 2.47 },
  { month: "Dec", return: 2.60 },
];

// ── URL ↔ filter helpers ───────────────────────────────────────────────────────

function filtersFromParams(params: URLSearchParams): AnalyticsFilters {
  const dateRange = (params.get("range") as PresetRange | "custom") ?? DEFAULT_FILTERS.dateRange;
  const fromStr = params.get("from");
  const toStr = params.get("to");

  const result: AnalyticsFilters = {
    riskTier: (params.get("risk") as RiskTierFilter) ?? DEFAULT_FILTERS.riskTier,
    jurisdiction: (params.get("jurisdiction") as JurisdictionFilter) ?? DEFAULT_FILTERS.jurisdiction,
    category: (params.get("category") as CategoryFilter) ?? DEFAULT_FILTERS.category,
    dateRange,
  };

  if (dateRange === "custom" && fromStr && toStr) {
    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && from <= to) {
      result.customDateRange = { from, to };
    } else {
      // Invalid custom range — fall back to default
      result.dateRange = DEFAULT_FILTERS.dateRange;
    }
  }

  return result;
}

function filtersToParams(filters: AnalyticsFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.riskTier !== "all") p.set("risk", filters.riskTier);
  if (filters.jurisdiction !== "all") p.set("jurisdiction", filters.jurisdiction);
  if (filters.category !== "all") p.set("category", filters.category);
  if (filters.dateRange !== DEFAULT_FILTERS.dateRange) p.set("range", filters.dateRange);
  if (
    filters.dateRange === "custom" &&
    filters.customDateRange?.from &&
    filters.customDateRange?.to
  ) {
    const from = filters.customDateRange.from;
    const to = filters.customDateRange.to;
    if (from > to) {
      // Invalid range — don't persist
      return p;
    }
    p.set("from", from.toISOString().split("T")[0]);
    p.set("to", to.toISOString().split("T")[0]);
  }
  return p;
}

// ── Slice helpers — filter mock data by date range ────────────────────────────

function sliceByRange<T>(data: T[], range: PresetRange | "custom"): T[] {
  const counts: Record<string, number> = {
    "7d": 1,
    "30d": 2,
    "90d": 4,
    "1y": 12,
    ytd: 5,
    all: data.length,
    custom: data.length,
  };
  return data.slice(-(counts[range] ?? data.length));
}

// ── Page ──────────────────────────────────────────────────────────────────────

function PortfolioAnalyticsInner() {
  const { isConnected, address } = useWallet();
  const { setWalletModalOpen } = useUIStore();
  const { setFilters, resetFilters } = useInvoiceStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Single positionsQuery — refetch every 30 s while tab is visible
  const positionsQuery = usePositions(address ?? undefined, { refetchInterval: 30_000 });

  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);

  const handleFiltersChange = useCallback(
    (next: AnalyticsFilters) => {
      const params = filtersToParams(next);
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router]
  );

  const handleRiskSegmentClick = useCallback(
    (riskTier: string) => {
      const allocationFilter = { dimension: "riskTier" as const, value: riskTier };
      resetFilters();
      setFilters({
        ...MARKETPLACE_DEFAULT_FILTERS,
        ...allocationToMarketplaceFilters(allocationFilter),
      });
      router.push(marketplacePathForAllocation(allocationFilter));
    },
    [resetFilters, setFilters, router]
  );

  // Slice all chart data by the active date-range filter
  const portfolio = useMemo(
    () => sliceByRange(PORTFOLIO_HISTORY, filters.dateRange),
    [filters.dateRange]
  );
  const yieldData = useMemo(
    () => sliceByRange(YIELD_HISTORY, filters.dateRange),
    [filters.dateRange]
  );
  const monthly = useMemo(
    () => sliceByRange(MONTHLY_RETURNS, filters.dateRange),
    [filters.dateRange]
  );
  const risk = useMemo(() => {
    const slices = aggregatePositions(
      (positionsQuery.data ?? []) as import("@/lib/portfolioAllocation").AllocatablePosition[],
      "riskTier"
    ).map((s) => ({
      name: s.name,
      value: Math.round(s.percent * 10) / 10,
      color: s.color,
    }));
    if (filters.riskTier === "all") return slices;
    return slices.filter((d) => d.name === filters.riskTier);
  }, [positionsQuery.data, filters.riskTier]);

  if (!isConnected) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground">Connect your wallet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          View your portfolio analytics, performance metrics, and investment data
        </p>
        <Button onClick={() => setWalletModalOpen(true)} className="mt-4">
          <span>Connect Wallet</span>
        </Button>
      </motion.div>
    );
  }

  return (
    <ErrorBoundary>
      <PrintLayout title="Kora Portfolio Analytics" subtitle="Invoice financing portfolio performance">
        <div id="analytics-report" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-zinc-100">Portfolio Analytics</h1>
              <p className="mt-1 text-sm text-zinc-500">
                Performance overview of your invoice financing portfolio
              </p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <button
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
                onClick={() => exportCsv(portfolio as any, "kora-portfolio.csv")}
              >
                Export CSV
              </button>
              <button
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
                onClick={() =>
                  exportPdf(
                    "analytics-report",
                    `kora-analytics-${new Date().toISOString().split("T")[0]}`
                  )
                }
              >
                Export PDF
              </button>
              <PrintButton />
            </div>
          </div>

          {/* Filter bar — changes push new URL params, charts re-slice instantly */}
          <div className="mb-6 print:hidden">
            <AnalyticsFilterBar filters={filters} onChange={handleFiltersChange} />
          </div>

          {/* Charts */}
          <AnalyticsCharts
            portfolio={portfolio}
            yieldData={yieldData}
            monthly={monthly}
            risk={risk}
            isLoading={positionsQuery.isLoading}
            onRiskSegmentClick={handleRiskSegmentClick}
          />
        </div>
      </PrintLayout>
    </ErrorBoundary>
  );
}

import { Suspense } from "react";

export default function PortfolioAnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <PortfolioAnalyticsInner />
    </Suspense>
  );
}
