"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PlusCircle, TrendingUp, FileText, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { RepaymentDialog } from "@/components/invoice/RepaymentDialog";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
import type { DataTableProps } from "@/types/table";
const DataTable = dynamic<DataTableProps<Invoice>>(
  () => import("@/components/ui/data-table").then((m) => m.DataTable),
  { ssr: false, loading: () => <DashboardSkeleton statCount={4} tableRows={5} tableCols={8} /> }
);
import { useWallet } from "@/hooks/useWallet";
import { useSMEInvoices } from "@/hooks/useInvoices";
import { useTransaction } from "@/hooks/useTransaction";
import { useUsdcBalance } from "@/hooks/useUsdcBalance";
import { prepareRepayInvoice } from "@/services/invoiceService";
import { useUIStore } from "@/store";
import { MOCK_INVOICES } from "@/services/mockData";
import {
  formatCurrency,
  formatDate,
  formatApr,
  cn,
} from "@/lib/utils";
import { InvoiceStatusBadge } from "@/components/invoice/InvoiceStatusBadge";
import type { Invoice } from "@/types";
import type { ColumnDef } from "@/types/table";
import { ErrorBoundary } from "@/components/ui/error-boundary";


export default function SMEDashboardPage() {
  const { isConnected, address } = useWallet();
  const { setWalletModalOpen } = useUIStore();
  const invoicesQuery = useSMEInvoices(address ?? undefined);
  const { execute, status: txStatus } = useTransaction();
  const { data: usdcBalance = 0 } = useUsdcBalance(address ?? undefined);

  const [repayTarget, setRepayTarget] = useState<Invoice | null>(null);

  if (!isConnected) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Connect your wallet</h2>
        <p className="text-sm text-muted-foreground">Connect to view and manage your invoices</p>
        <Button onClick={() => setWalletModalOpen(true)}>Connect Wallet</Button>
      </div>
    );
  }
  const myInvoices: Invoice[] = (invoicesQuery.data || MOCK_INVOICES).filter(
    (inv: Invoice) => inv.ownerAddress === address
  );

  const STATS = [
    {
      label: "Total Financed",
      value: formatCurrency(
        myInvoices.reduce((s, i) => s + i.funding.totalRaised, 0),
        "USDC",
        true
      ),
      change: "12.4% this month",
      changePositive: true,
      icon: <TrendingUp className="h-4 w-4" />,
    },
    {
      label: "Active Invoices",
      value: myInvoices.filter((i) => ["listed", "partially_funded", "fully_funded"].includes(i.status)).length.toString(),
      icon: <FileText className="h-4 w-4" />,
    },
    {
      label: "Pending Repayment",
      value: formatCurrency(
        myInvoices.filter((i) => i.status === "fully_funded").reduce((s, i) => s + i.metadata.amount, 0),
        "USDC",
        true
      ),
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "Repayment Rate",
      value: "100%",
      change: "All-time",
      changePositive: true,
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
  ];

  const handleRepay = async (inv: Invoice) => {
    if (!address) return;
    await execute(() => prepareRepayInvoice(inv.tokenId, address), {
      successMessage: "Yield distributed to investors",
      onSuccess: () => {
        invoicesQuery.refetch();
        setRepayTarget(null);
      },
    });
  };

  return (
    <ErrorBoundary>
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SME Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your invoice financing</p>
        </div>
        <Link href="/invoice/create">
          <Button>
            <PlusCircle className="h-4 w-4" /> New Invoice
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>My Invoices</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
          <DataTable
            data={myInvoices}
            columns={(() => {
              const cols: ColumnDef<Invoice>[] = [
                {
                  id: "invoice",
                  header: "Invoice",
                  accessor: (row) => row.metadata.invoiceNumber,
                  cell: (row) => (
                    <div>
                      <p className="font-medium text-foreground">{row.metadata.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">{row.metadata.category}</p>
                    </div>
                  ),
                },
                {
                  id: "debtor",
                  header: "Debtor",
                  accessor: (row) => row.metadata.debtorName,
                  cell: (row) => <span className="text-muted-foreground">{row.metadata.debtorName}</span>,
                },
                {
                  id: "amount",
                  header: "Amount",
                  accessor: (row) => row.metadata.amount,
                  cell: (row) => (
                    <span className="font-medium text-foreground">
                      {formatCurrency(row.metadata.amount, row.metadata.currency, true)}
                    </span>
                  ),
                },
                {
                  id: "apr",
                  header: "APR",
                  accessor: (row) => row.terms.apr,
                  cell: (row) => <span className="font-medium text-primary">{formatApr(row.terms.apr)}</span>,
                },
                {
                  id: "progress",
                  header: "Progress",
                  accessor: (row) => row.funding.fundingProgress,
                  cell: (row) => (
                    <div className="w-32 space-y-1">
                      <Progress value={row.funding.fundingProgress * 100} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">{Math.round(row.funding.fundingProgress * 100)}%</p>
                    </div>
                  ),
                },
                {
                  id: "status",
                  header: "Status",
                  accessor: (row) => row.status,
                  cell: (row) => (
                    <InvoiceStatusBadge status={row.status} />
                  ),
                },
                {
                  id: "due",
                  header: "Due Date",
                  accessor: (row) => row.terms.repaymentDate,
                  cell: (row) => (
                    <span className="text-xs text-muted-foreground">{formatDate(row.terms.repaymentDate)}</span>
                  ),
                },
                {
                  id: "actions",
                  header: "",
                  sortable: false,
                  cell: (row) => {
                    const isDue = new Date(row.terms.repaymentDate) <= new Date();
                    const canRepay = row.status === "fully_funded" && isDue;
                    const canCancel = row.status === "listed" || row.status === "pending_mint";

                    return (
                      <div className="flex items-center gap-2">
                        {canRepay && (
                          <Button size="sm" onClick={() => setRepayTarget(row)}>
                            Repay
                          </Button>
                        )}
                        {canCancel && (
                          <Button size="sm" variant="ghost">
                            Cancel
                          </Button>
                        )}
                        <Link href={`/marketplace/${row.id}`} className="text-xs text-primary hover:opacity-80">
                          View →
                        </Link>
                      </div>
                    );
                  },
                },
              ];
              return cols;
            })()}
            pageSize={5}
            enableSelection
            bulkActions={
              <Button type="button" variant="outline" size="sm">
                Export selected
              </Button>
            }
            isLoading={invoicesQuery.isLoading}
            emptyState={{
              title: "No invoices yet",
              message: "Create your first invoice to start raising liquidity.",
              illustration: <FileText className="h-10 w-10 text-muted-foreground" />,
            }}
          />
        </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {myInvoices.some((i) => i.status === "fully_funded") && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/5 p-4"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium text-warning">Repayment Due Soon</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              You have invoices approaching their repayment date. Ensure sufficient USDC balance.
            </p>
          </div>
        </motion.div>
          )}
        </div>
      </div>

      <RepaymentDialog
        invoice={repayTarget}
        open={!!repayTarget}
        onOpenChange={(open) => { if (!open) setRepayTarget(null); }}
        onConfirm={handleRepay}
        isLoading={txStatus !== "idle" && txStatus !== "confirmed" && txStatus !== "failed"}
        insufficientBalance={
          !!repayTarget &&
          usdcBalance <
            repayTarget.funding.totalRaised * (1 + repayTarget.terms.discountRate)
        }
      />
    </div>
    </ErrorBoundary>
  );
}
