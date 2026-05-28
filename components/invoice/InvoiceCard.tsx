"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, Users, TrendingUp, MapPin } from "lucide-react";
import { RiskBadge } from "@/components/ui/badge";
import { InvoiceFundingProgress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  formatCurrency,
  formatApr,
  daysUntil,
  STATUS_COLORS,
  cn,
} from "@/lib/utils";
import type { Invoice } from "@/types";

interface InvoiceCardProps {
  invoice: Invoice;
  index?: number;
}

export function InvoiceCard({ invoice, index = 0 }: InvoiceCardProps) {
  const { metadata, terms, funding, riskTier, status } = invoice;
  const days = daysUntil(terms.repaymentDate);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link href={`/marketplace/${invoice.id}`} className="block group">
        <div className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur-sm transition-all duration-200 hover:border-border hover:bg-card hover:shadow-token-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground group-hover:text-foreground">
                {metadata.debtorName}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {metadata.invoiceNumber}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <RiskBadge tier={riskTier} />
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs capitalize",
                  STATUS_COLORS[status]
                )}
              >
                {status.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {formatCurrency(metadata.amount, metadata.currency, true)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Financing {formatCurrency(terms.financingAmount, metadata.currency, true)}
            </p>
          </div>

          <div className="mt-4">
            <InvoiceFundingProgress
              funded={funding.totalRaised}
              target={funding.targetAmount}
              currency={metadata.currency}
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
            <div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" /> APR
              </p>
              <p className="mt-0.5 text-sm font-semibold text-primary">
                {formatApr(terms.apr)}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" /> Tenor
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {terms.tenor}d
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" /> Investors
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {funding.investorCount}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {metadata.jurisdiction} · {metadata.category}
            </span>
            <span className="text-xs text-muted-foreground">
              {days > 0 ? `${days}d left` : "Due"}
            </span>
          </div>

          {status === "listed" || status === "partially_funded" ? (
            <Button size="sm" className="mt-4 w-full" onClick={(e) => e.preventDefault()}>
              Fund Invoice
            </Button>
          ) : null}
        </div>
      </Link>
    </motion.div>
  );
}
