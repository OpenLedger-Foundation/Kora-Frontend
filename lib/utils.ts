import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as a currency string.
 * Existing signature preserved: formatCurrency(amount, currency?, compact?)
 * Extended: formatCurrency(amount, currency?, compact?, locale?)
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency = "USDC",
  compact = false,
  locale = "en-US"
): string {
  const n = amount ?? 0;
  if (compact && Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1)}M ${currency}`;
  }
  if (compact && Math.abs(n) >= 1_000) {
    return `$${(n / 1_000).toFixed(1)}K ${currency}`;
  }
  return (
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + ` ${currency}`
  );
}

/** Format an amount as USDC: "1,234.56 USDC" */
export function formatUSDC(
  amount: number | null | undefined,
  decimals = 2,
  locale = "en-US"
): string {
  const n = amount ?? 0;
  return (
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n) + " USDC"
  );
}

/** Format an amount as XLM: "1,234.5678900 XLM" (7 decimal places) */
export function formatXLM(
  amount: number | null | undefined,
  locale = "en-US"
): string {
  const n = amount ?? 0;
  return (
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 7,
      maximumFractionDigits: 7,
    }).format(n) + " XLM"
  );
}

/** Format a percentage value (already in percent, e.g. 12.5 → "12.50%") */
export function formatPercentage(
  value: number | null | undefined,
  decimals = 2,
  locale = "en-US"
): string {
  const n = value ?? 0;
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n / 100);
}

/** @deprecated Use formatPercentage. Kept for backward compatibility. */
export function formatPercent(value: number | null | undefined, decimals = 2): string {
  return `${((value ?? 0) * 100).toFixed(decimals)}%`;
}

/** Format APR (already in percent, e.g. 12.5 → "12.50% APR") */
export function formatApr(apr: number | null | undefined): string {
  return `${(apr ?? 0).toFixed(2)}% APR`;
}

/** Format a date string. format: "short" = "Jan 5, 2025", "long" = "January 5, 2025", "relative" = relative time */
export function formatDate(
  dateStr: string | null | undefined,
  fmt: "short" | "long" | "relative" = "short"
): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  if (fmt === "relative") return formatRelativeDate(dateStr);
  if (fmt === "long") return format(d, "MMMM d, yyyy");
  return format(d, "MMM d, yyyy");
}

/** Relative time (e.g. "in 30 days", "2 hours ago") using Intl.RelativeTimeFormat */
export function formatRelativeTime(
  date: string | Date | null | undefined,
  locale = "en"
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diffMs = d.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);
  const diffWk = Math.round(diffDay / 7);
  const diffMo = Math.round(diffDay / 30);
  const diffYr = Math.round(diffDay / 365);

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, "second");
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour");
  if (Math.abs(diffDay) < 7) return rtf.format(diffDay, "day");
  if (Math.abs(diffWk) < 5) return rtf.format(diffWk, "week");
  if (Math.abs(diffMo) < 12) return rtf.format(diffMo, "month");
  return rtf.format(diffYr, "year");
}

/** Relative time using date-fns (original behaviour, kept for backward compat) */
export function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return formatDistanceToNow(d, { addSuffix: true });
}

/** Days remaining until a date */
export function daysUntil(dateStr: string): number {
  return differenceInDays(new Date(dateStr), new Date());
}

/** Shorten a Stellar address/hash for display */
export function truncateAddress(address: string | null | undefined, chars = 4): string {
  if (!address) return "";
  const clean = address.trim();
  if (clean.length <= chars * 2) return clean;
  return `${clean.slice(0, chars)}...${clean.slice(-chars)}`;
}

/** Convert stroops to XLM */
export function stroopsToXlm(stroops: bigint | number): number {
  return Number(stroops) / 10_000_000;
}

/** Convert XLM to stroops */
export function xlmToStroops(xlm: number): bigint {
  return BigInt(Math.round(xlm * 10_000_000));
}

/** Risk tier colour mapping */
export const RISK_TIER_COLORS: Record<string, string> = {
  AAA: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  AA: "text-teal-400 bg-teal-400/10 border-teal-400/20",
  A: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  BBB: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  BB: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  B: "text-red-400 bg-red-400/10 border-red-400/20",
  CCC: "text-red-600 bg-red-600/10 border-red-600/20",
};

/** Invoice status colour mapping */
export const STATUS_COLORS: Record<string, string> = {
  draft: "text-muted-foreground bg-muted",
  pending_mint: "text-warning bg-warning/10",
  listed: "text-info bg-info/10",
  partially_funded: "text-primary bg-kora-muted",
  fully_funded: "text-success bg-success/10",
  active: "text-success bg-success/10",
  repaid: "text-info bg-info/10",
  defaulted: "text-destructive bg-destructive/10",
  cancelled: "text-muted-foreground bg-muted",
};

/** Retry a function up to `attempts` times with exponential backoff on 5xx errors */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 500
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const is5xx =
        err instanceof Error && /5\d{2}/.test(err.message);
      if (!is5xx || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
    }
  }
  throw lastError;
}

/** Risk tier APR multipliers for risk-adjusted returns */
export const RISK_TIER_MULTIPLIERS: Record<string, number> = {
  AAA: 1.0,  // No adjustment
  AA: 1.05,  // 5% boost
  A: 1.1,    // 10% boost
  BBB: 1.15, // 15% boost
  BB: 1.2,   // 20% boost
  B: 1.25,   // 25% boost
  CCC: 1.3,  // 30% boost
};

/**
 * Calculate APR from discount rate and days to maturity.
 * Formula: APR = (discount / (1 - discount)) * (365 / days) * 100
 * 
 * @param discountRate - Discount as decimal (e.g., 0.05 for 5%)
 * @param daysToMaturity - Number of days until maturity
 * @returns APR as percentage (e.g., 12.5 for 12.5% APR)
 */
export function calculateAPR(discountRate: number, daysToMaturity: number): number {
  if (daysToMaturity <= 0 || discountRate <= 0 || discountRate >= 1) {
    return 0;
  }
  return (discountRate / (1 - discountRate)) * (365 / daysToMaturity) * 100;
}

/**
 * Calculate expected return for an investor at maturity.
 * Formula: return = amount * discountRate
 * 
 * @param amount - Investment amount
 * @param discountRate - Discount as decimal (e.g., 0.05 for 5%)
 * @returns Expected return amount
 */
export function calculateExpectedReturn(amount: number, discountRate: number): number {
  return amount * discountRate;
}

/**
 * Calculate risk-adjusted return based on APR and risk tier.
 * Formula: adjustedAPR = APR * riskMultiplier
 * 
 * @param apr - APR as percentage
 * @param riskTier - Risk tier (e.g., "AAA", "BB")
 * @returns Risk-adjusted APR as percentage
 */
export function calculateRiskAdjustedReturn(apr: number, riskTier: string): number {
  const multiplier = RISK_TIER_MULTIPLIERS[riskTier] ?? 1.0;
  return apr * multiplier;
}

/**
 * Get color coding for APR based on thresholds.
 * @param apr - APR as percentage
 * @returns Tailwind color class
 */
export function getAPRColor(apr: number): string {
  if (apr >= 15) return "text-emerald-400";  // Green: excellent
  if (apr >= 8) return "text-amber-400";     // Amber: good
  return "text-red-400";                      // Red: low
}

/**
 * Convert an array of objects to a CSV file and trigger a browser download.
 * @param rows   Array of plain objects (all rows must share the same keys)
 * @param filename  Desired filename including `.csv` extension
 */
export function exportCsv(rows: Record<string, unknown>[], filename = "export.csv"): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const str = String(v ?? "");
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const csv = [
    headers.map(escape).join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
