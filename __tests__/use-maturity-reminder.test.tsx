/**
 * Tests for useMaturityReminder (Issue #677).
 *
 * The hook drives the SME maturity toasts and dedupes them through a
 * localStorage key list, so the things worth pinning down are: it fires only on
 * an exact day match, it fires once per invoice key no matter how often the
 * component re-renders, the preference switch actually suppresses it, and the
 * key list stays capped so it cannot grow forever.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

import { createMockInvoice } from "./fixtures";
import { useSettingsStore } from "@/store/settingsStore";
import type { Invoice } from "@/types";

const REMINDER_STORAGE_KEY = "kora-maturity-reminders";

const toastSuccess = vi.fn();
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({
    success: toastSuccess,
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

const exportIcs = vi.fn();
vi.mock("@/lib/export", () => ({
  exportInvoiceCalendarIcs: (invoice: unknown) => exportIcs(invoice),
}));

import { useMaturityReminder, isInQuietHours } from "@/hooks/useMaturityReminder";

/** An invoice maturing exactly `days` from now. */
function invoiceMaturingIn(days: number, overrides: Partial<Invoice> = {}): Invoice {
  const repaymentDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const base = createMockInvoice(overrides);
  return {
    ...base,
    terms: { ...base.terms, repaymentDate },
  };
}

function setPrefs(maturityReminder: boolean, maturityReminderDays: 1 | 3 | 7 = 7) {
  useSettingsStore.setState((state) => ({
    notifications: { ...state.notifications, maturityReminder, maturityReminderDays },
  }));
}

beforeEach(() => {
  localStorage.clear();
  toastSuccess.mockClear();
  exportIcs.mockClear();
  setPrefs(true, 7);
});

afterEach(() => {
  useSettingsStore.getState().resetNotifications();
});

describe("useMaturityReminder", () => {
  describe("day matching", () => {
    it("fires for an invoice maturing on the configured day", () => {
      const invoice = invoiceMaturingIn(7, { id: "inv_match" });
      renderHook(() => useMaturityReminder([invoice]));

      expect(toastSuccess).toHaveBeenCalledTimes(1);
      expect(toastSuccess.mock.calls[0][0]).toContain(invoice.metadata.invoiceNumber);
    });

    it("does not fire for an invoice maturing on a different day", () => {
      renderHook(() => useMaturityReminder([invoiceMaturingIn(4, { id: "inv_other_day" })]));

      expect(toastSuccess).not.toHaveBeenCalled();
    });

    it("follows the configured reminder day rather than a fixed one", () => {
      setPrefs(true, 3);
      renderHook(() => useMaturityReminder([invoiceMaturingIn(3, { id: "inv_three" })]));

      expect(toastSuccess).toHaveBeenCalledTimes(1);
    });

    it("does nothing for an empty invoice list", () => {
      renderHook(() => useMaturityReminder([]));

      expect(toastSuccess).not.toHaveBeenCalled();
    });

    it("fires once per matching invoice", () => {
      renderHook(() =>
        useMaturityReminder([
          invoiceMaturingIn(7, { id: "inv_a" }),
          invoiceMaturingIn(7, { id: "inv_b" }),
          invoiceMaturingIn(2, { id: "inv_c" }),
        ])
      );

      expect(toastSuccess).toHaveBeenCalledTimes(2);
    });

    it("uses the singular form one day out", () => {
      setPrefs(true, 1);
      renderHook(() => useMaturityReminder([invoiceMaturingIn(1, { id: "inv_one_day" })]));

      expect(toastSuccess.mock.calls[0][0]).toContain("1 day.");
    });
  });

  describe("dedupe", () => {
    it("does not toast the same invoice twice across renders", () => {
      const invoice = invoiceMaturingIn(7, { id: "inv_dedupe" });
      const { rerender } = renderHook(() => useMaturityReminder([invoice]));

      rerender();
      rerender();

      expect(toastSuccess).toHaveBeenCalledTimes(1);
    });

    it("does not toast again for a fresh mount once the key is stored", () => {
      const invoice = invoiceMaturingIn(7, { id: "inv_remount" });
      renderHook(() => useMaturityReminder([invoice]));
      expect(toastSuccess).toHaveBeenCalledTimes(1);

      renderHook(() => useMaturityReminder([invoice]));

      expect(toastSuccess).toHaveBeenCalledTimes(1);
    });

    it("records the reminder key against the invoice and day", () => {
      const invoice = invoiceMaturingIn(7, { id: "inv_key" });
      renderHook(() => useMaturityReminder([invoice]));

      const stored = JSON.parse(localStorage.getItem(REMINDER_STORAGE_KEY) || "[]");
      expect(stored).toContain("inv_key:7");
    });

    it("treats a different reminder-day preference as a separate key", () => {
      const invoice = invoiceMaturingIn(7, { id: "inv_day_scope" });
      renderHook(() => useMaturityReminder([invoice]));

      // Same invoice, but now the preference points at a day it also matches.
      setPrefs(true, 3);
      renderHook(() => useMaturityReminder([invoiceMaturingIn(3, { id: "inv_day_scope" })]));

      const stored = JSON.parse(localStorage.getItem(REMINDER_STORAGE_KEY) || "[]");
      expect(stored).toContain("inv_day_scope:7");
      expect(stored).toContain("inv_day_scope:3");
      expect(toastSuccess).toHaveBeenCalledTimes(2);
    });

    it("survives a corrupt stored value instead of throwing", () => {
      localStorage.setItem(REMINDER_STORAGE_KEY, "not-json");

      expect(() =>
        renderHook(() => useMaturityReminder([invoiceMaturingIn(7, { id: "inv_corrupt" })]))
      ).not.toThrow();
      expect(toastSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe("preference", () => {
    it("stays silent when maturityReminder is off", () => {
      setPrefs(false, 7);
      renderHook(() => useMaturityReminder([invoiceMaturingIn(7, { id: "inv_disabled" })]));

      expect(toastSuccess).not.toHaveBeenCalled();
    });

    it("does not record a key while disabled", () => {
      setPrefs(false, 7);
      renderHook(() => useMaturityReminder([invoiceMaturingIn(7, { id: "inv_disabled_key" })]));

      expect(localStorage.getItem(REMINDER_STORAGE_KEY)).toBeNull();
    });
  });

  describe("stored key cap", () => {
    it("keeps at most 50 keys, newest first", () => {
      const existing = Array.from({ length: 50 }, (_, i) => `old_${i}:7`);
      localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(existing));

      renderHook(() => useMaturityReminder([invoiceMaturingIn(7, { id: "inv_newest" })]));

      const stored = JSON.parse(localStorage.getItem(REMINDER_STORAGE_KEY) || "[]");
      expect(stored).toHaveLength(50);
      expect(stored[0]).toBe("inv_newest:7");
      expect(stored).not.toContain("old_49:7");
    });
  });

  describe("cleanup", () => {
    it("does not toast after unmount", () => {
      const invoice = invoiceMaturingIn(7, { id: "inv_unmount" });
      const { unmount } = renderHook(() => useMaturityReminder([invoice]));
      expect(toastSuccess).toHaveBeenCalledTimes(1);

      unmount();

      expect(toastSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe("downloadCalendarForInvoice", () => {
    it("exports the calendar entry for the given invoice", () => {
      const invoice = invoiceMaturingIn(30, { id: "inv_ics" });
      const { result } = renderHook(() => useMaturityReminder([invoice]));

      result.current.downloadCalendarForInvoice(invoice);

      expect(exportIcs).toHaveBeenCalledWith(invoice);
    });
  });

  describe("quiet hours", () => {
    function setQuietHours(
      enabled: boolean,
      start = "22:00",
      end = "08:00"
    ) {
      useSettingsStore.setState((state) => ({
        notifications: {
          ...state.notifications,
          quietHoursEnabled: enabled,
          quietHoursStart: start,
          quietHoursEnd: end,
        },
      }));
    }

    it("suppresses the toast when quiet hours are active", () => {
      // Current time is 23:00 — inside the 22:00–08:00 window.
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T23:00:00"));

      setQuietHours(true, "22:00", "08:00");
      renderHook(() => useMaturityReminder([invoiceMaturingIn(7, { id: "inv_quiet" })]));

      expect(toastSuccess).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("does not record a dedupe key when suppressed by quiet hours", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T23:00:00"));

      setQuietHours(true, "22:00", "08:00");
      renderHook(() => useMaturityReminder([invoiceMaturingIn(7, { id: "inv_quiet_key" })]));

      expect(localStorage.getItem(REMINDER_STORAGE_KEY)).toBeNull();
      vi.useRealTimers();
    });

    it("fires normally when quiet hours are enabled but current time is outside the window", () => {
      // Current time is 12:00 — outside the 22:00–08:00 window.
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T12:00:00"));

      setQuietHours(true, "22:00", "08:00");
      renderHook(() => useMaturityReminder([invoiceMaturingIn(7, { id: "inv_outside_quiet" })]));

      expect(toastSuccess).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it("fires normally when quiet hours are disabled regardless of time", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T23:30:00"));

      setQuietHours(false, "22:00", "08:00");
      renderHook(() => useMaturityReminder([invoiceMaturingIn(7, { id: "inv_quiet_off" })]));

      expect(toastSuccess).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it("suppresses at the exact quiet-hours start boundary", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T22:00:00"));

      setQuietHours(true, "22:00", "08:00");
      renderHook(() => useMaturityReminder([invoiceMaturingIn(7, { id: "inv_start_boundary" })]));

      expect(toastSuccess).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("fires at the quiet-hours end boundary (window is half-open [start, end))", () => {
      // 08:00 is the end: the window is [22:00, 08:00), so 08:00 is NOT quiet.
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T08:00:00"));

      setQuietHours(true, "22:00", "08:00");
      renderHook(() => useMaturityReminder([invoiceMaturingIn(7, { id: "inv_end_boundary" })]));

      expect(toastSuccess).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it("handles a same-day quiet window (e.g. 09:00–17:00)", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T10:00:00"));

      setQuietHours(true, "09:00", "17:00");
      renderHook(() => useMaturityReminder([invoiceMaturingIn(7, { id: "inv_sameday_quiet" })]));

      expect(toastSuccess).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("fires outside a same-day quiet window", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T18:00:00"));

      setQuietHours(true, "09:00", "17:00");
      renderHook(() => useMaturityReminder([invoiceMaturingIn(7, { id: "inv_sameday_outside" })]));

      expect(toastSuccess).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });
});

// ── isInQuietHours unit tests ──────────────────────────────────────────────────

describe("isInQuietHours", () => {
  function at(hour: number, minute = 0): Date {
    const d = new Date("2024-01-15T00:00:00");
    d.setHours(hour, minute, 0, 0);
    return d;
  }

  describe("overnight window (22:00–08:00)", () => {
    it("returns true at 22:00 (start boundary)", () => {
      expect(isInQuietHours("22:00", "08:00", at(22, 0))).toBe(true);
    });

    it("returns true at 23:30", () => {
      expect(isInQuietHours("22:00", "08:00", at(23, 30))).toBe(true);
    });

    it("returns true at 00:00 (midnight)", () => {
      expect(isInQuietHours("22:00", "08:00", at(0, 0))).toBe(true);
    });

    it("returns true at 07:59", () => {
      expect(isInQuietHours("22:00", "08:00", at(7, 59))).toBe(true);
    });

    it("returns false at 08:00 (end boundary — half-open)", () => {
      expect(isInQuietHours("22:00", "08:00", at(8, 0))).toBe(false);
    });

    it("returns false at 12:00", () => {
      expect(isInQuietHours("22:00", "08:00", at(12, 0))).toBe(false);
    });

    it("returns false at 21:59", () => {
      expect(isInQuietHours("22:00", "08:00", at(21, 59))).toBe(false);
    });
  });

  describe("same-day window (09:00–17:00)", () => {
    it("returns true at 09:00 (start boundary)", () => {
      expect(isInQuietHours("09:00", "17:00", at(9, 0))).toBe(true);
    });

    it("returns true at 12:00", () => {
      expect(isInQuietHours("09:00", "17:00", at(12, 0))).toBe(true);
    });

    it("returns false at 17:00 (end boundary — half-open)", () => {
      expect(isInQuietHours("09:00", "17:00", at(17, 0))).toBe(false);
    });

    it("returns false at 08:59", () => {
      expect(isInQuietHours("09:00", "17:00", at(8, 59))).toBe(false);
    });

    it("returns false at 23:00", () => {
      expect(isInQuietHours("09:00", "17:00", at(23, 0))).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("returns false when start equals end (zero-width window)", () => {
      // start === end means the same-day branch fires but start <= end (equal),
      // so it's treated as a zero-width window — no time can be inside it.
      expect(isInQuietHours("08:00", "08:00", at(8, 0))).toBe(false);
    });
  });
});
