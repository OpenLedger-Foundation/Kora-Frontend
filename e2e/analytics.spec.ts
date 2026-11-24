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

test.describe("Analytics page — connected", () => {
  test("renders analytics once a wallet is connected", async ({ page, context }) => {
    await injectConnectedWallet(context);
    await page.goto("/analytics");

    await expect(
      page.getByRole("heading", { name: /connect your wallet/i })
    ).not.toBeVisible();
  });

  test.describe("filter bar keyboard chip creation", () => {
    test.beforeEach(async ({ page, context }) => {
      await injectConnectedWallet(context);
      await page.goto("/analytics");
      await expect(
        page.getByRole("heading", { name: /connect your wallet/i })
      ).not.toBeVisible();
    });

    test("Tab reaches the chip group and exposes roving tabindex", async ({ page }) => {
      const chipGroup = page.getByRole("toolbar", { name: /analytics filters/i });
      await expect(chipGroup).toBeVisible();

      // Tab into the chip group; the first chip should receive focus.
      await chipGroup.focus();
      await page.keyboard.press("Tab");

      const chips = chipGroup.getByRole("button");
      const firstChip = chips.first();
      await expect(firstChip).toBeFocused();
      await expect(firstChip).toHaveAttribute("tabindex", "0");

      // Only one chip in the roving group should be tabbable at a time.
      const tabbableCount = await chips.evaluateAll((nodes) =>
        nodes.filter((n) => n.getAttribute("tabindex") === "0").length
      );
      expect(tabbableCount).toBe(1);
    });

    test("arrow keys move focus between chips", async ({ page }) => {
      const chipGroup = page.getByRole("toolbar", { name: /analytics filters/i });
      const chips = chipGroup.getByRole("button");
      await chips.first().focus();

      await page.keyboard.press("ArrowRight");
      await expect(chips.nth(1)).toBeFocused();
      await expect(chips.nth(1)).toHaveAttribute("tabindex", "0");
      await expect(chips.first()).toHaveAttribute("tabindex", "-1");

      await page.keyboard.press("ArrowLeft");
      await expect(chips.first()).toBeFocused();

      // Wrap-around: ArrowLeft from the first chip lands on the last chip.
      await page.keyboard.press("ArrowLeft");
      await expect(chips.last()).toBeFocused();
    });

    test("Enter and Space add a filter chip", async ({ page }) => {
      const chipGroup = page.getByRole("toolbar", { name: /analytics filters/i });
      const chips = chipGroup.getByRole("button");
      await chips.first().focus();

      const activeFilters = page.getByRole("list", { name: /active filters/i });
      const initialCount = await activeFilters.getByRole("listitem").count();

      await page.keyboard.press("Enter");
      await expect(activeFilters.getByRole("listitem")).toHaveCount(initialCount + 1);

      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Space");
      await expect(activeFilters.getByRole("listitem")).toHaveCount(initialCount + 2);
    });

    test("Delete and Backspace remove a filter chip and manage focus", async ({ page }) => {
      const chipGroup = page.getByRole("toolbar", { name: /analytics filters/i });
      const chips = chipGroup.getByRole("button");
      await chips.first().focus();

      const activeFilters = page.getByRole("list", { name: /active filters/i });

      // Add two filters so we can remove them.
      await page.keyboard.press("Enter");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Enter");
      const afterAdd = await activeFilters.getByRole("listitem").count();
      expect(afterAdd).toBeGreaterThanOrEqual(2);

      // Focus the first active filter chip and remove it with Delete.
      const firstActive = activeFilters.getByRole("listitem").first();
      await firstActive.focus();
      await page.keyboard.press("Delete");
      await expect(activeFilters.getByRole("listitem")).toHaveCount(afterAdd - 1);

      // Focus should move to a neighbouring chip, not be lost to <body>.
      const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedTag).not.toBe("BODY");

      // Remove the remaining chip with Backspace.
      const remaining = activeFilters.getByRole("listitem");
      await remaining.first().focus();
      await page.keyboard.press("Backspace");
      await expect(remaining).toHaveCount(afterAdd - 2);
    });

    test("removing the last chip returns to the default 'all' state", async ({ page }) => {
      const chipGroup = page.getByRole("toolbar", { name: /analytics filters/i });
      const chips = chipGroup.getByRole("button");
      await chips.first().focus();

      const activeFilters = page.getByRole("list", { name: /active filters/i });
      await page.keyboard.press("Enter");

      const activeChips = activeFilters.getByRole("listitem");
      await expect(activeChips).toHaveCount(1);

      await activeChips.first().focus();
      await page.keyboard.press("Delete");
      await expect(activeChips).toHaveCount(0);

      // Default 'all' state should be reflected back in the chip group.
      const allChip = chipGroup.getByRole("button", { name: /^all$/i });
      await expect(allChip).toHaveAttribute("aria-pressed", "true");
    });
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

test.describe("Analytics page — filter bar keyboard (mobile viewport)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keyboard chip creation and removal works on mobile", async ({ page, context }) => {
    await injectConnectedWallet(context);
    await page.goto("/analytics");

    await expect(
      page.getByRole("heading", { name: /connect your wallet/i })
    ).not.toBeVisible();

    const chipGroup = page.getByRole("toolbar", { name: /analytics filters/i });
    await expect(chipGroup).toBeVisible();

    const chips = chipGroup.getByRole("button");
    await chips.first().focus();
    await expect(chips.first()).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await expect(chips.nth(1)).toBeFocused();

    const activeFilters = page.getByRole("list", { name: /active filters/i });
    await page.keyboard.press("Enter");
    await expect(activeFilters.getByRole("listitem")).toHaveCount(1);

    await activeFilters.getByRole("listitem").first().focus();
    await page.keyboard.press("Delete");
    await expect(activeFilters.getByRole("listitem")).toHaveCount(0);

    const allChip = chipGroup.getByRole("button", { name: /^all$/i });
    await expect(allChip).toHaveAttribute("aria-pressed", "true");
  });
});

