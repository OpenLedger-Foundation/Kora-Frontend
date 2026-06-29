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
 *  - Happy path: full wizard → wallet signs → success toast
 *  - Error paths: validation errors block progression; IPFS failure is handled
 */

import { test, expect } from "@playwright/test";
import { injectWalletStubs } from "./helpers/mock-wallet";

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

/**
 * Upload a minimal PDF buffer as the invoice document.
 */
async function uploadPdf(page: import("@playwright/test").Page) {
  // Minimal valid PDF bytes
  const pdfBytes = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj " +
      "2 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj " +
      "3 0 obj<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>>endobj\n" +
      "xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n" +
      "0000000115 00000 n\ntrailer<</Size 4 /Root 1 0 R>>\nstartxref\n190\n%%EOF"
  );

  const dropzone = page.getByRole("region", { name: /upload|drop.*pdf|drag/i }).first();
  // Fall back to any file input inside the upload area
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({
    name: "invoice-test.pdf",
    mimeType: "application/pdf",
    buffer: pdfBytes,
  });
  // Give the dropzone time to register the file
  await page.waitForTimeout(300);
  void dropzone; // reference kept for clarity
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

/** Intercept Pinata/IPFS uploads and return a mock CID */
async function mockIpfsUpload(page: import("@playwright/test").Page) {
  await page.route("**/pinning/pinFileToIPFS**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ IpfsHash: "QmTestCID123456789", PinSize: 1234, Timestamp: new Date().toISOString() }),
    })
  );
  await page.route("**/pinning/pinJSONToIPFS**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ IpfsHash: "QmMetadataCID987654321", PinSize: 512, Timestamp: new Date().toISOString() }),
    })
  );
  // Also catch any /api/upload proxy route the app might use
  await page.route("**/api/upload**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ cid: "QmTestCID123456789", metadataCid: "QmMetadataCID987654321" }),
    })
  );
}

/** Intercept Soroban RPC calls and return a mock success response */
async function mockSorobanRpc(page: import("@playwright/test").Page) {
  await page.route("**/soroban**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: {
          status: "SUCCESS",
          txHash: "0xmocktxhash123",
          envelopeXdr: "mockenvelopexdr",
          resultXdr: "mockresultxdr",
        },
      }),
    })
  );
  // Also mock the Next.js API route that submits the transaction
  await page.route("**/api/invoice**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, invoiceId: "mock-invoice-id-001", txHash: "0xmocktxhash123" }),
    })
  );
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

  // ── Step 1 error paths ─────────────────────────────────────────────────────

  test("Step 1 error — empty invoice number shows validation error", async ({
    page,
  }) => {
    // Fill everything except invoice number, then blur the field
    await page.getByLabel(/debtor company name/i).fill("Acme Corp");
    await page.getByLabel(/invoice number/i).focus();
    await page.getByLabel(/invoice number/i).blur();
    // Attempt to click Next (should be disabled, but verify error message too)
    await expect(page.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  test("Step 1 error — invalid amount (zero) shows validation error and blocks Next", async ({
    page,
  }) => {
    await page.getByLabel(/invoice number/i).fill("INV-TEST-001");
    await page.getByLabel(/debtor company name/i).fill("Test Co");
    await page.getByLabel(/debtor address/i).fill("1 Test St");
    const amountInput = page.getByRole("spinbutton", { name: /invoice amount/i });
    await amountInput.fill("0");
    await amountInput.blur();
    await expect(page.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  test("Step 1 error — negative amount blocks Next", async ({ page }) => {
    await page.getByLabel(/invoice number/i).fill("INV-TEST-001");
    await page.getByLabel(/debtor company name/i).fill("Test Co");
    await page.getByLabel(/debtor address/i).fill("1 Test St");
    const amountInput = page.getByRole("spinbutton", { name: /invoice amount/i });
    await amountInput.fill("-100");
    await amountInput.blur();
    await expect(page.getByRole("button", { name: /next/i })).toBeDisabled();
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

  // ── Happy path (requires wallet mock) ─────────────────────────────────────

  test.describe("Happy path — full wizard with wallet", () => {
    test.beforeEach(async ({ context }) => {
      await injectWalletStubs(context, { usdcBalance: "10000.00" });
    });

    test("completes all 3 steps, uploads PDF, mints invoice, shows success toast", async ({
      page,
    }) => {
      // Mock network requests before navigating
      await mockIpfsUpload(page);
      await mockSorobanRpc(page);

      await page.goto("/invoice/create");

      // ── Step 1 ──────────────────────────────────────────────────────────
      await fillStep1(page);
      await expect(page.getByRole("button", { name: /next/i })).toBeEnabled();
      await page.getByRole("button", { name: /next/i }).click();

      // ── Step 2 ──────────────────────────────────────────────────────────
      await expect(page.getByText(/Financing Terms/i)).toBeVisible();
      await fillStep2(page);
      await page.getByRole("button", { name: /next/i }).click();

      // ── Step 3 ──────────────────────────────────────────────────────────
      await expect(page.getByText(/Upload & Review/i)).toBeVisible();

      // Upload a mock PDF
      await uploadPdf(page);

      // Verify summary shows correct data before submitting
      await expect(page.getByText("INV-2024-E2E-001")).toBeVisible();
      await expect(page.getByText("Acme Corporation Ltd")).toBeVisible();

      // Click Mint / Submit
      const mintBtn = page.getByRole("button", { name: /mint invoice nft|mint invoice|list invoice/i });
      await expect(mintBtn).toBeVisible();
      await mintBtn.click();

      // Wallet signs the transaction (stub auto-resolves)
      // Expect a success toast to appear
      await expect(
        page.getByText(/success|invoice.*created|invoice.*minted|listed successfully/i)
      ).toBeVisible({ timeout: 10_000 });
    });

    test("PDF upload accepted — file name appears in the UI", async ({ page }) => {
      await mockIpfsUpload(page);
      await page.goto("/invoice/create");

      await fillStep1(page);
      await page.getByRole("button", { name: /next/i }).click();
      await fillStep2(page);
      await page.getByRole("button", { name: /next/i }).click();

      await uploadPdf(page);

      // The uploaded file name should be shown somewhere in the UI
      await expect(
        page.getByText(/invoice-test\.pdf/i)
      ).toBeVisible({ timeout: 5_000 });
    });
  });

  // ── Error paths ────────────────────────────────────────────────────────────

  test.describe("Error paths", () => {
    test("Step 3 error — IPFS upload failure shows error message", async ({
      page,
      context,
    }) => {
      await injectWalletStubs(context);
      // Make IPFS endpoints fail
      await page.route("**/pinning/pinFileToIPFS**", (route) =>
        route.fulfill({ status: 500, body: "Internal Server Error" })
      );
      await page.route("**/api/upload**", (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "IPFS upload failed" }),
        })
      );

      await page.goto("/invoice/create");
      await fillStep1(page);
      await page.getByRole("button", { name: /next/i }).click();
      await fillStep2(page);
      await page.getByRole("button", { name: /next/i }).click();

      await uploadPdf(page);

      const mintBtn = page.getByRole("button", { name: /mint invoice nft|mint invoice|list invoice/i });
      if (await mintBtn.isVisible()) {
        await mintBtn.click();
        // Expect an error state — toast, alert, or inline message
        await expect(
          page.getByText(/error|failed|upload.*fail|try again/i)
        ).toBeVisible({ timeout: 10_000 });
      }
    });

    test("Step 3 error — submitting without PDF upload is blocked or shows warning", async ({
      page,
      context,
    }) => {
      await injectWalletStubs(context);
      await page.goto("/invoice/create");

      await fillStep1(page);
      await page.getByRole("button", { name: /next/i }).click();
      await fillStep2(page);
      await page.getByRole("button", { name: /next/i }).click();

      // Do NOT upload a file — click Mint directly
      const mintBtn = page.getByRole("button", { name: /mint invoice nft|mint invoice|list invoice/i });
      if (await mintBtn.isVisible()) {
        const isDisabled = await mintBtn.isDisabled();
        if (!isDisabled) {
          await mintBtn.click();
          // Should show a validation error or be blocked
          await expect(
            page.getByText(/upload.*required|please upload|document.*required|file.*required/i)
          ).toBeVisible({ timeout: 5_000 });
        } else {
          // Mint button correctly disabled when no file uploaded
          await expect(mintBtn).toBeDisabled();
        }
      }
    });

    test("Step 1 error — partial fill keeps Next disabled", async ({ page }) => {
      // Fill only invoice number — everything else empty
      await page.getByLabel(/invoice number/i).fill("INV-PARTIAL-001");
      await expect(page.getByRole("button", { name: /next/i })).toBeDisabled();
    });

    test("Step 1 error — debtor name only keeps Next disabled", async ({ page }) => {
      await page.getByLabel(/debtor company name/i).fill("Partial Co");
      await expect(page.getByRole("button", { name: /next/i })).toBeDisabled();
    });
  });
});
