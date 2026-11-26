"use client";

/**
 * FundingYieldCalculator — inline yield calculator for the invoice funding panel.
 *
 * Constraints:
 *  - Uses the SAME APR formula as APRDisplay: amount * (1 + (apr/100) * (days/365))
 *  - Values update with a 300ms debounce — not on every keystroke
 *  - Stale-proof: recalculates whenever `apr` or `daysToMaturity` props change
 *  - Never renders NaN/Infinity: malformed terms, zero APR, a reached funding
 *    cap, and a missing oracle price all have explicit localized copy (#1131)
 *
 * Shows:
 *  - Expected return (total payoff at maturity)
 *  - Annualised yield (as a formatted APR)
 *  - Break-even date (the repaymentDate of the invoice)
 */

import React, { useMemo } from "react";
import { TrendingUp, Calendar, Percent, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";
import { useFormatters } from "@/hooks/useFormatters";

interface FundingYieldCalculatorProps {
  /** Raw investment amount string from the controlled input — may be empty */
  amountInput: string;
  /** APR in percent (e.g. 24.5 for 24.5 %) — comes from invoice.terms.apr */
  apr: number;
  /** Calendar days until repayment — derived from invoice.terms.repaymentDate */
  daysToMaturity: number;
  /** ISO 8601 repayment date for break-even display */
  repaymentDate: string;
  /** Currency label, e.g. "USDC" */
  currency: string;
  /** Remaining funding capacity; when exceeded the projection is suppressed */
  remainingCapacity?: number;
  /**
   * Price of one currency unit in USD. `undefined` means the consumer does not
   * request a USD estimate; `null` means it requested one but the oracle did
   * not return a price.
   */
  oraclePrice?: number | null;
  /** Optional extra className on the wrapper */
  className?: string;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Core yield formula — identical to what InvoiceDetailClient uses:
 *   expectedReturn = amount * (1 + (apr / 100) * (days / 365))
 *
 * Returns `null` for malformed inputs so the caller can show explicit copy
 * instead of a silent NaN/Infinity.
 */
export function computeYield(
  amount: number,
  apr: number,
  daysToMaturity: number
): { expectedReturn: number; netYield: number } | null {
  if (!isFiniteNumber(amount) || !isFiniteNumber(apr) || !isFiniteNumber(daysToMaturity)) {
    return null;
  }
  if (amount <= 0 || apr < 0 || daysToMaturity < 0) return null;
  if (apr === 0 || daysToMaturity === 0) {
    return { expectedReturn: amount, netYield: 0 };
  }
  const expectedReturn = amount * (1 + (apr / 100) * (daysToMaturity / 365));
  const netYield = expectedReturn - amount;
  if (!isFiniteNumber(expectedReturn) || !isFiniteNumber(netYield)) return null;
  return { expectedReturn, netYield };
}

export function FundingYieldCalculator({
  amountInput,
  apr,
  daysToMaturity,
  repaymentDate,
  currency,
  remainingCapacity,
  oraclePrice,
  className,
}: FundingYieldCalculatorProps) {
  const t = useTranslations("invoiceDetail.yieldCalculator");
  const { formatCurrency, formatDate, formatApr } = useFormatters();
  // Debounce the raw string to avoid computing on every keystroke
  const debouncedInput = useDebounce(amountInput, 300);
  const debouncedApr = useDebounce(apr, 300);

  const amount = useMemo(() => {
    const parsed = Number.parseFloat(debouncedInput);
    return isFiniteNumber(parsed) && parsed >= 0 ? parsed : 0;
  }, [debouncedInput]);

  const projection = useMemo(
    () => computeYield(amount, debouncedApr, daysToMaturity),
    [amount, debouncedApr, daysToMaturity]
  );

  const hasOraclePrice = isFiniteNumber(oraclePrice) && oraclePrice > 0;
  // `null` explicitly means "price was requested but unavailable"; omitting the
  // prop means this surface does not show a USD estimate at all.
  const priceMissing = oraclePrice === null || (oraclePrice !== undefined && !hasOraclePrice);
  const usdEstimate = hasOraclePrice && projection ? projection.expectedReturn * oraclePrice : null;

  const edgeMessage = useMemo(() => {
    if (!projection) return t("invalidData");
    if (isFiniteNumber(remainingCapacity) && amount > remainingCapacity) return t("capReached");
    if (debouncedApr === 0) return t("zeroApr");
    if (daysToMaturity === 0) return t("noYield");
    return null;
  }, [projection, remainingCapacity, amount, debouncedApr, daysToMaturity, t]);

  if (amount <= 0) return null;

  if (edgeMessage) {
    return (
      <div
        className={cn(
          "rounded-xl border border-amber-500/30 bg-amber-500/5 p-4",
          className
        )}
        role="status"
        data-testid="yield-edge-message"
      >
        <div className="flex items-start gap-2 text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="text-xs">{edgeMessage}</p>
        </div>
      </div>
    );
  }

  const { expectedReturn, netYield } = projection!;

  return (
    <div
      className={cn(
        "rounded-xl border border-kora-500/20 bg-kora-500/5 p-4 space-y-3",
        className
      )}
      aria-label={t("a11yLabel")}
      data-testid="funding-yield-calculator"
    >
      <p className="text-xs font-semibold text-kora-400 uppercase tracking-wider">
        {t("title")}
      </p>

      {/* Expected Return */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <TrendingUp className="h-3.5 w-3.5 text-kora-400" aria-hidden="true" />
          <span>{t("expectedReturn")}</span>
        </div>
        <span
          className="font-mono text-sm font-semibold text-zinc-100"
          data-testid="expected-return"
        >
          {formatCurrency(expectedReturn, currency)}
        </span>
      </div>

      {/* Annualised Yield */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Percent className="h-3.5 w-3.5 text-kora-400" aria-hidden="true" />
          <span>{t("annualisedYield")}</span>
        </div>
        <span
          className="font-mono text-sm font-semibold text-kora-400"
          data-testid="annualised-yield"
        >
          {formatApr(debouncedApr)}
        </span>
      </div>

      {/* Break-even Date */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Calendar className="h-3.5 w-3.5 text-kora-400" aria-hidden="true" />
          <span>{t("breakEvenDate")}</span>
        </div>
        <span
          className="text-sm font-medium text-zinc-300"
          data-testid="break-even-date"
        >
          {formatDate(repaymentDate)}
        </span>
      </div>

      {/* Net Yield summary */}
      <div className="border-t border-kora-500/10 pt-2 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">{t("netYield")}</span>
        <span
          className="font-mono text-sm font-bold text-kora-400"
          data-testid="net-yield"
        >
          +{formatCurrency(netYield, currency)}
        </span>
      </div>

      {hasOraclePrice && usdEstimate !== null && (
        <div className="flex items-center justify-between gap-2 border-t border-kora-500/10 pt-2">
          <span className="text-xs text-zinc-400">{t("approxUsd")}</span>
          <span className="font-mono text-xs text-zinc-300" data-testid="yield-usd-estimate">
            ≈ {formatCurrency(usdEstimate, "USD")}
          </span>
        </div>
      )}

      {priceMissing && (
        <p
          className="flex items-start gap-1.5 text-xs text-amber-200"
          role="status"
          data-testid="yield-edge-message"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t("priceUnavailable")}
        </p>
      )}
    </div>
  );
}
