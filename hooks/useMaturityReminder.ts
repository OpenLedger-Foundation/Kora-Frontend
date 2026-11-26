"use client";

import { useEffect, useCallback } from "react";
import { useToast } from "@/hooks/useToast";
import { useSettingsStore } from "@/store/settingsStore";
import { exportInvoiceCalendarIcs } from "@/lib/export";
import type { Invoice } from "@/types";

export interface QuietHoursConfig {
  enabled: boolean;
  /** Start of quiet hours in "HH:mm" 24h format. */
  start: string;
  /** End of quiet hours in "HH:mm" 24h format. */
  end: string;
  /** IANA timezone, e.g. "America/New_York". Defaults to the runtime timezone. */
  timezone?: string;
}

function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function getMinutesInTimezone(now: Date, timezone?: string): number {
  if (!timezone) {
    return now.getHours() * 60 + now.getMinutes();
  }
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hourPart = parts.find((part) => part.type === "hour")?.value ?? "0";
    const minutePart = parts.find((part) => part.type === "minute")?.value ?? "0";
    // Intl may return "24" for midnight in some environments.
    const hours = Number(hourPart) % 24;
    return hours * 60 + Number(minutePart);
  } catch {
    return now.getHours() * 60 + now.getMinutes();
  }
}

/**
 * Returns true when `now` falls inside the configured quiet-hours window.
 * Handles windows that cross midnight (e.g. 22:00 -> 07:00) and respects the
 * configured timezone. Returns false when quiet hours are disabled or the
 * configuration is invalid.
 */
export function isWithinQuietHours(config: QuietHoursConfig | undefined, now = new Date()): boolean {
  if (!config || !config.enabled) return false;
  const start = parseTimeToMinutes(config.start);
  const end = parseTimeToMinutes(config.end);
  if (start === null || end === null) return false;
  if (start === end) return false;

  const current = getMinutesInTimezone(now, config.timezone);

  if (start < end) {
    return current >= start && current < end;
  }
  // Cross-midnight window, e.g. 22:00 -> 07:00.
  return current >= start || current < end;
}
=======

const REMINDER_STORAGE_KEY = "kora-maturity-reminders";
const REPAYMENT_ALERT_STORAGE_KEY = "kora-repayment-alerts";
const REPAYMENT_DUE_SOON_DAYS = 7;

function getShownKeys(storageKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function markShown(storageKey: string, key: string) {
  if (typeof window === "undefined") return;
  const keys = getShownKeys(storageKey);
  if (keys.includes(key)) return;
  localStorage.setItem(storageKey, JSON.stringify([key, ...keys].slice(0, 50)));
}

function daysUntilDate(date: string, now = new Date()): number {
  const target = new Date(date);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Returns `true` when the given `now` falls within the quiet-hours window
 * [start, end). The window is expressed as 24-hour "HH:MM" strings in the
 * user's local time zone. When start > end (e.g. "22:00"–"08:00") the window
 * wraps around midnight.
 */
export function isInQuietHours(
  start: string,
  end: string,
  now = new Date()
): boolean {
  // Convert "HH:MM" to minutes-since-midnight for straightforward comparison.
  function toMinutes(hhmm: string): number {
    const [h = "0", m = "0"] = hhmm.split(":");
    return parseInt(h, 10) * 60 + parseInt(m, 10);
  }

  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (startMin <= endMin) {
    // Same-day window, e.g. 08:00–22:00.
    return nowMin >= startMin && nowMin < endMin;
  }
  // Overnight window, e.g. 22:00–08:00.
  return nowMin >= startMin || nowMin < endMin;
}

export function isRepaymentDueSoon(invoice: Invoice, now = new Date()): boolean {
  if (invoice.status !== "fully_funded") return false;
  const daysLeft = daysUntilDate(invoice.terms.repaymentDate, now);
  return daysLeft >= 0 && daysLeft <= REPAYMENT_DUE_SOON_DAYS;
}

export function shouldShowRepaymentDueBanner(
  invoices: Invoice[],
  repaymentAlerts: boolean,
  now = new Date()
): boolean {
  return repaymentAlerts && invoices.some((invoice) => isRepaymentDueSoon(invoice, now));
}

export function useMaturityReminder(invoices: Invoice[]) {
  const { notifications } = useSettingsStore();
  const toast = useToast();

  const downloadCalendarForInvoice = useCallback((invoice: Invoice) => {
    exportInvoiceCalendarIcs(invoice);
  }, []);

  const quietHours = notifications.quietHours;

  useEffect(() => {
    if (!notifications.maturityReminder || invoices.length === 0) return;

    // Suppress (defer) reminders while inside the quiet-hours window. The
    // reminder is not marked as shown, so it will fire on a later effect run
    // once the window has passed.
    if (isWithinQuietHours(quietHours)) return;

    invoices.forEach((invoice) => {
      const daysLeft = daysUntilDate(invoice.terms.repaymentDate);
      if (daysLeft !== notifications.maturityReminderDays) return;

      const reminderKey = `${invoice.id}:${notifications.maturityReminderDays}`;
      if (getShownKeys(REMINDER_STORAGE_KEY).includes(reminderKey)) return;

      toast.success(
        `Maturity reminder: ${invoice.metadata.invoiceNumber} matures in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`
      );
      markShown(REMINDER_STORAGE_KEY, reminderKey);
    });
  }, [
    invoices,
    notifications.maturityReminder,
    notifications.maturityReminderDays,
    quietHours,
    toast,
  ]);

  useEffect(() => {
    if (!notifications.repaymentAlerts || invoices.length === 0) return;

    invoices.forEach((invoice) => {
      if (!isRepaymentDueSoon(invoice)) return;

      const alertKey = invoice.id;
      if (getShownKeys(REPAYMENT_ALERT_STORAGE_KEY).includes(alertKey)) return;

      const daysLeft = daysUntilDate(invoice.terms.repaymentDate);
      const timing = daysLeft === 0 ? "today" : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
      toast.success(`Repayment due soon: ${invoice.metadata.invoiceNumber} is due ${timing}.`);
      markShown(REPAYMENT_ALERT_STORAGE_KEY, alertKey);
    });
  }, [invoices, notifications.repaymentAlerts, toast]);

  return { downloadCalendarForInvoice };
}
