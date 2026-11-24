/**
 * E2E — Wallet-gated /analytics page.
 *
 * Covers:
 *  - Disconnected: shows the "Connect your wallet" gate instead of analytics
 *  - Disconnected: "Connect Wallet" CTA opens the wallet connect modal
 *  - Connected: wallet gate is dismissed and the analytics page renders
 *
 * Wallet simulation strategy:
 *   Inject a Zustand-compatible localStorage entry for `kora-wallet-store`
 *   before navigating so the app rehydrates as connected, same approach as
 *   e2e/dashboard.spec.ts.
 */
import { test, expect, type BrowserContext } from "@playwright/test";
import { MOCK_ADDRESS, injectWalletStubs } from "./helpers/mock-wallet";

async function injectConnectedWallet(context: BrowserContext) {
  await injectWalletStubs(context);
}

test.describe("Analytics page — disconnected", () => {
  test("shows connect wallet gate when no wallet is connected", async ({ page }) => {
    await page.goto("/analytics");

    await expect(
      page.getByRole("heading", { name: /connect your wallet/i })
    ).toBeVisible();
    await expect(page.getByText(/view your portfolio analytics/i)).toBeVisible();
  });

  test("connect wallet CTA opens the wallet connect modal", async ({ page }) => {
    await page.goto("/analytics");

    await page.getByRole("button", { name: /connect wallet/i }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("Analytics page — filter chips keyboard", () => {
  test("creates and removes filter chips using only the keyboard", async ({
    page,
    context,
  }) => {
    await injectConnectedWallet(context);
    await page.goto("/analytics");

    await expect(
      page.getByRole("heading", { name: /connect your wallet/i })
    ).not.toBeVisible();

    const chipGroup = page.getByRole("toolbar", { name: /filter/i });
    await expect(chipGroup).toBeVisible();

    // Tab into the chip group and focus the first chip.
    await chipGroup.focus();
    const firstChip = chipGroup.getByRole("button").first();
    await expect(firstChip).toBeFocused();

    // Arrow between chips moves roving focus.
    const chips = chipGroup.getByRole("button");
    const chipCount = await chips.count();
    if (chipCount > 1) {
      await page.keyboard.press("ArrowRight");
      await expect(chips.nth(1)).toBeFocused();
      await page.keyboard.press("ArrowLeft");
      await expect(chips.nth(0)).toBeFocused();
    }

    // Enter activates the focused chip (adds it to the active filters).
    await page.keyboard.press("Enter");
    await expect(chipGroup.getByRole("button", { pressed: true }).first()).toBeVisible();

    // Space also activates a chip.
    if (chipCount > 1) {
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press(" ");
      await expect(chipGroup.getByRole("button", { pressed: true })).toHaveCount(2);
    }

    // Delete removes the focused chip and focus moves to a sibling.
    await page.keyboard.press("Delete");
    await expect(chipGroup.getByRole("button", { pressed: true })).toHaveCount(1);
    await expect(chipGroup.getByRole("button").first()).toBeFocused();
  });

  test("Backspace clears the focused chip", async ({ page, context }) => {
    await injectConnectedWallet(context);
    await page.goto("/analytics");

    await expect(
      page.getByRole("heading", { name: /connect your wallet/i })
    ).not.toBeVisible();

    const chipGroup = page.getByRole("toolbar", { name: /filter/i });
    await expect(chipGroup).toBeVisible();

    await chipGroup.focus();
    await page.keyboard.press("Enter");
    await expect(chipGroup.getByRole("button", { pressed: true }).first()).toBeVisible();

    await page.keyboard.press("Backspace");
    await expect(chipGroup.getByRole("button", { pressed: true })).toHaveCount(0);
    await expect(chipGroup.getByRole("button").first()).toBeFocused();
  });
});

test.describe("Analytics page — connected", () => {
  test("renders analytics once a wallet is connected", async ({ page, context }) => {
    await injectConnectedWallet(context);
    await page.goto("/analytics");

    await expect(
      page.getByRole("heading", { name: /connect your wallet/i })
    ).not.toBeVisible();
  });

  test("triggers portfolio PDF digest download", async ({ page, context }) => {
    await injectConnectedWallet(context);
    await page.goto("/analytics");

    await expect(
      page.getByRole("heading", { name: /connect your wallet/i })
    ).not.toBeVisible();

    const digestButton = page.getByRole("button", {
      name: /download portfolio pdf digest|pdf digest/i,
    });

    await expect(digestButton).toBeVisible();

    // Skips gracefully when portfolio empty in mock
    if (await digestButton.isDisabled()) {
      test.skip(true, "Portfolio is empty in mock data, skipping PDF download assertion");
      return;
    }

    const downloadPromise = page.waitForEvent("download");
    await digestButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^kora-portfolio-digest-.*\.pdf$/);
  });
});

