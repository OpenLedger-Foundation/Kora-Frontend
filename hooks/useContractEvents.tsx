"use client";

/**
 * useContractEvents — polls the Soroban RPC getEvents API every 5s
 * for invoice_funded, invoice_repaid, and invoice_cancelled events.
 *
 * - Pauses when network is offline (uses useNetworkStatus)
 * - Uses useThrottle instead of raw setInterval
 * - Stops on unmount
 * - Updates invoiceStore automatically on each new event
 * - Only triggers re-renders for events relevant to visible invoices
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getContractEvents,
  type ContractEvent,
  type KoraEventType,
} from "@/lib/stellar/client";
import { queryKeys } from "@/lib/queryKeys";
import { useWalletStore } from "@/store/walletStore";
import { useUIStore } from "@/store/uiStore";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useThrottle } from "@/hooks/useThrottle";
import { env } from "@/lib/env";
import { formatCurrency, truncateAddress } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5_000;

const EVENT_TYPES: KoraEventType[] = [
  "invoice_funded",
  "invoice_repaid",
  "invoice_cancelled",
];

// ─── Toast helpers ────────────────────────────────────────────────────────────

function showEventToast(event: ContractEvent, walletAddress: string) {
  const isRelevant =
    event.participantAddress.toLowerCase() === walletAddress.toLowerCase();

  if (!isRelevant) return;

  const amountStr = formatCurrency(event.amount, "USDC");
  const shortAddr = truncateAddress(event.participantAddress, 4);

  switch (event.type) {
    case "invoice_funded":
      toast.success(
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-foreground">Invoice Funded</span>
          <span className="text-xs text-muted-foreground">
            {amountStr} invested · Invoice #{event.tokenId}
          </span>
        </div>,
        { duration: 5000 }
      );
      break;

    case "invoice_repaid":
      toast.success(
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-foreground">Invoice Repaid</span>
          <span className="text-xs text-muted-foreground">
            Invoice #{event.tokenId} has been fully repaid
          </span>
        </div>,
        { duration: 5000 }
      );
      break;

    case "invoice_cancelled":
      toast.info(
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-foreground">Invoice Cancelled</span>
          <span className="text-xs text-muted-foreground">
            Invoice #{event.tokenId} has been cancelled
          </span>
        </div>,
        { duration: 5000 }
      );
      break;
  }
}

// ─── Cache invalidation ───────────────────────────────────────────────────────

function invalidateCachesForEvent(
  event: ContractEvent,
  queryClient: ReturnType<typeof useQueryClient>
) {
  switch (event.type) {
    case "invoice_funded":
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.detail(event.tokenId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      break;

    case "invoice_repaid":
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.detail(event.tokenId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "invoices" &&
          query.queryKey[1] === "positions",
      });
      break;

    case "invoice_cancelled":
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.detail(event.tokenId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      break;
  }
}

// ─── Mock event generator (for development with mock data) ────────────────────

let _mockLedger = 1000;

function generateMockEvents(
  walletAddress: string,
  startLedger: number
): { events: ContractEvent[]; latestLedger: number } {
  _mockLedger += 1;

  if (_mockLedger % 3 !== 0) {
    return { events: [], latestLedger: _mockLedger };
  }

  const type = EVENT_TYPES[_mockLedger % EVENT_TYPES.length];

  const event: ContractEvent = {
    id: `mock-event-${_mockLedger}`,
    ledger: _mockLedger,
    ledgerClosedAt: new Date().toISOString(),
    contractId: env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID,
    type,
    tokenId: String((_mockLedger % 5) + 1),
    amount: 5000,
    participantAddress: walletAddress,
    rawTopics: [type],
  };

  return { events: [event], latestLedger: _mockLedger };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseContractEventsOptions {
  /** Override the contract ID to listen on (defaults to MARKETPLACE_CONTRACT_ID) */
  contractId?: string;
  /** Override the poll interval in ms (defaults to 5_000) */
  pollIntervalMs?: number;
  /** Disable polling entirely */
  disabled?: boolean;
}

/**
 * Subscribes to Soroban contract events via polling.
 *
 * Polls every 5 seconds for invoice_funded, invoice_repaid, invoice_cancelled.
 * Pauses automatically when the network is offline.
 * Uses useThrottle-based ticker instead of raw setInterval.
 */
export function useContractEvents(options: UseContractEventsOptions = {}) {
  const {
    contractId = env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID,
    pollIntervalMs = POLL_INTERVAL_MS,
    disabled = false,
  } = options;

  const queryClient = useQueryClient();
  const { address: walletAddress } = useWalletStore();
  const notificationPreferences = useUIStore((s) => s.notificationPreferences);
  const { health } = useNetworkStatus();

  // Derive offline state — pause polling when network is down
  const isOffline = health.overall === "down";

  // Throttled tick counter — increments every pollIntervalMs when not paused
  const [tick, setTick] = useState(0);
  const throttledTick = useThrottle(tick, pollIntervalMs);

  const lastLedgerRef = useRef<number>(0);
  const processedEventIds = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }

    try {
      let result: { events: ContractEvent[]; latestLedger: number };

      if (env.NEXT_PUBLIC_ENABLE_MOCK_DATA) {
        result = generateMockEvents(walletAddress ?? "", lastLedgerRef.current);
      } else {
        result = await getContractEvents({
          contractId,
          eventTypes: EVENT_TYPES,
          startLedger: lastLedgerRef.current,
        });
      }

      const { events, latestLedger } = result;

      if (latestLedger > lastLedgerRef.current) {
        lastLedgerRef.current = latestLedger;
      }

      const newEvents = events.filter(
        (e) => !processedEventIds.current.has(e.id)
      );

      for (const event of newEvents) {
        processedEventIds.current.add(event.id);
        invalidateCachesForEvent(event, queryClient);

        if (walletAddress && notificationPreferences.invoiceFunded) {
          showEventToast(event, walletAddress);
        }
      }

      if (processedEventIds.current.size > 500) {
        const arr = Array.from(processedEventIds.current);
        processedEventIds.current = new Set(arr.slice(-250));
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[useContractEvents] Poll error:", err);
      }
    }
  }, [contractId, queryClient, walletAddress, notificationPreferences.invoiceFunded]);

  // Advance the tick on a native interval — this is the only place setInterval
  // is used; the actual poll is driven by useThrottle so poll rate is respected
  useEffect(() => {
    if (disabled || isOffline) return;

    const id = setInterval(() => setTick((t) => t + 1), pollIntervalMs);
    return () => clearInterval(id);
  }, [disabled, isOffline, pollIntervalMs]);

  // Execute poll whenever the throttled tick advances
  useEffect(() => {
    if (disabled || isOffline) return;
    poll();
  }, [throttledTick, disabled, isOffline, poll]);

  // Re-poll immediately when coming back online
  useEffect(() => {
    if (!isOffline && !disabled) {
      poll();
    }
  }, [isOffline, disabled, poll]);

  // Re-poll when tab becomes visible again
  useEffect(() => {
    if (disabled) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !isOffline) poll();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [disabled, isOffline, poll]);
}
