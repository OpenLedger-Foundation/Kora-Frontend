"use client";

/**
 * useContractEvents — polls the Soroban RPC getEvents API every 10 seconds
 * for invoice_funded, invoice_repaid, and yield_distributed events.
 *
 * On each poll:
 * - Parses event XDR to extract tokenId, amount, and participant address
 * - Invalidates relevant TanStack Query caches
 * - Shows a toast for events involving the connected wallet address
 * - Tracks the last processed ledger to avoid reprocessing events
 */

import { useEffect, useRef, useCallback } from "react";
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
import { env } from "@/lib/env";
import { formatCurrency, truncateAddress } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 10_000;

const EVENT_TYPES: KoraEventType[] = [
  "invoice_funded",
  "invoice_repaid",
  "yield_distributed",
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

    case "yield_distributed":
      toast.success(
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-kora-400">Yield Distributed 🎉</span>
          <span className="text-xs text-muted-foreground">
            {amountStr} yield sent to {shortAddr}
          </span>
        </div>,
        { duration: 7000 }
      );
      break;
  }
}

// ─── Cache invalidation ───────────────────────────────────────────────────────

/**
 * Invalidate TanStack Query caches based on the event type.
 * Maps each event to the relevant query keys that need refreshing.
 */
function invalidateCachesForEvent(
  event: ContractEvent,
  queryClient: ReturnType<typeof useQueryClient>
) {
  switch (event.type) {
    case "invoice_funded":
      // Refresh the specific invoice detail and the full list (funding progress changed)
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.detail(event.tokenId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.all,
      });
      break;

    case "invoice_repaid":
      // Refresh invoice detail (status → repaid) and investor positions
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.detail(event.tokenId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.all,
      });
      // Invalidate all positions (yield may now be claimable)
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "invoices" &&
          query.queryKey[1] === "positions",
      });
      break;

    case "yield_distributed":
      // Refresh investor positions and account balances (USDC balance changed)
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "invoices" &&
          query.queryKey[1] === "positions",
      });
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey[0] === "account",
      });
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

  // Only emit a mock event occasionally (every ~30s = every 3rd poll)
  if (_mockLedger % 3 !== 0) {
    return { events: [], latestLedger: _mockLedger };
  }

  const eventTypes: KoraEventType[] = [
    "invoice_funded",
    "invoice_repaid",
    "yield_distributed",
  ];
  const type = eventTypes[_mockLedger % eventTypes.length];

  const event: ContractEvent = {
    id: `mock-event-${_mockLedger}`,
    ledger: _mockLedger,
    ledgerClosedAt: new Date().toISOString(),
    contractId: env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID,
    type,
    tokenId: String((_mockLedger % 5) + 1),
    amount: type === "yield_distributed" ? 125.5 : 5000,
    participantAddress: walletAddress,
    rawTopics: [type],
  };

  return { events: [event], latestLedger: _mockLedger };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseContractEventsOptions {
  /** Override the contract ID to listen on (defaults to MARKETPLACE_CONTRACT_ID) */
  contractId?: string;
  /** Override the poll interval in ms (defaults to 10_000) */
  pollIntervalMs?: number;
  /** Disable polling entirely */
  disabled?: boolean;
}

/**
 * Subscribes to Soroban contract events via polling.
 *
 * Polls every 10 seconds for invoice_funded, invoice_repaid, and
 * yield_distributed events. Invalidates TanStack Query caches and shows
 * wallet-relevant toasts on each new event.
 *
 * Uses a ledger cursor to avoid reprocessing events across polls.
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

  // Track the last processed ledger to use as cursor
  const lastLedgerRef = useRef<number>(0);
  // Track processed event IDs to deduplicate within a session
  const processedEventIds = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    // Skip polling when tab is hidden to save resources
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

      // Update cursor to the latest ledger seen
      if (latestLedger > lastLedgerRef.current) {
        lastLedgerRef.current = latestLedger;
      }

      // Process only new, unseen events
      const newEvents = events.filter(
        (e) => !processedEventIds.current.has(e.id)
      );

      for (const event of newEvents) {
        processedEventIds.current.add(event.id);

        // 1. Invalidate relevant TanStack Query caches
        invalidateCachesForEvent(event, queryClient);

        // 2. Show toast for wallet-relevant events (if notifications enabled)
        if (walletAddress && notificationPreferences.invoiceFunded) {
          showEventToast(event, walletAddress);
        }
      }

      // Prevent the processed set from growing unboundedly
      if (processedEventIds.current.size > 500) {
        const arr = Array.from(processedEventIds.current);
        processedEventIds.current = new Set(arr.slice(-250));
      }
    } catch (err) {
      // Silently swallow polling errors — the UI should not break if events
      // are temporarily unavailable. Log for debugging only.
      if (process.env.NODE_ENV === "development") {
        console.warn("[useContractEvents] Poll error:", err);
      }
    }
  }, [contractId, queryClient, walletAddress, notificationPreferences.invoiceFunded]);

  useEffect(() => {
    if (disabled) return;

    // Run an initial poll immediately
    poll();

    intervalRef.current = setInterval(poll, pollIntervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Immediately poll when tab becomes visible again
        poll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [disabled, poll, pollIntervalMs]);
}
