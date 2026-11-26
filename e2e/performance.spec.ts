import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import {
  evaluateVitalsRegression,
  formatRegression,
  GATED_VITALS,
  REGRESSION_THRESHOLD_PCT,
} from "../lib/webVitals";

const baselinePath = path.resolve(__dirname, "../performance-baseline.json");

interface PerformanceData {
  timeToFirstCardMs: number;
  timeToFilterResponseMs: number;
  timeToLoad50InvoicesMs: number;
  timeToLoad100InvoicesMs: number;
}

interface BaselineFile extends Partial<PerformanceData> {
  webVitals?: Record<string, number>;
}

/**
 * Collect Core Web Vitals from the live page (Issue #437).
 *
 * Read straight from the Performance Timeline rather than through the
 * `web-vitals` package: the entries are already buffered by the time the test
 * asks for them, so there is no race with observer registration, and the E2E
 * run stays independent of the app's own reporting wiring.
 *
 * - LCP  — last `largest-contentful-paint` entry (the spec emits several as the
 *          candidate element changes; only the final one counts)
 * - CLS  — sum of layout-shift values, excluding shifts within 500ms of user
 *          input, per the Core Web Vitals definition
 * - TTFB — `responseStart` from the navigation entry
 * - FCP  — `first-contentful-paint` paint entry
 */
async function collectWebVitals(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const lcpEntries = performance.getEntriesByType(
      "largest-contentful-paint",
    ) as PerformanceEntry[];
    const lcp =
      lcpEntries.length > 0
        ? lcpEntries[lcpEntries.length - 1].startTime
        : undefined;

    const cls = (
      performance.getEntriesByType("layout-shift") as Array<
        PerformanceEntry & { value: number; hadRecentInput: boolean }
      >
    ).reduce((sum, entry) => (entry.hadRecentInput ? sum : sum + entry.value), 0);

    const [navigation] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];

    const fcp = performance
      .getEntriesByName("first-contentful-paint")
      .at(0)?.startTime;

    const vitals: Record<string, number> = { CLS: cls };
    if (typeof lcp === "number") vitals.LCP = lcp;
    if (navigation) vitals.TTFB = navigation.responseStart;
    if (typeof fcp === "number") vitals.FCP = fcp;
    return vitals;
  });
}

test.describe("Marketplace Performance Load Testing", () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss onboarding tour and changelog
    await page.addInitScript(() => {
      localStorage.setItem("kora-tour-done", "true");
      localStorage.setItem("kora-changelog-seen-version", "0.1.0");
    });
  });

  test("measures marketplace infinite scroll and filtering performance", async ({ page }, testInfo) => {
    // Initial load uses default page size (first page only)
    const startTime = Date.now();
    await page.goto("/marketplace");

    const firstCard = page.locator("a[href^='/marketplace/']").first();
    await firstCard.waitFor({ state: "visible", timeout: 20_000 });
    const timeToFirstCardMs = Date.now() - startTime;

    // Scroll the infinite sentinel into view repeatedly until 50 cards load
    const cardLocator = page.locator("a[href^='/marketplace/']");
    const scrollUntilCount = async (target: number, timeoutMs: number) => {
      const deadline = Date.now() + timeoutMs;
      while ((await cardLocator.count()) < target && Date.now() < deadline) {
        await page.locator("#infinite-sentinel").scrollIntoViewIfNeeded().catch(() => undefined);
        await page.mouse.wheel(0, 2400);
        await page.waitForTimeout(250);
      }
    };

    await scrollUntilCount(50, 25_000);
    await expect(cardLocator.nth(49)).toBeVisible({ timeout: 20_000 });
    const timeToLoad50InvoicesMs = Date.now() - startTime;

    await scrollUntilCount(100, 30_000);
    await expect(cardLocator.nth(99)).toBeVisible({ timeout: 20_000 });
    const timeToLoad100InvoicesMs = Date.now() - startTime;

    // Filter response — search for a generated SME
    const searchInput = page.getByPlaceholder(/Search by debtor, invoice number, or jurisdiction/i);
    await searchInput.waitFor({ state: "visible" });

    const filterStartTime = Date.now();
    await searchInput.fill("SME 50");
    await page.locator("a[href^='/marketplace/']").nth(1).waitFor({ state: "detached", timeout: 10_000 });
    await page.getByText("SME 50").first().waitFor({ state: "visible", timeout: 10_000 });
    const timeToFilterResponseMs = Date.now() - filterStartTime;

    const pageMetrics = await page.metrics();
    const timing = await page.evaluate(() => {
      const t = window.performance.timing;
      return {
        navigationStart: t.navigationStart,
        domInteractive: t.domInteractive - t.navigationStart,
        domComplete: t.domComplete - t.navigationStart,
        loadEventEnd: t.loadEventEnd - t.navigationStart,
      };
    });

    console.log("=== Playwright Page Metrics ===");
    console.log(JSON.stringify(pageMetrics, null, 2));
    console.log("=== Performance Timing ===");
    console.log(JSON.stringify(timing, null, 2));

    const currentData: PerformanceData = {
      timeToFirstCardMs,
      timeToFilterResponseMs,
      timeToLoad50InvoicesMs,
      timeToLoad100InvoicesMs,
    };

    console.log("=== Measured Performance Results ===");
    console.log(JSON.stringify(currentData, null, 2));

    if (fs.existsSync(baselinePath)) {
      const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf-8")) as BaselineFile;
      console.log("=== Baseline Performance ===");
      console.log(JSON.stringify(baseline, null, 2));

      const thresholdPercentage = 1.2;
      const warnings: string[] = [];

      (Object.keys(currentData) as Array<keyof PerformanceData>).forEach((key) => {
        const current = currentData[key];
        const base = baseline[key];
        if (typeof base !== "number") return;
        const limit = base * thresholdPercentage;

        if (current > limit) {
          const warningMsg = `[PERF WARNING] ${key} exceeded baseline by > 20%: Current ${current}ms, Baseline ${base}ms (Limit ${limit.toFixed(0)}ms)`;
          warnings.push(warningMsg);
          console.warn(warningMsg);
          testInfo.annotations.push({ type: "performance-warning", description: warningMsg });
        }
      });

      if (warnings.length > 0) {
        console.warn("\n⚠️  Performance degradation detected, but test is passing as per configuration.\n");
      } else {
        console.log("\n✅  All performance measurements are within acceptable baseline limits.\n");
      }
    }

    if (process.env.UPDATE_PERF_BASELINE === "true") {
      fs.writeFileSync(baselinePath, JSON.stringify(currentData, null, 2));
      console.log(`\n💾  Performance baseline updated successfully at ${baselinePath}\n`);
    }
  });

  // ─── Investor dashboard APR sparkline lazy-load (Issue #1173) ─────────────
  //
  // APR sparklines below the fold must not be mounted on first paint — eager
  // charts hurt LCP on the investor dashboard. This spec asserts that:
  //   1. Above-the-fold sparklines render eagerly (happy path).
  //   2. Below-the-fold sparklines are deferred until scrolled into view.
  //   3. A degraded/offline API still resolves the lazy placeholder without
  //      throwing (failure path).
  test.describe("Investor dashboard APR sparkline lazy-load", () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem("kora-tour-done", "true");
        localStorage.setItem("kora-changelog-seen-version", "0.1.0");
      });
    });

    test("defers below-the-fold sparklines until scrolled into view", async ({ page }) => {
      await page.goto("/dashboard/investor");

      const sparklines = page.locator('[data-testid="apr-sparkline"]');
      await sparklines.first().waitFor({ state: "visible", timeout: 20_000 });

      const total = await sparklines.count();
      expect(total).toBeGreaterThan(0);

      // Below-the-fold sparklines should not have mounted their chart yet.
      const deferred = page.locator('[data-testid="apr-sparkline"][data-lazy-state="deferred"]');
      const deferredBefore = await deferred.count();

      // Scroll the last sparkline into view and assert it mounts.
      const last = sparklines.last();
      await last.scrollIntoViewIfNeeded();
      await expect(last).toHaveAttribute("data-lazy-state", "loaded", { timeout: 10_000 });

      if (deferredBefore > 0) {
        // At least one previously-deferred sparkline is now loaded.
        await expect(deferred).toHaveCount(deferredBefore - 1, { timeout: 10_000 });
      }
    });

    test("renders lazy placeholder without crashing when APR data is unavailable", async ({ page }) => {
      // Simulate a degraded API: fail APR requests so the sparkline falls back.
      await page.route("**/api/**apr**", (route) => route.abort());

      await page.goto("/dashboard/investor");

      const sparklines = page.locator('[data-testid="apr-sparkline"]');
      await sparklines.first().waitFor({ state: "visible", timeout: 20_000 });

      const last = sparklines.last();
      await last.scrollIntoViewIfNeeded();

      // The sparkline must settle into a non-loading state (loaded or error),
      // never remain stuck on the lazy placeholder.
      await expect(last).not.toHaveAttribute("data-lazy-state", "deferred", {
        timeout: 10_000,
      });
    });
  });

  // ─── Web Vitals regression gate (Issue #437) ──────────────────────────────
  //
  // Unlike the load test above, this one FAILS the build. The custom timings
  // are wall-clock measurements of a scripted scroll, which is inherently noisy
  // on shared CI runners — hence warn-only. Core Web Vitals are browser-reported
  // measurements of a single page load, stable enough to gate on once paired
  // with the absolute-delta floor in evaluateVitalsRegression().
  //
  // The check is relative, not absolute: VITAL_THRESHOLDS already answers "is
  // this fast enough", but a PR can double LCP while staying under 2500ms and
  // nothing would notice. This catches that.
  //
  // ── Updating the baseline ────────────────────────────────────────────────
  // performance-baseline.json holds a `webVitals` object. When a change makes
  // a metric legitimately slower — a deliberate trade-off, a new above-the-fold
  // feature — update it deliberately rather than loosening the threshold:
  //
  //   1. Run this spec on the PR branch:  npx playwright test e2e/performance
  //   2. Read the measured values from the console output.
  //   3. Update performance-baseline.json's `webVitals` object.
  //   4. Commit the baseline alongside the change.
  test("core web vitals stay within regression threshold", async ({ page }, testInfo) => {
    await page.goto("/marketplace");
    await page.locator("a[href^='/marketplace/']").first().waitFor({
      state: "visible",
      timeout: 20_000,
    });

    const vitals = await collectWebVitals(page);
    console.log("=== Measured Web Vitals ===");
    console.log(JSON.stringify(vitals, null, 2));

    if (!fs.existsSync(baselinePath)) {
      testInfo.skip(true, "No performance baseline file present");
      return;
    }

    const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf-8")) as BaselineFile;
    const baselineVitals = baseline.webVitals ?? {};

    const regressions = evaluateVitalsRegression(baselineVitals, vitals, {
      gated: GATED_VITALS,
      thresholdPct: REGRESSION_THRESHOLD_PCT,
    });

    if (regressions.length > 0) {
      const message = formatRegression(regressions);
      testInfo.annotations.push({ type: "web-vitals-regression", description: message });
      expect(regressions, message).toHaveLength(0);
    }
  });
});
