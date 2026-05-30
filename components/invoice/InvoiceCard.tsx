"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, Users, TrendingUp, MapPin, ArrowRight, Clock } from "lucide-react";
import { RiskBadge, Badge } from "@/components/ui/badge";
import { InvoiceFundingProgress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { fetchInvoiceById } from "@/services/invoiceService";
import {
  formatCurrency,
  formatApr,
  daysUntil,
  cn,
} from "@/lib/utils";
import { useCountdown, formatCountdown } from "@/hooks/useCountdown";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { DebtorDisplay } from "./DebtorDisplay";
import type { Invoice } from "@/types";

interface InvoiceCardProps {
  invoice: Invoice;
  index?: number;
  updatedAt?: number;
}

const JURISDICTION_FLAGS: Record<string, string> = {
  KE: "🇰🇪",
  NG: "🇳🇬",
  GH: "🇬🇭",
  ZA: "🇿🇦",
  US: "🇺🇸",
  EU: "🇪🇺",
  UK: "🇬🇧",
  GB: "🇬🇧",
};

const JURISDICTION_NAMES: Record<string, string> = {
  KE: "Kenya",
  NG: "Nigeria",
  GH: "Ghana",
  ZA: "South Africa",
  US: "United States",
  EU: "European Union",
  UK: "United Kingdom",
};

function getFlagEmoji(countryCode: string) {
  if (JURISDICTION_FLAGS[countryCode]) {
    return JURISDICTION_FLAGS[countryCode];
  }
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  try {
    return String.fromCodePoint(...codePoints);
  } catch {
    return "🌐";
  }
}

export function InvoiceCard({ invoice, index = 0, updatedAt }: InvoiceCardProps) {
  const { metadata, terms, funding, riskTier, status, listingExpiry } = invoice;
  const days = daysUntil(terms.repaymentDate);
  const flag = getFlagEmoji(metadata.jurisdiction);
  const countryName = JURISDICTION_NAMES[metadata.jurisdiction] || metadata.jurisdiction;
  const queryClient = useQueryClient();
  
  // Check if invoice is expired
  const countdown = useCountdown(listingExpiry);
  const isExpired = countdown.isExpired || status === "cancelled";

  const handleMouseEnter = () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.invoices.detail(invoice.id),
      queryFn: () => fetchInvoiceById(invoice.id),
      staleTime: 30000,
    });
  };

  return (
    <Link
      href={`/marketplace/${invoice.id}`}
      className={cn("block group relative h-full", isExpired && "opacity-60")}
      onMouseEnter={handleMouseEnter}
      role="article"
      aria-label={`Invoice for ${metadata.debtorName}, Amount: ${formatCurrency(metadata.amount, metadata.currency, true)}, Risk Tier: ${riskTier}, APR: ${formatApr(terms.apr)}`}
    >
      <motion.div
        layoutId={`invoice-card-${invoice.id}`}
        className={cn(
          "relative overflow-hidden rounded-xl border bg-card/60 p-5 backdrop-blur-sm transition-all duration-200 hover:bg-card hover:shadow-token-lg flex flex-col h-full justify-between",
          isExpired ? "border-muted bg-muted/30 hover:border-muted" : "border-border hover:border-border"
        )}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={!isExpired ? { y: -6 } : {}}
        transition={{ duration: 0.3, delay: index * 0.05 }}
      >
        <div>
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DebtorDisplay invoice={invoice} className="group-hover:text-primary transition-colors" />
              <p className="mt-1 truncate text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                {metadata.invoiceNumber}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5">
                <RiskBadge tier={riskTier} />
                <Badge variant="kora" className="font-semibold px-1.5 py-0.5 text-[10px]">
                  {formatApr(terms.apr)}
                </Badge>
                {isExpired && (
                  <Badge variant="secondary" className="font-semibold px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground">
                    Expired
                  </Badge>
                )}
              </div>
              <InvoiceStatusBadge status={status} />
            </div>
          </div>

          {/* Amount */}
          <div className="mt-4">
            <p className="text-2xl font-bold tracking-tight text-foreground">
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
              updatedAt={updatedAt}
            />
          </div>

          {/* Metrics */}
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
            <div>
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="h-3 w-3 text-primary" /> APR
              </p>
              <p className="mt-0.5 text-sm font-semibold text-primary">
                {formatApr(terms.apr)}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Calendar className="h-3 w-3 text-muted-foreground" /> Tenor
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {terms.tenor}d
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Users className="h-3 w-3 text-muted-foreground" /> Investors
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {funding.investorCount}
              </p>
            </div>
          </div>
        </div>

        <div>
          {/* Footer Info */}
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
              <span className="text-sm shrink-0" role="img" aria-label={countryName}>{flag}</span>
              <span className="truncate">{countryName} · {metadata.category}</span>
            </span>
            <span className={cn("text-xs flex items-center gap-1 shrink-0 font-medium", isExpired ? "text-muted-foreground" : "text-muted-foreground")}>
              {isExpired ? (
                <>
                  <Clock className="h-3 w-3" />
                  Expired
                </>
              ) : (
                <>
                  <Calendar className="h-3 w-3" />
                  {countdown.isExpired ? "Due" : formatCountdown(countdown)}
                </>
              )}
            </span>
          </div>

          {!isExpired && (status === "listed" || status === "partially_funded") ? (
            <Button size="sm" className="mt-4 w-full relative z-20" onClick={(e) => e.preventDefault()}>
              Fund Invoice
            </Button>
          ) : null}
        </div>

        {/* Hover overlay CTA */}
        <div className="absolute inset-0 bg-zinc-950/75 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 flex items-center justify-center pointer-events-none">
          <div className="bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-lg shadow-xl flex items-center gap-2 border border-primary/20 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 pointer-events-auto">
            View Details
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export function InvoiceCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-5 space-y-4 relative overflow-hidden flex flex-col justify-between h-full min-h-[320px]">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        </div>

        {/* Amount */}
        <div className="space-y-2 mt-5">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>

        {/* Progress */}
        <div className="space-y-2 mt-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-3 w-10" />
          </div>
          <Skeleton className="h-2 w-full" />
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3 border-t border-border pt-4 mt-5">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-4 w-12" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-4 w-8" />
          </div>
        </div>
      </div>

      <div>
        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border pt-4 mt-5">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-9 w-full mt-4" />
      </div>
    </div>
  );
}
