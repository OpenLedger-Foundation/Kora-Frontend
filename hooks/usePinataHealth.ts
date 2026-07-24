"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { checkPinataHealth, invalidatePinataHealthCache } from "@/lib/ipfs";

export type PinataHealthStatus = "idle" | "checking" | "healthy" | "unhealthy";

export interface UsePinataHealthOptions {
  /**
   * Automatically re-check with exponential backoff after an unhealthy result.
   * Defaults to true — the wizard recovers on its own when Pinata comes back.
   */
  autoRetry?: boolean;
  /** Maximum automatic retry attempts before giving up. Default 4. */
  maxRetries?: number;
  /** Base delay (ms) for exponential backoff. Default 3000. */
  baseDelayMs?: number;
  /** Cap for a single backoff delay (ms). Default 30000. */
  maxDelayMs?: number;
}

export interface UsePinataHealthResult {
  status: PinataHealthStatus;
  isHealthy: boolean;
  isChecking: boolean;
  /** Number of automatic backoff retries performed since the last healthy check. */
  retryCount: number;
  /** Timestamp (ms) of the last completed check, or null before the first. */
  lastCheckedAt: number | null;
  /**
   * Manually re-check health. Always bypasses the 60s health cache so the
   * "Retry" button performs a real fresh ping, then resets backoff.
   */
  recheck: () => void;
}

/**
 * Checks whether Pinata is reachable before the user attempts an upload.
 *
 * - Fires automatically on mount.
 * - `recheck()` invalidates the cached health result first, so the retry button
 *   always performs a genuine fresh probe (the 60s cache would otherwise make a
 *   manual retry a no-op).
 * - When `autoRetry` is enabled, an unhealthy result schedules escalating
 *   background re-checks (exponential backoff) so the wizard self-heals once
 *   Pinata recovers, without hammering the endpoint.
 */
export function usePinataHealth(
  options: UsePinataHealthOptions = {}
): UsePinataHealthResult {
  const {
    autoRetry = true,
    maxRetries = 4,
    baseDelayMs = 3_000,
    maxDelayMs = 30_000,
  } = options;

  const [status, setStatus] = useState<PinataHealthStatus>("idle");
  const [retryCount, setRetryCount] = useState(0);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  // Timer + retry bookkeeping kept in refs so the effect deps stay stable.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);
  const mountedRef = useRef(true);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /**
   * Run a single health probe.
   * @param force - bypass the health cache (used by manual retry).
   */
  const run = useCallback(
    async (force: boolean) => {
      if (force) invalidatePinataHealthCache();
      setStatus("checking");
      const healthy = await checkPinataHealth();
      if (!mountedRef.current) return healthy;

      setStatus(healthy ? "healthy" : "unhealthy");
      setLastCheckedAt(Date.now());

      if (healthy) {
        // Recovered — stop any pending backoff and reset the counter.
        clearTimer();
        retriesRef.current = 0;
        setRetryCount(0);
      } else if (autoRetry && retriesRef.current < maxRetries) {
        // Schedule an escalating background re-check.
        const attempt = retriesRef.current;
        const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
        retriesRef.current = attempt + 1;
        setRetryCount(retriesRef.current);
        clearTimer();
        timerRef.current = setTimeout(() => {
          void run(true);
        }, delay);
      }
      return healthy;
    },
    [autoRetry, maxRetries, baseDelayMs, maxDelayMs, clearTimer]
  );

  const recheck = useCallback(() => {
    // Manual retry resets backoff and forces a fresh, uncached probe.
    clearTimer();
    retriesRef.current = 0;
    setRetryCount(0);
    void run(true);
  }, [run, clearTimer]);

  useEffect(() => {
    mountedRef.current = true;
    void run(false);
    return () => {
      mountedRef.current = false;
      clearTimer();
    };
  }, [run, clearTimer]);

  return {
    status,
    isHealthy: status === "healthy",
    isChecking: status === "checking",
    retryCount,
    lastCheckedAt,
    recheck,
  };
}
