"use client";

import { useState, useCallback, useRef } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { TrendingUp, Users, Calendar, BarChart2, Shield } from "lucide-react";
import { RiskBadge } from "@/components/ui/badge";
import { usePrefetchInvoice } from "@/hooks/usePrefetchInvoice";
import { formatApr, formatCurrency, cn } from "@/lib/utils";
import type { Invoice } from "@/types";

// ─── Hover delay ──────────────────────────────────────────────────────────────

/**
 * Milliseconds of continuous hover before the popover opens.
 * Prevents accidental triggers when the pointer moves quickly across cards.
 */
const HOVER_OPEN_DELAY_MS = 350;

/**
 * Milliseconds after pointer-leave before the popover closes.
 * Gives the user a moment to move onto the popover content itself.
 */
const HOVER_CLOSE_DELAY_MS = 150;

// ─── Mini stat row ────────────────────────────────────────────────────────────

interface StatRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function StatRow({ icon, label, value }: StatRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-xs font-semibold text-foreground">{value}</span>
    </div>
  );
}

// ─── Popover content ──────────────────────────────────────────────────────────

interface PopoverContentProps {
  invoice: Invoice;
}

function InvoiceQuickStats({ invoice }: PopoverContentProps) {
  const { metadata, terms, funding, riskTier } = invoice;
  const fundingPct = Math.round(funding.fundingProgress * 100);

  return (
    <div
      className="w-64 space-y-3 rounded-xl border border-border bg-popover p-4 shadow-lg"
      aria-label={`Quick stats for invoice ${metadata.invoiceNumber}`}
    >
      {/* Invoice number + debtor */}
      <div className="pb-2 border-b border-border">
        <p className="text-xs font-semibold text-foreground truncate">
          {metadata.debtorName}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {metadata.invoiceNumber}
        </p>
      </div>

      {/* Stats */}
      <div className="space-y-2">
        <StatRow
          icon={<TrendingUp className="h-3 w-3 text-primary" />}
          label="APR"
          value={formatApr(terms.apr)}
        />
        <StatRow
          icon={<BarChart2 className="h-3 w-3 text-muted-foreground" />}
          label="Funding progress"
          value={`${fundingPct}%`}
        />
        <StatRow
          icon={<Users className="h-3 w-3 text-muted-foreground" />}
          label="Investors"
          value={String(funding.investorCount)}
        />
        <StatRow
          icon={<Calendar className="h-3 w-3 text-muted-foreground" />}
          label="Tenor"
          value={`${terms.tenor}d`}
        />
        <StatRow
          icon={<Shield className="h-3 w-3 text-muted-foreground" />}
          label="Min. investment"
          value={formatCurrency(terms.minInvestment, metadata.currency, true)}
        />
      </div>

      {/* Funding progress bar */}
      <div
        className="h-1.5 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={fundingPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Funding progress: ${fundingPct}%`}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${Math.min(fundingPct, 100)}%` }}
        />
      </div>

      {/* Risk badge row */}
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
          Risk tier
        </span>
        <RiskBadge tier={riskTier} tooltip={false} />
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export interface InvoiceCardHoverPopoverProps {
  invoice: Invoice;
  /** The card element that triggers the popover */
  children: React.ReactNode;
  /** Popover placement (defaults to right, falls back to left) */
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

/**
 * InvoiceCardHoverPopover
 *
 * Wraps an invoice card child with a Radix Popover that opens on hover
 * (with a 350ms delay to avoid accidental triggers) and shows a mini stats
 * panel: APR, funding progress, risk tier, investor count, tenor, and minimum
 * investment.
 *
 * On mobile / touch devices the popover is suppressed in favour of a tap that
 * navigates directly to the invoice detail page (handled by the Link in
 * InvoiceCard).
 *
 * Prefetching is triggered as soon as the pointer enters the trigger area, so
 * the detail page data is warm by the time the user clicks through.
 */
export function InvoiceCardHoverPopover({
  invoice,
  children,
  side = "right",
  className,
}: InvoiceCardHoverPopoverProps) {
  const [open, setOpen] = useState(false);
  const prefetch = usePrefetchInvoice();

  // Timers for delayed open/close
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const handleMouseEnter = useCallback(() => {
    // Fire prefetch immediately — data starts loading before popover opens
    prefetch(invoice.id);

    clearTimers();
    openTimerRef.current = setTimeout(() => setOpen(true), HOVER_OPEN_DELAY_MS);
  }, [invoice.id, prefetch, clearTimers]);

  const handleMouseLeave = useCallback(() => {
    clearTimers();
    closeTimerRef.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  }, [clearTimers]);

  // Keep the popover open when the pointer moves over the content itself
  const handleContentMouseEnter = useCallback(() => {
    clearTimers();
  }, [clearTimers]);

  const handleContentMouseLeave = useCallback(() => {
    clearTimers();
    closeTimerRef.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  }, [clearTimers]);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        asChild
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        // Suppress popover on touch — tap navigates via the Link inside
        onTouchStart={() => setOpen(false)}
      >
        <div className={cn("w-full h-full", className)}>{children}</div>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={side}
          sideOffset={8}
          align="start"
          collisionPadding={16}
          className={cn(
            "z-50 animate-in fade-in-0 zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          )}
          onMouseEnter={handleContentMouseEnter}
          onMouseLeave={handleContentMouseLeave}
          // Prevent focus being stolen from the card on open
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <InvoiceQuickStats invoice={invoice} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
