/**
 * E2E — Landing Page
 *
 * Covers:
 *  - Page loads with correct title and hero headline
 *  - Hero CTAs navigate to the correct routes
 *  - Protocol stats section is visible
 *  - "How It Works" section renders all 5 steps
 *  - Bottom CTA section renders and navigates correctly
 *  - Navbar links are present
 */

import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("loads with correct page title", async ({ page }) => {
    await expect(page).toHaveTitle(/Kora Protocol/i);
  });

  test("renders hero headline", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Invoice Financing, On-Chain/i })
    ).toBeVisible();
  });

  test("hero CTA — Finance My Invoice navigates to /invoice/create", async ({
    page,
  }) => {
    await page.getByRole("link", { name: /Finance My Invoice/i }).first().click();
    await expect(page).toHaveURL(/\/invoice\/create/);
  });

  test("hero CTA — Browse Marketplace navigates to /marketplace", async ({
    page,
  }) => {
    await page.getByRole("link", { name: /Browse Marketplace/i }).first().click();
    await expect(page).toHaveURL(/\/marketplace/);
  });

  test("renders protocol stats section", async ({ page }) => {
    // The stats section contains these labels
    await expect(page.getByText("Total Volume Financed")).toBeVisible();
    await expect(page.getByText("Active Invoices")).toBeVisible();
    await expect(page.getByText("Liquidity Providers")).toBeVisible();
    await expect(page.getByText(/Avg\. APR/i)).toBeVisible();
  });

  test("renders How It Works section with all 5 steps", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /How It Works/i })
    ).toBeVisible();

    const steps = [
      "Connect Wallet",
      "Upload Invoice",
      "List on Marketplace",
      "Receive Liquidity",
      "Repay & Close",
    ];
    for (const step of steps) {
      await expect(page.getByText(step)).toBeVisible();
    }
  });

  test("renders Features section", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Built for the Real Economy/i })
    ).toBeVisible();
    await expect(page.getByText("Instant Settlement")).toBeVisible();
    await expect(page.getByText("Non-Custodial")).toBeVisible();
    await expect(page.getByText("Global Access")).toBeVisible();
    await expect(page.getByText("Transparent Risk")).toBeVisible();
  });

  test("bottom CTA — Create Invoice navigates to /invoice/create", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: /Ready to unlock your capital/i })
    ).toBeVisible();

    // There are two "Create Invoice" links on the page; the bottom CTA is last
    await page.getByRole("link", { name: /Create Invoice/i }).last().click();
    await expect(page).toHaveURL(/\/invoice\/create/);
  });

  test("bottom CTA — Explore Marketplace navigates to /marketplace", async ({
    page,
  }) => {
    await page.getByRole("link", { name: /Explore Marketplace/i }).click();
    await expect(page).toHaveURL(/\/marketplace/);
  });

  test("navbar contains all primary navigation links", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: /Main navigation/i });
    await expect(nav.getByRole("link", { name: /Marketplace/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Invest/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /My Invoices/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Create Invoice/i })).toBeVisible();
  });
});
