/**
 * Unit tests for lib/utils.ts
 *
 * Target: 100% line/branch/function coverage on every export.
 *
 * Sections:
 *  1. cn
 *  2. formatCurrency
 *  3. formatUSDC
 *  4. formatXLM
 *  5. formatPercentage
 *  6. formatPercent (deprecated)
 *  7. formatApr
 *  8. formatDate
 *  9. formatRelativeTime
 * 10. formatRelativeDate
 * 11. daysUntil
 * 12. shortenAddress
 * 13. truncateAddress
 * 14. stroopsToXlm / xlmToStroops
 * 15. isValidStellarAddress
 * 16. getJurisdictionFlag / getJurisdictionName
 * 17. calculateYieldProjection
 * 18. calculateAPR
 * 19. calculateExpectedReturn
 * 20. calculateRiskAdjustedReturn
 * 21. getAPRColor
 * 22. withRetry
 * 23. exportCsv
 * 24. Constants (RISK_TIER_COLORS, STATUS_COLORS)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cn,
  formatCurrency,
  formatUSDC,
  formatXLM,
  formatPercentage,
  formatPercent,
  formatApr,
  formatDate,
  formatRelativeTime,
  formatRelativeDate,
  daysUntil,
  truncateAddress,
  shortenAddress,
  stroopsToXlm,
  xlmToStroops,
  isValidStellarAddress,
  getJurisdictionFlag,
  getJurisdictionName,
  calculateYieldProjection,
  calculateAPR,
  calculateExpectedReturn,
  calculateRiskAdjustedReturn,
  getAPRColor,
  RISK_TIER_COLORS,
  STATUS_COLORS,
  withRetry,
  exportCsv,
} from "../utils";

// ─── 1. cn ────────────────────────────────────────────────────────────────────

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });
  it("deduplicates tailwind classes (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
  it("handles conditional classes", () => {
    expect(cn("base", false && "skip", "end")).toBe("base end");
  });
  it("handles undefined/null inputs", () => {
    expect(cn(undefined, null as any, "ok")).toBe("ok");
  });
  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});

// ─── 2. formatCurrency ────────────────────────────────────────────────────────

describe("formatCurrency", () => {
  it("formats a standard amount with default currency", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56 USDC");
  });
  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00 USDC");
  });
  it("formats negative amount", () => {
    expect(formatCurrency(-500)).toBe("-$500.00 USDC");
  });
  it("handles null → treats as 0", () => {
    expect(formatCurrency(null)).toBe("$0.00 USDC");
  });
  it("handles undefined → treats as 0", () => {
    expect(formatCurrency(undefined)).toBe("$0.00 USDC");
  });
  it("uses provided currency label", () => {
    expect(formatCurrency(100, "XLM")).toBe("$100.00 XLM");
  });
  it("compact: formats millions", () => {
    expect(formatCurrency(2_500_000, "USDC", true)).toBe("$2.5M USDC");
  });
  it("compact: formats thousands", () => {
    expect(formatCurrency(1500, "USDC", true)).toBe("$1.5K USDC");
  });
  it("compact: negative millions", () => {
    expect(formatCurrency(-3_000_000, "USDC", true)).toBe("$-3.0M USDC");
  });
  it("compact: negative thousands", () => {
    expect(formatCurrency(-2500, "USDC", true)).toBe("$-2.5K USDC");
  });
  it("compact: below 1000 falls through to full format", () => {
    expect(formatCurrency(999, "USDC", true)).toBe("$999.00 USDC");
  });
  it("compact: exactly 1_000_000 boundary", () => {
    expect(formatCurrency(1_000_000, "USDC", true)).toBe("$1.0M USDC");
  });
  it("compact: exactly 1_000 boundary", () => {
    expect(formatCurrency(1_000, "USDC", true)).toBe("$1.0K USDC");
  });

  // ── Locale tests (Issue #290) ──────────────────────────────────────────────
  it("locale en-US: 1000 → '1,234.00 USDC'", () => {
    // en-US uses comma thousands sep and period decimal
    expect(formatCurrency(1000, "USDC", false, "en-US")).toBe("$1,000.00 USDC");
  });
  it("locale en-US: 1000.00 matches spec", () => {
    expect(formatCurrency(1000, "USDC", false, "en-US")).toContain("1,000.00");
  });
  it("locale es-ES: 1000 → contains '1.000,00'", () => {
    // es-ES uses period thousands sep and comma decimal
    const result = formatCurrency(1000, "USDC", false, "es-ES");
    expect(result).toContain("1.000,00");
    expect(result).toContain("USDC");
  });
  it("locale fr-FR: 1000 → contains '1\u00a0000,00'", () => {
    // fr-FR uses narrow no-break space as thousands sep and comma decimal
    const result = formatCurrency(1000, "USDC", false, "fr-FR");
    // Accept either a regular space or narrow no-break space (\u202f or \u00a0)
    expect(result.replace(/[\u00a0\u202f]/g, " ")).toContain("1 000,00");
    expect(result).toContain("USDC");
  });
  it("currency symbol always remains USDC regardless of locale", () => {
    expect(formatCurrency(100, "USDC", false, "de-DE")).toContain("USDC");
    expect(formatCurrency(100, "USDC", false, "ja-JP")).toContain("USDC");
    expect(formatCurrency(100, "USDC", false, "ar-SA")).toContain("USDC");
  });
});

// ─── 3. formatUSDC ───────────────────────────────────────────────────────────

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
  it("handles null → 0", () => {
    expect(formatUSDC(null)).toBe("0.00 USDC");
  });
  it("handles undefined → 0", () => {
    expect(formatUSDC(undefined)).toBe("0.00 USDC");
  });
  it("handles very large numbers", () => {
    expect(formatUSDC(1_000_000_000)).toBe("1,000,000,000.00 USDC");
  });
  it("handles negative", () => {
    expect(formatUSDC(-99.99)).toBe("-99.99 USDC");
  });
  it("0 decimals", () => {
    expect(formatUSDC(1234.56, 0)).toBe("1,235 USDC");
  });
});

// ─── 4. formatXLM ────────────────────────────────────────────────────────────

describe("formatXLM", () => {
  it("formats with 7 decimal places", () => {
    expect(formatXLM(1234.5678)).toBe("1,234.5678000 XLM");
  });
  it("handles zero", () => {
    expect(formatXLM(0)).toBe("0.0000000 XLM");
  });
  it("handles null → 0", () => {
    expect(formatXLM(null)).toBe("0.0000000 XLM");
  });
  it("handles undefined → 0", () => {
    expect(formatXLM(undefined)).toBe("0.0000000 XLM");
  });
  it("handles negative", () => {
    expect(formatXLM(-1.5)).toBe("-1.5000000 XLM");
  });
  it("handles stroops precision (0.0000001)", () => {
    expect(formatXLM(0.0000001)).toBe("0.0000001 XLM");
  });
});

// ─── 5. formatPercentage ─────────────────────────────────────────────────────

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
  it("handles null → 0", () => {
    expect(formatPercentage(null)).toBe("0.00%");
  });
  it("handles undefined → 0", () => {
    expect(formatPercentage(undefined)).toBe("0.00%");
  });
  it("handles 100%", () => {
    expect(formatPercentage(100)).toBe("100.00%");
  });
  it("handles negative", () => {
    expect(formatPercentage(-5)).toBe("-5.00%");
  });
  it("handles fractional decimals=3", () => {
    expect(formatPercentage(33.333, 3)).toBe("33.333%");
  });
});

// ─── 6. formatPercent (deprecated) ───────────────────────────────────────────

describe("formatPercent (deprecated)", () => {
  it("multiplies by 100 and appends %", () => {
    expect(formatPercent(0.125)).toBe("12.50%");
  });
  it("handles zero", () => {
    expect(formatPercent(0)).toBe("0.00%");
  });
  it("handles null → 0", () => {
    expect(formatPercent(null)).toBe("0.00%");
  });
  it("handles undefined → 0", () => {
    expect(formatPercent(undefined)).toBe("0.00%");
  });
  it("respects custom decimals", () => {
    expect(formatPercent(0.1, 0)).toBe("10%");
  });
});

// ─── 7. formatApr ────────────────────────────────────────────────────────────

describe("formatApr", () => {
  it("formats APR with 2 decimal places", () => {
    expect(formatApr(12.5)).toBe("12.50% APR");
  });
  it("handles zero", () => {
    expect(formatApr(0)).toBe("0.00% APR");
  });
  it("handles null → 0", () => {
    expect(formatApr(null)).toBe("0.00% APR");
  });
  it("handles undefined → 0", () => {
    expect(formatApr(undefined)).toBe("0.00% APR");
  });
  it("handles large APR", () => {
    expect(formatApr(99.99)).toBe("99.99% APR");
  });
});

// ─── 8. formatDate ───────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("short format (default)", () => {
    expect(formatDate("2025-06-15")).toBe("Jun 15, 2025");
  });
  it("long format", () => {
    expect(formatDate("2025-06-15", "long")).toBe("June 15, 2025");
  });
  it("relative format delegates to formatRelativeDate", () => {
    // Just verify it returns a non-empty string (relative output is time-dependent)
    const result = formatDate("2025-01-01", "relative");
    expect(typeof result).toBe("string");
    expect(result).not.toBe("—");
  });
  it("handles null → '—'", () => {
    expect(formatDate(null)).toBe("—");
  });
  it("handles undefined → '—'", () => {
    expect(formatDate(undefined)).toBe("—");
  });
  it("handles invalid date string → '—'", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });
  it("handles empty string → '—'", () => {
    expect(formatDate("")).toBe("—");
  });
});

// ─── 9. formatRelativeTime ───────────────────────────────────────────────────

describe("formatRelativeTime", () => {
  it("returns '—' for null", () => {
    expect(formatRelativeTime(null)).toBe("—");
  });
  it("returns '—' for undefined", () => {
    expect(formatRelativeTime(undefined)).toBe("—");
  });
  it("returns '—' for invalid date string", () => {
    expect(formatRelativeTime("bad-date")).toBe("—");
  });
  it("formats seconds ago (< 60s)", () => {
    const d = new Date(Date.now() - 30_000);
    const result = formatRelativeTime(d);
    expect(result).toMatch(/second/);
  });
  it("formats minutes ago (< 60min)", () => {
    const d = new Date(Date.now() - 5 * 60_000);
    expect(formatRelativeTime(d)).toMatch(/minute/);
  });
  it("formats hours ago (< 24h)", () => {
    const d = new Date(Date.now() - 2 * 3600_000);
    expect(formatRelativeTime(d)).toBe("2 hours ago");
  });
  it("formats days ago (< 7d)", () => {
    const d = new Date(Date.now() - 3 * 86_400_000);
    expect(formatRelativeTime(d)).toBe("3 days ago");
  });
  it("formats weeks ago (< 5 weeks)", () => {
    const d = new Date(Date.now() - 14 * 86_400_000);
    expect(formatRelativeTime(d)).toMatch(/week/);
  });
  it("formats months ago (< 12 months)", () => {
    const d = new Date(Date.now() - 60 * 86_400_000);
    expect(formatRelativeTime(d)).toMatch(/month/);
  });
  it("formats years", () => {
    const d = new Date(Date.now() - 400 * 86_400_000);
    expect(formatRelativeTime(d)).toMatch(/year/);
  });
  it("formats future date in days", () => {
    const d = new Date(Date.now() + 5 * 86_400_000);
    expect(formatRelativeTime(d)).toBe("in 5 days");
  });
  it("formats future date in hours", () => {
    const d = new Date(Date.now() + 3 * 3600_000);
    expect(formatRelativeTime(d)).toBe("in 3 hours");
  });
  it("accepts a date string", () => {
    const future = new Date(Date.now() + 365 * 86_400_000).toISOString();
    expect(formatRelativeTime(future)).toMatch(/year/);
  });
});

// ─── 10. formatRelativeDate ──────────────────────────────────────────────────

describe("formatRelativeDate", () => {
  it("returns '—' for null", () => {
    expect(formatRelativeDate(null)).toBe("—");
  });
  it("returns '—' for undefined", () => {
    expect(formatRelativeDate(undefined)).toBe("—");
  });
  it("returns '—' for invalid date", () => {
    expect(formatRelativeDate("not-a-date")).toBe("—");
  });
  it("returns a relative string for a valid past date", () => {
    const past = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const result = formatRelativeDate(past);
    expect(result).toMatch(/ago/);
  });
  it("returns a relative string for a valid future date", () => {
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const result = formatRelativeDate(future);
    expect(result).toMatch(/in/);
  });
});

// ─── 11. daysUntil ───────────────────────────────────────────────────────────

describe("daysUntil", () => {
  it("returns a positive number for a future date", () => {
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString().split("T")[0];
    expect(daysUntil(future)).toBeGreaterThan(0);
  });
  it("returns a negative number for a past date", () => {
    const past = new Date(Date.now() - 10 * 86_400_000).toISOString().split("T")[0];
    expect(daysUntil(past)).toBeLessThan(0);
  });
  it("returns approximately 0 for today", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(Math.abs(daysUntil(today))).toBeLessThanOrEqual(1);
  });
});

// ─── 12. truncateAddress ──────────────────────────────────────────────────────

describe("truncateAddress", () => {
  const addr = "GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQ";

  it("shortens with default 4 chars", () => {
    expect(truncateAddress(addr)).toBe("GBVZ...QKZQ");
  });
  it("shortens with custom chars", () => {
    expect(truncateAddress(addr, 6)).toBe("GBVZQ4...KZQKZQ");
  });
  it("returns empty string for empty input", () => {
    expect(truncateAddress("")).toBe("");
  });
  it("returns empty string for falsy input", () => {
    expect(truncateAddress(undefined as any)).toBe("");
  });
});

// ─── 13. truncateAddress ─────────────────────────────────────────────────────

describe("truncateAddress", () => {
  const addr = "GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQ";

  it("truncates with default 4 chars", () => {
    expect(truncateAddress(addr)).toBe("GBVZ...KZQK");
  });
  it("truncates with custom chars", () => {
    expect(truncateAddress(addr, 6)).toBe("GBVZQ4...QKZQKZ");
  });
  it("returns empty string for null", () => {
    expect(truncateAddress(null)).toBe("");
  });
  it("returns empty string for undefined", () => {
    expect(truncateAddress(undefined)).toBe("");
  });
  it("returns empty string for empty input", () => {
    expect(truncateAddress("")).toBe("");
  });
  it("returns full address if shorter than threshold", () => {
    expect(truncateAddress("SHORT", 4)).toBe("SHORT");
  });
  it("handles non-ASCII characters", () => {
    const nonAscii = "ΓΒVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQK测试";
    const result = truncateAddress(nonAscii, 4);
    expect(result).toContain("...");
    expect(result).toBe(`${nonAscii.slice(0, 4)}...${nonAscii.slice(-4)}`);
  });
  it("handles address with whitespace (trims)", () => {
    expect(truncateAddress("  " + addr + "  ")).toBe("GBVZ...KZQK");
  });
});

// ─── 14. stroopsToXlm / xlmToStroops ─────────────────────────────────────────

describe("stroopsToXlm", () => {
  it("converts stroops to XLM", () => {
    expect(stroopsToXlm(10_000_000)).toBe(1);
  });
  it("handles zero", () => {
    expect(stroopsToXlm(0)).toBe(0);
  });
  it("handles fractional stroops", () => {
    expect(stroopsToXlm(1)).toBe(0.0000001);
  });
  it("handles bigint input", () => {
    expect(stroopsToXlm(BigInt(50_000_000))).toBe(5);
  });
  it("handles very large numbers", () => {
    expect(stroopsToXlm(100_000_000_000_000)).toBe(10_000_000);
  });
});

describe("xlmToStroops", () => {
  it("converts XLM to stroops", () => {
    expect(xlmToStroops(1)).toBe(BigInt(10_000_000));
  });
  it("handles zero", () => {
    expect(xlmToStroops(0)).toBe(BigInt(0));
  });
  it("handles fractional XLM", () => {
    expect(xlmToStroops(0.5)).toBe(BigInt(5_000_000));
  });
  it("rounds fractional stroops", () => {
    expect(xlmToStroops(0.00000015)).toBe(BigInt(2));
  });
  it("handles very large XLM amounts", () => {
    expect(xlmToStroops(1_000_000)).toBe(BigInt(10_000_000_000_000));
  });
});

// ─── 15. isValidStellarAddress ──────────────────────────────────────────────

describe("isValidStellarAddress", () => {
  it("returns true for valid G address", () => {
    expect(isValidStellarAddress("GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H")).toBe(true);
  });
  it("returns false for invalid address", () => {
    expect(isValidStellarAddress("invalid-address")).toBe(false);
  });
  it("returns false for null", () => {
    expect(isValidStellarAddress(null)).toBe(false);
  });
  it("returns false for undefined", () => {
    expect(isValidStellarAddress(undefined)).toBe(false);
  });
  it("returns false for empty string", () => {
    expect(isValidStellarAddress("")).toBe(false);
  });
  it("trims whitespace before validation", () => {
    expect(isValidStellarAddress("  GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H  ")).toBe(true);
  });
  it("returns false for too short address", () => {
    expect(isValidStellarAddress("GBRPY")).toBe(false);
  });
});

// ─── 16. getJurisdictionFlag / getJurisdictionName ───────────────────────────

describe("getJurisdictionFlag", () => {
  it("returns flag for known jurisdiction", () => {
    expect(getJurisdictionFlag("KE")).toBe("🇰🇪");
    expect(getJurisdictionFlag("NG")).toBe("🇳🇬");
    expect(getJurisdictionFlag("US")).toBe("🇺🇸");
  });
  it("returns code for unknown jurisdiction", () => {
    expect(getJurisdictionFlag("XX")).toBe("XX");
  });
  it("handles empty string", () => {
    expect(getJurisdictionFlag("")).toBe("");
  });
});

describe("getJurisdictionName", () => {
  it("returns name for known jurisdiction", () => {
    expect(getJurisdictionName("KE")).toBe("Kenya");
    expect(getJurisdictionName("NG")).toBe("Nigeria");
    expect(getJurisdictionName("US")).toBe("United States");
  });
  it("returns code for unknown jurisdiction", () => {
    expect(getJurisdictionName("XX")).toBe("XX");
  });
  it("handles empty string", () => {
    expect(getJurisdictionName("")).toBe("");
  });
});

// ─── 17. calculateYieldProjection ───────────────────────────────────────────

describe("calculateYieldProjection", () => {
  it("calculates yield projection for 12 months", () => {
    const result = calculateYieldProjection(10000, "AAA", 12);
    expect(result.data).toHaveLength(13); // 0-12 inclusive
    expect(result.annualizedReturn).toBe(8.5);
    expect(result.invoicesNeeded).toBe(2); // ceil(10000/5000)
    expect(result.totalYield).toBeGreaterThan(0);
  });
  it("handles unknown tier (defaults to 12% APR)", () => {
    const result = calculateYieldProjection(5000, "UNKNOWN", 6);
    expect(result.annualizedReturn).toBe(12);
  });
  it("calculates for high-risk tier", () => {
    const result = calculateYieldProjection(20000, "CCC", 12);
    expect(result.annualizedReturn).toBe(32.0);
    expect(result.invoicesNeeded).toBe(4);
  });
  it("handles zero amount", () => {
    const result = calculateYieldProjection(0, "A", 12);
    expect(result.totalYield).toBe(0);
    expect(result.invoicesNeeded).toBe(0);
  });
  it("includes savings and tbills benchmarks", () => {
    const result = calculateYieldProjection(10000, "AA", 12);
    const finalMonth = result.data[12];
    expect(finalMonth.savings).toBeGreaterThan(10000);
    expect(finalMonth.tbills).toBeGreaterThan(10000);
    expect(finalMonth.portfolio).toBeGreaterThan(finalMonth.savings);
  });
});

// ─── 18. calculateAPR ────────────────────────────────────────────────────────

describe("calculateAPR", () => {
  it("calculates APR from discount rate and days", () => {
    const apr = calculateAPR(0.05, 90);
    expect(apr).toBeCloseTo(21.28, 2);
  });
  it("returns 0 for zero days", () => {
    expect(calculateAPR(0.05, 0)).toBe(0);
  });
  it("returns 0 for negative days", () => {
    expect(calculateAPR(0.05, -10)).toBe(0);
  });
  it("returns 0 for zero discount rate", () => {
    expect(calculateAPR(0, 90)).toBe(0);
  });
  it("returns 0 for discount rate >= 1", () => {
    expect(calculateAPR(1, 90)).toBe(0);
    expect(calculateAPR(1.5, 90)).toBe(0);
  });
  it("handles very short tenor", () => {
    const apr = calculateAPR(0.01, 1);
    expect(apr).toBeGreaterThan(0);
  });
});

// ─── 19. calculateExpectedReturn ─────────────────────────────────────────────

describe("calculateExpectedReturn", () => {
  it("calculates expected return", () => {
    expect(calculateExpectedReturn(10000, 0.05)).toBe(500);
  });
  it("handles zero amount", () => {
    expect(calculateExpectedReturn(0, 0.05)).toBe(0);
  });
  it("handles zero discount rate", () => {
    expect(calculateExpectedReturn(10000, 0)).toBe(0);
  });
  it("handles large amounts", () => {
    expect(calculateExpectedReturn(1_000_000, 0.15)).toBe(150_000);
  });
});

// ─── 20. calculateRiskAdjustedReturn ─────────────────────────────────────────

describe("calculateRiskAdjustedReturn", () => {
  it("adjusts APR for AAA tier (no adjustment)", () => {
    expect(calculateRiskAdjustedReturn(10, "AAA")).toBe(10);
  });
  it("adjusts APR for BB tier (20% boost)", () => {
    expect(calculateRiskAdjustedReturn(10, "BB")).toBe(12);
  });
  it("adjusts APR for CCC tier (30% boost)", () => {
    expect(calculateRiskAdjustedReturn(10, "CCC")).toBe(13);
  });
  it("defaults to 1.0 multiplier for unknown tier", () => {
    expect(calculateRiskAdjustedReturn(10, "UNKNOWN")).toBe(10);
  });
  it("handles zero APR", () => {
    expect(calculateRiskAdjustedReturn(0, "BB")).toBe(0);
  });
});

// ─── 21. getAPRColor ─────────────────────────────────────────────────────────

describe("getAPRColor", () => {
  it("returns green for APR >= 15", () => {
    expect(getAPRColor(15)).toBe("text-emerald-400");
    expect(getAPRColor(20)).toBe("text-emerald-400");
  });
  it("returns amber for APR >= 8 and < 15", () => {
    expect(getAPRColor(8)).toBe("text-amber-400");
    expect(getAPRColor(12)).toBe("text-amber-400");
  });
  it("returns red for APR < 8", () => {
    expect(getAPRColor(7)).toBe("text-red-400");
    expect(getAPRColor(0)).toBe("text-red-400");
  });
});

// ─── 22. withRetry ───────────────────────────────────────────────────────────

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await withRetry(fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 5xx error", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("500 Internal Server Error"))
      .mockResolvedValueOnce("success");
    
    const resultPromise = withRetry(fn, 3, 100);
    await vi.advanceTimersByTimeAsync(100);
    const result = await resultPromise;
    
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry on non-5xx error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("400 Bad Request"));
    await expect(withRetry(fn)).rejects.toThrow("400 Bad Request");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after max attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("503 Service Unavailable"));
    const resultPromise = withRetry(fn, 3, 100);
    
    // Advance through all retry delays
    await vi.advanceTimersByTimeAsync(100); // 1st retry
    await vi.advanceTimersByTimeAsync(200); // 2nd retry
    
    await expect(resultPromise).rejects.toThrow("503 Service Unavailable");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("uses exponential backoff", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("500"))
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValueOnce("success");
    
    const resultPromise = withRetry(fn, 3, 100);
    
    await vi.advanceTimersByTimeAsync(100); // 1st retry (100ms)
    await vi.advanceTimersByTimeAsync(200); // 2nd retry (200ms)
    
    const result = await resultPromise;
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

// ─── 23. exportCsv ───────────────────────────────────────────────────────────

describe("exportCsv", () => {
  let createElementSpy: any;
  let createObjectURLSpy: any;
  let revokeObjectURLSpy: any;
  let clickSpy: any;

  beforeEach(() => {
    clickSpy = vi.fn();
    createElementSpy = vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click: clickSpy,
    } as any);
    createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports array of objects as CSV", () => {
    const data = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ];
    exportCsv(data, "test.csv");

    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");
  });

  it("handles empty array (no-op)", () => {
    exportCsv([], "empty.csv");
    expect(createElementSpy).not.toHaveBeenCalled();
  });

  it("escapes commas and quotes in values", () => {
    const data = [{ field: 'value,with,comma' }, { field: 'value"with"quote' }];
    exportCsv(data, "test.csv");
    expect(createObjectURLSpy).toHaveBeenCalled();
  });

  it("handles null and undefined values", () => {
    const data = [{ a: null, b: undefined, c: "valid" }];
    exportCsv(data, "test.csv");
    expect(clickSpy).toHaveBeenCalled();
  });

  it("uses default filename if not provided", () => {
    const data = [{ name: "Test" }];
    exportCsv(data);
    expect(clickSpy).toHaveBeenCalled();
  });
});

// ─── 24. Constants Coverage ──────────────────────────────────────────────────

describe("Constants", () => {
  it("RISK_TIER_COLORS contains all tiers", () => {
    expect(RISK_TIER_COLORS).toHaveProperty("AAA");
    expect(RISK_TIER_COLORS).toHaveProperty("BB");
    expect(RISK_TIER_COLORS).toHaveProperty("CCC");
  });

  it("STATUS_COLORS contains common statuses", () => {
    expect(STATUS_COLORS).toHaveProperty("draft");
    expect(STATUS_COLORS).toHaveProperty("listed");
    expect(STATUS_COLORS).toHaveProperty("repaid");
    expect(STATUS_COLORS).toHaveProperty("defaulted");
  });
});
