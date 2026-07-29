/**
 * Component tests — DatePicker
 *
 * These tests exercise the custom DatePicker UI primitive
 * (components/ui/date-picker.tsx), which is built on Radix UI Popover and
 * renders its calendar grid into a portal.  Portal-based rendering and the
 * popover open/close lifecycle cannot be tested in jsdom.
 *
 * The tests run against the isolated fixture page at /test-components
 * (app/test-components/page.tsx), which mounts DatePicker with:
 *   label="Select Date", name="fixture-date", min=today
 *
 * Do NOT duplicate any Vitest / jsdom tests.  This file covers:
 *  - Trigger button renders with placeholder text before selection
 *  - Calendar popover is not visible before the trigger is clicked
 *  - Clicking the trigger opens the calendar and shows the current month/year
 *  - Day-of-week column headers (Su Mo Tu We Th Fr Sa) are visible
 *  - Clicking a future day closes the calendar
 *  - Selected date is written as YYYY-MM-DD into the hidden <input>
 *  - Trigger button text updates to the formatted selected date
 *  - "Next month" chevron advances the calendar header by one month
 *  - "Prev month" chevron retreats the calendar header
 *  - Navigating forward then back restores the original month header
 *  - Days before the min date are rendered as disabled buttons
 *  - Clicking a disabled date leaves the hidden input empty
 *  - Pressing Escape closes the calendar
 *  - Clicking outside the popover closes the calendar
 */

import { test, expect, type Page } from "@playwright/test";
import { format, addMonths } from "date-fns";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function gotoFixture(page: Page) {
  await page.goto("/test-components");
  await expect(page.locator("#date-picker-fixture")).toBeVisible();
}

/** The Radix Popover trigger button for the DatePicker */
const getTrigger = (page: Page) =>
  page
    .locator("#date-picker-fixture")
    .getByRole("button")
    .first();

/**
 * The Radix Popover portal content.
 * Radix renders the calendar outside #date-picker-fixture, so we locate it
 * by the presence of numbered day buttons inside it.
 */
const getCalendar = (page: Page) =>
  page
    .locator('[data-radix-popper-content-wrapper]')
    .filter({ has: page.locator("button", { hasText: /^\d+$/ }) })
    .first();

/** The "Next month" chevron button inside the calendar */
const getNextMonthBtn = (page: Page) =>
  getCalendar(page).getByRole("button").last();

/** The "Prev month" chevron button inside the calendar */
const getPrevMonthBtn = (page: Page) =>
  getCalendar(page).getByRole("button").first();

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe("DatePicker component — date selection", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page);
  });

  // ── Initial rendering ─────────────────────────────────────────────────────

  test("trigger button renders with placeholder text before selection", async ({
    page,
  }) => {
    await expect(
      page.locator("#date-picker-fixture").getByText(/Select date/i)
    ).toBeVisible();
  });

  test("calendar popover is not visible before the trigger is clicked", async ({
    page,
  }) => {
    // The current month/year header only exists inside the open popover
    const monthYear = format(new Date(), "MMMM yyyy");
    await expect(
      page.locator('[data-radix-popper-content-wrapper]').getByText(monthYear)
    ).not.toBeVisible();
  });

  // ── Opening the calendar ──────────────────────────────────────────────────

  test("clicking the trigger opens the calendar popover", async ({ page }) => {
    await getTrigger(page).click();
    const monthYear = format(new Date(), "MMMM yyyy");
    await expect(
      page.locator('[data-radix-popper-content-wrapper]').getByText(monthYear)
    ).toBeVisible({ timeout: 5_000 });
  });

  test("calendar header shows the current month and year", async ({ page }) => {
    await getTrigger(page).click();
    const cal = getCalendar(page);
    await expect(cal.getByText(format(new Date(), "MMMM yyyy"))).toBeVisible();
  });

  test("calendar renders day-of-week column headers", async ({ page }) => {
    await getTrigger(page).click();
    const cal = getCalendar(page);
    for (const day of ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]) {
      await expect(cal.getByText(day).first()).toBeVisible();
    }
  });

  // ── Selecting a date ──────────────────────────────────────────────────────

  test("clicking a future day cell closes the calendar", async ({ page }) => {
    await getTrigger(page).click();

    // Navigate one month forward so no days are blocked by the min=today constraint
    await getNextMonthBtn(page).click();

    const cal = getCalendar(page);
    await cal.getByRole("button", { name: "15" }).first().click();

    // After selection the popover should close
    await expect(getCalendar(page)).not.toBeVisible({ timeout: 3_000 });
  });

  test("selecting a date writes YYYY-MM-DD into the hidden input", async ({
    page,
  }) => {
    await getTrigger(page).click();
    const nextMonth = addMonths(new Date(), 1);
    await getNextMonthBtn(page).click();

    const cal = getCalendar(page);
    await cal.getByRole("button", { name: "10" }).first().click();

    const expectedValue = format(
      new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 10),
      "yyyy-MM-dd"
    );

    // The fixture renders <p data-testid="selected-date-value">Value: {date}</p>
    await expect(page.getByTestId("selected-date-value")).toContainText(
      expectedValue,
      { timeout: 3_000 }
    );
  });

  test("trigger button text updates to the formatted selected date", async ({
    page,
  }) => {
    const trigger = getTrigger(page);
    await trigger.click();

    const nextMonth = addMonths(new Date(), 1);
    await getNextMonthBtn(page).click();

    const cal = getCalendar(page);
    await cal.getByRole("button", { name: "20" }).first().click();

    const expectedLabel = format(
      new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 20),
      "PPP"
    );
    await expect(trigger).toContainText(expectedLabel, { timeout: 3_000 });
  });

  // ── Month navigation ───────────────────────────────────────────────────────

  test("next-month chevron advances the calendar header by one month", async ({
    page,
  }) => {
    await getTrigger(page).click();
    await getNextMonthBtn(page).click();
    const nextHeader = format(addMonths(new Date(), 1), "MMMM yyyy");
    await expect(getCalendar(page).getByText(nextHeader)).toBeVisible();
  });

  test("prev-month chevron retreats the calendar header", async ({ page }) => {
    await getTrigger(page).click();

    // Go forward two months first so prev-month isn't blocked by min=today
    await getNextMonthBtn(page).click();
    await getNextMonthBtn(page).click();

    await getPrevMonthBtn(page).click();

    const expectedHeader = format(addMonths(new Date(), 1), "MMMM yyyy");
    await expect(getCalendar(page).getByText(expectedHeader)).toBeVisible();
  });

  test("navigating forward then back restores the original month header", async ({
    page,
  }) => {
    const originalHeader = format(new Date(), "MMMM yyyy");
    await getTrigger(page).click();
    await getNextMonthBtn(page).click();
    await getPrevMonthBtn(page).click();
    await expect(getCalendar(page).getByText(originalHeader)).toBeVisible();
  });

  // ── Disabled dates ─────────────────────────────────────────────────────────

  test("days before the min date are rendered as disabled buttons", async ({
    page,
  }) => {
    await getTrigger(page).click();

    // Navigate one month back — all days there are before today (min=today)
    await getPrevMonthBtn(page).click();

    const cal = getCalendar(page);
    const disabledDays = cal.locator("button[disabled]");
    await expect(disabledDays.first()).toBeVisible({ timeout: 3_000 });
  });

  test("clicking a disabled date leaves the hidden input empty", async ({
    page,
  }) => {
    await getTrigger(page).click();
    await getPrevMonthBtn(page).click();

    const cal = getCalendar(page);
    const disabledDay = cal.locator("button[disabled]").first();

    if (await disabledDay.isVisible()) {
      await disabledDay.click({ force: true });
    }

    // No date value should have been written
    await expect(page.getByTestId("selected-date-value")).not.toBeVisible();
  });

  // ── Dismissal ─────────────────────────────────────────────────────────────

  test("pressing Escape closes the calendar", async ({ page }) => {
    await getTrigger(page).click();
    await expect(getCalendar(page)).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(getCalendar(page)).not.toBeVisible({ timeout: 3_000 });
  });

  test("clicking outside the popover closes the calendar", async ({ page }) => {
    await getTrigger(page).click();
    await expect(getCalendar(page)).toBeVisible();

    // Click the page heading — always outside the popover
    await page
      .locator("h1", { hasText: /Component Test Fixtures/i })
      .click();

    await expect(getCalendar(page)).not.toBeVisible({ timeout: 3_000 });
  });
});
