/**
 * Unit tests for interrupted-signature recovery in hooks/useTransaction.ts (#1121).
 *
 * The contract under test:
 *  - a wallet request that never got an answer records the unsigned XDR and
 *    offers a retry, because nothing was signed or submitted;
 *  - an explicit refusal records nothing (the user meant it);
 *  - the retry re-signs the *same* XDR and clears the record, so a second
 *    attempt cannot produce a second on-chain transaction;
 *  - an attempt restored from storage is offered back once after a refresh.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import * as StellarSdk from "@stellar/stellar-sdk";

const h = vi.hoisted(() => ({
  signTransaction: vi.fn(),
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
  setTxState: vi.fn(),
  addTransaction: vi.fn(),
  updateTransactionStatus: vi.fn(),
  simulateTransaction: vi.fn(),
  getTransaction: vi.fn(),
  submitTransaction: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("../useToast", () => ({
  useToast: () => h.toast,
}));

vi.mock("../useWallet", () => ({
  useWallet: () => ({
    signTransaction: h.signTransaction,
    publicKey: "GBTESTPUBLICKEYXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    provider: "freighter",
  }),
}));

vi.mock("../useNetworkValidation", () => ({
  useNetworkValidation: () => ({ isNetworkMismatch: false, errorMessage: "" }),
}));

vi.mock("../useTxSimulation", () => ({
  useTxSimulation: () => ({ simulationDialogProps: {}, onSimulationPreview: vi.fn() }),
}));

vi.mock("@/lib/stellar/client", () => ({
  rpc: {
    getTransaction: h.getTransaction,
    simulateTransaction: h.simulateTransaction,
  },
  submitTransaction: h.submitTransaction,
  BadSequenceError: class BadSequenceError extends Error {},
  sequenceManager: { reset: vi.fn() },
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  },
}));

vi.mock("@/store/uiStore", () => ({
  useUIStore: (selector: (state: unknown) => unknown) => selector({ setTxState: h.setTxState }),
}));

vi.mock("@/store/transactionHistoryStore", () => ({
  useTransactionHistoryStore: (selector: (state: unknown) => unknown) =>
    selector({
      addTransaction: h.addTransaction,
      updateTransactionStatus: h.updateTransactionStatus,
    }),
}));

vi.mock("@/lib/xdrDraftQueue", () => ({
  enqueueSignedXdr: vi.fn().mockResolvedValue({ id: "queued-1" }),
  flushQueuedXdrDrafts: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
}));

vi.mock("../useNetworkStatus", () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

import { useTransaction } from "../useTransaction";
import { useTransactionStore } from "@/store/transactionStore";
import { WalletSigningError } from "@/lib/walletSigningError";

const PASSPHRASE = "Test SDF Network ; September 2015";

/**
 * Build a real, parseable envelope. The fixtures elsewhere in the suite are
 * hand-pasted and do not survive `fromXDR` in the installed SDK, so this test
 * constructs its own instead of depending on one.
 */
function buildBumpSequenceXdr(bumpTo: string): string {
  const source = StellarSdk.StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 7));
  return new StellarSdk.TransactionBuilder(new StellarSdk.Account(source, "0"), {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(StellarSdk.Operation.bumpSequence({ bumpTo }))
    .setTimeout(StellarSdk.TimeoutInfinite)
    .build()
    .toXDR();
}

const UNSIGNED_XDR = buildBumpSequenceXdr("1");

/** A second envelope, so the "restored after a refresh" case is a distinct XDR. */
const RESTORED_XDR = buildBumpSequenceXdr("42");

const TX_HASH = "a".repeat(64);

function successfulSimulation() {
  h.simulateTransaction.mockResolvedValue({
    results: [{ auth: [], xdr: "result-xdr" }],
    latestLedger: 1000,
    minResourceFee: "1000",
  });
}

/** Runs `run` inside `act`, returning its resolved value. */
async function run<T>(body: () => Promise<T>): Promise<T> {
  let value!: T;
  await act(async () => {
    value = await body();
  });
  return value;
}

describe("useTransaction — interrupted signature recovery (#1121)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
    useTransactionStore.setState({ signatureRecovery: null });
    successfulSimulation();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("records the unsigned XDR and offers a retry when the wallet never answers", async () => {
    h.signTransaction.mockRejectedValue(
      new WalletSigningError("interrupted", "User closed the popup")
    );

    const { result } = renderHook(() => useTransaction());
    const buildFn = vi.fn().mockResolvedValue(UNSIGNED_XDR);

    const hash = await run(() => result.current.execute(buildFn));

    expect(hash).toBeNull();
    expect(result.current.status).toBe("failed");

    expect(useTransactionStore.getState().signatureRecovery).toEqual({
      unsignedXdr: UNSIGNED_XDR,
      reason: "interrupted",
      detail: "User closed the popup",
      createdAt: expect.any(Number),
    });

    expect(h.toast.error).toHaveBeenCalledWith(
      "signatureInterrupted",
      "signatureInterruptedHint",
      expect.any(Function),
      "kora-tx",
      "txConfirmed"
    );
    expect(h.submitTransaction).not.toHaveBeenCalled();
  });

  it("re-signs the same envelope on retry, clears the record, and confirms", async () => {
    h.signTransaction.mockRejectedValue(
      new WalletSigningError("interrupted", "User closed the popup")
    );

    const { result } = renderHook(() => useTransaction());
    const buildFn = vi.fn().mockResolvedValue(UNSIGNED_XDR);

    await run(() => result.current.execute(buildFn));
    expect(useTransactionStore.getState().signatureRecovery).not.toBeNull();

    // The wallet is answering again.
    h.signTransaction.mockResolvedValue("SIGNED_XDR");
    h.submitTransaction.mockResolvedValue({ status: "PENDING", hash: TX_HASH });
    h.getTransaction.mockResolvedValue({ status: "SUCCESS" });

    const resumedHash = await run(() => result.current.resumeInterruptedSignature());

    expect(resumedHash).toBe(TX_HASH);
    // Same unsigned XDR — the resume never rebuilds the transaction.
    expect(h.signTransaction).toHaveBeenLastCalledWith(UNSIGNED_XDR);
    expect(buildFn).toHaveBeenCalledTimes(1);
    expect(useTransactionStore.getState().signatureRecovery).toBeNull();
    expect(result.current.status).toBe("confirmed");
    expect(h.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when there is nothing to resume", async () => {
    const { result } = renderHook(() => useTransaction());

    const resumed = await run(() => result.current.resumeInterruptedSignature());

    expect(resumed).toBeNull();
    expect(h.signTransaction).not.toHaveBeenCalled();
  });

  it("does not record a recovery when the user explicitly rejects", async () => {
    h.signTransaction.mockRejectedValue(new WalletSigningError("rejected", "User rejected"));

    const { result } = renderHook(() => useTransaction());
    const buildFn = vi.fn().mockResolvedValue(UNSIGNED_XDR);

    const hash = await run(() => result.current.execute(buildFn));

    expect(hash).toBeNull();
    expect(useTransactionStore.getState().signatureRecovery).toBeNull();
    expect(h.toast.error).toHaveBeenCalledWith(
      "failed",
      "User rejected",
      expect.any(Function),
      "kora-tx",
      "txConfirmed"
    );
  });

  it("does not offer a re-sign once the envelope is signed (submit failure)", async () => {
    h.signTransaction.mockResolvedValue("SIGNED_XDR");
    // Also classifies as "interrupted" — the guard that must hold is the stage
    // marker, not the wording: re-signing here would duplicate a submission.
    h.submitTransaction.mockRejectedValue(new Error("The response window was closed"));

    const { result } = renderHook(() => useTransaction());
    const buildFn = vi.fn().mockResolvedValue(UNSIGNED_XDR);

    const hash = await run(() => result.current.execute(buildFn));

    expect(hash).toBeNull();
    expect(useTransactionStore.getState().signatureRecovery).toBeNull();
    expect(h.toast.error).toHaveBeenCalledWith(
      "failed",
      expect.any(String),
      expect.any(Function),
      "kora-tx",
      "txConfirmed"
    );
  });

  it("surfaces a persisted attempt once, with a retry action", async () => {
    useTransactionStore.setState({
      signatureRecovery: {
        unsignedXdr: RESTORED_XDR,
        reason: "interrupted",
        detail: "User closed the popup",
        createdAt: Date.now(),
      },
    });

    const { result } = renderHook(() => useTransaction());

    expect(h.toast.error).toHaveBeenCalledWith(
      "signatureInterrupted",
      "signatureInterruptedHint",
      expect.any(Function),
      "kora-signature-recovery",
      undefined
    );

    // A second consumer mounting must not raise the same prompt again.
    renderHook(() => useTransaction());
    expect(h.toast.error).toHaveBeenCalledTimes(1);

    // The prompt's retry hands control back to the same resume path.
    h.signTransaction.mockResolvedValue("SIGNED_XDR");
    h.submitTransaction.mockResolvedValue({ status: "PENDING", hash: TX_HASH });
    h.getTransaction.mockResolvedValue({ status: "SUCCESS" });

    const retry = h.toast.error.mock.calls[0][2] as () => Promise<string | null>;
    const resumedHash = await run(retry);

    expect(resumedHash).toBe(TX_HASH);
    expect(h.signTransaction).toHaveBeenCalledWith(RESTORED_XDR);
    expect(useTransactionStore.getState().signatureRecovery).toBeNull();
  });
});

