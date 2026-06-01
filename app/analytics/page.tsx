"use client";

import { motion } from "framer-motion";
import { useMemo, useState, useCallback } from "react";
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
import { useUIStore } from "@/store";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { cn } from "@/lib/utils";

// ── Mock analytics data ────────────────────────────────────────────────────────

const PORTFOLIO_HISTORY = [
  { month: "Jun", value: 0 },
  { month: "Jul", value: 25000 },
  { month: "Aug", value: 48000 },
  { month: "Sep", value: 72000 },
  { month: "Oct", value: 115000 },
  { month: "Nov", value: 170000 },
];

const YIELD_HISTORY = [
  { month: "Jun", yield: 0 },
  { month: "Jul", yield: 420 },
  { month: "Aug", yield: 890 },
  { month: "Sep", yield: 1540 },
  { month: "Oct", yield: 2800 },
  { month: "Nov", yield: 4200 },
];

const RISK_DISTRIBUTION = [
  { name: "AAA", value: 30, color: "#34d399" },
  { name: "AA", value: 45, color: "#14b8a6" },
  { name: "A", value: 20, color: "#22d3ee" },
  { name: "BBB", value: 5, color: "#fbbf24" },
];

const MONTHLY_RETURNS = [
  { month: "Jun", return: 0 },
  { month: "Jul", return: 1.68 },
  { month: "Aug", return: 1.85 },
  { month: "Sep", return: 2.14 },
  { month: "Oct", return: 2.43 },
  { month: "Nov", return: 2.47 },
];

const STATS = [
  {
    label: "Total Deployed",
    value: formatCurrency(170000, "USDC", true),
    valueRaw: 170000,
    change: "↑ $55K this month",
    changePositive: true,
    icon: <DollarSign className="h-4 w-4" />,
  },
  {
    label: "Total Yield Earned",
    value: formatCurrency(4200, "USDC", true),
    valueRaw: 4200,
    change: "2.47% avg monthly",
    changePositive: true,
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    label: "Annualised Return",
    value: "29.6%",
    change: "vs 4.2% T-bill",
    changePositive: true,
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    label: "Default Rate",
    value: "0.0%",
    valueRaw: 0,
    change: "All-time",
    changePositive: true,
    icon: <Shield className="h-4 w-4" />,
  },
];

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "#18181b",
    border: "1px solid #27272a",
    borderRadius: "8px",
    color: "#e4e4e7",
    fontSize: "12px",
  },
};

export default function PortfolioAnalyticsPage() {
  const { isConnected } = useWallet();
  const { setWalletModalOpen } = useUIStore();
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [isLoading, setIsLoading] = useState(false);

  // Simple date range filtering for mock data — in real app you'd slice by timestamps
  const portfolio = useMemo(() => PORTFOLIO_HISTORY, [range]);
  const yieldData = useMemo(() => YIELD_HISTORY, [range]);
  const risk = useMemo(() => RISK_DISTRIBUTION, [range]);
  const monthly = useMemo(() => MONTHLY_RETURNS, [range]);

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
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-foreground">Portfolio Analytics</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Performance overview of your invoice financing portfolio
          </p>
        </motion.div>

        {/* Controls */}
        <div className="mb-8">
          <AnalyticsControls
            range={range}
            onRangeChange={setRange}
            isLoading={isLoading}
            onExportPortfolio={() => handleExport("portfolio")}
            onExportYield={() => handleExport("yield")}
            onExportRisk={() => handleExport("risk")}
            onExportMonthly={() => handleExport("monthly")}
            onReset={handleReset}
          />
        </div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <StatCard {...stat} />
            </motion.div>
          ))}
        </motion.div>

        {/* Charts */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <AnalyticsCharts
            portfolio={portfolio}
            yieldData={yieldData}
            risk={risk}
            monthly={monthly}
            isLoading={isLoading}
            onExport={handleExport}
          />
        </motion.div>
      </div>
    </ErrorBoundary>
  );
}
