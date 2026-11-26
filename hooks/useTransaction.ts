"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "./useToast";
import type { NotificationPreferenceType } from "./useToast";
import { useWallet } from "./useWallet";
import { useNetworkValidation } from "./useNetworkValidation";
import { useTxSimulation } from "./useTxSimulation";
import { rpc, submitTransaction, BadSequenceError, sequenceManager } from "@/lib/stellar/client";
import { env } from "@/lib/env";
import { mapSimulationError } from "@/lib/stellar/simulationErrors";
import * as StellarSdk from "@stellar/stellar-sdk";
import { useUIStore } from "@/store/uiStore";
import { useTransactionStore } from "@/store/transactionStore";
import { classifySigningError } from "@/lib/walletSigningError";
import { useTransactionHistoryStore, type TxType } from "@/store/transactionHistoryStore";
import type { TxState as UITxState } from "@/types";
import { enqueueSignedXdr, flushQueuedXdrDrafts, type QueuedXdrDraft } from "@/lib/xdrDraftQueue";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export type TxLifecycleStatus =
  | "idle"
  | "building"
  | "simulating"
  | "signing"
  | "submitting"
  | "retrying"
  | "polling"
  | "confirmed"
  | "failed";

async function buildAndSign(
  buildFn: () => Promise<string>,
  signTransaction: (xdr: string) => Promise<string>,
  setStage: (stage: TxLifecycleStatus) => void
): Promise<string> {
  setStage("building");
  const unsignedXdr = await buildFn();
  setStage("signing");
  return signTransaction(unsignedXdr);
}

interface TxState {
  status: TxLifecycleStatus;
  txHash?: string;
  error?: string;
  startedAt?: number;
  provider?: string;
  timeoutMs?: number;
  tips?: string[];
  canExtend?: boolean;
}

/** Numeric accessor as exposed by Soroban resource XDR objects. */
type ResourceGetter = () => number | bigint;

/**
 * Narrow view of the simulation fields we read resources from. The SDK's
 * response shape has changed across versions, so every accessor is optional.
 */
interface SimulationResourceSource {
  transactionData?: {
    resources?: () => {
      instructions?: ResourceGetter;
      readBytes?: ResourceGetter;
      writeBytes?: ResourceGetter;
    };
  };
  sorobanData?: {
    resources: () => {
      instructions: ResourceGetter;
      readBytes: ResourceGetter;
      writeBytes: ResourceGetter;
    };
  };
}

function getErrorMessage(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "message" in err) {
    const { message } = err as { message?: unknown };
    return typeof message === "string" ? message : undefined;
  }
  return undefined;
}

/** Parsed simulation result exposed to the preview dialog. */
export interface SimulationPreview {
  /** Fee in stroops (1 XLM = 10_000_000 stroops) */
  feeStroops: number;
  /** Fee in XLM */
  feeXlm: number;
  /** Resource fee in stroops */
  resourceFee: number;
  /** CPU instructions consumed */
  cpuInstructions: number;
  /** Memory bytes consumed */
  memoryBytes: number;
  /** Read bytes */
  readBytes: number;
  /** Write bytes */
  writeBytes: number;
  /** Human-readable error if simulation failed */
  error?: string;
}

const TOAST_ID = "kora-tx";
/** Toast id for the "your signature was interrupted" retry prompt (#1121). */
const RECOVERY_TOAST_ID = "kora-signature-recovery";
/**
 * Unsigned XDRs already offered back to the user as a retry prompt, so a
 * route change that remounts a consumer does not re-raise the same toast.
 */
const surfacedRecoveries = new Set<string>();
const MAX_POLL_ATTEMPTS = 30;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const SIMULATION_TIMEOUT_MS = 10_000;

async function pollWithBackoff(
  hash: string
): Promise<{ hash: string; txResult?: StellarSdk.rpc.Api.GetTransactionResponse }> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    if (Date.now() > deadline) throw new Error("Transaction timed out after 5 minutes");

    const result = await rpc.getTransaction(hash);
    if (result.status === "SUCCESS") return { hash, txResult: result };
    if (result.status === "FAILED") throw new Error("Transaction failed on-chain");

    const delay = Math.min(1000 * 2 ** attempt, 16_000);
    await new Promise((r) => setTimeout(r, delay));
  }

  throw new Error(`Transaction not confirmed after ${MAX_POLL_ATTEMPTS} attempts`);
}

/**
 * Parse a successful simulation result into a SimulationPreview.
 */
function parseSimulationPreview(
  sim: StellarSdk.rpc.Api.SimulateTransactionSuccessResponse
): SimulationPreview {
  const feeStroops = parseInt(sim.minResourceFee ?? "0", 10);
  const feeXlm = feeStroops / 10_000_000;

  const source = sim as unknown as SimulationResourceSource;
  const resources = source.transactionData?.resources?.() ?? null;

  let cpuInstructions = 0;
  let memoryBytes = 0;
  let readBytes = 0;
  let writeBytes = 0;

  try {
    if (resources) {
      cpuInstructions = Number(resources.instructions?.() ?? 0);
      memoryBytes = Number(resources.readBytes?.() ?? 0); // Soroban SDK naming varies
      readBytes = Number(resources.readBytes?.() ?? 0);
      writeBytes = Number(resources.writeBytes?.() ?? 0);
    }
    // Fallback: try sorobanData path
    const sorobanData = source.sorobanData;
    if (sorobanData) {
      const r = sorobanData.resources();
      cpuInstructions = Number(r.instructions());
      readBytes = Number(r.readBytes());
      writeBytes = Number(r.writeBytes());
    }
  } catch {
    // Resource parsing is best-effort; leave zeros if unavailable
  }

  return { feeStroops, feeXlm, resourceFee: feeStroops, cpuInstructions, memoryBytes, readBytes, writeBytes };
}

/** Preview shape used when the RPC cannot simulate at all (#1132). */
function failedSimulationPreview(error: string): SimulationPreview {
  return {
    feeStroops: 0,
    feeXlm: 0,
    resourceFee: 0,
    cpuInstructions: 0,
    memoryBytes: 0,
    readBytes: 0,
    writeBytes: 0,
    error,
  };
}

export interface ProviderSigningConfig {
  timeoutMs: number;
  providerName: string;
  category: "hardware" | "mobile" | "extension" | "default";
  tips: string[];
}

export const PROVIDER_SIGNING_CONFIGS: Record<string, ProviderSigningConfig> = {
  ledger: {
    timeoutMs: 120_000,
    providerName: "Hardware Wallet (Ledger)",
    category: "hardware",
    tips: [
      "Ensure Ledger device is unlocked and connected via USB/Bluetooth",
      "Open the Stellar app on your Ledger device",
      "Ensure 'Blind Signing' / 'Hash Signing' is enabled in Stellar app settings",
      "Review transaction parameters and approve on device screen",
    ],
  },
  lobstr: {
    timeoutMs: 90_000,
    providerName: "Lobstr Mobile Wallet",
    category: "mobile",
    tips: [
      "Open the Lobstr app on your mobile device",
      "Check push notifications or scan the signing QR code",
      "Approve the signature request before the timeout window expires",
    ],
  },
  freighter: {
    timeoutMs: 60_000,
    providerName: "Freighter Wallet",
    category: "extension",
    tips: [
      "Check browser toolbar for the Freighter popup window",
      "Unlock extension if currently locked",
      "Review transaction details and click Approve",
    ],
  },
  xbull: {
    timeoutMs: 60_000,
    providerName: "xBull Wallet",
    category: "extension",
    tips: [
      "Check for the xBull popup window or tab",
      "Unlock your vault and select the active account",
      "Approve the transaction signature request",
    ],
  },
  albedo: {
    timeoutMs: 60_000,
    providerName: "Albedo",
    category: "extension",
    tips: [
      "Confirm the signature in the Albedo browser popup window",
      "Review transaction parameters and approve",
    ],
  },
  default: {
    timeoutMs: 60_000,
    providerName: "Stellar Wallet",
    category: "default",
    tips: [
      "Check your wallet extension or mobile app window",
      "Review transaction details before approving",
      "Keep this window open during signing",
    ],
  },
};

export function getProviderSigningConfig(provider?: string | null): ProviderSigningConfig {
  if (!provider) return PROVIDER_SIGNING_CONFIGS.default;
  const key = provider.toLowerCase();
  if (key.includes("ledger")) return PROVIDER_SIGNING_CONFIGS.ledger;
  if (key.includes("lobstr")) return PROVIDER_SIGNING_CONFIGS.lobstr;
  if (key.includes("freighter")) return PROVIDER_SIGNING_CONFIGS.freighter;
  if (key.includes("xbull")) return PROVIDER_SIGNING_CONFIGS.xbull;
  if (key.includes("albedo")) return PROVIDER_SIGNING_CONFIGS.albedo;
  return PROVIDER_SIGNING_CONFIGS[key] || PROVIDER_SIGNING_CONFIGS.default;
}

export function useTransaction() {
  const [state, setState] = useState<TxState>({ status: "idle" });
  const [simulationPreview, setSimulationPreview] = useState<SimulationPreview | null>(null);
  const { signTransaction, publicKey, provider } = useWallet();
  const { isNetworkMismatch, errorMessage } = useNetworkValidation();
  const toast = useToast();
  const t = useTranslations("transaction");
  const tSim = useTranslations("txSimulation");
  const setTxState = useUIStore((s) => s.setTxState);
  const addTransaction = useTransactionHistoryStore((s) => s.addTransaction);
  const updateTransactionStatus = useTransactionHistoryStore((s) => s.updateTransactionStatus);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutResolverRef = useRef<((value: string) => void) | null>(null);
  const timeoutRejecterRef = useRef<((reason?: unknown) => void) | null>(null);
  const signingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSigningTimer = useCallback(() => {
    if (signingTimerRef.current) {
      clearTimeout(signingTimerRef.current);
      signingTimerRef.current = null;
    }
  }, []);

  const setStage = useCallback(
    (status: TxLifecycleStatus, extra?: Partial<TxState>) => {
      setState((s) => ({ ...s, status, ...extra }));
      if (status === "retrying") {
        setTxState({ status: "submitting" });
      } else {
        setTxState({ status, ...extra } as UITxState);
      }
      // Show loading toast for in-progress stages
      const inProgress: TxLifecycleStatus[] = ["building", "simulating", "signing", "submitting", "polling"];
      if (inProgress.includes(status)) {
        const labels: Record<string, string> = {
          building: t("building"),
          simulating: t("simulating"),
          signing: t("signing"),
          submitting: t("submitting"),
          polling: t("polling"),
        };
        toast.loading(labels[status] ?? status, TOAST_ID, "txConfirmed");
      }
    },
    [t, toast, setTxState]
  );

  const cancel = useCallback(() => {
    clearSigningTimer();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (timeoutRejecterRef.current) {
      timeoutRejecterRef.current(new Error("SIGNING_CANCELLED"));
      timeoutRejecterRef.current = null;
    }
    setState({ status: "idle" });
    setSimulationPreview(null);
    setTxState({ status: "idle" });
    toast.dismiss(TOAST_ID);
  }, [clearSigningTimer, setTxState, toast]);

  const extendTimeout = useCallback(
    (extraMs = 60_000) => {
      clearSigningTimer();
      const config = getProviderSigningConfig(provider);
      const newTimeout = (config.timeoutMs || 60_000) + extraMs;

      setTxState({
        status: "signing",
        startedAt: Date.now(),
        provider: config.providerName,
        timeoutMs: newTimeout,
        tips: config.tips,
        canExtend: true,
      });

      signingTimerRef.current = setTimeout(() => {
        setTxState({
          status: "timeout",
          provider: config.providerName,
          timeoutMs: newTimeout,
          canExtend: true,
        });
      }, newTimeout);
    },
    [clearSigningTimer, provider, setTxState]
  );

  /**
   * Latest `execute`, written by an effect below. `resumeInterruptedSignature`
   * is declared *before* `execute` so `execute`'s catch block can offer it as
   * the failure toast's retry action; it calls back through this ref rather
   * than a dependency, which would otherwise be a use-before-declaration.
   */
  const executeRef = useRef<((buildFn: () => Promise<string>) => Promise<string | null>) | null>(
    null
  );
  /** Stops a double-clicked retry from signing the same XDR twice. */
  const resumeInFlightRef = useRef(false);

  /**
   * Resume an interrupted signature (#1121).
   *
   * The stored XDR is re-signed verbatim — no rebuild, no new sequence number
   * — so the retry produces the same transaction the wallet never answered
   * for. Because the interrupted attempt never reached the network, that
   * re-sign cannot duplicate a submission; the in-flight guard covers the
   * remaining case of two retries racing each other.
   *
   * Returns the transaction hash, or null when there was nothing to resume or
   * the attempt failed (the failure path already raised its own toast).
   */
  const resumeInterruptedSignature = useCallback(async (): Promise<string | null> => {
    const recovery = useTransactionStore.getState().signatureRecovery;
    if (!recovery || resumeInFlightRef.current) return null;

    // Clear first: if this attempt is interrupted too, the catch below records
    // it again with the same XDR instead of losing it.
    useTransactionStore.getState().clearSignatureRecovery();
    resumeInFlightRef.current = true;
    try {
      return await executeRef.current?.(async () => recovery.unsignedXdr);
    } finally {
      resumeInFlightRef.current = false;
    }
  }, []);

  const execute = useCallback(
    async (
      buildFn: () => Promise<string>,
      options?: {
        onSuccess?: (hash: string, txResult?: any) => void;
        successMessage?: string;
        successNotificationType?: NotificationPreferenceType;
        onError?: (err: unknown) => void;
        /**
         * Action for the failure toast's retry button. Defaults to clearing the
         * failed state, which is all a generic caller can offer; callers that
         * can re-attempt the whole transaction pass their own handler so the
         * button actually retries rather than just dismissing the error.
         */
        onRetry?: () => void;
        /** Called with the simulation preview; must resolve true to proceed */
        onSimulationPreview?: (preview: SimulationPreview) => Promise<boolean>;
        txType?: string;
        txDescription?: string;
        txAmount?: string;
        txAssetCode?: string;
        cancelReason?: string;
        cancelNotes?: string;
      }
    ): Promise<string | null> => {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      /**
       * Unsigned XDR of the attempt currently in flight, kept only between the
       * signing prompt and a successful signature — once signed, the envelope
       * (not the unsigned XDR) is what must be retried, so recovery is cleared
       * to prevent a re-sign of an already-submitted transaction (#1121).
       */
      let unsignedForRecovery: string | null = null;

      try {
        // Check network first
        if (isNetworkMismatch) {
          throw new Error(errorMessage);
        }

        // 1. Build
        setStage("building");
        const unsignedXdr = await buildFn();

        if (abortController.signal.aborted) {
          throw new Error("SIGNING_CANCELLED");
        }

        // 2. Simulate (skip for mock XDRs)
        if (!unsignedXdr.startsWith("mock_")) {
          setStage("simulating");

          const tx = StellarSdk.TransactionBuilder.fromXDR(
            unsignedXdr,
            env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE
          );

          // Race simulation against a 10-second timeout. A dead RPC must not
          // surface as a raw "fetch failed" — callers (and users) need an
          // actionable, localized reason (#1132). The timer is always cleared
          // so a late resolution cannot keep a Node test/worker alive.
          const simPromise = rpc.simulateTransaction(tx).catch(() => {
            throw new Error(`${tSim("rpcUnavailable")}: ${tSim("rpcUnavailableDesc")}`);
          });
          let simulationTimeout: ReturnType<typeof setTimeout> | null = null;
          const timeoutPromise = new Promise<never>((_, reject) => {
            simulationTimeout = setTimeout(
              () => reject(new Error(tSim("timeout"))),
              SIMULATION_TIMEOUT_MS
            );
          });

          let sim: Awaited<ReturnType<typeof rpc.simulateTransaction>> | null = null;
          let simulationError: string | null = null;
          try {
            sim = await Promise.race([simPromise, timeoutPromise]);
          } catch (err) {
            simulationError =
              err instanceof Error ? err.message : tSim("simulationError");
          } finally {
            if (simulationTimeout) clearTimeout(simulationTimeout);
          }

          if (abortController.signal.aborted) {
            throw new Error("SIGNING_CANCELLED");
          }

          // An RPC outage or timeout has no simulation result to inspect, but
          // the user still needs the same blocked preview as a contract revert:
          // Cancel/close is the only way forward, and signing never starts.
          if (simulationError || !sim) {
            const preview = failedSimulationPreview(
              simulationError ?? tSim("rpcUnavailableDesc")
            );
            setSimulationPreview(preview);
            if (options?.onSimulationPreview) {
              await options.onSimulationPreview(preview);
            }
            throw new Error(preview.error);
          }

          if (StellarSdk.rpc.Api.isSimulationError(sim)) {
            const readableError = mapSimulationError(sim.error);
            const preview: SimulationPreview = {
              feeStroops: 0,
              feeXlm: 0,
              resourceFee: 0,
              cpuInstructions: 0,
              memoryBytes: 0,
              readBytes: 0,
              writeBytes: 0,
              error: readableError,
            };
            setSimulationPreview(preview);

            if (options?.onSimulationPreview) {
              await options.onSimulationPreview(preview);
            }
            throw new Error(`Simulation failed: ${readableError}`);
          }

          // Parse successful simulation
          const preview = parseSimulationPreview(
            sim as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse
          );
          setSimulationPreview(preview);

          if (options?.onSimulationPreview) {
            const proceed = await options.onSimulationPreview(preview);
            if (!proceed || abortController.signal.aborted) {
              setState({ status: "idle" });
              setTxState({ status: "idle" });
              toast.dismiss(TOAST_ID);
              return null;
            }
          }
        }

        // 3. Sign (Provider-aware hardware/mobile timeouts)
        const providerConfig = getProviderSigningConfig(provider);
        setStage("signing", {
          startedAt: Date.now(),
          provider: providerConfig.providerName,
          timeoutMs: providerConfig.timeoutMs,
          tips: providerConfig.tips,
          canExtend: true,
        });

        unsignedForRecovery = unsignedXdr;

        let signedXdr: string;
        if (unsignedXdr.startsWith("mock_")) {
          await new Promise((r) => setTimeout(r, 600));
          signedXdr = `${unsignedXdr}_signed`;
        } else {
          // Signing with timeout notification
          const signPromise = signTransaction(unsignedXdr);
          
          const timeoutPromise = new Promise<string>((resolve, reject) => {
            timeoutResolverRef.current = resolve;
            timeoutRejecterRef.current = reject;

            clearSigningTimer();
            signingTimerRef.current = setTimeout(() => {
              setTxState({
                status: "timeout",
                provider: providerConfig.providerName,
                timeoutMs: providerConfig.timeoutMs,
                canExtend: true,
              });
            }, providerConfig.timeoutMs);
          });

          signedXdr = await Promise.race([signPromise, timeoutPromise]);
          clearSigningTimer();
        }

        // Signature in hand: from here the *signed* envelope is what could be
        // retried (see the offline queue below), never the unsigned XDR.
        unsignedForRecovery = null;

        if (abortController.signal.aborted) {
          throw new Error("SIGNING_CANCELLED");
        }

        // 4. Submit — on network errors after a successful sign, enqueue the
        //    signed envelope so it can be retried when the connection returns.
        setStage("submitting");
        let hash: string;

        if (signedXdr.startsWith("mock_")) {
          await new Promise((r) => setTimeout(r, 800));
          hash = Array.from({ length: 64 }, () =>
            Math.floor(Math.random() * 16).toString(16)
          ).join("");
        } else {
          let submitResult: Awaited<ReturnType<typeof submitTransaction>>;
          try {
            submitResult = await submitTransaction(signedXdr);
          } catch (submitErr) {
            // Network-level error after signing — queue the envelope for later retry
            const isNetworkError =
              submitErr instanceof TypeError ||
              (submitErr instanceof Error &&
                (submitErr.message.includes("fetch") ||
                  submitErr.message.includes("network") ||
                  submitErr.message.includes("offline") ||
                  submitErr.message.includes("Failed to fetch") ||
                  !navigator.onLine));

            if (isNetworkError) {
              await enqueueSignedXdr(signedXdr, {
                type: options?.txType ?? "other",
                invoiceId: options?.txDescription,
                amount: options?.txAmount,
                assetCode: options?.txAssetCode,
              });
              // Inform the user and provide a link to the queue panel
              toast.loading(
                t("queuedOffline"),
                TOAST_ID,
                "txConfirmed"
              );
            }
            throw submitErr;
          }

          if (submitResult.status === "ERROR") throw new Error("Transaction submission failed");
          hash = submitResult.hash;
        }

        // Add to history as pending only AFTER submission succeeded
        addTransaction({
          hash,
          type: (options?.txType as TxType | undefined) || "other",
          status: "pending",
          description: options?.txDescription,
          amount: options?.txAmount,
          assetCode: options?.txAssetCode,
          cancelReason: options?.cancelReason,
          cancelNotes: options?.cancelNotes,
        });

        // 5. Poll
        setStage("polling", { txHash: hash });
        let txResult: any = null;
        if (!signedXdr.startsWith("mock_")) {
          const pollRes = await pollWithBackoff(hash);
          txResult = pollRes.txResult;
        } else {
          await new Promise((r) => setTimeout(r, 1000));
          txResult = { status: "SUCCESS", txHash: hash, mock: true };
        }

        // Phase 5: confirmed
        setState({ status: "confirmed", txHash: hash });
        setTxState({ status: "confirmed", txHash: hash });
        updateTransactionStatus(hash, "confirmed");
        toast.success(
          options?.successMessage ?? t("confirmed"),
          hash,
          TOAST_ID,
          options?.successNotificationType ?? "txConfirmed"
        );

        options?.onSuccess?.(hash, txResult);
        return hash;
      } catch (err: unknown) {
        clearSigningTimer();
        const errMessage = getErrorMessage(err);
        if (errMessage === "SIGNING_CANCELLED" || errMessage?.includes("cancelled")) {
          setState({ status: "idle" });
          setTxState({ status: "idle" });
          toast.dismiss(TOAST_ID);
          return null;
        }

        const kind = classifySigningError(err);
        // Only an interruption *during the signature prompt* leaves an unsigned
        // XDR worth resuming; anything after it (submit/poll) is already
        // covered by the offline queue and must not trigger a re-sign.
        const recoverable = kind === "interrupted" && unsignedForRecovery !== null;

        if (recoverable && unsignedForRecovery) {
          useTransactionStore.getState().setSignatureRecovery({
            unsignedXdr: unsignedForRecovery,
            reason: kind,
            detail: errMessage,
            createdAt: Date.now(),
          });
          // This session already showed the retry prompt above — mark it so the
          // rehydrate effect does not raise a second, duplicate toast.
          surfacedRecoveries.add(unsignedForRecovery);
        }

        const message = err instanceof Error ? err.message : t("failed");
        setState({ status: "failed", error: message });
        setTxState({ status: "failed", error: { code: "TRANSACTION_FAILED", message } });

        if (state.txHash) {
          updateTransactionStatus(state.txHash, "failed", message);
        }

        // An interrupted signature failed silently — nothing was signed or
        // submitted — so say that and offer the re-sign instead of reporting
        // a failed transaction (#1121).
        toast.error(
          recoverable ? t("signatureInterrupted") : t("failed"),
          recoverable ? t("signatureInterruptedHint") : message,
          recoverable
            ? () => resumeInterruptedSignature()
            : options?.onRetry ?? (() => setState({ status: "idle" })),
          TOAST_ID,
          "txConfirmed"
        );
        options?.onError?.(err);
        return null;
      } finally {
        abortControllerRef.current = null;
      }
    },
    [
      isNetworkMismatch,
      errorMessage,
      setStage,
      provider,
      signTransaction,
      clearSigningTimer,
      setTxState,
      addTransaction,
      state.txHash,
      updateTransactionStatus,
      toast,
      t,
      tSim,
      resumeInterruptedSignature,
    ]
  );

  const reset = useCallback(() => {
    cancel();
  }, [cancel]);

  // Expose the latest `execute` to `resumeInterruptedSignature` (declared
  // above it) without turning `execute` into a dependency of that callback.
  useEffect(() => {
    executeRef.current = execute;
  });

  /**
   * An interruption that happened before a refresh is rehydrated from the
   * persisted store, so offer the retry once per pending attempt (#1121).
   */
  useEffect(() => {
    const recovery = useTransactionStore.getState().signatureRecovery;
    if (!recovery || surfacedRecoveries.has(recovery.unsignedXdr)) return;
    surfacedRecoveries.add(recovery.unsignedXdr);
    toast.error(
      t("signatureInterrupted"),
      t("signatureInterruptedHint"),
      // Returns the attempt's promise so callers (and tests) can await it.
      () => resumeInterruptedSignature(),
      RECOVERY_TOAST_ID,
      undefined
    );
  }, [resumeInterruptedSignature, toast, t]);

  // Auto-flush the offline queue when the connection comes back online.
  // We use a stable submit helper so the effect doesn't need to close over
  // any per-render values.
  const { isOnline } = useNetworkStatus();
  const prevOnlineRef = useRef(isOnline);
  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    if (!isOnline || !wasOffline) return;

    // Reconnected — attempt to flush all queued signed envelopes
    void flushQueuedXdrDrafts(async (draft: QueuedXdrDraft) => {
      if (draft.signedXdr.startsWith("mock_")) {
        await new Promise<void>((r) => setTimeout(r, 300));
        return;
      }
      const result = await submitTransaction(draft.signedXdr);
      if (result.status === "ERROR") {
        throw new Error("Queued transaction submission failed");
      }
    });
  }, [isOnline]);

  return {
    execute,
    /**
     * Re-signs the stored unsigned XDR after an interrupted signature (#1121).
     * No-op (returns null) when there is no pending attempt.
     */
    resumeInterruptedSignature,
    reset,
    cancel,
    extendTimeout,
    status: state.status,
    txHash: state.txHash,
    error: state.error,
    simulationPreview,
  };
}

/**
 * P2P position transfer flow (#443) — combines useTransaction + the
 * simulation-preview gate (see hooks/useTxSimulation.ts) so callers get the
 * same "build → simulate → preview → sign → submit → poll" pipeline as
 * fund/claim/cancel, without re-wiring it per screen.
 *
 * `acceptTransfer` is a stub: it surfaces
 * `prepareAcceptPositionTransfer`'s NOT_IMPLEMENTED error through the normal
 * error/toast path until the buyer-acceptance contract ABI is confirmed
 * (see the doc comment on that function in services/invoiceService.ts).
 */
export function useTransferPositionFlow() {
  const tx = useTransaction();
  const { simulationDialogProps, onSimulationPreview } = useTxSimulation();

  const transferPosition = useCallback(
    async (positionId: string, toAddress: string, sellerAddress: string) => {
      const { prepareTransferPosition } = await import(
        "@/services/invoiceService"
      );
      return tx.execute(
        () => prepareTransferPosition(positionId, toAddress, sellerAddress),
        {
          onSimulationPreview,
          successMessage: "Position transferred successfully!",
          txType: "transfer",
        }
      );
    },
    [tx, onSimulationPreview]
  );

  const acceptTransfer = useCallback(
    async (positionId: string, buyerAddress: string) => {
      const { prepareAcceptPositionTransfer } = await import(
        "@/services/invoiceService"
      );
      return tx.execute(
        () => prepareAcceptPositionTransfer(positionId, buyerAddress),
        { onSimulationPreview, txType: "transfer" }
      );
    },
    [tx, onSimulationPreview]
  );

  return {
    ...tx,
    transferPosition,
    acceptTransfer,
    simulationDialogProps,
  };
}

/**
 * Acquiring a listed position on the secondary market (issue #594).
 *
 * Funding already ran every transaction through
 * "build -> simulate -> preview -> sign -> submit". Secondary acquire did not:
 * the Acquire button on `app/secondary` was a placeholder `alert()`, so the one
 * flow where a buyer commits capital against *someone else's* position had the
 * weakest pre-signature safety of any flow in the app.
 *
 * This reuses the same gate rather than adding a parallel one, so acquire
 * inherits the timeout handling, the readable simulation errors and the
 * block-on-failure behaviour already proven for fund/transfer.
 */
export function useAcquirePositionFlow() {
  const tx = useTransaction();
  const { simulationDialogProps, onSimulationPreview } = useTxSimulation();

  const acquirePosition = useCallback(
    async (positionId: string, buyerAddress: string, sellerAddress: string) => {
      const { prepareTransferPosition } = await import(
        "@/services/invoiceService"
      );
      return tx.execute(
        () => prepareTransferPosition(positionId, buyerAddress, sellerAddress),
        {
          onSimulationPreview,
          successMessage: "Position acquired successfully!",
          txType: "acquire",
          txDescription: `Acquire position ${positionId}`,
        }
      );
    },
    [tx, onSimulationPreview]
  );

  return {
    acquirePosition,
    simulationDialogProps,
    status: tx.status,
    error: tx.error,
  };
}

export function useSecondaryEscrowFlow() {
  const { escrowState, setEscrowStep, setEscrowError, resetEscrow } = useTransactionStore();
  const tx = useTransaction();

  const startEscrow = useCallback(
    async (positionId: string, buyerAddress: string, sellerAddress: string, amount: number) => {
      resetEscrow();

      setEscrowStep("buyer_funding");
      const success1 = await tx.execute(
        async () => {
          await new Promise((r) => setTimeout(r, 1500));
          return "mock_buyer_funding_xdr";
        },
        {
          successMessage: "Buyer funding escrow deposited!",
          txType: "fund",
        }
      );

      if (!success1) {
        setEscrowError("buyer_funding", "Buyer funding failed or was cancelled.");
        return false;
      }

      setEscrowStep("buyer_funded");
      await new Promise((r) => setTimeout(r, 1000));

      setEscrowStep("seller_transferring");
      const { prepareTransferPosition } = await import("@/services/invoiceService");
      const success2 = await tx.execute(
        () => prepareTransferPosition(positionId, buyerAddress, sellerAddress),
        {
          successMessage: "Seller yield rights transferred!",
          txType: "transfer",
        }
      );

      if (!success2) {
        setEscrowError("seller_transferring", "Seller transfer of position failed.");
        return false;
      }

      setEscrowStep("seller_transferred");
      await new Promise((r) => setTimeout(r, 1000));

      setEscrowStep("settled");
      return true;
    },
    [tx, resetEscrow, setEscrowStep, setEscrowError]
  );

  const retryEscrow = useCallback(
    async (positionId: string, buyerAddress: string, sellerAddress: string, amount: number) => {
      const currentErrorStep = escrowState.errorStep;
      setEscrowError(null, null);

      if (currentErrorStep === "buyer_funding") {
        return startEscrow(positionId, buyerAddress, sellerAddress, amount);
      }

      if (currentErrorStep === "seller_transferring") {
        setEscrowStep("seller_transferring");
        const { prepareTransferPosition } = await import("@/services/invoiceService");
        const success = await tx.execute(
          () => prepareTransferPosition(positionId, buyerAddress, sellerAddress),
          {
            successMessage: "Seller yield rights transferred on retry!",
            txType: "transfer",
          }
        );

        if (!success) {
          setEscrowError("seller_transferring", "Seller transfer of position failed again.");
          return false;
        }

        setEscrowStep("seller_transferred");
        await new Promise((r) => setTimeout(r, 1000));
        setEscrowStep("settled");
        return true;
      }

      return false;
    },
    [escrowState, startEscrow, tx, setEscrowStep, setEscrowError]
  );

  return {
    escrowState,
    startEscrow,
    retryEscrow,
    resetEscrow,
  };
}

/** Returns live-region messages for accessible transaction announcements (#441). */
export function useTxAnnouncement(): { polite?: string; assertive?: string } {
  const txState = useUIStore((s) => s.txState);
  if (txState.status === "failed") {
    const message =
      typeof txState.error === "object" && txState.error !== null && "message" in txState.error
        ? String(txState.error.message)
        : "Transaction failed";
    return { assertive: message };
  }
  if (txState.status === "timeout") {
    return {
      assertive: "Transaction signing timed out waiting for wallet response. You can extend time, retry, or cancel safely.",
    };
  }
  if (txState.status === "signing") {
    const providerName = "provider" in txState && txState.provider ? txState.provider : "your wallet";
    return { polite: `Waiting for signature from ${providerName}. Please check and approve on your device.` };
  }
  if (txState.status !== "idle" && txState.status !== "confirmed") {
    return { polite: `Transaction ${txState.status}...` };
  }
  if (txState.status === "confirmed") {
    return { polite: "Transaction confirmed" };
  }
  return {};
}
