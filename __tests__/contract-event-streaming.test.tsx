import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateCachesForEvent } from "@/hooks/useContractEvents";
import {
  EVENT_STREAM_INTERVAL_MS,
  EVENT_POLL_FALLBACK_INTERVAL_MS,
  EVENT_STREAM_FAILURE_THRESHOLD,
  subscribeContractEvents,
  rpc,
  type ContractEvent,
} from "@/lib/stellar/client";
import { queryKeys } from "@/lib/queryKeys";

const fundedEvent: ContractEvent = {
  id: "evt-1",
  ledger: 100,
  ledgerClosedAt: new Date().toISOString(),
  contractId: "CABC",
  type: "invoice_funded",
  tokenId: "42",
  amount: 1000,
  participantAddress: "GABC",
  rawTopics: ["invoice_funded"],
};

describe("contract event streaming + invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes stream cadence under 2s and 5s polling fallback", () => {
    expect(EVENT_STREAM_INTERVAL_MS).toBeLessThanOrEqual(2_000);
    expect(EVENT_POLL_FALLBACK_INTERVAL_MS).toBe(5_000);
    expect(EVENT_STREAM_FAILURE_THRESHOLD).toBeGreaterThan(0);
  });

  it("invalidates invoice detail + list caches on invoice_funded", () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    invalidateCachesForEvent(fundedEvent, queryClient);

    expect(spy).toHaveBeenCalledWith({
      queryKey: queryKeys.invoices.detail("42"),
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.invoices.all });
  });

  it("invalidates positions caches on invoice_repaid", () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    invalidateCachesForEvent(
      { ...fundedEvent, type: "invoice_repaid", id: "evt-2" },
      queryClient
    );

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        predicate: expect.any(Function),
      })
    );
  });

  it("falls back to polling after repeated stream failures", async () => {
    // Spy at the RPC boundary — same-module vi.mock of getContractEvents does not
    // replace the binding used inside subscribeContractEvents.
    vi.spyOn(rpc, "getEvents").mockRejectedValue(new Error("stream down"));

    const modes: string[] = [];
    const sub = subscribeContractEvents(
      {
        contractId: "CABC",
        eventTypes: ["invoice_funded"],
        startLedger: 0,
        streamIntervalMs: 10,
        pollIntervalMs: 20,
      },
      {
        onEvents: () => undefined,
        onModeChange: (m) => modes.push(m),
        onError: () => undefined,
      }
    );

    await vi.waitFor(
      () => {
        expect(modes).toContain("polling");
        expect(sub.getMode()).toBe("polling");
      },
      { timeout: 2_000, interval: 20 }
    );

    sub.unsubscribe();
  });
});
