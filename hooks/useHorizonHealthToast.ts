"use client";

/**
 * useHorizonHealthToast — surface degraded Horizon health as a toast (Issue #1007)
 *
 * The navbar dot only changes colour when Horizon slows down or fails, so users
 * who never open the network tooltip have no idea their balances may be stale.
 * This hook watches the Horizon service status and raises a dismissible toast
 * when it transitions into `degraded` or `down`.
 *
 * - **Deduped** — a single toast id is reused, so repeated warnings replace the
 *   existing toast instead of stacking duplicates.
 * - **Coalesced** — offline/online flaps and operational ⇄ degraded flapping are
 *   debounced: a severity must persist for a short window before it toasts, and
 *   a long outage collapses into one toast rather than flickering.
 * - **Self-clearing** — returning to `operational` dismisses the toast, so a
 *   recovered network never leaves a stale error on screen.
 * - **Offline-aware** — while the browser is offline every health check fails;
 *   the indicator already shows "Offline", so no Horizon toast is raised.
 *
 * Animation is handled by sonner, whose stylesheet disables toast transitions
 * under `prefers-reduced-motion`.
 */

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/hooks/useToast";
import type { NetworkStatus } from "@/hooks/useNetworkStatus";

export const HORIZON_HEALTH_TOAST_ID = "horizon-health";

/** How long a severity must persist before it is surfaced (coalesces flaps). */
export const HORIZON_HEALTH_COALESCE_MS = 4000;

type Severity = Exclude<NetworkStatus, "operational">;

// Module state is the source of truth for the currently surfaced severity so
// repeated renders/remounts do not re-toast the same warning (dedupe).
let surfaced: Severity | null = null;

/** Clears the dedupe state. Exposed for tests. */
export function resetHorizonHealthToastThrottle() {
  surfaced = null;
}

export function useHorizonHealthToast(
  status: NetworkStatus,
  isOnline: boolean,
  onRetry?: () => void,
) {
  const t = useTranslations("network");
  const toast = useToast();
  const previous = useRef<NetworkStatus>("operational");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the latest callbacks without re-running the transition effect.
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const onRetryRef = useRef(onRetry);
  onRetryRef.current = onRetry;

  useEffect(() => {
    const prev = previous.current;
    previous.current = status;

    const clearTimer = () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };

    if (status === "operational") {
      clearTimer();
      if (prev !== "operational") {
        toastRef.current.dismiss(HORIZON_HEALTH_TOAST_ID);
        surfaced = null;
      }
      return;
    }

    // Offline: the indicator already shows "Offline"; do not raise a Horizon
    // toast, and cancel any pending coalesced toast.
    if (!isOnline) {
      clearTimer();
      return;
    }

    if (status === prev) return;

    // Dedupe: this severity is already on screen.
    if (surfaced === status) return;

    // Coalesce: wait for the severity to persist before surfacing it. A flap
    // back to operational (or offline) clears the pending timer above.
    clearTimer();
    timer.current = setTimeout(() => {
      timer.current = null;
      if (surfaced === status) return;
      surfaced = status;
      toastRef.current.error(
        status === "down" ? t("horizonDownToast") : t("horizonDegradedToast"),
        t("horizonToastHint"),
        onRetryRef.current ? () => onRetryRef.current?.() : undefined,
        HORIZON_HEALTH_TOAST_ID,
      );
    }, HORIZON_HEALTH_COALESCE_MS);

    return clearTimer;
  }, [status, isOnline, t]);
}
