"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Store, TrendingUp, DollarSign, BarChart3, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import dynamic from "next/dynamic";
const DataTable = dynamic(() => import("@/components/ui/data-table").then((m) => m.DataTable), {
  ssr: false,
  loading: () => <div className="h-48 rounded bg-zinc-900/40" />,
});
import { useWallet } from "@/hooks/useWallet";
import { useUIStore } from "@/store";
import { usePositions } from "@/hooks/usePositions";
import { useTransaction } from "@/hooks/useTransaction";
import { prepareClaimPosition } from "@/services/invoiceService";
import { RiskBadge } from "@/components/ui/badge";
import {
  formatCurrency,
  formatDate,
  formatApr,
  RISK_TIER_COLORS,
  cn,
} from "@/lib/utils";
import type { InvestorPosition } from "@/types/invoice";
import type { ColumnDef } from "@/types/table";

export default function InvestorDashboardPage() {
  const { isConnected } = useWallet();
  const { setWalletModalOpen } = useUIStore();
  const { address } = useWallet();
  const positionsQuery = usePositions(address ?? undefined, { refetchInterval: 30_000 });
  const { execute } = useTransaction();

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

  const handleClaim = async (pos: InvestorPosition) => {
    if (!address) return;
    await execute(() => prepareClaimPosition(pos.id, address), {
      successMessage: "Claim submitted",
      onSuccess: () => positionsQuery.refetch(),
    });
  };

  const positionsData: InvestorPosition[] = positionsQuery.data ?? [];
  const totalInvested = positionsData.reduce((sum, position) => sum + position.investedAmount, 0);
  const totalExpected = positionsData.reduce((sum, position) => sum + position.expectedReturn, 0);
  const totalYield = totalExpected - totalInvested;
  const averageApr = positionsData.length
    ? positionsData.reduce((sum, position) => sum + (position.invoice?.terms.apr ?? 0), 0) / positionsData.length
    : 0;

  const STATS = [
    {
      label: "Portfolio Value",
      value: formatCurrency(totalInvested, "USDC", true),
      change: `${positionsData.length} ${positionsData.length === 1 ? "position" : "positions"}`,
      changePositive: true,
      icon: <DollarSign className="h-4 w-4" />,
    },
    {
      label: "Expected Yield",
      value: formatCurrency(totalYield, "USDC", true),
      change: totalInvested > 0 ? `${((totalYield / totalInvested) * 100).toFixed(1)}% return` : "0.0% return",
      changePositive: true,
      icon: <TrendingUp className="h-4 w-4" />,
    },
    {
      label: "Active Positions",
      value: positionsData.length.toString(),
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      label: "Avg. APR",
      value: `${averageApr.toFixed(1)}%`,
      change: "Across all positions",
      changePositive: true,
      icon: <Clock className="h-4 w-4" />,
    },
  ];

  const POSITION_COLUMNS: ColumnDef<InvestorPosition>[] = [
    {
      id: "invoice",
      header: "Invoice",
      accessor: (row) => row.invoice?.metadata.invoiceNumber ?? row.invoiceId,
      cell: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.invoice?.metadata.invoiceNumber ?? `Invoice ${row.invoiceId}`}</p>
          <p className="text-xs text-muted-foreground">{row.invoice?.metadata.category ?? "Unspecified"}</p>
        </div>
      ),
    },
    {
      id: "debtor",
      header: "Debtor",
      accessor: (row) => row.invoice?.metadata.debtorName ?? "Unknown debtor",
      cell: (row) => <span className="text-muted-foreground">{row.invoice?.metadata.debtorName ?? "Unknown debtor"}</span>,
    },
    {
      id: "invested",
      header: "Invested",
      accessor: (row) => row.investedAmount,
      cell: (row) => (
        <span className="font-medium text-foreground">{formatCurrency(row.investedAmount, "USDC", true)}</span>
      ),
    },
    {
      id: "expected",
      header: "Expected Return",
      accessor: (row) => row.expectedReturn,
      cell: (row) => (
        <span className="font-medium text-success">{formatCurrency(row.expectedReturn, "USDC", true)}</span>
      ),
    },
    {
      id: "yield",
      header: "Yield",
      accessor: (row) => row.expectedReturn - row.investedAmount,
      cell: (row) => <span className="text-primary">+{formatCurrency(row.expectedReturn - row.investedAmount, "USDC", true)}</span>,
    },
    {
      id: "apr",
      header: "APR",
      accessor: (row) => row.invoice?.terms.apr ?? 0,
      cell: (row) => <span className="font-medium text-primary">{formatApr(row.invoice?.terms.apr ?? 0)}</span>,
    },
    {
      id: "risk",
      header: "Risk",
      accessor: (row) => row.invoice?.riskTier ?? "AAA",
      cell: (row) => (
        <span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold", RISK_TIER_COLORS[row.invoice?.riskTier ?? "AAA"])}>
          {row.invoice?.riskTier ?? "AAA"}
        </span>
      ),
    },
    {
      id: "due",
      header: "Due Date",
      accessor: (row) => row.invoice?.terms.repaymentDate ?? "",
      cell: (row) => <span className="text-xs text-muted-foreground">{formatDate(row.invoice?.terms.repaymentDate ?? "")}</span>,
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
          <Link href={`/marketplace/${row.invoice?.id ?? row.invoiceId}`} className="text-xs text-primary hover:opacity-80">
            View →
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Investor Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track your invoice financing portfolio</p>
        </div>
        <Link href="/marketplace">
          <Button variant="outline">
            <Store className="h-4 w-4" /> Browse Marketplace
          </Button>
        </Link>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Active Positions</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <DataTable
            data={positionsData}
            columns={POSITION_COLUMNS}
            isLoading={positionsQuery.isLoading}
            pageSize={5}
            emptyState={{
              title: "No positions",
              message: "Fund invoices on the marketplace to build your portfolio.",
              illustration: <BarChart3 className="h-10 w-10 text-muted-foreground" />,
            }}
          />
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Allocation by Risk Tier</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(
              positionsData.reduce<Record<string, number>>((acc, position) => {
                const tier = position.invoice?.riskTier ?? "AAA";
                acc[tier] = (acc[tier] || 0) + position.investedAmount;
                return acc;
              }, {})
            ).map(([tier, amount]) => (
              <div key={tier} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <RiskBadge tier={tier as import("@/components/ui/badge").AnyRiskTier} />
                  <span className="text-muted-foreground">
                    {formatCurrency(amount, "USDC", true)}
                  </span>
                </div>
                <Progress value={(amount / totalInvested) * 100} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Allocation by Jurisdiction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(
              positionsData.reduce<Record<string, number>>((acc, position) => {
                const jurisdiction = position.invoice?.metadata.jurisdiction ?? "OTHER";
                acc[jurisdiction] = (acc[jurisdiction] || 0) + position.investedAmount;
                return acc;
              }, {})
            ).map(([jurisdiction, amount]) => (
              <div key={jurisdiction} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">{jurisdiction}</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(amount, "USDC", true)}
                  </span>
                </div>
                <Progress
                  value={(amount / totalInvested) * 100}
                  className="h-1.5"
                  indicatorClassName="bg-info"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
