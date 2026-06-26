import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as USD/USDC currency */
export function formatCurrency(
  amount: number,
  currency = "USDC",
  compact = false
): string {
  if (compact && amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M ${currency}`;
  }
  if (compact && amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K ${currency}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount) + ` ${currency}`;
}

/** Format a percentage (0.05 → "5.00%") */
export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Format APR (already in percent, e.g. 12.5 → "12.50% APR") */
export function formatApr(apr: number): string {
  return `${apr.toFixed(2)}% APR`;
}

/** Format a date string to readable form */
export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), "MMM d, yyyy");
}

/** Relative time (e.g. "in 30 days") */
export function formatRelativeDate(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
}

/** Days remaining until a date */
export function daysUntil(dateStr: string): number {
  return differenceInDays(new Date(dateStr), new Date());
}

/** Shorten a Stellar address for display */
export function shortenAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars + 1)}...${address.slice(-chars)}`;
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

/** Export an array of objects as a CSV file download */
export function exportCsv(data: Record<string, unknown>[], filename: string): void {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((row) => headers.map((h) => JSON.stringify(row[h] ?? "")).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
