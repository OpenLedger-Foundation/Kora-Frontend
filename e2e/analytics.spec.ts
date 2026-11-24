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

  test("serializes cohort filters to the URL and restores them on reload", async ({
    page,
    context,
  }) => {
    await injectConnectedWallet(context);
    await page.goto("/analytics");

    await expect(
      page.getByRole("heading", { name: /connect your wallet/i })
    ).not.toBeVisible();

    await page.getByRole("button", { name: "AA", exact: true }).click();
    await page.getByLabel(/filter by jurisdiction/i).selectOption("KE");
    await page.getByLabel(/filter by category/i).selectOption("services");
    await page.getByRole("button", { name: "90 days", exact: true }).click();

    await expect(page).toHaveURL(/risk=AA/);
    await expect(page).toHaveURL(/jurisdiction=KE/);
    await expect(page).toHaveURL(/category=services/);
    await expect(page).toHaveURL(/range=90d/);

    await page.reload();

    await expect(page.getByRole("button", { name: "AA", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.getByLabel(/filter by jurisdiction/i)).toHaveValue("KE");
    await expect(page.getByLabel(/filter by category/i)).toHaveValue("services");
    await expect(page.getByRole("button", { name: "90 days", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("ignores unsupported cohort params and preserves unrelated params on change", async ({
    page,
    context,
  }) => {
    await injectConnectedWallet(context);
    await page.goto(
      "/analytics?risk=BOGUS&jurisdiction=ZZ&category=other&range=custom&from=2026-02-30&to=2026-03-01&utm_source=email"
    );

    await expect(page.getByRole("button", { name: "All", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.getByLabel(/filter by jurisdiction/i)).toHaveValue("all");
    await expect(page.getByLabel(/filter by category/i)).toHaveValue("all");
    await expect(page.getByRole("button", { name: "30 days", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.getByRole("button", { name: "B", exact: true }).click();

    await expect(page).toHaveURL(/risk=B(?:$|&)/);
    await expect(page).toHaveURL(/utm_source=email/);
    await expect(page).not.toHaveURL(/jurisdiction=ZZ/);
    await expect(page).not.toHaveURL(/category=other/);
    await expect(page).not.toHaveURL(/range=custom/);
  });

  test("copies the canonical filtered URL to the clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await injectConnectedWallet(context);
    await page.goto("/analytics");

    await page.getByRole("button", { name: "BB", exact: true }).click();
    await page.getByLabel(/filter by jurisdiction/i).selectOption("GH");
    await page.getByTestId("analytics-copy-link").click();

    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const copiedUrl = new URL(copied);

    expect(copiedUrl.pathname).toContain("/analytics");
    expect(copiedUrl.searchParams.get("risk")).toBe("BB");
    expect(copiedUrl.searchParams.get("jurisdiction")).toBe("GH");
    await expect(page.getByRole("status")).toContainText(/link copied/i);
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

