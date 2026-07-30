/**
 * useKybStatusPoller — Issue #489
 *
 * Polls `kycStatus` from the wallet store on a fixed interval while `enabled`
 * is true. As soon as the status flips to `"verified"`, the `onVerified`
 * callback fires and polling stops.
 *
 * The poller is intentionally side-effect-free: it reads from the Zustand
 * store directly (no network request) because in the mock environment
 * SynapsKycModal already writes the resolved status to the store.  In a
 * production integration the webhook handler (`/api/webhooks/kyc`) would
 * update a server-side record, and a real poller would call that API.
 */

import { useEffect, useRef } from "react";
import { useWalletKycStatus, useWalletStore } from "@/store/walletStore";

const POLL_INTERVAL_MS = 4_000;

interface UseKybStatusPollerOptions {
  /** Polling is active only while this is `true`. */
  enabled: boolean;
  /** Called once when `kycStatus` becomes `"verified"`. */
  onVerified?: () => void;
}

export function useKybStatusPoller({
  enabled,
  onVerified,
}: UseKybStatusPollerOptions): void {
  const kycStatus = useWalletKycStatus();
  const onVerifiedRef = useRef(onVerified);
  // Keep the ref fresh on every render without re-triggering the effect.
  onVerifiedRef.current = onVerified;

  useEffect(() => {
    if (!enabled) return;

    // Already verified before the effect even runs.
    if (kycStatus === "verified") {
      onVerifiedRef.current?.();
      return;
    }

    const intervalId = setInterval(() => {
      // Re-read the store value synchronously inside the interval.
      // Zustand's store is synchronously readable via getState().
      const status = useWalletStore.getState().kycStatus;
      if (status === "verified") {
        clearInterval(intervalId);
        onVerifiedRef.current?.();
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
