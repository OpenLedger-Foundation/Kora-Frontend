"use client";

import { useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useSettingsStore } from "@/store/settingsStore";
import { daysUntil } from "@/lib/utils";
import type { Invoice } from "@/types";

/**
 * Thresholds (in days) at which a maturity reminder toast is shown.
 * Toasts fire once per session per invoice per threshold.
 */
const REMINDER_THRESHOLDS_DAYS = [30, 14, 7, 3, 1] as const;

const SESSION_CACHE_KEY = "kora-maturity-reminded";

function getSessionCache(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function addToSessionCache(key: string): void {
  if (typeof window === "undefined") return;
  try {
    const cache = getSessionCache();
    cache.add(key);
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify([...cache]));
  } catch {
    // silently ignore storage errors
  }
}

/**
 * useMaturityReminder
 *
 * Watches a list of invoices and fires push toast notifications when an
 * invoice's repayment date crosses a configured threshold — **only** when
 * the maturity push notification preference is enabled in settingsStore.
 *
 * Reminders are de-duplicated per session via sessionStorage so they fire
 * at most once per threshold per invoice.
 *
 * @param invoices - The invoices to watch (typically the user's positions).
 */
export function useMaturityReminder(invoices: Invoice[]): void {
  const { isEnabled } = useSettingsStore();

  const checkReminders = useCallback(() => {
    // Respect the maturity push notification preference
    if (!isEnabled("maturity", "push")) return;

    const sessionCache = getSessionCache();

    for (const invoice of invoices) {
      // Only relevant for active invoices
      if (
        invoice.status !== "listed" &&
        invoice.status !== "partially_funded" &&
        invoice.status !== "fully_funded" &&
        invoice.status !== "active"
      ) {
        continue;
      }

      const days = daysUntil(invoice.terms.repaymentDate);

      for (const threshold of REMINDER_THRESHOLDS_DAYS) {
        if (days > threshold) continue;

        const cacheKey = `${invoice.id}:${threshold}`;
        if (sessionCache.has(cacheKey)) continue;

        // Fire the toast
        addToSessionCache(cacheKey);

        const message =
          days <= 0
            ? `${invoice.metadata.invoiceNumber} is due today!`
            : days === 1
            ? `${invoice.metadata.invoiceNumber} matures tomorrow.`
            : `${invoice.metadata.invoiceNumber} matures in ${days} day${days === 1 ? "" : "s"}.`;

        const severity =
          days <= 1 ? "error" : days <= 7 ? "warning" : "info";

        if (severity === "error") {
          toast.error("Invoice Maturity Reminder", {
            description: message,
            duration: 8000,
          });
        } else if (severity === "warning") {
          toast.warning("Invoice Maturity Reminder", {
            description: message,
            duration: 6000,
          });
        } else {
          toast.info("Invoice Maturity Reminder", {
            description: message,
            duration: 4000,
          });
        }

        // Only fire the first matching (tightest) threshold per invoice
        break;
      }
    }
  }, [invoices, isEnabled]);

  useEffect(() => {
    checkReminders();
    // Re-run whenever the invoice list changes (e.g. after refetch)
  }, [checkReminders]);
}
