"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
const Charts = dynamic(() => import("@/components/analytics/Charts"), {
  ssr: false,
  loading: () => <AnalyticsSkeleton />,
});
import { TrendingUp, DollarSign, BarChart3, Shield } from "lucide-react";
import { AnalyticsSkeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { useWallet } from "@/hooks/useWallet";
import { useUIStore } from "@/store";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { exportCsv } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ui/error-boundary";

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

  // Simple date range filtering for mock data — in real app you'd slice by timestamps
  const portfolio = useMemo(() => PORTFOLIO_HISTORY, [range]);
  const yieldData = useMemo(() => YIELD_HISTORY, [range]);
  const risk = useMemo(() => RISK_DISTRIBUTION, [range]);
  const monthly = useMemo(() => MONTHLY_RETURNS, [range]);

  if (!isConnected) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800">
          <BarChart3 className="h-6 w-6 text-zinc-500" />
        </div>
        <h2 className="text-xl font-semibold text-zinc-100">Connect your wallet</h2>
        <p className="text-sm text-zinc-500">Connect to view your portfolio analytics</p>
        <Button onClick={() => setWalletModalOpen(true)}>Connect Wallet</Button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-100">Portfolio Analytics</h1>
          <p className="mt-1 text-sm text-zinc-500">Performance overview of your invoice financing portfolio</p>
        </div>

      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Range:</span>
          {(["7d", "30d", "90d", "all"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2 py-1 text-sm ${range === r ? "bg-zinc-700 text-white" : "text-zinc-400"}`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-md bg-zinc-800 px-3 py-1 text-sm text-zinc-200"
            onClick={() => exportCsv(portfolio as any, "portfolio.csv")}
          >
            Export Portfolio CSV
          </button>
          <button
            className="rounded-md bg-zinc-800 px-3 py-1 text-sm text-zinc-200"
            onClick={() => exportCsv(yieldData as any, "yield.csv")}
          >
            Export Yield CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat, i) => (
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

      {/* Charts row 1 */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Charts portfolio={PORTFOLIO_HISTORY} yieldData={YIELD_HISTORY} monthly={MONTHLY_RETURNS} risk={RISK_DISTRIBUTION} />
      </div>

      <Charts portfolio={PORTFOLIO_HISTORY} yieldData={YIELD_HISTORY} monthly={MONTHLY_RETURNS} risk={RISK_DISTRIBUTION} compact />
    </div>
    </ErrorBoundary>
  );
}
