import { describe, it, expect, beforeEach } from "vitest";
import { useTransactionStore } from "../transactionStore";

describe("Escrow State Machine", () => {
  beforeEach(() => {
    useTransactionStore.getState().resetEscrow();
  });

  it("should initialize with default idle state", () => {
    const state = useTransactionStore.getState().escrowState;
    expect(state.step).toBe("idle");
    expect(state.errorStep).toBe(null);
    expect(state.errorMessage).toBe(null);
  });

  it("should transition steps correctly", () => {
    const store = useTransactionStore.getState();
    store.setEscrowStep("buyer_funding");
    expect(useTransactionStore.getState().escrowState.step).toBe("buyer_funding");

    store.setEscrowStep("buyer_funded");
    expect(useTransactionStore.getState().escrowState.step).toBe("buyer_funded");
  });

  it("should set and clear errors", () => {
    const store = useTransactionStore.getState();
    store.setEscrowStep("buyer_funding");
    store.setEscrowError("buyer_funding", "Insufficient funds");

    let state = useTransactionStore.getState().escrowState;
    expect(state.errorStep).toBe("buyer_funding");
    expect(state.errorMessage).toBe("Insufficient funds");

    // Transitioning back to an active retry step clears the error; transitioning
    // to the *next* non-retry step (e.g. buyer_funded) does not, because the
    // store only auto-clears when entering buyer_funding or seller_transferring.
    store.setEscrowStep("buyer_funding");
    state = useTransactionStore.getState().escrowState;
    expect(state.errorStep).toBe(null);
    expect(state.errorMessage).toBe(null);
  });

  it("should reset completely", () => {
    const store = useTransactionStore.getState();
    store.setEscrowStep("seller_transferring");
    store.setEscrowError("seller_transferring", "Network error");
    store.resetEscrow();

    const state = useTransactionStore.getState().escrowState;
    expect(state.step).toBe("idle");
    expect(state.errorStep).toBe(null);
    expect(state.errorMessage).toBe(null);
  });

  it("should walk the full happy path through to completion", () => {
    const store = useTransactionStore.getState();
    const path = [
      "buyer_funding",
      "buyer_funded",
      "seller_transferring",
      "completed",
    ] as const;

    for (const step of path) {
      store.setEscrowStep(step);
      expect(useTransactionStore.getState().escrowState.step).toBe(step);
    }
  });

  it("should expose dispute-relevant states the UI binds to", () => {
    const store = useTransactionStore.getState();
    const disputeStates = [
      "disputed",
      "refunded",
      "cancelled",
    ] as const;

    for (const step of disputeStates) {
      store.setEscrowStep(step);
      expect(useTransactionStore.getState().escrowState.step).toBe(step);
    }
  });

  it("should keep terminal states stable and not auto-clear errors", () => {
    const store = useTransactionStore.getState();
    store.setEscrowStep("disputed");
    store.setEscrowError("disputed", "Awaiting arbitration");

    let state = useTransactionStore.getState().escrowState;
    expect(state.step).toBe("disputed");
    expect(state.errorStep).toBe("disputed");
    expect(state.errorMessage).toBe("Awaiting arbitration");

    // Re-entering a terminal state must not silently drop the error, so the
    // dispute UI keeps showing the machine's actual state.
    store.setEscrowStep("disputed");
    state = useTransactionStore.getState().escrowState;
    expect(state.step).toBe("disputed");
    expect(state.errorStep).toBe("disputed");
    expect(state.errorMessage).toBe("Awaiting arbitration");
  });

  it("should clear errors when retrying from a terminal dispute state", () => {
    const store = useTransactionStore.getState();
    store.setEscrowStep("disputed");
    store.setEscrowError("disputed", "Awaiting arbitration");

    store.setEscrowStep("buyer_funding");
    const state = useTransactionStore.getState().escrowState;
    expect(state.step).toBe("buyer_funding");
    expect(state.errorStep).toBe(null);
    expect(state.errorMessage).toBe(null);
  });

  it("should reset from a terminal dispute state back to idle", () => {
    const store = useTransactionStore.getState();
    store.setEscrowStep("refunded");
    store.setEscrowError("refunded", "Refund processed");
    store.resetEscrow();

    const state = useTransactionStore.getState().escrowState;
    expect(state.step).toBe("idle");
    expect(state.errorStep).toBe(null);
    expect(state.errorMessage).toBe(null);
  });
});
