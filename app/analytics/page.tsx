"use client";

import { motion } from "framer-motion";
import { useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
const AnalyticsCharts = dynamic(() => import("@/components/analytics/AnalyticsCharts"), {
  ssr: false,
  loading: () => <AnalyticsSkeleton />,
});
import { TrendingUp, DollarSign, BarChart3, Shield, Download } from "lucide-react";
import { AnalyticsSkeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { AnalyticsControls } from "@/components/analytics/AnalyticsControls";
import { useWallet } from "@/hooks/useWallet";
import { usePositions } from "@/hooks/usePositions";
import { useUIStore } from "@/store";
import { Button } from "@/components/ui/button";
import { PrintButton, PrintLayout } from "@/components/ui/print-layout";
import { formatCurrency } from "@/lib/utils";
import { exportCsv, exportPdf } from "@/lib/export";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { cn } from "@/lib/utils";
import {
  AnalyticsFilterBar,
  DEFAULT_FILTERS,
  type AnalyticsFilters,
  type RiskTierFilter,
  type JurisdictionFilter,
  type CategoryFilter,
} from "@/components/analytics/AnalyticsFilterBar";
import type { PresetRange } from "@/components/analytics/DateRangePicker";
import type { RiskTier } from "@/types/invoice";

// ─── Risk tier colors ──────────────────────────────────────────────────────
const RISK_TIER_COLORS: Record<RiskTier, string> = {
  AAA: "#34d399",
  AA: "#14b8a6",
  A: "#22d3ee",
  BBB: "#fbbf24",
  BB: "#f97316",
  B: "#ef4444",
  CCC: "#dc2626",
};

// Helper to get month short name
function getMonthShortName(date: Date): string {
  return date.toLocaleString("default", { month: "short" });
}

const toCsvRows = <T extends object>(rows: T[]): Record<string, unknown>[] =>
  rows.map((row) => Object.fromEntries(Object.entries(row)));

// ── URL ↔ filter helpers ───────────────────────────────────────────────────────

function filtersFromParams(params: URLSearchParams): AnalyticsFilters {
  return {
    riskTier: (params.get("risk") as RiskTierFilter) ?? DEFAULT_FILTERS.riskTier,
    jurisdiction: (params.get("jurisdiction") as JurisdictionFilter) ?? DEFAULT_FILTERS.jurisdiction,
    category: (params.get("category") as CategoryFilter) ?? DEFAULT_FILTERS.category,
    dateRange: (params.get("range") as PresetRange | "custom") ?? DEFAULT_FILTERS.dateRange,
  };
}

function filtersToParams(filters: AnalyticsFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.riskTier !== "all") p.set("risk", filters.riskTier);
  if (filters.jurisdiction !== "all") p.set("jurisdiction", filters.jurisdiction);
  if (filters.category !== "all") p.set("category", filters.category);
  if (filters.dateRange !== "30d") p.set("range", filters.dateRange);
  return p;
}

// ── Slice helpers (mock — in real app filter by actual data timestamps/fields) ─

function sliceByRange<T>(data: T[], range: PresetRange | "custom"): T[] {
  const counts: Record<string, number> = { "7d": 1, "30d": 2, "90d": 4, ytd: 5, all: 6, custom: 6 };
  return data.slice(-(counts[range] ?? 6));
}

// ── Page ──────────────────────────────────────────────────────────────────────

function PortfolioAnalyticsInner() {
  const { isConnected, address } = useWallet();
  const { setWalletModalOpen } = useUIStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const positionsQuery = usePositions(address ?? undefined, { refetchInterval: 30_000 });
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("30d");

  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);

  const handleFiltersChange = useCallback(
    (next: AnalyticsFilters) => {
      const params = filtersToParams(next);
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router]
  );

  const positions = positionsQuery.data ?? [];

  // Calculate aggregated data
  const { portfolio, yieldData, risk, monthly, stats } = useMemo(() => {
    // Filter positions based on selected filters
    let filteredPositions = positions;
    
    if (filters.riskTier !== "all") {
      filteredPositions = filteredPositions.filter(p => p.invoice?.riskTier === filters.riskTier);
    }
    if (filters.jurisdiction !== "all") {
      filteredPositions = filteredPositions.filter(p => p.invoice?.metadata.jurisdiction === filters.jurisdiction);
    }
    if (filters.category !== "all") {
      filteredPositions = filteredPositions.filter(p => p.invoice?.metadata.category === filters.category);
    }

    // Calculate risk distribution
    const riskByTier: Record<RiskTier, number> = {
      AAA: 0, AA: 0, A: 0, BBB: 0, BB: 0, B: 0, CCC: 0
    };
    let totalInvestedForRisk = 0;
    filteredPositions.forEach(pos => {
      const tier = pos.invoice?.riskTier || "A";
      riskByTier[tier] += pos.investedAmount;
      totalInvestedForRisk += pos.investedAmount;
    });
    const riskDistribution = Object.entries(riskByTier)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({
        name,
        value: totalInvestedForRisk > 0 ? parseFloat(((value / totalInvestedForRisk) * 100).toFixed(1)) : 0,
        color: RISK_TIER_COLORS[name as RiskTier]
      }));

    // Calculate portfolio history by month
    const portfolioByMonth: Record<string, number> = {};
    const yieldByMonth: Record<string, number> = {};
    const monthlyInvested: Record<string, number> = {};

    filteredPositions.forEach(pos => {
      const investedDate = new Date(pos.investedAt);
      const monthKey = `${investedDate.getFullYear()}-${investedDate.getMonth()}`;
      const monthName = getMonthShortName(investedDate);
      
      if (!portfolioByMonth[monthKey]) {
        portfolioByMonth[monthKey] = 0;
        yieldByMonth[monthKey] = 0;
        monthlyInvested[monthKey] = 0;
      }
      
      portfolioByMonth[monthKey] += pos.investedAmount;
      monthlyInvested[monthKey] += pos.investedAmount;
      
      if (pos.status === "repaid") {
        yieldByMonth[monthKey] += pos.yieldEarned;
      }
    });

    // Generate sorted portfolio history
    const sortedMonths = Object.keys(portfolioByMonth).sort();
    let cumulativeValue = 0;
    const portfolioHistory = sortedMonths.map(monthKey => {
      cumulativeValue += portfolioByMonth[monthKey];
      const [year, month] = monthKey.split("-");
      const date = new Date(parseInt(year), parseInt(month));
      return {
        month: getMonthShortName(date),
        value: cumulativeValue
      };
    });

    // Generate yield history
    const yieldHistory = sortedMonths.map(monthKey => {
      const [year, month] = monthKey.split("-");
      const date = new Date(parseInt(year), parseInt(month));
      return {
        month: getMonthShortName(date),
        yield: yieldByMonth[monthKey]
      };
    });

    // Generate monthly returns
    const monthlyReturns = sortedMonths.map(monthKey => {
      const [year, month] = monthKey.split("-");
      const date = new Date(parseInt(year), parseInt(month));
      const invested = monthlyInvested[monthKey];
      const yieldAmount = yieldByMonth[monthKey];
      const returnPct = invested > 0 ? parseFloat(((yieldAmount / invested) * 100).toFixed(2)) : 0;
      return {
        month: getMonthShortName(date),
        return: returnPct
      };
    });

    // Calculate stats
    const totalDeployed = filteredPositions.reduce((sum, p) => sum + p.investedAmount, 0);
    const totalYieldEarned = filteredPositions.reduce((sum, p) => sum + p.yieldEarned, 0);
    const defaultedCount = filteredPositions.filter(p => p.status === "defaulted").length;
    const totalPositions = filteredPositions.length;
    const defaultRate = totalPositions > 0 ? parseFloat(((defaultedCount / totalPositions) * 100).toFixed(1)) : 0;
    const avgApr = totalPositions > 0 
      ? parseFloat((filteredPositions.reduce((sum, p) => sum + (p.invoice?.terms.apr || 0), 0) / totalPositions).toFixed(1))
      : 0;

    const stats = [
      {
        label: "Total Deployed",
        value: formatCurrency(totalDeployed, "USDC", true),
        valueRaw: totalDeployed,
        change: `${totalPositions} positions`,
        changePositive: true,
        icon: <DollarSign className="h-4 w-4" />,
      },
      {
        label: "Total Yield Earned",
        value: formatCurrency(totalYieldEarned, "USDC", true),
        valueRaw: totalYieldEarned,
        change: `${avgApr}% avg APR`,
        changePositive: true,
        icon: <TrendingUp className="h-4 w-4" />,
      },
      {
        label: "Annualised Return",
        value: `${avgApr}%`,
        change: "Average APR",
        changePositive: true,
        icon: <BarChart3 className="h-4 w-4" />,
      },
      {
        label: "Default Rate",
        value: `${defaultRate}%`,
        valueRaw: defaultRate,
        change: `${defaultedCount} defaulted`,
        changePositive: defaultRate === 0,
        icon: <Shield className="h-4 w-4" />,
      },
    ];

    return {
      portfolio: portfolioHistory,
      yieldData: yieldHistory,
      risk: riskDistribution,
      monthly: monthlyReturns,
      stats
    };
  }, [positions, filters]);

  const handleExport = useCallback((type: "portfolio" | "yield" | "risk" | "monthly") => {
    let data, filename;
    switch (type) {
      case "portfolio":
        data = portfolio;
        filename = `kora-portfolio-${range}-${Date.now()}.csv`;
        break;
      case "yield":
        data = yieldData;
        filename = `kora-yield-${range}-${Date.now()}.csv`;
        break;
      case "risk":
        data = risk;
        filename = `kora-risk-${range}-${Date.now()}.csv`;
        break;
      case "monthly":
        data = monthly;
        filename = `kora-returns-${range}-${Date.now()}.csv`;
        break;
    }

    // Convert to CSV
    const headers = Object.keys(data[0] || {});
    const csv = [
      headers.join(","),
      ...data.map((row: any) => headers.map((h) => row[h]).join(",")),
    ].join("\n");

    // Download
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [portfolio, yieldData, risk, monthly, range]);

  const handleReset = useCallback(() => {
    setRange("30d");
  }, []);

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
                onClick={() => exportPdf("analytics-report", `kora-analytics-${new Date().toISOString().split("T")[0]}`)}
              >
                Export PDF
              </button>
              <PrintButton />
            </div>
          </div>

          {/* Filter bar */}
          <div className="mb-6 print:hidden">
            <AnalyticsFilterBar filters={filters} onChange={handleFiltersChange} />
          </div>

          {/* Stats */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
              >
                <StatCard {...stat} />
              </motion.div>
            ))}
          </div>

          {/* Charts */}
          <AnalyticsCharts
            portfolio={portfolio}
            yieldData={yieldData}
            monthly={monthly}
            risk={risk}
            isLoading={positionsQuery.isLoading}
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
