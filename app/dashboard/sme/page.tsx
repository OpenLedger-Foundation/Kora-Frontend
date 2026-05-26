"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PlusCircle, TrendingUp, FileText, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { DataTable } from "@/components/ui/data-table";
import { useWallet } from "@/hooks/useWallet";
import { useUIStore } from "@/store";
import { MOCK_INVOICES } from "@/services/mockData";
import {
  formatCurrency,
  formatDate,
  formatApr,
  STATUS_COLORS,
  cn,
} from "@/lib/utils";
import type { Invoice } from "@/types";
import type { ColumnDef } from "@/types/table";

const MY_INVOICES = MOCK_INVOICES.slice(0, 3);

const INVOICE_COLUMNS: ColumnDef<Invoice>[] = [
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
        <p className="text-xs text-muted-foreground">
          {Math.round(row.funding.fundingProgress * 100)}%
        </p>
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    accessor: (row) => row.status,
    cell: (row) => (
      <span className={cn("rounded-md px-2 py-0.5 text-xs capitalize", STATUS_COLORS[row.status])}>
        {row.status.replace(/_/g, " ")}
      </span>
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
    cell: (row) => (
      <Link href={`/marketplace/${row.id}`} className="text-xs text-primary hover:opacity-80">
        View →
      </Link>
    ),
  },
];

const STATS = [
  {
    label: "Total Financed",
    value: formatCurrency(
      MY_INVOICES.reduce((s, i) => s + i.funding.totalRaised, 0),
      "USDC",
      true
    ),
    change: "12.4% this month",
    changePositive: true,
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    label: "Active Invoices",
    value: MY_INVOICES.filter((i) =>
      ["listed", "partially_funded", "fully_funded"].includes(i.status)
    ).length.toString(),
    icon: <FileText className="h-4 w-4" />,
  },
  {
    label: "Pending Repayment",
    value: formatCurrency(
      MY_INVOICES.filter((i) => i.status === "fully_funded").reduce(
        (s, i) => s + i.metadata.amount,
        0
      ),
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

export default function SMEDashboardPage() {
  const { isConnected } = useWallet();
  const { setWalletModalOpen } = useUIStore();

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

  return (
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

      <Card>
        <CardHeader>
          <CardTitle>My Invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <DataTable
            data={MY_INVOICES}
            columns={INVOICE_COLUMNS}
            pageSize={5}
            enableSelection
            bulkActions={
              <Button type="button" variant="outline" size="sm">
                Export selected
              </Button>
            }
            emptyState={{
              title: "No invoices yet",
              message: "Create your first invoice to start raising liquidity.",
              illustration: <FileText className="h-10 w-10 text-muted-foreground" />,
            }}
          />
        </CardContent>
      </Card>

      {MY_INVOICES.some((i) => i.status === "fully_funded") && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/5 p-4"
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
  );
}
