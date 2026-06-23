"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Store, TrendingUp, DollarSign, BarChart3, Clock, Coins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import dynamic from "next/dynamic";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import { useUIStore } from "@/store";
import { usePositions } from "@/hooks/usePositions";
import { useTransaction } from "@/hooks/useTransaction";
import { useTxSimulation } from "@/hooks/useTxSimulation";
import { TxSimulationPreview } from "@/components/invoice/TxSimulationPreview";
import { useMaturityReminder } from "@/hooks/useMaturityReminder";
import { prepareClaimPosition } from "@/services/invoiceService";
import { MOCK_INVOICES } from "@/services/mockData";
import { RiskBadge } from "@/components/ui/badge";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import {
  formatCurrency,
  formatDate,
  formatApr,
  RISK_TIER_COLORS,
  cn,
} from "@/lib/utils";
import type { ColumnDef } from "@/types/table";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { env } from "@/lib/env";
import {
  PortfolioDonut,
  type DonutFilter,
} from "@/components/dashboard/PortfolioDonut";
import type { InvoicePosition } from "@/types";

const DataTable = dynamic<any>(
  () => import("@/components/ui/data-table").then((m) => m.DataTable),
  {
    ssr: false,
    loading: () => <DashboardSkeleton statCount={4} tableRows={5} tableCols={9} />,
  }
);

// ─── Local position shape (matches DataTable expectations) ────────────────────

interface InvestorPosition {
  id: string;
  invoice: (typeof MOCK_INVOICES)[number];
  investedAmount: number;
  expectedReturn: number;
  status: "active" | "repaid";
}

// ─── Mock fallback ────────────────────────────────────────────────────────────

const POSITIONS: InvestorPosition[] = MOCK_INVOICES.slice(0, 4).map((inv, i) => ({
  id: inv.id,
  invoice: inv,
  investedAmount: [15000, 50000, 5000, 100000][i],
  expectedReturn: [15000, 50000, 5000, 100000][i] * (1 + inv.terms.discountRate),
  status: inv.status === "repaid" ? "repaid" : "active",
}));

const totalInvested = POSITIONS.reduce((s, p) => s + p.investedAmount, 0);
const totalExpected = POSITIONS.reduce((s, p) => s + p.expectedReturn, 0);
const totalYield = totalExpected - totalInvested;

const STATS = [
  {
    label: "Portfolio Value",
    value: formatCurrency(totalInvested, "USDC", true),
    valueRaw: totalInvested,
    change: "4 active positions",
    changePositive: true,
    icon: <DollarSign className="h-4 w-4" />,
  },
  {
    label: "Expected Yield",
    value: formatCurrency(totalYield, "USDC", true),
    valueRaw: totalYield,
    change: `${((totalYield / totalInvested) * 100).toFixed(1)}% return`,
    changePositive: true,
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    label: "Active Positions",
    value: POSITIONS.length.toString(),
    valueRaw: POSITIONS.length,
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    label: "Avg. APR",
    value: `${(POSITIONS.reduce((s, p) => s + p.invoice.terms.apr, 0) / POSITIONS.length).toFixed(1)}%`,
    valueRaw: Number(
      (POSITIONS.reduce((s, p) => s + p.invoice.terms.apr, 0) / POSITIONS.length).toFixed(1)
    ),
    change: "Across all positions",
    changePositive: true,
    icon: <Clock className="h-4 w-4" />,
  },
];

// ─── Drill-down filter helper ─────────────────────────────────────────────────

function applyDonutFilter(
  positions: InvestorPosition[],
  filter: DonutFilter | null
): InvestorPosition[] {
  if (!filter) return positions;
  return positions.filter((p) => {
    switch (filter.dimension) {
      case "riskTier":
        return p.invoice.riskTier === filter.value;
      case "jurisdiction":
        return p.invoice.metadata.jurisdiction === filter.value;
      case "category":
        return p.invoice.metadata.category === filter.value;
      default:
        return true;
    }
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvestorDashboardPage() {
  const { isConnected, address, fundWalletOnTestnet, refreshBalance } = useWallet();
  const { setWalletModalOpen } = useUIStore();
  const toast = useToast();
  const [isFunding, setIsFunding] = useState(false);
  const positionsQuery = usePositions(address ?? undefined, { refetchInterval: 30_000 });
  const { execute } = useTransaction();
  const { simulationDialogProps, onSimulationPreview } = useTxSimulation();

  // ── Donut drill-down state ──────────────────────────────────────────────────
  const [donutFilter, setDonutFilter] = useState<DonutFilter | null>(null);

  // ── Resolve positions ───────────────────────────────────────────────────────
  const rawPositions = positionsQuery.data;
  const positionsData: InvestorPosition[] = rawPositions
    ? rawPositions.map((p) => ({
        id: p.invoiceId,
        invoice: p.invoice,
        investedAmount: p.investedAmount,
        expectedReturn: p.expectedReturn,
        status: p.status as "active" | "repaid",
      }))
    : POSITIONS;

  // Positions after applying the donut filter (for the table)
  const filteredPositions = useMemo(
    () => applyDonutFilter(positionsData, donutFilter),
    [positionsData, donutFilter]
  );

  // Cast to InvoicePosition[] for PortfolioDonut (it needs the full invoice shape)
  const invoicePositions = positionsData as unknown as InvoicePosition[];

  useMaturityReminder(
    positionsData
      .filter((p) => p.status === "active")
      .map((p) => p.invoice)
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleClaim = async (pos: InvestorPosition) => {
    if (!address) return;
    await execute(() => prepareClaimPosition(pos.id, address), {
      successMessage: "Claim submitted",
      onSimulationPreview,
      onSuccess: () => positionsQuery.refetch(),
    });
  };

  const handleFundTestnetAccount = async () => {
    setIsFunding(true);
    const toastId = "dashboard-testnet-funding";
    try {
      toast.loading("Funding testnet account...", toastId);
      await fundWalletOnTestnet();
      await refreshBalance();
      toast.success("Testnet account funded with 10,000 XLM", undefined, toastId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fund testnet account";
      toast.error("Funding failed", message, undefined, toastId);
    } finally {
      setIsFunding(false);
    }
  };

  const handleSegmentClick = useCallback((filter: DonutFilter | null) => {
    setDonutFilter(filter);
  }, []);

  // ── Columns (defined inside component to access handleClaim) ────────────────

  const POSITION_COLUMNS: ColumnDef<InvestorPosition>[] = useMemo(
    () => [
      {
        id: "invoice",
        header: "Invoice",
        accessor: (row) => row.invoice.metadata.invoiceNumber,
        cell: (row) => (
          <div>
            <p className="font-medium text-foreground">{row.invoice.metadata.invoiceNumber}</p>
            <p className="text-xs text-muted-foreground">{row.invoice.metadata.category}</p>
          </div>
        ),
      },
      {
        id: "debtor",
        header: "Debtor",
        accessor: (row) => row.invoice.metadata.debtorName,
        cell: (row) => (
          <span className="text-muted-foreground">{row.invoice.metadata.debtorName}</span>
        ),
      },
      {
        id: "invested",
        header: "Invested",
        accessor: (row) => row.investedAmount,
        cell: (row) => (
          <span className="font-medium text-foreground">
            {formatCurrency(row.investedAmount, "USDC", true)}
          </span>
        ),
      },
      {
        id: "expected",
        header: "Expected Return",
        accessor: (row) => row.expectedReturn,
        cell: (row) => (
          <span className="font-medium text-success">
            {formatCurrency(row.expectedReturn, "USDC", true)}
          </span>
        ),
      },
      {
        id: "yield",
        header: "Yield",
        accessor: (row) => row.expectedReturn - row.investedAmount,
        cell: (row) => (
          <span className="text-primary">
            +{formatCurrency(row.expectedReturn - row.investedAmount, "USDC", true)}
          </span>
        ),
      },
      {
        id: "apr",
        header: "APR",
        accessor: (row) => row.invoice.terms.apr,
        cell: (row) => (
          <span className="font-medium text-primary">{formatApr(row.invoice.terms.apr)}</span>
        ),
      },
      {
        id: "risk",
        header: "Risk",
        accessor: (row) => row.invoice.riskTier,
        cell: (row) => (
          <span
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs font-semibold",
              RISK_TIER_COLORS[row.invoice.riskTier]
            )}
          >
            {row.invoice.riskTier}
          </span>
        ),
      },
      {
        id: "due",
        header: "Due Date",
        accessor: (row) => row.invoice.terms.repaymentDate,
        cell: (row) => (
          <span className="text-xs text-muted-foreground">
            {formatDate(row.invoice.terms.repaymentDate)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        sortable: false,
        cell: (row) => (
          <div className="flex items-center gap-2">
            {row.status === "repaid" ? (
              <Button size="sm" onClick={() => handleClaim(row)}>
                Claim
              </Button>
            ) : null}
            <Link
              href={`/marketplace/${row.invoice.id}`}
              className="text-xs text-primary hover:opacity-80"
            >
              View →
            </Link>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleClaim]
  );

  // ── Not connected guard ─────────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Connect your wallet</h2>
        <p className="text-sm text-muted-foreground">Connect to view your investment portfolio</p>
        <Button onClick={() => setWalletModalOpen(true)}>Connect Wallet</Button>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {/* Page header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Investor Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track your invoice financing portfolio
            </p>
          </div>
          <Link href="/marketplace">
            <Button variant="outline">
              <Store className="h-4 w-4" /> Browse Marketplace
            </Button>
          </Link>
        </div>

        {/* Stat cards */}
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

        {/* ── Portfolio Composition Donuts ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <PortfolioDonut
            positions={invoicePositions}
            activeFilter={donutFilter}
            onSegmentClick={handleSegmentClick}
          />
        </motion.div>

        {/* ── Positions table (filtered by donut selection) ─────────────────── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>
              {donutFilter
                ? `Positions — ${donutFilter.value}`
                : "Active Positions"}
            </CardTitle>
            {donutFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => setDonutFilter(null)}
              >
                Clear filter ×
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <DataTable
              data={filteredPositions}
              columns={POSITION_COLUMNS}
              pageSize={5}
              emptyState={{
                title: donutFilter ? "No matching positions" : "No positions",
                message: donutFilter
                  ? `No positions match the selected filter (${donutFilter.value}).`
                  : "Fund invoices on the marketplace to build your portfolio.",
                illustration: <BarChart3 className="h-10 w-10 text-muted-foreground" />,
                action:
                  !donutFilter && env.NEXT_PUBLIC_STELLAR_NETWORK === "testnet" ? (
                    <Button
                      onClick={handleFundTestnetAccount}
                      disabled={isFunding}
                      variant="outline"
                    >
                      {isFunding ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Coins className="h-4 w-4" />
                      )}
                      {isFunding ? "Funding..." : "Fund Testnet Account"}
                    </Button>
                  ) : undefined,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
}
