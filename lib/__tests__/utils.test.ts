import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatUSDC,
  formatXLM,
  formatPercentage,
  formatApr,
  formatDate,
  formatRelativeTime,
} from "../utils";

// ─── formatCurrency ───────────────────────────────────────────────────────────

describe("formatCurrency", () => {
  it("formats a standard amount", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56 USDC");
  });
  it("compact: millions", () => {
    expect(formatCurrency(2_500_000, "USDC", true)).toBe("$2.5M USDC");
  });
  it("compact: thousands", () => {
    expect(formatCurrency(1500, "USDC", true)).toBe("$1.5K USDC");
  });
  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("$0.00 USDC");
  });
  it("handles negative", () => {
    expect(formatCurrency(-500, "USDC")).toBe("-$500.00 USDC");
  });
  it("handles null/undefined gracefully", () => {
    expect(formatCurrency(null)).toBe("$0.00 USDC");
    expect(formatCurrency(undefined)).toBe("$0.00 USDC");
  });
  it("uses provided currency symbol", () => {
    expect(formatCurrency(100, "XLM")).toBe("$100.00 XLM");
  });
});

// ─── formatUSDC ──────────────────────────────────────────────────────────────

describe("formatUSDC", () => {
  it("formats with 2 decimal places by default", () => {
    expect(formatUSDC(1234.56)).toBe("1,234.56 USDC");
  });
  it("respects custom decimal places", () => {
    expect(formatUSDC(1234.5, 4)).toBe("1,234.5000 USDC");
  });
  it("handles zero", () => {
    expect(formatUSDC(0)).toBe("0.00 USDC");
  });
  it("handles null/undefined", () => {
    expect(formatUSDC(null)).toBe("0.00 USDC");
    expect(formatUSDC(undefined)).toBe("0.00 USDC");
  });
  it("handles very large numbers", () => {
    expect(formatUSDC(1_000_000_000)).toBe("1,000,000,000.00 USDC");
  });
  it("handles negative", () => {
    expect(formatUSDC(-99.99)).toBe("-99.99 USDC");
  });
});

// ─── formatXLM ───────────────────────────────────────────────────────────────

describe("formatXLM", () => {
  it("formats with 7 decimal places", () => {
    expect(formatXLM(1234.5678)).toBe("1,234.5678000 XLM");
  });
  it("handles zero", () => {
    expect(formatXLM(0)).toBe("0.0000000 XLM");
  });
  it("handles null/undefined", () => {
    expect(formatXLM(null)).toBe("0.0000000 XLM");
    expect(formatXLM(undefined)).toBe("0.0000000 XLM");
  });
  it("handles negative", () => {
    expect(formatXLM(-1.5)).toBe("-1.5000000 XLM");
  });
  it("handles very small amounts (stroops precision)", () => {
    expect(formatXLM(0.0000001)).toBe("0.0000001 XLM");
  });
});

// ─── formatPercentage ────────────────────────────────────────────────────────

describe("formatPercentage", () => {
  it("formats a standard percentage", () => {
    expect(formatPercentage(12.34)).toBe("12.34%");
  });
  it("respects custom decimals", () => {
    expect(formatPercentage(5, 0)).toBe("5%");
  });
  it("handles zero", () => {
    expect(formatPercentage(0)).toBe("0.00%");
  });
  it("handles null/undefined", () => {
    expect(formatPercentage(null)).toBe("0.00%");
    expect(formatPercentage(undefined)).toBe("0.00%");
  });
  it("handles 100%", () => {
    expect(formatPercentage(100)).toBe("100.00%");
  });
  it("handles negative", () => {
    expect(formatPercentage(-5)).toBe("-5.00%");
  });
});

// ─── formatApr ───────────────────────────────────────────────────────────────

describe("formatApr", () => {
  it("formats APR", () => {
    expect(formatApr(12.5)).toBe("12.50% APR");
  });
  it("handles zero", () => {
    expect(formatApr(0)).toBe("0.00% APR");
  });
  it("handles null/undefined", () => {
    expect(formatApr(null)).toBe("0.00% APR");
    expect(formatApr(undefined)).toBe("0.00% APR");
  });
});

// ─── formatDate ──────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("short format (default)", () => {
    expect(formatDate("2025-06-15")).toBe("Jun 15, 2025");
  });
  it("long format", () => {
    expect(formatDate("2025-06-15", "long")).toBe("June 15, 2025");
  });
  it("handles null/undefined", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });
  it("handles invalid date string", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });
});

// ─── formatRelativeTime ──────────────────────────────────────────────────────

describe("formatRelativeTime", () => {
  it("returns '—' for null/undefined", () => {
    expect(formatRelativeTime(null)).toBe("—");
    expect(formatRelativeTime(undefined)).toBe("—");
  });
  it("returns '—' for invalid date", () => {
    expect(formatRelativeTime("bad-date")).toBe("—");
  });
  it("formats a past date in days", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeDaysAgo)).toBe("3 days ago");
  });
  it("formats a future date in days", () => {
    const inFiveDays = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(inFiveDays)).toBe("in 5 days");
  });
  it("formats hours ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoHoursAgo)).toBe("2 hours ago");
  });
  it("formats months", () => {
    const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoMonthsAgo)).toBe("2 months ago");
  });
  it("accepts a date string", () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(future)).toBe("next year");
  });
});
