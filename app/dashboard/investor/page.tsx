"use client";

import { Suspense } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Store, TrendingUp, DollarSign, BarChart3, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import dynamic from "next/dynamic";
import type { DataTableProps } from "@/types/table";
const DataTable = dynamic<DataTableProps<InvestorPosition>>(
  () => import("@/components/ui/data-table").then((m) => m.DataTable),
  {
    ssr: false,
    loading: () => <div className="h-48 rounded bg-zinc-900/40" />,
  },
);
import { useWallet } from "@/hooks/useWallet";
import { useUIStore } from "@/store";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTransaction } from "@/hooks/useTransaction";
import { prepareClaimPosition } from "@/services/invoiceService";
import { RiskBadge } from "@/components/ui/badge";
import { getPositions } from "@/lib/stellar/contracts";
import {
  formatCurrency,
  formatDate,
  formatApr,
  RISK_TIER_COLORS,
  cn,
} from "@/lib/utils";
import type { InvestorPosition } from "@/types/invoice";
import type { ColumnDef } from "@/types/table";

// ─── Skeleton for portfolio while data loads ──────────────────────────────────

function PortfolioSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

// ─── Portfolio content — suspends until positions are loaded ──────────────────

function InvestorPortfolioSection({ address }: { address: string }) {
  const { execute } = useTransaction();

  const { data: positionsData = [] } = useSuspenseQuery<InvestorPosition[]>({
    queryKey: ["positions", address],
    queryFn: async () => {
      const positions = await getPositions(address);
      return positions.map((p) => ({
        id: p.invoiceId,
        invoiceId: p.invoiceId,
        invoice: p.invoice,
        investedAmount: p.investedAmount,
        expectedReturn: p.expectedReturn,
        status: p.status,
      }));
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const totalInvested = positionsData.reduce((sum, p) => sum + p.investedAmount, 0);
  const totalExpected = positionsData.reduce((sum, p) => sum + p.expectedReturn, 0);
  const totalYield = totalExpected - totalInvested;
  const averageApr = positionsData.length
    ? positionsData.reduce((sum, p) => sum + (p.invoice?.terms.apr ?? 0), 0) / positionsData.length
    : 0;

  const stats = [
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
      change:
        totalInvested > 0
          ? `${((totalYield / totalInvested) * 100).toFixed(1)}% return`
          : "0.0% return",
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
          <p className="font-medium text-foreground">
            {row.invoice?.metadata.invoiceNumber ?? `Invoice ${row.invoiceId}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.invoice?.metadata.category ?? "Unspecified"}
          </p>
        </div>
      ),
    },
    {
      id: "debtor",
      header: "Debtor",
      accessor: (row) => row.invoice?.metadata.debtorName ?? "Unknown debtor",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.invoice?.metadata.debtorName ?? "Unknown debtor"}
        </span>
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
          +
          {formatCurrency(
            row.expectedReturn - row.investedAmount,
            "USDC",
            true,
          )}
        </span>
      ),
    },
    {
      id: "apr",
      header: "APR",
      accessor: (row) => row.invoice?.terms.apr ?? 0,
      cell: (row) => (
        <span className="font-medium text-primary">
          {formatApr(row.invoice?.terms.apr ?? 0)}
        </span>
      ),
    },
    {
      id: "risk",
      header: "Risk",
      accessor: (row) => row.invoice?.riskTier ?? "AAA",
      cell: (row) => (
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-xs font-semibold",
            RISK_TIER_COLORS[row.invoice?.riskTier ?? "AAA"],
          )}
        >
          {row.invoice?.riskTier ?? "AAA"}
        </span>
      ),
    },
    {
      id: "due",
      header: "Due Date",
      accessor: (row) => row.invoice?.terms.repaymentDate ?? "",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(row.invoice?.terms.repaymentDate ?? "")}
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
            <Button size="sm" onClick={() => execute(() => prepareClaimPosition(row.id, address), { successMessage: "Claim submitted" })}>
              Claim
            </Button>
          ) : null}
          <Link
            href={`/marketplace/${row.invoice?.id ?? row.invoiceId}`}
            className="text-xs text-primary hover:opacity-80"
          >
            View →
          </Link>
        </div>
      ),
    },
  ];

  return (
    <>
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

      <Card>
        <CardHeader>
          <CardTitle>Active Positions</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <DataTable
            data={positionsData}
            columns={POSITION_COLUMNS}
            isLoading={false}
            pageSize={5}
            emptyState={{
              title: "No positions",
              message:
                "Fund invoices on the marketplace to build your portfolio.",
              illustration: (
                <BarChart3 className="h-10 w-10 text-muted-foreground" />
              ),
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
              positionsData.reduce<Record<string, number>>((acc, p) => {
                const tier = p.invoice?.riskTier ?? "AAA";
                acc[tier] = (acc[tier] || 0) + p.investedAmount;
                return acc;
              }, {}),
            ).map(([tier, amount]) => (
              <div key={tier} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <RiskBadge tier={tier as import("@/components/ui/badge").AnyRiskTier} />
                  <span className="text-muted-foreground">{formatCurrency(amount, "USDC", true)}</span>
                </div>
                <Progress
                  value={(amount / totalInvested) * 100}
                  className="h-1.5"
                />
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
              positionsData.reduce<Record<string, number>>((acc, p) => {
                const jurisdiction = p.invoice?.metadata.jurisdiction ?? "OTHER";
                acc[jurisdiction] = (acc[jurisdiction] || 0) + p.investedAmount;
                return acc;
              }, {}),
            ).map(([jurisdiction, amount]) => (
              <div key={jurisdiction} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">{jurisdiction}</span>
                  <span className="text-muted-foreground">{formatCurrency(amount, "USDC", true)}</span>
                </div>
                <Progress value={(amount / totalInvested) * 100} className="h-1.5" indicatorClassName="bg-info" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function InvestorDashboardPage() {
  const { isConnected, address } = useWallet();
  const { setWalletModalOpen } = useUIStore();

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

      {address && (
        <Suspense fallback={<PortfolioSkeleton />}>
          <InvestorPortfolioSection address={address} />
        </Suspense>
      )}
    </div>
  );
}
