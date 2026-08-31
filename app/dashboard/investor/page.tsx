"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Store, TrendingUp, DollarSign, BarChart3, Clock, AlertTriangle, Tag } from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { useWallet } from "@/hooks/useWallet";
import { useFormatters } from "@/hooks/useFormatters";
import { useUIStore, useInvoiceStore, usePositionListingStore, DEFAULT_FILTERS } from "@/store";
import { usePositions } from "@/hooks/usePositions";
import { ConcentrationRiskAlerts } from "@/components/analytics/ConcentrationRiskAlerts";
import { useTransaction } from "@/hooks/useTransaction";
import { useTxSimulation } from "@/hooks/useTxSimulation";
import { useVerifiedAction } from "@/hooks/useVerifiedAction";
import { useToast } from "@/hooks/useToast";
import { useTranslations } from "next-intl";
import { TxSimulationPreview } from "@/components/invoice/TxSimulationPreview";
import { prepareClaimPosition } from "@/services/invoiceService";
import { ListPositionDialog } from "@/components/invoice/ListPositionDialog";
import type { PortfolioDonutProps, DonutFilter } from "@/components/dashboard/PortfolioDonut";
import {
  marketplacePathForAllocation,
  allocationToMarketplaceFilters,
} from "@/lib/portfolioAllocation";
import {
  RISK_TIER_COLORS,
  cn,
} from "@/lib/utils";
import type { InvestorPosition, InvoicePosition } from "@/types/invoice";
import { computeImpliedDiscount } from "@/types/invoice";
import type { ColumnDef, DataTableProps } from "@/types/table";
import { InvestorDashboardSkeleton } from "@/components/ui/skeleton";
import { KycStatusCard } from "@/components/dashboard/KycStatusCard";
import { StaleDataBadge } from "@/components/layout/StaleDataBadge";
import { SellerAnalyticsDashboard } from "@/components/analytics/SellerAnalyticsDashboard";

const DataTable = dynamic<DataTableProps<InvestorPosition>>(
  () => import("@/components/ui/data-table").then((m) => m.DataTable),
  {
    ssr: false,
    loading: () => <div className="h-48 rounded bg-zinc-900/40" aria-busy="true" />,
  },
);

const PortfolioDonut = dynamic<PortfolioDonutProps>(
  () => import("@/components/dashboard/PortfolioDonut").then((m) => m.PortfolioDonut),
  {
    ssr: false,
    loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-zinc-900/40 border border-zinc-800" />,
  },
);

/** Loading must resolve within 30s or we surface an error state. */
const INVESTOR_DASHBOARD_LOAD_TIMEOUT_MS = 30_000;

function toInvoicePositions(positions: InvestorPosition[]): InvoicePosition[] {
  return positions
    .filter((p): p is InvestorPosition & { invoice: NonNullable<InvestorPosition["invoice"]> } =>
      Boolean(p.invoice),
    )
    .map((p) => ({
      invoiceId: p.invoiceId,
      invoice: p.invoice,
      investedAmount: p.investedAmount,
      expectedReturn: p.expectedReturn,
      yieldEarned: Math.max(0, p.expectedReturn - p.investedAmount),
      investedAt: p.invoice.createdAt,
      status: p.status,
    }));
}

export default function InvestorDashboardPage() {
  const { isConnected, address } = useWallet();
  const { setWalletModalOpen } = useUIStore();
  const t = useTranslations("investorDashboard");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { setFilters, resetFilters } = useInvoiceStore();
  const { formatCurrency, formatDate, formatApr, formatPercentage } = useFormatters();
  const positionsQuery = usePositions(address ?? undefined, {
    refetchInterval: 30_000,
  });
  const { execute } = useTransaction();
  const { simulationDialogProps, onSimulationPreview } = useTxSimulation();
  const { executeProtectedAction } = useVerifiedAction();
  const toast = useToast();
  const [donutFilter, setDonutFilter] = useState<DonutFilter | null>(null);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [listingTarget, setListingTarget] = useState<InvestorPosition | null>(null);
  const { listings, listPosition, unlistPosition } = usePositionListingStore();

  const positionsData: InvestorPosition[] = useMemo(
    () => positionsQuery.data ?? [],
    [positionsQuery.data],
  );
  const isInitialLoading =
    positionsQuery.isLoading || (positionsQuery.isFetching && !positionsQuery.data);

  const donutPositions = useMemo(
    () => toInvoicePositions(positionsData),
    [positionsData],
  );

  const filteredPositions = useMemo(() => {
    if (!donutFilter) return positionsData;
    return positionsData.filter((pos) => {
      const inv = pos.invoice;
      if (!inv) return false;
      switch (donutFilter.dimension) {
        case "riskTier":
          return inv.riskTier === donutFilter.value;
        case "jurisdiction":
          return inv.metadata.jurisdiction === donutFilter.value;
        case "category":
          return inv.metadata.category === donutFilter.value;
        default:
          return true;
      }
    });
  }, [positionsData, donutFilter]);

  const handleSegmentClick = useCallback(
    (filter: DonutFilter | null) => {
      setDonutFilter(filter);
      if (!filter) {
        resetFilters();
        return;
      }
      resetFilters();
      setFilters({
        ...DEFAULT_FILTERS,
        ...allocationToMarketplaceFilters(filter),
      });
      router.push(marketplacePathForAllocation(filter));
    },
    [resetFilters, setFilters, router],
  );

  useEffect(() => {
    if (!isConnected || !isInitialLoading || loadTimedOut) return;

    const id = window.setTimeout(() => {
      setLoadTimedOut(true);
    }, INVESTOR_DASHBOARD_LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(id);
  }, [isConnected, isInitialLoading, loadTimedOut]);

  useEffect(() => {
    if (positionsQuery.isSuccess || positionsQuery.isError) {
      setLoadTimedOut(false);
    }
  }, [positionsQuery.isSuccess, positionsQuery.isError]);

  /**
   * Claiming yield moves funds, so it sits behind the same verification session
   * SME repayment does (#681). Previously this called `execute` directly, which
   * meant an expired session reached the signing prompt with no re-verification
   * step in between.
   */
  const handleClaim = async (pos: InvestorPosition) => {
    if (!address) return;

    const runClaim = async () => {
      await execute(() => prepareClaimPosition(pos.id, address), {
        successMessage: "Claim submitted",
        // Yield claims are the "yield available" notification channel, not the
        // generic tx one — muting that preference must mute this too.
        successNotificationType: "yieldAvailable",
        onSimulationPreview,
        onSuccess: () => positionsQuery.refetch(),
        // Without this the failure toast's retry only clears the error; the
        // investor still has an unclaimed position and no way back to it.
        onRetry: () => {
          void handleClaim(pos);
        },
      });
    };

    const result = await executeProtectedAction(runClaim, "claim");

    // `requiresVerification` comes back only when no VerificationProvider is in
    // the tree to raise the modal — surface the reason rather than failing mute.
    if (result.requiresVerification) {
      toast.error(
        "Verification required",
        "Verify wallet ownership to claim your yield.",
        () => {
          void handleClaim(pos);
        }
      );
      return;
    }

    if (result.error && result.error !== "Wallet not connected") {
      toast.error("Claim failed", result.error, () => {
        void handleClaim(pos);
      });
    }
  };

  const handleListSubmit = (askPrice: number) => {
    if (!listingTarget) return;
    listPosition({
      positionId: listingTarget.id,
      askPrice,
      impliedDiscount: computeImpliedDiscount(askPrice, listingTarget.expectedReturn),
      listedAt: new Date().toISOString(),
      invoiceTokenId: listingTarget.invoice?.tokenId,
      repaymentDate: listingTarget.invoice?.terms.repaymentDate,
      ownershipConfirmed: true,
    });
    setListingTarget(null);
  };

  const listedPositions = positionsData.filter((pos) => listings[pos.id]);

  if (!isConnected) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          {t("connectTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("connectDesc")}
        </p>
        <Button onClick={() => setWalletModalOpen(true)}>{tCommon("connectWallet")}</Button>
      </div>
    );
  }

  if (loadTimedOut || positionsQuery.isError) {
    return (
      <div
        className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          Unable to load portfolio
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {loadTimedOut
            ? "Loading took longer than 30 seconds. Check your connection and try again."
            : "Something went wrong while fetching your positions."}
        </p>
        <Button
          onClick={() => {
            setLoadTimedOut(false);
            void positionsQuery.refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (isInitialLoading) {
    return <InvestorDashboardSkeleton />;
  }

  const totalInvested = positionsData.reduce(
    (sum, position) => sum + position.investedAmount,
    0,
  );
  const totalExpected = positionsData.reduce(
    (sum, position) => sum + position.expectedReturn,
    0,
  );
  const totalYield = totalExpected - totalInvested;
  const averageApr = positionsData.length
    ? positionsData.reduce(
        (sum, position) => sum + (position.invoice?.terms.apr ?? 0),
        0,
      ) / positionsData.length
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
      id: "listing",
      header: "Listing",
      sortable: false,
      cell: (row) =>
        listings[row.id] ? (
          <Badge variant="kora">
            <Tag className="mr-1 h-3 w-3" aria-hidden />
            Listed · {formatCurrency(listings[row.id].askPrice, "USDC", true)}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
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
          {row.status === "active" &&
            (listings[row.id] ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => unlistPosition(row.id)}
              >
                Unlist
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setListingTarget(row)}
              >
                <Tag className="h-3.5 w-3.5" /> List for Sale
              </Button>
            ))}
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
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-busy="false">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
          <StaleDataBadge
            updatedAt={positionsQuery.dataUpdatedAt || null}
            className="mt-2"
          />
        </div>
        <Link href="/marketplace">
          <Button variant="outline">
            <Store className="h-4 w-4" /> Browse Marketplace
          </Button>
        </Link>
      </div>

      <KycStatusCard />

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

      {/* Issue #604: the donut shows how the portfolio splits; this says when a
          split has become a risk. Sits directly above it so the warning and the
          chart it refers to are read together. */}
      <ConcentrationRiskAlerts className="mb-6" positions={donutPositions} />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="mb-8"
      >
        <PortfolioDonut
          positions={donutPositions}
          activeFilter={donutFilter}
          onSegmentClick={handleSegmentClick}
        />
      </motion.div>

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
            columns={POSITION_COLUMNS as any}
            isLoading={false}
            pageSize={5}
            emptyState={{
              title: donutFilter ? "No matching positions" : t("empty.title"),
              message: donutFilter
                ? `No positions match the selected filter (${donutFilter.value}).`
                : t("empty.message"),
              illustration: (
                <BarChart3 className="h-10 w-10 text-muted-foreground" />
              ),
            }}
          />
        </CardContent>
      </Card>
      

      {listedPositions.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" aria-hidden />
              Active Listings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-3">
              {listedPositions.map((pos) => {
                const listing = listings[pos.id];
                if (!listing) return null;
                const currency = pos.invoice?.metadata.currency ?? "USDC";
                return (
                  <div
                    key={pos.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {pos.invoice?.metadata.invoiceNumber ?? `Invoice ${pos.invoiceId}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Listed {formatDate(listing.listedAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        {formatCurrency(listing.askPrice, currency)}
                      </p>
                      <p
                        className={cn(
                          "text-xs",
                          listing.impliedDiscount >= 0 ? "text-success" : "text-warning",
                        )}
                      >
                        {(listing.impliedDiscount * 100).toFixed(2)}% implied discount
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => unlistPosition(pos.id)}
                    >
                      Unlist
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <ListPositionDialog
        position={listingTarget}
        open={listingTarget !== null}
        onOpenChange={(open) => !open && setListingTarget(null)}
        onSubmit={handleListSubmit}
      />

      {/* Seller analytics (#593) — shown whenever the investor has active listings */}
      {listedPositions.length > 0 && (
        <SellerAnalyticsDashboard
          listings={Object.values(listings)}
          positions={positionsData}
          className="mt-8"
        />
      )}

      <TxSimulationPreview {...simulationDialogProps} />
    </div>
  );
}
