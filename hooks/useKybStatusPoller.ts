/**
 * useKybStatusPoller — Issue #489, resourced by the Synaps webhook in #694.
 *
 * Polls `kycStatus` from the wallet store on a fixed interval while `enabled`
 * is true. As soon as the status flips to `"verified"`, the `onVerified`
 * callback fires and polling stops.
 *
 * The poller stays side-effect-free — it reads the Zustand store directly and
 * makes no request of its own. What changed in #694 is who writes that store.
 * It used to be only `SynapsKycModal`; now `useKycStatusSync`, mounted app-wide
 * in `WalletButton`, pulls the status the `/api/webhooks/kyc` handler recorded
 * into the same store. So a real Synaps callback advances this gate through
 * exactly the path the mock always used, and this hook keeps working without a
 * TanStack Query client of its own.
 *
 * Issue #1124 adds explicit idle/pending/fail states, exponential backoff, and
 * 429 (rate-limit) handling so the KYB gate can render empty/error/retry UI and
 * recover via `retry()` without inventing a parallel polling subsystem.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useWalletKycStatus, useWalletStore } from "@/store/walletStore";
import { KYC_POLL_INTERVAL_MS } from "@/hooks/useKycStatusSync";

/** Lifecycle state exposed to the KYB gate UI. */
export type KybPollState = "idle" | "pending" | "verified" | "fail";

/** Upper bound for the exponential backoff between polls. */
const MAX_BACKOFF_MS = KYC_POLL_INTERVAL_MS * 8;

interface UseKybStatusPollerOptions {
  /** Polling is active only while this is `true`. */
  enabled: boolean;
  /** Called once when `kycStatus` becomes `"verified"`. */
  onVerified?: () => void;
  /**
   * Optional probe run on each tick. Return `"rate-limited"` to signal a 429
   * so the poller backs off instead of hammering the endpoint.
   */
  probe?: () => Promise<"ok" | "rate-limited">;
}

export interface UseKybStatusPollerResult {
  /** Current lifecycle state for the gate UI. */
  state: KybPollState;
  /** Number of consecutive failed/rate-limited ticks. */
  failures: number;
  /** True while a 429 backoff is in effect. */
  rateLimited: boolean;
  /** Reset the poller and immediately re-poll (used by the retry button). */
  retry: () => void;
}

export function useKybStatusPoller({
  enabled,
  onVerified,
  probe,
}: UseKybStatusPollerOptions): UseKybStatusPollerResult {
  const kycStatus = useWalletKycStatus();
  const onVerifiedRef = useRef(onVerified);
  // Keep the ref fresh on every render without re-triggering the effect.
  onVerifiedRef.current = onVerified;
  const probeRef = useRef(probe);
  probeRef.current = probe;

  const [state, setState] = useState<KybPollState>("idle");
  const [failures, setFailures] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  // Bumping this re-runs the polling effect (retry / manual re-poll).
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setFailures(0);
    setRateLimited(false);
    setState("pending");
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState("idle");
      return;
    }

    // Already verified before the effect even runs.
    if (kycStatus === "verified") {
      setState("verified");
      onVerifiedRef.current?.();
      return;
    }

    setState("pending");

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let localFailures = 0;

    const schedule = (delay: number) => {
      timeoutId = setTimeout(tick, delay);
    };

    const tick = async () => {
      if (cancelled) return;

      // Re-read the store value synchronously inside the tick.
      // Zustand's store is synchronously readable via getState().
      const status = useWalletStore.getState().kycStatus;
      if (status === "verified") {
        setState("verified");
        onVerifiedRef.current?.();
        return;
      }

      let nextDelay = KYC_POLL_INTERVAL_MS;
      try {
        const result = await probeRef.current?.();
        if (cancelled) return;
        if (result === "rate-limited") {
          localFailures += 1;
          setFailures(localFailures);
          setRateLimited(true);
          nextDelay = Math.min(
            KYC_POLL_INTERVAL_MS * 2 ** localFailures,
            MAX_BACKOFF_MS,
          );
        } else {
          localFailures = 0;
          setFailures(0);
          setRateLimited(false);
        }
      } catch {
        if (cancelled) return;
        localFailures += 1;
        setFailures(localFailures);
        setState("fail");
        nextDelay = Math.min(
          KYC_POLL_INTERVAL_MS * 2 ** localFailures,
          MAX_BACKOFF_MS,
        );
      }

      if (!cancelled) schedule(nextDelay);
    };

    schedule(KYC_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, attempt]);

  return { state, failures, rateLimited, retry };
}
