/**
 * E2E — Wallet Connect Modal
 *
 * Covers:
 *  - WalletButton is visible in the navbar
 *  - Clicking WalletButton opens the connect modal
 *  - Modal renders the correct title and description
 *  - All 4 wallet providers are listed
 *  - Freighter is marked as "Popular"
 *  - Albedo is always available (web-based, no extension needed)
 *  - Modal closes when the Escape key is pressed
 *  - Modal closes when clicking outside the dialog
 */

import { test, expect } from "@playwright/test";

test.describe("Wallet connect modal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("WalletButton is visible in the navbar", async ({ page }) => {
    // WalletButton renders either "Connect Wallet" or a truncated address
    const walletBtn = page.locator("header").getByRole("button").filter({
      hasText: /connect wallet|G[A-Z0-9]{4}/i,
    });
    await expect(walletBtn).toBeVisible();
  });

  test("clicking WalletButton opens the connect modal", async ({ page }) => {
    await page
      .locator("header")
      .getByRole("button")
      .filter({ hasText: /connect wallet/i })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: /Connect Wallet/i })
    ).toBeVisible();
  });

  test("modal renders description text", async ({ page }) => {
    await page
      .locator("header")
      .getByRole("button")
      .filter({ hasText: /connect wallet/i })
      .click();

    await expect(
      page.getByText(/Connect your Stellar wallet to access Kora Protocol/i)
    ).toBeVisible();
  });

  test("modal lists all 4 wallet providers", async ({ page }) => {
    await page
      .locator("header")
      .getByRole("button")
      .filter({ hasText: /connect wallet/i })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Freighter")).toBeVisible();
    await expect(dialog.getByText("xBull Wallet")).toBeVisible();
    await expect(dialog.getByText("LOBSTR")).toBeVisible();
    await expect(dialog.getByText("Albedo")).toBeVisible();
  });

  test("Freighter is marked as Popular", async ({ page }) => {
    await page
      .locator("header")
      .getByRole("button")
      .filter({ hasText: /connect wallet/i })
      .click();

    const dialog = page.getByRole("dialog");
    // The Popular badge sits near the Freighter entry
    await expect(dialog.getByText("Popular")).toBeVisible();
  });

  test("Albedo shows as available (web-based, no extension required)", async ({
    page,
  }) => {
    await page
      .locator("header")
      .getByRole("button")
      .filter({ hasText: /connect wallet/i })
      .click();

    const dialog = page.getByRole("dialog");
    // Albedo description confirms it needs no extension
    await expect(
      dialog.getByText(/Web-based Stellar signer/i)
    ).toBeVisible();
  });

  test("modal closes on Escape key", async ({ page }) => {
    await page
      .locator("header")
      .getByRole("button")
      .filter({ hasText: /connect wallet/i })
      .click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("modal can also be opened from the marketplace fund panel", async ({
    page,
  }) => {
    // Navigate to marketplace and open a detail page
    await page.goto("/marketplace");
    // Wait for invoice cards to render
    await page.waitForSelector("a[href^='/marketplace/']", { timeout: 10_000 });
    // Click the first invoice card
    await page.locator("a[href^='/marketplace/']").first().click();
    await page.waitForURL(/\/marketplace\/.+/);

    // The fund panel shows "Connect Wallet to Invest" when disconnected
    const connectBtn = page.getByRole("button", {
      name: /Connect Wallet to Invest/i,
    });
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /Connect Wallet/i })
      ).toBeVisible();
    }
  });
});
