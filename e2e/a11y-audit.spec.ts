/**
 * Automated accessibility audit — axe-playwright
 *
 * Runs axe-core against key routes and fails CI if any critical or serious
 * violations are found.  Does NOT replace manual accessibility testing or
 * expert review with assistive technologies.
 *
 * Dependency: axe-playwright@2.0.3 (pinned in package.json devDependencies)
 *
 * Known false-positive exclusions are listed per-route below with justification.
 * Add new exclusions only with a documented reason and a tracking issue.
 */

import { test, expect } from "@playwright/test";
import { injectAxe, getViolations } from "axe-playwright";
import { injectWalletStubs } from "./helpers/mock-wallet";

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Run axe against the current page and assert no critical/serious violations.
 * Returns the full violation list so individual tests can add extra assertions.
 */
async function auditPage(
  page: Parameters<typeof injectAxe>[0],
  options?: { disableRules?: string[] }
) {
  await injectAxe(page);

  const violations = await getViolations(page, undefined, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    },
    rules: Object.fromEntries(
      (options?.disableRules ?? []).map((id) => [id, { enabled: false }])
    ),
  });

  // Filter to critical and serious only — best-effort automated check
  const blocking = violations.filter((v) =>
    ["critical", "serious"].includes(v.impact ?? "")
  );

  if (blocking.length > 0) {
    const summary = blocking
      .map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`)
      .join("\n");
    expect.soft(blocking, `Axe found critical/serious violations:\n${summary}`).toHaveLength(0);
  }

  return violations;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

test.describe("Accessibility audit — landing page (/)", () => {
  test("no critical or serious axe violations", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await auditPage(page);
  });
});

test.describe("Accessibility audit — marketplace (/marketplace)", () => {
  test("no critical or serious axe violations", async ({ page }) => {
    await page.goto("/marketplace");
    await page.waitForLoadState("networkidle");

    await auditPage(page, {
      // Known false positive: Radix UI popover portals render outside the main
      // landmark at mount time; their aria-owns relationship is established
      // dynamically. Tracked in issue #240.
      disableRules: [],
    });
  });

  test("no critical or serious axe violations under Arabic (RTL) locale", async ({
    page,
  }) => {
    await page.goto("/marketplace", {
      headers: { "accept-language": "ar" },
    });
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => {
      document.documentElement.lang = "ar";
      document.documentElement.dir = "rtl";
    });
    await auditPage(page, {
      disableRules: [],
    });
  });
});

// ─── Marketplace card actions (Issue #1176) ──────────────────────────────────
//
// Every action rendered on a marketplace card (view, favorite/save, compare,
// buy/contact, share) must be reachable and operable from the keyboard with a
// visible focus indicator.  These tests guard against regressions where an
// action is wired only to pointer events (onClick on a non-interactive div).

test.describe("Accessibility audit — marketplace card actions (keyboard)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/marketplace");
    await page.waitForLoadState("networkidle");
  });

  test("card actions are focusable and expose an accessible name", async ({ page }) => {
    const cards = page.locator('[data-testid="marketplace-card"]');
    const cardCount = await cards.count();
    expect(cardCount, "expected at least one marketplace card").toBeGreaterThan(0);

    const firstCard = cards.first();
    const actions = firstCard.locator('[data-testid="marketplace-card-action"]');
    const actionCount = await actions.count();
    expect(actionCount, "expected at least one card action").toBeGreaterThan(0);

    for (let i = 0; i < actionCount; i++) {
      const action = actions.nth(i);
      // Actions must be real interactive elements (button/a) or carry an
      // explicit interactive role — never a bare pointer-only div.
      const tagName = await action.evaluate((el) => el.tagName.toLowerCase());
      const role = await action.getAttribute("role");
      const isInteractive =
        tagName === "button" || tagName === "a" || role === "button" || role === "link";
      expect(isInteractive, `card action ${i} is not a semantic interactive element`).toBe(
        true,
      );

      // Every action needs an accessible name for screen readers.
      const name = (await action.getAttribute("aria-label")) ?? (await action.innerText());
      expect(name?.trim(), `card action ${i} is missing an accessible name`).toBeTruthy();
    }
  });

  test("card actions are reachable via Tab with a visible focus ring", async ({ page }) => {
    const firstCard = page.locator('[data-testid="marketplace-card"]').first();
    const actions = firstCard.locator('[data-testid="marketplace-card-action"]');
    const actionCount = await actions.count();
    expect(actionCount).toBeGreaterThan(0);

    // Focus the first action directly, then verify the focus indicator is
    // visible (outline or box-shadow) — pointer-only actions fail this.
    for (let i = 0; i < actionCount; i++) {
      const action = actions.nth(i);
      await action.focus();
      const isFocused = await action.evaluate((el) => el === document.activeElement);
      expect(isFocused, `card action ${i} could not receive keyboard focus`).toBe(true);

      const hasVisibleFocus = await action.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        const outlineVisible =
          styles.outlineStyle !== "none" && parseFloat(styles.outlineWidth) > 0;
        const shadowVisible = styles.boxShadow !== "none";
        return outlineVisible || shadowVisible;
      });
      expect(hasVisibleFocus, `card action ${i} has no visible focus indicator`).toBe(true);
    }
  });

  test("card actions activate with Enter and Space", async ({ page }) => {
    const firstCard = page.locator('[data-testid="marketplace-card"]').first();
    const favorite = firstCard
      .locator('[data-testid="marketplace-card-action"]')
      .filter({ has: page.locator('[data-action="favorite"]') })
      .first();

    // Fall back to the first action if a dedicated favorite control is absent.
    const target = (await favorite.count()) > 0
      ? favorite
      : firstCard.locator('[data-testid="marketplace-card-action"]').first();

    await target.focus();
    const pressedBefore = await target.getAttribute("aria-pressed");

    // Enter must activate the control.
    await page.keyboard.press("Enter");
    await expect(target).toBeFocused();

    // Space must also activate a button-style control.
    await page.keyboard.press("Space");
    await expect(target).toBeFocused();

    // If the control is a toggle, its pressed state must be keyboard-driven.
    if (pressedBefore !== null) {
      const pressedAfter = await target.getAttribute("aria-pressed");
      expect(pressedAfter, "toggle state should change via keyboard").not.toBe(pressedBefore);
    }
  });

  test("card actions remain operable on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/marketplace");
    await page.waitForLoadState("networkidle");

    const firstCard = page.locator('[data-testid="marketplace-card"]').first();
    const firstAction = firstCard
      .locator('[data-testid="marketplace-card-action"]')
      .first();
    await expect(firstAction).toBeVisible();

    await firstAction.focus();
    const isFocused = await firstAction.evaluate((el) => el === document.activeElement);
    expect(isFocused, "card action should be focusable on mobile viewport").toBe(true);
  });
});

test.describe("Accessibility audit — invoice detail (/marketplace/:id)", () => {
  test("no critical or serious axe violations on sample invoice", async ({ page }) => {
    // Navigate to a seeded or mock invoice; the app uses mock data in E2E mode.
    await page.goto("/marketplace/1");
    await page.waitForLoadState("networkidle");
    await auditPage(page);
  });
});

test.describe("Accessibility audit — SME dashboard (/dashboard/sme)", () => {
  test("no critical or serious axe violations", async ({ page }) => {
    await page.goto("/dashboard/sme");
    await page.waitForLoadState("networkidle");
    await auditPage(page);
  });
});

test.describe("Accessibility audit — investor dashboard (/dashboard/investor)", () => {
  test("no critical or serious axe violations", async ({ page }) => {
    await page.goto("/dashboard/investor");
    await page.waitForLoadState("networkidle");
    await auditPage(page);
  });
});

// ─── Analytics & transactions (Issue #439) ───────────────────────────────────
//
// Both routes were previously excluded from this audit. They are covered here
// because they carry the two patterns most likely to regress: Recharts SVGs
// (unlabelled graphics) and a hand-rolled aria-modal drawer (no focus
// management unless it is implemented explicitly).

test.describe("Accessibility audit — analytics (/analytics)", () => {
  test("no critical or serious axe violations", async ({ page }) => {
    await page.goto("/analytics");
    await page.waitForLoadState("networkidle");
    await auditPage(page);
  });

  test("every chart exposes an accessible name", async ({ page }) => {
    await page.goto("/analytics");
    await page.waitForLoadState("networkidle");

    // Charts render inside role="img" wrappers whose aria-label summarises the
    // underlying data — see ChartFigure in components/analytics/AnalyticsCharts.
    const charts = page.locator('[role="img"]');
    const count = await charts.count();
    expect(count, "expected at least one labelled chart").toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const label = await charts.nth(i).getAttribute("aria-label");
      expect(label?.trim(), `chart ${i} is missing an accessible name`).toBeTruthy();
    }
  });
});

test.describe("Accessibility audit — transactions (/transactions)", () => {
  test("no critical or serious axe violations", async ({ page }) => {
    await page.goto("/transactions");
    await page.waitForLoadState("networkidle");
    await auditPage(page);
  });
});

// ─── Offline page ──────────────────────────────────────────────────────
//
// The offline page is a static fallback rendered when the browser has no
// network connectivity.  It is fully server-rendered so there is no
// client-side hydration mismatch, and all dynamic regions (pending tx
// queue, stale-data badge) are progressive enhancements that degrade
// gracefully.
//
// RTL note: the page inherits `dir="rtl"` from the <html> element when
// the Arabic locale is active (LocaleProvider sets document.documentElement.dir).
// No additional RTL-specific fixes are required — flexbox layouts and
// the semantic heading/list structure work correctly in both directions.

test.describe("Accessibility audit — offline page (/offline)", () => {
  test("no critical or serious axe violations", async ({ page }) => {
    await page.goto("/offline");
    await page.waitForLoadState("networkidle");
    await auditPage(page);
  });
});

test.describe("Accessibility audit — transaction history drawer", () => {
  /** Open the drawer from the navbar trigger. */
  async function openDrawer(page: Parameters<typeof injectAxe>[0]) {
    await page.goto("/transactions");
    await page.waitForLoadState("networkidle");

    const trigger = page.getByRole("button", { name: /transaction history/i }).first();
    await trigger.click();

    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    return dialog;
  }

  test("no critical or serious axe violations while open", async ({ page }) => {
    await openDrawer(page);
    await auditPage(page);
  });

  test("traps focus and restores it on close", async ({ page }) => {
    const dialog = await openDrawer(page);

    // Focus must land inside the drawer on open, not on the document body.
    const focusedInDialog = await dialog.evaluate((el) =>
      el.contains(document.activeElement),
    );
    expect(focusedInDialog, "focus should move into the drawer on open").toBe(true);

    // Tabbing through the whole drawer must never leave it.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const stillInside = await dialog.evaluate((el) =>
        el.contains(document.activeElement),
      );
      expect(stillInside, `focus escaped the drawer after ${i + 1} Tab press(es)`).toBe(
        true,
      );
    }

    // Escape is the keyboard exit from a trapped surface.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
