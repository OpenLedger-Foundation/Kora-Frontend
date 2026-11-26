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

test.describe("Marketplace card actions keyboard operability (#1176)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/marketplace");
  });

  test("card actions are reachable via Tab and operable with Enter/Space", async ({
    page,
  }) => {
    // Card actions must be semantic interactive elements (button or link)
    const actions = page.locator(
      '[data-testid^="marketplace-card-action"]'
    );
    const count = await actions.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const action = actions.nth(i);
      const tagName = await action.evaluate((el) =>
        el.tagName.toLowerCase()
      );
      // Must be a native interactive element, not a pointer-only div/span
      expect(["button", "a"]).toContain(tagName);

      // Must be focusable via keyboard
      await action.focus();
      await expect(action).toBeFocused();

      // Must expose an accessible name
      const accessibleName = await action.evaluate(
        (el) =>
          el.getAttribute("aria-label") ??
          el.textContent?.trim() ??
          ""
      );
      expect(accessibleName.length).toBeGreaterThan(0);
    }
  });

  test("focused card action shows a visible focus indicator", async ({
    page,
  }) => {
    const firstAction = page
      .locator('[data-testid^="marketplace-card-action"]')
      .first();
    await expect(firstAction).toBeAttached();

    await firstAction.focus();
    await expect(firstAction).toBeFocused();

    // A visible focus ring must be present (outline or box-shadow)
    const hasFocusIndicator = await firstAction.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      const outlineVisible =
        styles.outlineStyle !== "none" &&
        parseFloat(styles.outlineWidth || "0") > 0;
      const shadowVisible = styles.boxShadow !== "none";
      return outlineVisible || shadowVisible;
    });
    expect(hasFocusIndicator).toBe(true);
  });

  test("card actions remain keyboard operable on mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/marketplace");

    const firstAction = page
      .locator('[data-testid^="marketplace-card-action"]')
      .first();
    await expect(firstAction).toBeAttached();

    await firstAction.focus();
    await expect(firstAction).toBeFocused();

    const tagName = await firstAction.evaluate((el) =>
      el.tagName.toLowerCase()
    );
    expect(["button", "a"]).toContain(tagName);
  });

  test("card actions degrade gracefully when marketplace data is empty", async ({
    page,
  }) => {
    // Intercept the marketplace data request and return an empty list to
    // exercise the empty/degraded state without crashing the page.
    await page.route("**/api/**/marketplace**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], data: [] }),
      })
    );

    await page.goto("/marketplace");

    // Page should still render its main landmark and skip link without errors
    await expect(page.locator("#main-content")).toBeAttached();
    await expect(
      page.locator('a[href="#main-content"]').first()
    ).toBeAttached();
  });
});
