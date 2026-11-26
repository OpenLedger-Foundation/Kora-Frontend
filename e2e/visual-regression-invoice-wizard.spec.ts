/**
 * Visual Regression — Invoice Wizard critical steps (#1229)
 *
 * Captures stable anchors for the three wizard steps that can silently break
 * the SME create flow when CSS drifts:
 *   1. invoice-details  — step 0, empty required-field state
 *   2. financing-terms  — step 1, live preview populated
 *   3. upload-review    — step 2, review summary populated
 *
 * Determinism measures:
 *   - Dedicated `visual-regression` Playwright project with a fixed 1280x800
 *     viewport and reduced motion
 *   - `Date.now()` frozen to 2025-03-15T12:00:00.000Z so dates and countdowns
 *     cannot drift between baseline capture and CI
 *   - Onboarding/changelog overlays and the KYB gate disabled via seeded
 *     localStorage state (KYB is still covered by its own unit/E2E tests)
 *   - `maxDiffPixelRatio: 0.005` — a diff above 0.5% fails the test
 *   - Dynamic ping animations and toast containers are masked
 *
 * Baseline workflow:
 *   1. `npm run test:visual -- --update-snapshots`
 *   2. Commit `e2e/visual-regression-invoice-wizard.spec.ts-snapshots/`
 *   3. CI runs `npm run test:visual` with no update flag
 */

import { test, expect, type Page } from "@playwright/test";

const FIXED_NOW_MS = 1742040000000;
const VIEWPORT = { width: 1280, height: 800 };
const MAX_DIFF_PIXEL_RATIO = 0.005;

const ANCHORS = {
  invoiceDetails: "invoice-details",
  financingTerms: "financing-terms",
  uploadReview: "upload-review",
} as const;

/** Deterministic date relative to the frozen clock. */
function fixedDate(daysFromFrozenNow: number): string {
  return new Date(FIXED_NOW_MS + daysFromFrozenNow * 86_400_000)
    .toISOString()
    .split("T")[0];
}

/** Freeze the clock, motion and overlays before any app JavaScript runs. */
async function prepareDeterministicPage(page: Page) {
  await page.addInitScript((fixedMs: number) => {
    const OriginalDate = Date;
    class FrozenDate extends OriginalDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        if (args.length === 0) {
          super(fixedMs);
        } else {
          // @ts-ignore — the union of Date constructor overloads
          super(...args);
        }
      }
      static now() {
        return fixedMs;
      }
      static parse(value: string) {
        return OriginalDate.parse(value);
      }
      static UTC(...args: Parameters<typeof Date.UTC>) {
        return OriginalDate.UTC(...args);
      }
    }
    (window as unknown as { Date: DateConstructor }).Date = FrozenDate;

    localStorage.setItem("kora-tour-done", "true");
    localStorage.setItem("kora-changelog-seen-version", "0.1.0");
    localStorage.setItem(
      "kora:feature-flag-overrides",
      JSON.stringify({ "kyb-mint-gate": false })
    );

    const style = document.createElement("style");
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `;
    document.head.appendChild(style);
  }, FIXED_NOW_MS);

  await page.emulateMedia({ reducedMotion: "reduce" });
}

/** Fill the required fields of step 0 using accessible labels. */
async function fillInvoiceDetails(page: Page) {
  await page.getByLabel(/invoice number/i).fill("INV-2025-VISUAL-001");
  await page.getByLabel(/debtor company name/i).fill("Visual Fixture Ltd");
  await page.getByLabel(/debtor address/i).fill("12 Baseline Street, Nairobi");
  await page
    .getByRole("spinbutton", { name: /invoice amount/i })
    .fill("50000");

  await page.evaluate((dateStr: string) => {
    const inputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="hidden"]'
    );
    for (const input of inputs) {
      const label = document.querySelector<HTMLLabelElement>(
        `label[for="${input.id}"]`
      );
      if (label && /due date/i.test(label.textContent ?? "")) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        setter?.call(input, dateStr);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        break;
      }
    }
  }, fixedDate(90));
}

/** Fill the required fields of step 1. */
async function fillFinancingTerms(page: Page) {
  await page.getByRole("spinbutton", { name: /discount rate/i }).fill("5");
  await page
    .getByRole("spinbutton", { name: /minimum investment/i })
    .fill("1000");

  await page.evaluate((dateStr: string) => {
    const inputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="hidden"]'
    );
    for (const input of inputs) {
      const label = document.querySelector<HTMLLabelElement>(
        `label[for="${input.id}"]`
      );
      if (label && /listing expiry/i.test(label.textContent ?? "")) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        setter?.call(input, dateStr);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        break;
      }
    }
  }, fixedDate(30));
}

/** Screenshot a single anchored wizard step. */
async function captureAnchor(page: Page, anchor: string, snapshotName: string) {
  const target = page.locator(`[data-visual-anchor="${anchor}"]`);
  await expect(target).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(150);

  await expect(target).toHaveScreenshot(snapshotName, {
    maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
    animations: "disabled",
    mask: [
      page.locator("[data-testid='countdown-timer']"),
      page.locator(".animate-ping"),
      page.locator("[data-sonner-toaster]"),
    ],
  });
}

test.use({ viewport: VIEWPORT });

test.describe("Invoice wizard — visual regression anchors", () => {
  test.beforeEach(async ({ page }) => {
    await prepareDeterministicPage(page);
    await page.goto("/invoice/create");
    await expect(
      page.locator(`[data-visual-anchor="${ANCHORS.invoiceDetails}"]`)
    ).toBeVisible({ timeout: 20_000 });
  });

  test("step 1 invoice details matches baseline", async ({ page }) => {
    await captureAnchor(
      page,
      ANCHORS.invoiceDetails,
      "wizard-invoice-details.png"
    );
  });

  test("step 2 financing terms matches baseline", async ({ page }) => {
    await fillInvoiceDetails(page);
    await page.getByRole("button", { name: /next/i }).click();
    await captureAnchor(
      page,
      ANCHORS.financingTerms,
      "wizard-financing-terms.png"
    );
  });

  test("step 3 upload and review matches baseline", async ({ page }) => {
    await fillInvoiceDetails(page);
    await page.getByRole("button", { name: /next/i }).click();
    await fillFinancingTerms(page);
    await page.getByRole("button", { name: /next/i }).click();
    await captureAnchor(
      page,
      ANCHORS.uploadReview,
      "wizard-upload-review.png"
    );
  });

  test("step 1 invoice details matches mobile baseline", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await captureAnchor(
      page,
      ANCHORS.invoiceDetails,
      "wizard-invoice-details-mobile.png"
    );
  });
});
