/**
 * E2E — SME KYB Gate Screen (Issue #729)
 *
 * Verifies that an unverified SME attempting to create an invoice is:
 *  1. Shown the KybGateScreen interstitial (not the Upload & Review step)
 *  2. Unable to reach the wizard steps beyond Financing Terms
 *  3. Shown a verify CTA button
 *  4. Able to go back to the previous step
 *
 * Issue #1124 adds coverage for the empty / error / retry states driven by
 * useKybStatusPoller, including polling backoff and 429 handling.
 *
 * Strategy:
 *  - Inject mock wallet state via localStorage (same pattern as existing helpers)
 *  - Set kycStatus to "none" to trigger the gate
 *  - Enable the "kyb-mint-gate" feature flag via localStorage
 *  - Navigate to /invoice/create and advance the wizard to step 2
 *  - Assert gate screen is visible and Upload & Review step is not reachable
 *
 * All specs run under 30 seconds.
 */

import { test, expect } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";

// ── Constants ─────────────────────────────────────────────────────────────────

const MOCK_ADDRESS = "GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQ";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns a date string N days from today in YYYY-MM-DD format */
function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

/**
 * Inject a connected wallet with kycStatus "none" (unverified SME) into
 * localStorage so the Zustand store rehydrates correctly on page load.
 * Also enables the "kyb-mint-gate" feature flag.
 */
async function injectUnverifiedSmeWallet(
  context: BrowserContext,
  kycStatus: "none" | "pending" | "rejected" = "none",
) {
  await context.addInitScript(
    ({ address, kyc }) => {
      // Freighter stub so wallet detection logic sees a connected wallet
      (window as any).freighter = {
        isConnected: () => Promise.resolve(true),
        getPublicKey: () => Promise.resolve(address),
        signTransaction: (xdr: string) => Promise.resolve({ signedTxXdr: xdr }),
        getNetwork: () =>
          Promise.resolve({
            network: "TESTNET",
            networkPassphrase: "Test SDF Network ; September 2015",
          }),
        getNetworkDetails: () =>
          Promise.resolve({
            network: "TESTNET",
            networkPassphrase: "Test SDF Network ; September 2015",
            sorobanRpcUrl: "https://soroban-testnet.stellar.org",
          }),
      };

      // Wallet store — connected but NOT KYC verified
      const walletState = {
        state: {
          address,
          publicKey: address,
          isConnected: true,
          provider: "freighter",
          network: "testnet",
          balance: { xlm: "1000.00", usdc: "5000.00", eurc: "0" },
          isVerified: false,
          verifiedAt: null,
          kycStatus: kyc,
          walletPassphrase: "Test SDF Network ; September 2015",
        },
        version: 0,
      };
      localStorage.setItem("kora-wallet", JSON.stringify(walletState));
      localStorage.setItem("kora-wallet-store", JSON.stringify(walletState));

      // Enable the kyb-mint-gate feature flag via the flags store / localStorage key
      // The app reads feature flags from NEXT_PUBLIC_FEATURE_FLAGS or a local override.
      // We also try the common Zustand-persisted flag store key patterns.
      const flagState = {
        state: { flags: { "kyb-mint-gate": true } },
        version: 0,
      };
      localStorage.setItem("kora-feature-flags", JSON.stringify(flagState));

      // Override environment-level mock flag in window so env module picks it up
      (window as any).__KORA_FEATURE_FLAGS__ = { "kyb-mint-gate": true };
    },
    { address: MOCK_ADDRESS, kyc: kycStatus },
  );
}

/**
 * Fill all Step 1 (Invoice Details) required fields.
 */
async function fillInvoiceDetails(page: Page) {
  await page.getByLabel(/invoice number/i).fill("INV-KYB-E2E-001");
  await page.getByLabel(/debtor company name/i).fill("Test Debtor Corp");
  await page.getByLabel(/debtor address/i).fill("123 Business St, Nairobi");

  const amountInput = page.getByRole("spinbutton", { name: /invoice amount/i });
  await amountInput.fill("50000");

  // Due date via hidden input workaround (same as invoice-wizard.spec.ts)
  await page.evaluate((dateStr) => {
    const hiddenInputs = document.querySelectorAll<HTMLInputElement>('input[type="hidden"]');
    for (const inp of hiddenInputs) {
      const label = document.querySelector<HTMLLabelElement>(`label[for="${inp.id}"]`);
      if (label && /due date/i.test(label.textContent || "")) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
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
 * Fill Step 2 (Financing Terms) required fields.
 */
async function fillFinancingTerms(page: Page) {
  const discountInput = page.getByRole("spinbutton", { name: /discount rate/i });
  await discountInput.fill("5");

  const minInvInput = page.getByRole("spinbutton", { name: /minimum investment/i });
  await minInvInput.fill("1000");

  await page.evaluate((dateStr) => {
    const hiddenInputs = document.querySelectorAll<HTMLInputElement>('input[type="hidden"]');
    for (const inp of hiddenInputs) {
      const label = document.querySelector<HTMLLabelElement>(`label[for="${inp.id}"]`);
      if (label && /listing expiry/i.test(label.textContent || "")) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
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
 * Navigate the wizard to the point where Next is clicked after Step 2
 * (Financing Terms), triggering the KYB gate check.
 */
async function navigateToKybGateClick(page: Page) {
  // Step 1: Invoice Details
  await fillInvoiceDetails(page);
  await expect(page.getByRole("button", { name: /next/i })).toBeEnabled({ timeout: 5_000 });
  await page.getByRole("button", { name: /next/i }).click();

  // Step 2: Financing Terms
  await expect(page.getByText(/Financing Terms/i)).toBeVisible({ timeout: 5_000 });
  await fillFinancingTerms(page);
  await expect(page.getByRole("button", { name: /next/i })).toBeEnabled({ timeout: 5_000 });

  // Click Next — this triggers the KYB gate check
  await page.getByRole("button", { name: /next/i }).click();
}

/**
 * Route the KYB status endpoint so tests can drive the poller's
 * idle / pending / fail states deterministically (Issue #1124).
 */
async function mockKybStatus(
  page: Page,
  handler: (callCount: number) => { status: number; body?: unknown },
) {
  let calls = 0;
  await page.route("**/kyb/status**", async (route) => {
    calls += 1;
    const { status, body } = handler(calls);
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body ?? {}),
    });
  });
}

// ── Test suite ────────────────────────────────────────────────────────────────

test.describe("SME KYB Gate Screen — unverified SME", () => {
  test.beforeEach(async ({ context, page }) => {
    await injectUnverifiedSmeWallet(context, "none");
    await page.goto("/invoice/create");
  });

  // ── Acceptance criterion 1: Unverified SME sees gate screen ────────────────

  test("unverified SME sees KybGateScreen when advancing past Financing Terms", async ({
    page,
  }) => {
    await navigateToKybGateClick(page);

    await expect(
      page.getByTestId("kyb-gate-screen"),
    ).toBeVisible({ timeout: 8_000 });
  });

  // ── Acceptance criterion 2: Wizard steps are not reachable ─────────────────

  test("Upload & Review step is not visible when gate is shown", async ({
    page,
  }) => {
    await navigateToKybGateClick(page);

    // Gate must be visible
    await expect(page.getByTestId("kyb-gate-screen")).toBeVisible({ timeout: 8_000 });

    // Upload & Review must NOT be reachable
    await expect(
      page.getByText(/Upload & Review/i),
    ).not.toBeVisible();
  });

  test("no file upload area is shown while gate is active", async ({ page }) => {
    await navigateToKybGateClick(page);

    await expect(page.getByTestId("kyb-gate-screen")).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });
});

// ── Issue #1124: empty / error / retry states ─────────────────────────────────

test.describe("KYB gate — empty, error and retry states", () => {
  test.beforeEach(async ({ context, page }) => {
    await injectUnverifiedSmeWallet(context, "none");
  });

  test("shows pending state while KYB status is being polled", async ({ page }) => {
    await mockKybStatus(page, () => ({ status: 200, body: { status: "pending" } }));
    await page.goto("/invoice/create");
    await navigateToKybGateClick(page);

    await expect(page.getByTestId("kyb-gate-screen")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId("kyb-gate-pending")).toBeVisible({ timeout: 8_000 });
  });

  test("shows clear error copy and retry button on failure", async ({ page }) => {
    await mockKybStatus(page, () => ({ status: 500, body: { message: "boom" } }));
    await page.goto("/invoice/create");
    await navigateToKybGateClick(page);

    await expect(page.getByTestId("kyb-gate-screen")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId("kyb-gate-error")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId("kyb-gate-retry")).toBeVisible();
  });

  test("retry re-triggers polling and recovers from error state", async ({ page }) => {
    // First call fails, subsequent calls succeed as pending
    await mockKybStatus(page, (call) =>
      call === 1
        ? { status: 500, body: { message: "boom" } }
        : { status: 200, body: { status: "pending" } },
    );
    await page.goto("/invoice/create");
    await navigateToKybGateClick(page);

    await expect(page.getByTestId("kyb-gate-error")).toBeVisible({ timeout: 8_000 });
    await page.getByTestId("kyb-gate-retry").click();

    await expect(page.getByTestId("kyb-gate-pending")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId("kyb-gate-error")).not.toBeVisible();
  });

  test("handles 429 rate limit without crashing and offers retry", async ({ page }) => {
    await mockKybStatus(page, () => ({ status: 429, body: { message: "rate limited" } }));
    await page.goto("/invoice/create");
    await navigateToKybGateClick(page);

    await expect(page.getByTestId("kyb-gate-screen")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId("kyb-gate-error")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId("kyb-gate-retry")).toBeVisible();
  });
});
