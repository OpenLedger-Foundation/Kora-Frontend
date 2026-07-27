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
  //   2. Read the measured values from the "=== Measured Web Vitals ===" block
  //      in the output.
  //   3. Or regenerate automatically:
  //        UPDATE_VITALS_BASELINE=true npx playwright test e2e/performance
  //   4. Commit the updated performance-baseline.json **in the same PR**, and
  //      say in the description why the regression is acceptable.
  //
  // Never update the baseline on main to make a red build go green — that
  // silently ratchets the budget and defeats the gate.

  test("web vitals have not regressed beyond baseline", async ({ page }, testInfo) => {
    await page.goto("/marketplace");
    await page.waitForLoadState("networkidle");

    // LCP is only finalised once the page stops producing new candidates.
    // Scrolling would restart that, so measure a settled initial viewport.
    await page.waitForTimeout(1_000);

    const vitals = await collectWebVitals(page);

    console.log("=== Measured Web Vitals ===");
    console.log(JSON.stringify(vitals, null, 2));

    // Feed the app's own ingest endpoint with the E2E run, so /api/vitals sees
    // synthetic traffic on every CI run and a broken handler surfaces here
    // rather than silently dropping real user metrics in production.
    const ingest = await page.request.post("/api/vitals", {
      data: {
        metrics: Object.entries(vitals).map(([name, value]) => ({
          name,
          value,
          id: `e2e-${name}-${Date.now()}`,
          label: "e2e",
          startTime: 0,
          rating: "good",
          url: "/marketplace",
          userAgent: "playwright",
          timestamp: Date.now(),
        })),
      },
    });
    expect(
      ingest.status(),
      "/api/vitals should accept the E2E vitals payload",
    ).toBe(204);

    if (process.env.UPDATE_VITALS_BASELINE === "true") {
      const existing = fs.existsSync(baselinePath)
        ? (JSON.parse(fs.readFileSync(baselinePath, "utf-8")) as BaselineFile)
        : {};
      fs.writeFileSync(
        baselinePath,
        `${JSON.stringify({ ...existing, webVitals: vitals }, null, 2)}\n`,
      );
      console.log(`\n💾  Web Vitals baseline updated at ${baselinePath}\n`);
      test.skip(true, "Baseline regenerated — skipping the gate for this run.");
      return;
    }

    const baseline = fs.existsSync(baselinePath)
      ? (JSON.parse(fs.readFileSync(baselinePath, "utf-8")) as BaselineFile)
      : undefined;

    const report = evaluateVitalsRegression(vitals, baseline?.webVitals);

    for (const entry of report.passed) {
      console.log(`✅  ${formatRegression(entry)}`);
    }
    if (report.skipped.length > 0) {
      console.log(
        `ℹ️  Skipped (no baseline or not measured): ${report.skipped.join(", ")}`,
      );
    }

    for (const regression of report.regressions) {
      const message = `[PERF REGRESSION] ${formatRegression(regression)}`;
      console.error(message);
      testInfo.annotations.push({
        type: "performance-regression",
        description: message,
      });
    }

    // A run where nothing could be compared is not a pass — it means the
    // collector broke, or the baseline is missing the gated metrics, and
    // reporting green would hide that the gate is not actually running.
    expect(
      report.passed.length + report.regressions.length,
      `no gated vitals could be compared (skipped: ${report.skipped.join(", ") || "none"}). ` +
        `Expected at least one of ${GATED_VITALS.join(", ")} in both the run and performance-baseline.json.`,
    ).toBeGreaterThan(0);

    expect(
      report.regressions.map(formatRegression),
      `Web Vitals regressed by more than ${REGRESSION_THRESHOLD_PCT * 100}% vs performance-baseline.json.\n` +
        `If this regression is intentional, regenerate the baseline with\n` +
        `  UPDATE_VITALS_BASELINE=true npx playwright test e2e/performance\n` +
        `and commit performance-baseline.json in this PR with a justification.`,
    ).toEqual([]);
  });
});
