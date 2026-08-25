"use client";

/**
 * SimilarInvoices
 * ===============
 * Recommendation carousel rendered at the bottom of the invoice detail page.
 * Shows 3–6 investable invoices most similar to the one currently being viewed,
 * ranked by a composite similarity score (category 30 %, risk tier 25 %,
 * APR band 25 %, tenor band 20 %).
 *
 * Gracefully degrades:
 * - Renders a skeleton grid while the query is in-flight.
 * - Renders an accessible empty-state when no similar invoices are found.
 * - Works entirely offline against the cached/mock invoice list.
 */

import Link from "next/link";
import { motion } from "framer-motion";
import { TrendingUp, Calendar, Sparkles, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, RiskBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceFundingProgress } from "@/components/ui/progress";
import { useSimilarInvoices } from "@/hooks/useInvoices";
import { formatCurrency, formatApr, daysUntil, cn } from "@/lib/utils";
import type { SimilarInvoice } from "@/lib/comparison";

// ─── Props ────────────────────────────────────────────────────────────────────

interface SimilarInvoicesProps {
  /** ID of the invoice currently being viewed (reference). */
  referenceId: string;
  /** Maximum cards to show. Defaults to 6. Must be between 3 and 6. */
  maxResults?: number;
}

// ─── Individual Card ──────────────────────────────────────────────────────────

interface SimilarInvoiceCardProps {
  item: SimilarInvoice;
  index: number;
}

function SimilarInvoiceCard({ item, index }: SimilarInvoiceCardProps) {
  const { invoice, similarity } = item;
  const { metadata, terms, funding, riskTier } = invoice;
  const days = daysUntil(terms.repaymentDate);
  const scorePercent = Math.round(similarity.score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="h-full"
    >
      <Link
        href={`/marketplace/${invoice.id}`}
        className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kora-400 rounded-xl"
        aria-label={`Similar invoice: ${metadata.debtorName}, ${formatApr(terms.apr)}, Risk tier ${riskTier}, ${scorePercent}% match`}
      >
        <div className="relative flex h-full flex-col rounded-xl border border-border bg-card/60 p-4 backdrop-blur-sm transition-all duration-200 hover:border-kora-400/40 hover:bg-card hover:shadow-lg hover:-translate-y-1">
          {/* Similarity badge */}
          <div className="absolute right-3 top-3">
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-kora-500/15 px-2 py-0.5 text-[10px] font-semibold text-kora-300 ring-1 ring-kora-500/20"
              title={`Similarity score: ${scorePercent}%`}
            >
              <Sparkles className="h-2.5 w-2.5" />
              {scorePercent}%
            </span>
          </div>

          {/* Header */}
          <div className="mb-3 pr-12">
            <p className="truncate text-sm font-semibold text-foreground group-hover:text-kora-300 transition-colors">
              {metadata.debtorName}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {metadata.invoiceNumber}
            </p>
          </div>

          {/* Amount */}
          <p className="text-lg font-bold tracking-tight text-foreground">
            {formatCurrency(metadata.amount, metadata.currency, true)}
          </p>

          {/* Funding progress */}
          <div className="mt-3">
            <InvoiceFundingProgress
              funded={funding.totalRaised}
              target={funding.targetAmount}
              currency={metadata.currency}
            />
          </div>

          {/* Key metrics */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <RiskBadge tier={riskTier} />
            <Badge variant="kora" className="text-[10px] font-semibold px-1.5 py-0.5">
              {formatApr(terms.apr)}
            </Badge>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {terms.tenor}d tenor
            </span>
          </div>

          {/* Score breakdown tooltip-style row */}
          <div className="mt-auto pt-3 border-t border-border grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-2.5 w-2.5 text-kora-400" />
              APR band{" "}
              <span className="ml-auto font-semibold text-zinc-400">
                {Math.round(similarity.dimensions.aprBand * 100)}%
              </span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-kora-500/40 inline-block" />
              Category{" "}
              <span className="ml-auto font-semibold text-zinc-400">
                {Math.round(similarity.dimensions.category * 100)}%
              </span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-zinc-500/40 inline-block" />
              Risk tier{" "}
              <span className="ml-auto font-semibold text-zinc-400">
                {Math.round(similarity.dimensions.riskTier * 100)}%
              </span>
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" />
              Tenor{" "}
              <span className="ml-auto font-semibold text-zinc-400">
                {Math.round(similarity.dimensions.tenorBand * 100)}%
              </span>
            </span>
          </div>

          {/* Hover CTA hint */}
          <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-b-xl bg-gradient-to-r from-kora-500/0 via-kora-500/60 to-kora-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SimilarInvoicesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Loading similar invoices"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card/60 p-4 space-y-3"
        >
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-1/3" />
          <div className="space-y-1">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-2 w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center"
      role="status"
      aria-label="No similar invoices found"
    >
      <Sparkles className="mb-3 h-8 w-8 text-zinc-600" aria-hidden="true" />
      <p className="text-sm font-medium text-zinc-400">No similar invoices right now</p>
      <p className="mt-1 max-w-xs text-xs text-zinc-600 leading-relaxed">
        There are no other open invoices that closely match this one&apos;s category,
        risk tier, APR, or tenor at this time.
      </p>
      <Link
        href="/marketplace"
        className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-kora-400 hover:text-kora-300 transition-colors"
      >
        Browse full marketplace <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * Renders a recommendation section below the invoice detail.
 * Resolves similar invoices from the cached list — no extra network call needed.
 */
export function SimilarInvoices({
  referenceId,
  maxResults = 6,
}: SimilarInvoicesProps) {
  const { data: similar, isLoading } = useSimilarInvoices(referenceId, maxResults);

  return (
    <section aria-labelledby="similar-invoices-heading" className="mt-10">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle
            id="similar-invoices-heading"
            className="flex items-center gap-2 text-base"
          >
            <Sparkles className="h-4 w-4 text-kora-400" aria-hidden="true" />
            Similar Opportunities
          </CardTitle>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Invoices ranked by similarity across category, risk tier, APR band,
            and tenor — showing only open opportunities.
          </p>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <SimilarInvoicesSkeleton count={3} />
          ) : !similar || similar.length === 0 ? (
            <EmptyState />
          ) : (
            <div
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              role="list"
              aria-label={`${similar.length} similar invoice${similar.length !== 1 ? "s" : ""}`}
            >
              {similar.map((item, i) => (
                <div key={item.invoice.id} role="listitem">
                  <SimilarInvoiceCard item={item} index={i} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
