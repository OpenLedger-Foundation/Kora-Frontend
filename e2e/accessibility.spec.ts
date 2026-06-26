/**
 * E2E — Accessibility: Skip to main content link
 *
 * Covers:
 *  - Skip link is the first focusable element in the DOM
 *  - Skip link is visually hidden until focused
 *  - Skip link becomes visible on focus
 *  - Activating the skip link moves focus to #main-content
 *
 * Relates to: Issue #287 (WCAG 2.1 SC 2.4.1)
 */

import { test, expect } from "@playwright/test";

test.describe("Skip to main content link (#287)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("skip link is the first focusable element in the DOM", async ({
    page,
  }) => {
    // Tab once from the document body — first focus should land on the skip link
    await page.keyboard.press("Tab");

    const focused = await page.evaluate(
      () => document.activeElement?.getAttribute("href") ?? ""
    );
    expect(focused).toBe("#main-content");
  });

  test("skip link is visually hidden before focus", async ({ page }) => {
    const skipLink = page.locator('a[href="#main-content"]').first();

    // Before focus the element should be present but not visibly occupying space
    await expect(skipLink).toBeAttached();

    // The link should NOT be visible to the user before focus
    // (sr-only clips it to 1×1 px which makes it invisible in visual terms)
    const boxBefore = await skipLink.boundingBox();
    // sr-only clips to 1x1; anything under 4px is considered hidden
    expect(boxBefore).not.toBeNull();
    expect((boxBefore?.width ?? 0) + (boxBefore?.height ?? 0)).toBeLessThan(4);
  });

  test("skip link becomes visible on focus", async ({ page }) => {
    const skipLink = page.locator('a[href="#main-content"]').first();

    // Tab to the skip link
    await page.keyboard.press("Tab");

    // After focus the link should be visible with real dimensions
    await expect(skipLink).toBeFocused();
    const box = await skipLink.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100); // a real button-like element
    expect(box!.height).toBeGreaterThan(20);
  });

  test("activating skip link moves focus to #main-content", async ({
    page,
  }) => {
    // Tab to the skip link and press Enter to activate it
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    const focusedId = await page.evaluate(
      () => document.activeElement?.id ?? ""
    );
    expect(focusedId).toBe("main-content");
  });

  test("skip link is present on every key route", async ({ page }) => {
    const routes = ["/", "/marketplace", "/dashboard/sme", "/dashboard/investor"];

    for (const route of routes) {
      await page.goto(route);
      const skipLink = page.locator('a[href="#main-content"]').first();
      await expect(skipLink).toBeAttached();
    }
  });
});
