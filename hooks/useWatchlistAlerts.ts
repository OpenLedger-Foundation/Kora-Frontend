"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useFormatters } from "@/hooks/useFormatters";
import type { Invoice } from "@/types";
import { useInvoiceStore } from "@/store";
import { useSettingsStore, type NotificationPrefs } from "@/store/settingsStore";
import { useToast } from "@/hooks/useToast";

type Snapshot = Pick<Invoice, "status"> & {
  fundingProgress: number;
  apr: number;
};

export function getAlertMessage(
  invoice: Invoice,
  previous: Snapshot | undefined,
  preferences: NotificationPrefs,
  t: (key: string, values?: Record<string, string | number>) => string,
  formatPercentage: (value: number, decimals?: number) => string
): string | null {
  if (!previous) return null;
  const invoiceNumber = invoice.metadata.invoiceNumber || invoice.id;
  if (preferences.status && previous.status !== invoice.status) {
    return t("alerts.statusChanged", {
      invoiceNumber,
      status: t(`alerts.statuses.${invoice.status}`),
    });
  }
  if (preferences.fundingProgress && previous.fundingProgress !== invoice.funding.fundingProgress) {
    return t("alerts.fundingProgress", {
      invoiceNumber,
      percent: formatPercentage(invoice.funding.fundingProgress * 100, 0),
    });
  }
  if (preferences.apr && previous.apr !== invoice.terms.apr) {
    return t("alerts.aprChanged", {
      invoiceNumber,
      apr: formatPercentage(invoice.terms.apr, 0),
    });
  }
  return null;
}

/** Identical alerts (same invoice + message) are suppressed for this long. */
export const ALERT_DEDUPE_MS = 60_000;
/** At most ALERT_THROTTLE_MAX toasts are shown per ALERT_THROTTLE_WINDOW_MS. */
export const ALERT_THROTTLE_WINDOW_MS = 10_000;
export const ALERT_THROTTLE_MAX = 3;

export interface AlertGate {
  /** Returns true if the alert identified by `key` should be shown now. */
  shouldEmit(key: string, now?: number): boolean;
}

/**
 * Dedupe + throttle gate for watchlist toasts (#1141).
 *
 * - Dedupe: a key already shown within `dedupeMs` is dropped, so a store
 *   refresh that re-reports the same change (or flaps back and forth) does
 *   not toast twice.
 * - Throttle: a sliding window caps how many toasts can fire in a burst, so
 *   a bulk refresh of many watched invoices cannot produce a toast storm.
 *   Dropped alerts are not queued; the next real change will alert again.
 */
export function createAlertGate({
  dedupeMs = ALERT_DEDUPE_MS,
  windowMs = ALERT_THROTTLE_WINDOW_MS,
  maxPerWindow = ALERT_THROTTLE_MAX,
}: { dedupeMs?: number; windowMs?: number; maxPerWindow?: number } = {}): AlertGate {
  const lastShown = new Map<string, number>();
  let recent: number[] = [];

  return {
    shouldEmit(key, now = Date.now()) {
      const previous = lastShown.get(key);
      if (previous !== undefined && now - previous < dedupeMs) return false;

      recent = recent.filter((at) => now - at < windowMs);
      if (recent.length >= maxPerWindow) return false;

      recent.push(now);
      lastShown.set(key, now);
      // Keep the dedupe map bounded to recently-shown keys.
      for (const [k, at] of lastShown) {
        if (now - at >= dedupeMs) lastShown.delete(k);
      }
      return true;
    },
  };
}

function snapshot(invoice: Invoice): Snapshot {
  return {
    status: invoice.status,
    fundingProgress: invoice.funding.fundingProgress,
    apr: invoice.terms.apr,
  };
}

export function useWatchlistAlerts() {
  const t = useTranslations("marketplace.watchlist");
  const { formatPercentage } = useFormatters();
  const invoices = useInvoiceStore((state) => state.invoices);
  const watchedInvoiceIds = useInvoiceStore((state) => state.watchedInvoiceIds);
  const preferences = useSettingsStore((state) => state.notifications);
  const previous = useRef<Record<string, Snapshot>>({});
  const gate = useRef<AlertGate | null>(null);
  if (gate.current === null) gate.current = createAlertGate();
  const { info } = useToast();

  useEffect(() => {
    const watched = new Set(watchedInvoiceIds);
    const next: Record<string, Snapshot> = {};

    invoices.forEach((invoice) => {
      if (!watched.has(invoice.id)) return;
      const current = snapshot(invoice);
      const old = previous.current[invoice.id];
      next[invoice.id] = current;
      if (!old) return;

      const translate = t as unknown as (key: string, values?: Record<string, string | number>) => string;
      const message = getAlertMessage(invoice, old, preferences, translate, formatPercentage);
      if (message && gate.current?.shouldEmit(`${invoice.id}:${message}`)) info(message);
    });

    previous.current = next;
  }, [invoices, watchedInvoiceIds, preferences, info, t, formatPercentage]);
}
