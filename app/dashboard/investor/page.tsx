"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Store,
  TrendingUp,
  DollarSign,
  BarChart3,
  Clock,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import dynamic from "next/dynamic";
const DataTable = dynamic<any>(
  () => import("@/components/ui/data-table").then((m) => m.DataTable),
  {
    ssr: false,
    loading: () => (
      <DashboardSkeleton statCount={4} tableRows={5} tableCols={9} />
    ),
  }
);
import { useWallet } from "@/hooks/useWallet";
import { useUIStore } from "@/store";
import { usePositions } from "@/hooks/usePositions";
import { useTransaction } from "@/hooks/useTransaction";
import { prepareClaimPosition } from "@/services/invoiceService";
import { RiskBadge } from "@/components/ui/badge";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, formatApr, RISK_TIER_COLORS, cn } from "@/lib/utils";
import type { ColumnDef } from "@/types/table";
import { ErrorBoundary } from "@/components/ui/error-boundary";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InvestorPosition {
  id: string;
  invoice: {
    id: string;
    metadata: { invoiceNumber: string; category: string; debtorName: string };
    terms: { apr: number; repaymentDate: string; discountRate: number };
    riskTier: string;
  };
  investedAmount: number;
  expectedReturn: number;
  yieldEarned: number;
  status: "active" | "repaid";
  claimed: boolean;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvestorDashboardPage() {
  const { isConnected, address } = useWallet();
  const { setWalletModalOpen } = useUIStore();
  const positionsQuery = usePositions(address ?? undefined, {
    refetchInterval: 30_000,
  });
  const { execute, status: txStatus } = useTransaction();

  // Optimistic "claimed" set — tracks IDs claimed in this session
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [isClaimingAll, setIsClaimingAll] = useState(false);

  // ─── Derived data ──────────────────────────────────────────────────────────

  const rawPositions = positionsQuery.data ?? [];

  const positions: InvestorPosition[] = useMemo(
    () =>
      rawPositions.map((p) => ({
        id: p.invoiceId,
        invoice: p.invoice as InvestorPosition["invoice"],
        investedAmount: p.investedAmount,
        expectedReturn: p.expectedReturn,
        yieldEarned: p.yieldEarned ?? 0,
        status: p.status as "active" | "repaid",
        claimed: claimedIds.has(p.invoiceId),
      })),
    [rawPositions, claimedIds]
  );

  const claimablePositions = positions.filter(
    (p) => p.status === "repaid" && !p.claimed
  );

  const totalInvested = positions.reduce((s, p) => s + p.investedAmount, 0);
  const totalExpected = positions.reduce((s, p) => s + p.expectedReturn, 0);
  const totalYield = totalExpected - totalInvested;
  const totalClaimed = positions
    .filter((p) => p.claimed)
    .reduce((s, p) => s + p.yieldEarned, 0);
  const avgApr =
    positions.length > 0
      ? positions.reduce((s, p) => s + p.invoice.terms.apr, 0) / positions.length
      : 0;

  // ─── Claim handlers ────────────────────────────────────────────────────────

  const handleClaim = async (pos: InvestorPosition) => {
    if (!address || pos.claimed) return;
    setClaimingId(pos.id);
    await execute(() => prepareClaimPosition(pos.id, address), {
      successMessage: `Claimed ${formatCurrency(pos.yieldEarned, "USDC", true)} yield`,
      onSuccess: () => {
        setClaimedIds((prev) => new Set(prev).add(pos.id));
        positionsQuery.refetch();
      },
    });
    setClaimingId(null);
  };

  const handleClaimAll = async () => {
    if (!address || claimablePositions.length === 0) return;
    setIsClaimingAll(true);
    for (const pos of claimablePositions) {
      setClaimingId(pos.id);
      // eslint-disable-next-line no-await-in-loop
      const hash = await execute(() => prepareClaimPosition(pos.id, address), {
        successMessage: `Claimed ${formatCurrency(pos.yieldEarned, "USDC", true)} from ${pos.invoice.metadata.invoiceNumber}`,
        onSuccess: () => {
          setClaimedIds((prev) => new Set(prev).add(pos.id));
        },
      });
      if (!hash) break; // stop on first failure
    }
    setClaimingId(null);
    setIsClaimingAll(false);
    positionsQuery.refetch();
  };

  // ─── Table columns ─────────────────────────────────────────────────────────

  const columns: ColumnDef<InvestorPosition>[] = [
    {
      id: "invoice",
      header: "Invoice",
      accessor: (row) => row.invoice.metadata.invoiceNumber,
      cell: (row) => (
        <div>
          <p className="font-medium text-foreground">
            {row.invoice.metadata.invoiceNumber}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.invoice.metadata.category}
          </p>
        </div>
      ),
    },
    {
      id: "debtor",
      header: "Debtor",
      accessor: (row) => row.invoice.metadata.debtorName,
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.invoice.metadata.debtorName}
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
      accessor: (row) => row.yieldEarned,
      cell: (row) => (
        <span className="text-primary">
          +{formatCurrency(row.yieldEarned || row.expectedReturn - row.investedAmount, "USDC", true)}
        </span>
      ),
    },
    {
      id: "apr",
      header: "APR",
      accessor: (row) => row.invoice.terms.apr,
      cell: (row) => (
        <span className="font-medium text-primary">
          {formatApr(row.invoice.terms.apr)}
        </span>
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
            RISK_TIER_COLORS[row.invoice.riskTier as keyof typeof RISK_TIER_COLORS]
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
      cell: (row) => {
        const isClaiming = claimingId === row.id;
        return (
          <div className="flex items-center gap-2">
            {row.status === "repaid" && !row.claimed && (
              <Button
                size="sm"
                onClick={() => handleClaim(row)}
                disabled={isClaiming || isClaimingAll}
              >
                {isClaiming ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Claim"
                )}
              </Button>
            )}
            {row.claimed && (
              <span className="flex items-center gap-1 text-xs text-success">
                <CheckCircle2 className="h-3 w-3" /> Claimed
              </span>
            )}
            <Link
              href={`/marketplace/${row.invoice.id}`}
              className="text-xs text-primary hover:opacity-80"
            >
              View →
            </Link>
          </div>
        );
      },
    },
  ];

  // ─── Not connected ─────────────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          Connect your wallet
        </h2>
        <p className="text-sm text-muted-foreground">
          Connect to view your investment portfolio
        </p>
        <Button onClick={() => setWalletModalOpen(true)}>Connect Wallet</Button>
      </div>
    );
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const stats = [
    {
      label: "Portfolio Value",
      value: formatCurrency(totalInvested, "USDC", true),
      change: `${positions.length} position${positions.length !== 1 ? "s" : ""}`,
      changePositive: true,
      icon: <DollarSign className="h-4 w-4" />,
    },
    {
      label: "Expected Yield",
      value: formatCurrency(totalYield, "USDC", true),
      change:
        totalInvested > 0
          ? `${((totalYield / totalInvested) * 100).toFixed(1)}% return`
          : "—",
      changePositive: true,
      icon: <TrendingUp className="h-4 w-4" />,
    },
    {
      label: "Total Claimed",
      value: formatCurrency(totalClaimed, "USDC", true),
      change:
        claimablePositions.length > 0
          ? `${claimablePositions.length} claimable`
          : "All claimed",
      changePositive: claimablePositions.length === 0,
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    {
      label: "Avg. APR",
      value: `${avgApr.toFixed(1)}%`,
      change: "Across all positions",
      changePositive: true,
      icon: <Clock className="h-4 w-4" />,
    },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Investor Dashboard
            </h1>
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Active Positions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
          <DataTable
            data={positionsData}
            columns={POSITION_COLUMNS}
            pageSize={5}
            emptyState={{
              title: "No positions",
              message: "Fund invoices on the marketplace to build your portfolio.",
              illustration: <BarChart3 className="h-10 w-10 text-muted-foreground" />,
            }}
          />
        </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Allocation by Risk Tier</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
            {Object.entries(
              POSITIONS.reduce<Record<string, number>>((acc, p) => {
                acc[p.invoice.riskTier] = (acc[p.invoice.riskTier] || 0) + p.investedAmount;
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
              POSITIONS.reduce<Record<string, number>>((acc, p) => {
                const j = p.invoice.metadata.jurisdiction;
                acc[j] = (acc[j] || 0) + p.investedAmount;
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
    </ErrorBoundary>
  );
}
