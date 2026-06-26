/**
 * E2E — Invoice Creation Wizard
 *
 * Covers:
 *  - Page loads with Step 1 visible
 *  - Step indicator shows all 3 steps
 *  - Back button is disabled on Step 1
 *  - Next button is disabled when Step 1 is empty
 *  - Filling Step 1 fields enables the Next button
 *  - Navigating to Step 2 shows Financing Terms fields
 *  - Live Financing Preview panel is visible on Step 2
 *  - Navigating to Step 3 shows Upload & Review
 *  - Step 3 shows the review summary with entered data
 *  - Back navigation from Step 2 returns to Step 1 with values preserved
 *  - Back navigation from Step 3 returns to Step 2
 *
 * Note: The wizard requires a connected wallet to submit.  Steps 1-3
 * navigation is fully testable without a wallet connection.
 */

import { test, expect } from "@playwright/test";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a date string N days from today in YYYY-MM-DD format */
function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

/**
 * Fill all required Step 1 fields.
 * Uses keyboard-friendly interactions that work with the custom components.
 */
async function fillStep1(page: import("@playwright/test").Page) {
  await page.getByLabel(/invoice number/i).fill("INV-2024-E2E-001");
  await page.getByLabel(/debtor company name/i).fill("Acme Corporation Ltd");
  await page.getByLabel(/debtor address/i).fill("123 Business Street, Nairobi, Kenya");

  // NumberInput for invoice amount — target the spinbutton
  const amountInput = page.getByRole("spinbutton", { name: /invoice amount/i });
  await amountInput.fill("50000");

  // DatePicker uses a hidden input; trigger it via the native value setter
  await page.evaluate((dateStr) => {
    const hiddenInputs = document.querySelectorAll<HTMLInputElement>('input[type="hidden"]');
    for (const inp of hiddenInputs) {
      const label = document.querySelector<HTMLLabelElement>(`label[for="${inp.id}"]`);
      if (label && /due date/i.test(label.textContent || "")) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        setter?.call(inp, dateStr);
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.dispatchEvent(new Event("change", { bubbles: true }));
        break;
      }
    }
  }, futureDate(90));
}

/**
 * Fill all required Step 2 fields.
 */
async function fillStep2(page: import("@playwright/test").Page) {
  const discountInput = page.getByRole("spinbutton", { name: /discount rate/i });
  await discountInput.fill("5");

  const minInvInput = page.getByRole("spinbutton", { name: /minimum investment/i });
  await minInvInput.fill("1000");

  // Listing expiry date
  await page.evaluate((dateStr) => {
    const hiddenInputs = document.querySelectorAll<HTMLInputElement>('input[type="hidden"]');
    for (const inp of hiddenInputs) {
      const label = document.querySelector<HTMLLabelElement>(`label[for="${inp.id}"]`);
      if (label && /listing expiry/i.test(label.textContent || "")) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        setter?.call(inp, dateStr);
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.dispatchEvent(new Event("change", { bubbles: true }));
        break;
      }
    }
  }, futureDate(30));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Invoice creation wizard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/invoice/create");
  });

  // ── Step 1 ────────────────────────────────────────────────────────────────

  test("Step 1 — page loads with Invoice Details heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Create Invoice/i })
    ).toBeVisible();
    await expect(page.getByText("Invoice Details")).toBeVisible();
  });

  test("Step 1 — step indicator shows all 3 steps", async ({ page }) => {
    await expect(page.getByText("Invoice Details")).toBeVisible();
    await expect(page.getByText("Financing Terms")).toBeVisible();
    await expect(page.getByText("Upload & Review")).toBeVisible();
  });

  test("Step 1 — Back button is disabled", async ({ page }) => {
    await expect(page.getByRole("button", { name: /back/i })).toBeDisabled();
  });

  test("Step 1 — Next button is disabled when form is empty", async ({
    page,
  }) => {
    await expect(page.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  test("Step 1 — all required fields are present", async ({ page }) => {
    await expect(page.getByLabel(/invoice number/i)).toBeVisible();
    await expect(page.getByLabel(/debtor company name/i)).toBeVisible();
    await expect(page.getByLabel(/debtor address/i)).toBeVisible();
    await expect(
      page.getByRole("spinbutton", { name: /invoice amount/i })
    ).toBeVisible();
    await expect(page.getByText(/^due date$/i)).toBeVisible();
    await expect(page.getByLabel(/jurisdiction/i)).toBeVisible();
    await expect(page.getByLabel(/industry category/i)).toBeVisible();
  });

  test("Step 1 — jurisdiction defaults to Kenya", async ({ page }) => {
    const select = page.getByLabel(/jurisdiction/i);
    await expect(select).toHaveValue("KE");
  });

  test("Step 1 — category defaults to technology", async ({ page }) => {
    const select = page.getByLabel(/industry category/i);
    await expect(select).toHaveValue("technology");
  });

  test("Step 1 — Next button enables after filling all required fields", async ({
    page,
  }) => {
    await fillStep1(page);
    await expect(page.getByRole("button", { name: /next/i })).toBeEnabled();
  });

  // ── Step 2 ────────────────────────────────────────────────────────────────

  test("Step 2 — navigating from Step 1 shows Financing Terms", async ({
    page,
  }) => {
    await fillStep1(page);
    await page.getByRole("button", { name: /next/i }).click();

    await expect(page.getByText(/Financing Terms/i)).toBeVisible();
    await expect(page.getByRole("slider")).toBeVisible();
  });

  test("Step 2 — discount rate slider and number input are present", async ({
    page,
  }) => {
    await fillStep1(page);
    await page.getByRole("button", { name: /next/i }).click();

    await expect(page.getByRole("slider")).toBeVisible();
    await expect(
      page.getByRole("spinbutton", { name: /discount rate/i })
    ).toBeVisible();
  });

  test("Step 2 — minimum investment and listing expiry fields are present", async ({
    page,
  }) => {
    await fillStep1(page);
    await page.getByRole("button", { name: /next/i }).click();

    await expect(
      page.getByRole("spinbutton", { name: /minimum investment/i })
    ).toBeVisible();
    await expect(page.getByText(/listing expiry date/i)).toBeVisible();
  });

  test("Step 2 — Live Financing Preview panel is visible", async ({ page }) => {
    await fillStep1(page);
    await page.getByRole("button", { name: /next/i }).click();

    await expect(page.getByText(/Live Financing Preview/i)).toBeVisible();
    await expect(page.getByText(/Financing Amount/i)).toBeVisible();
    await expect(page.getByText(/Investor Payout at Maturity/i)).toBeVisible();
  });

  test("Step 2 — financing amount updates when discount rate changes", async ({
    page,
  }) => {
    await fillStep1(page);
    await page.getByRole("button", { name: /next/i }).click();

    const discountInput = page.getByRole("spinbutton", { name: /discount rate/i });
    await discountInput.fill("5");
    // $50,000 * (1 - 0.05) = $47,500
    await expect(page.getByText(/47,500/)).toBeVisible();
  });

  test("Step 2 — Back button returns to Step 1", async ({ page }) => {
    await fillStep1(page);
    await page.getByRole("button", { name: /next/i }).click();
    await expect(page.getByText(/Financing Terms/i)).toBeVisible();

    await page.getByRole("button", { name: /back/i }).click();
    await expect(page.getByText("Invoice Details")).toBeVisible();
    await expect(page.getByLabel(/invoice number/i)).toBeVisible();
  });

  test("Step 2 — values are preserved when navigating back to Step 1", async ({
    page,
  }) => {
    await fillStep1(page);
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByRole("button", { name: /back/i }).click();

    // Invoice number should still be filled
    await expect(page.getByLabel(/invoice number/i)).toHaveValue(
      "INV-2024-E2E-001"
    );
  });

  // ── Step 3 ────────────────────────────────────────────────────────────────

  test("Step 3 — navigating from Step 2 shows Upload & Review", async ({
    page,
  }) => {
    await fillStep1(page);
    await page.getByRole("button", { name: /next/i }).click();
    await fillStep2(page);
    await page.getByRole("button", { name: /next/i }).click();

    await expect(page.getByText(/Upload & Review/i)).toBeVisible();
  });

  test("Step 3 — invoice document upload area is visible", async ({ page }) => {
    await fillStep1(page);
    await page.getByRole("button", { name: /next/i }).click();
    await fillStep2(page);
    await page.getByRole("button", { name: /next/i }).click();

    await expect(page.getByText(/Invoice Document/i)).toBeVisible();
  });

  test("Step 3 — review summary shows entered invoice data", async ({
    page,
  }) => {
    await fillStep1(page);
    await page.getByRole("button", { name: /next/i }).click();
    await fillStep2(page);
    await page.getByRole("button", { name: /next/i }).click();

    // Summary should show the invoice number and debtor from Step 1
    await expect(page.getByText("INV-2024-E2E-001")).toBeVisible();
    await expect(page.getByText("Acme Corporation Ltd")).toBeVisible();
  });

  test("Step 3 — Back button returns to Step 2", async ({ page }) => {
    await fillStep1(page);
    await page.getByRole("button", { name: /next/i }).click();
    await fillStep2(page);
    await page.getByRole("button", { name: /next/i }).click();

    await page.getByRole("button", { name: /back/i }).click();
    await expect(page.getByText(/Live Financing Preview/i)).toBeVisible();
  });

  test("Step 3 — Submit button is visible", async ({ page }) => {
    await fillStep1(page);
    await page.getByRole("button", { name: /next/i }).click();
    await fillStep2(page);
    await page.getByRole("button", { name: /next/i }).click();

    // Submit / Mint button
    await expect(
      page.getByRole("button", { name: /mint invoice|submit|list invoice/i })
    ).toBeVisible();
  });
});
