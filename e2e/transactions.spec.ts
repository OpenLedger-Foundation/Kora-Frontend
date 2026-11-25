/**
 * E2E — Wallet-gated /transactions page.
 *
 * Covers:
 *  - Disconnected: shows the "Connect your wallet" gate instead of history
 *  - Disconnected: "Connect Wallet" CTA opens the wallet connect modal
 *  - Connected: wallet gate is dismissed and transaction history renders
 *
 * Wallet simulation strategy:
 *   Inject a Zustand-compatible localStorage entry for `kora-wallet-store`
 *   before navigating so the app rehydrates as connected, same approach as
 *   e2e/dashboard.spec.ts.
 */
import { test, expect, type BrowserContext } from "@playwright/test";
import { MOCK_ADDRESS } from "./helpers/mock-wallet";

async function injectConnectedWallet(context: BrowserContext) {
  await context.addInitScript((address) => {
    const walletState = {
      state: {
        address,
        publicKey: address,
        isConnected: true,
        provider: "freighter",
        balance: "1000.00",
        isVerified: false,
        verifiedAt: null,
      },
      version: 0,
    };
    localStorage.setItem("kora-wallet-store", JSON.stringify(walletState));
  }, MOCK_ADDRESS);
}

test.describe("Transactions page — disconnected", () => {
  test("shows connect wallet gate when no wallet is connected", async ({ page }) => {
    await page.goto("/transactions");

    await expect(
      page.getByRole("heading", { name: /connect your wallet/i })
    ).toBeVisible();
    await expect(
      page.getByText(/connect to view your on-chain transaction history/i)
    ).toBeVisible();
  });

  test("connect wallet CTA opens the wallet connect modal", async ({ page }) => {
    await page.goto("/transactions");

    await page.getByRole("button", { name: /connect wallet/i }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("Transactions page — connected", () => {
  test("renders transaction history once a wallet is connected", async ({ page, context }) => {
    await injectConnectedWallet(context);
    await page.goto("/transactions");

    await expect(
      page.getByRole("heading", { name: /connect your wallet/i })
    ).not.toBeVisible();
  });
});


for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`groups invoices and supports keyboard disclosure at ${viewport.width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize(viewport);
    await injectConnectedWallet(context);
    await context.addInitScript(() => {
      const entries = [
        { invoiceId: "42", description: "Invoice funding" },
        { invoiceId: "11", description: "Separate invoice funding" },
        { description: "No invoice assigned" },

      ];
      localStorage.setItem("kora-tx-history", JSON.stringify({
        version: 0,
        state: {
          transactions: entries.map((entry, i) => ({
            ...entry,
            hash: String(i + 1).repeat(64),
            type: "fund",
            status: "confirmed",
            timestamp: new Date(Date.UTC(2026, 0, 4 - i)).toISOString(),
          })),
        },
      }));
      localStorage.setItem("kora-transaction-history", JSON.stringify({
        version: 0,
        state: {
          transactions: [{
            hash: "4".repeat(64),
            invoiceId: "42",
            type: "repay_invoice",
            status: "confirmed",
            description: "Invoice repayment",
            timestamp: Date.UTC(2026, 0, 1),
          }],
        },
      }));
    });
    await page.goto("/transactions");

    const first = page.getByRole("button", { name: /Invoice 42.*2 transactions/ });
    const second = page.getByRole("button", { name: /Invoice 11.*1 transaction/ });
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await expect(second).toBeVisible();
    await expect(page.getByText("No invoice assigned")).toBeVisible();
    const id = await first.getAttribute("aria-controls");
    const rows = page.locator(`[id="${id}"]`);
    await expect(rows.getByText("Invoice funding", { exact: true })).toBeVisible();
    await expect(rows.getByText("Invoice repayment", { exact: true })).toBeVisible();
    await first.focus();
    await first.press("Enter");
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await expect(first).toBeFocused();
    await expect(rows).toBeHidden();
    await expect(second).toBeVisible();
    await first.press("Space");
    await expect(rows).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    const screenshot = testInfo.outputPath(`invoice-groups-${viewport.width}.png`);
    await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
    await testInfo.attach("Invoice groups", { path: screenshot, contentType: "image/png" });
  });
}

test("shows the empty state for a connected wallet", async ({ page, context }) => {
  await injectConnectedWallet(context);
  await page.goto("/transactions");
  await expect(page.getByText(/no transactions yet/i)).toBeVisible();
});

test("keeps history available when Horizon is down", async ({ page, context }) => {
  await injectConnectedWallet(context);
  await page.route("**/ledgers?*", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto("/transactions");
  await expect(page.getByText("A Stellar service is unavailable. Try again shortly.")).toBeVisible();
  await expect(page.getByText(/no transactions yet/i)).toBeVisible();
});
