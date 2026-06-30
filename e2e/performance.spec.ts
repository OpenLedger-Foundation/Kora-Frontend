import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const baselinePath = path.resolve(__dirname, "../performance-baseline.json");

interface PerformanceData {
  timeToFirstCardMs: number;
  timeToFilterResponseMs: number;
  timeToLoad50InvoicesMs: number;
}

test.describe("Marketplace Performance Load Testing", () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss onboarding tour and changelog
    await page.addInitScript(() => {
      localStorage.setItem("kora-tour-done", "true");
      localStorage.setItem("kora-changelog-seen-version", "0.1.0");
    });
  });

  test("measures marketplace page load, rendering, and filtering performance", async ({ page }, testInfo) => {
    // 1. Navigate to marketplace with pageSize=50 to load all 50 invoices on the page
    const startTime = Date.now();
    await page.goto("/marketplace?pageSize=50");

    // Wait for the first invoice card to be visible in the DOM
    const firstCard = page.locator("a[href^='/marketplace/']").first();
    await firstCard.waitFor({ state: "visible", timeout: 20_000 });
    const timeToFirstCardMs = Date.now() - startTime;

    // Wait for the 50th invoice card to be visible in the DOM
    const fiftiethCard = page.locator("a[href^='/marketplace/']").nth(49);
    await fiftiethCard.waitFor({ state: "visible", timeout: 20_000 });
    const timeToLoad50InvoicesMs = Date.now() - startTime;

    // 2. Measure Time to Filter Response (Search for a specific card)
    const searchInput = page.getByPlaceholder(/Search by debtor, invoice number, or jurisdiction/i);
    await searchInput.waitFor({ state: "visible" });

    const filterStartTime = Date.now();
    // Search for "SME 50" which will filter the list down to exactly one card
    await searchInput.fill("SME 50");

    // Wait until the second card is detached (i.e. only 1 card remains) and "SME 50" is visible
    await page.locator("a[href^='/marketplace/']").nth(1).waitFor({ state: "detached", timeout: 10_000 });
    await page.getByText("SME 50").first().waitFor({ state: "visible", timeout: 10_000 });
    const timeToFilterResponseMs = Date.now() - filterStartTime;

    // 3. Extract Playwright's Page Metrics and performance.timing
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
    };

    console.log("=== Measured Performance Results ===");
    console.log(JSON.stringify(currentData, null, 2));

    // 4. Load baseline and compare
    if (fs.existsSync(baselinePath)) {
      const baseline: PerformanceData = JSON.parse(fs.readFileSync(baselinePath, "utf-8"));
      console.log("=== Baseline Performance ===");
      console.log(JSON.stringify(baseline, null, 2));

      const thresholdPercentage = 1.2; // 20% degradation threshold
      const warnings: string[] = [];

      (Object.keys(currentData) as Array<keyof PerformanceData>).forEach((key) => {
        const current = currentData[key];
        const base = baseline[key];
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

    // 5. Update baseline if requested via environment variable
    if (process.env.UPDATE_PERF_BASELINE === "true") {
      fs.writeFileSync(baselinePath, JSON.stringify(currentData, null, 2));
      console.log(`\n💾  Performance baseline updated successfully at ${baselinePath}\n`);
    }
  });
});
