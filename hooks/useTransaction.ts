"use client";

import { useCallback, useState } from "react";
import { useToast } from "./useToast";
import type { NotificationPreferenceType } from "./useToast";
import { useWallet } from "./useWallet";
import { rpc, submitTransaction } from "@/lib/stellar/client";
import { env } from "@/lib/env";
import * as StellarSdk from "@stellar/stellar-sdk";

export type TxLifecycleStatus =
  | "idle"
  | "building"
  | "simulating"
  | "signing"
  | "submitting"
  | "polling"
  | "confirmed"
  | "failed";

interface TxState {
  status: TxLifecycleStatus;
  txHash?: string;
  error?: string;
}

const TOAST_ID = "kora-tx";
const MAX_POLL_ATTEMPTS = 30;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const STAGE_MESSAGES: Record<TxLifecycleStatus, string> = {
  idle: "",
  building: "Building transaction…",
  simulating: "Simulating transaction…",
  signing: "Waiting for wallet signature…",
  submitting: "Submitting to Stellar network…",
  polling: "Waiting for confirmation…",
  confirmed: "Transaction confirmed!",
  failed: "Transaction failed",
};

async function pollWithBackoff(hash: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    if (Date.now() > deadline) throw new Error("Transaction timed out after 5 minutes");

    const result = await rpc.getTransaction(hash);
    if (result.status === "SUCCESS") return hash;
    if (result.status === "FAILED") throw new Error("Transaction failed on-chain");

    // Exponential backoff: 1s, 2s, 4s, 8s … capped at 16s
    const delay = Math.min(1000 * 2 ** attempt, 16_000);
    await new Promise((r) => setTimeout(r, delay));
  }

  throw new Error(`Transaction not confirmed after ${MAX_POLL_ATTEMPTS} attempts`);
}

export function useTransaction() {
  const [state, setState] = useState<TxState>({ status: "idle" });
  const { signTransaction } = useWallet();
  const toast = useToast();

  const setStage = (status: TxLifecycleStatus, extra?: Partial<TxState>) => {
    setState((s) => ({ ...s, status, ...extra }));
    if (status !== "idle" && status !== "confirmed" && status !== "failed") {
      toast.loading(STAGE_MESSAGES[status], TOAST_ID, "txConfirmed");
    }
  };

  const execute = useCallback(
    async (
      buildFn: () => Promise<string>,
      options?: {
        onSuccess?: (hash: string) => void;
        successMessage?: string;
        successNotificationType?: NotificationPreferenceType;
        onError?: (err: unknown) => void;
      }
    ): Promise<string | null> => {
      try {
        // 1. Build
        setStage("building");
        const unsignedXdr = await buildFn();

        // 2. Simulate (skip for mock XDRs)
        if (!unsignedXdr.startsWith("mock_")) {
          setStage("simulating");
          const tx = StellarSdk.TransactionBuilder.fromXDR(
            unsignedXdr,
            env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE
          );
          const sim = await rpc.simulateTransaction(tx);
          if (StellarSdk.rpc.Api.isSimulationError(sim)) {
            throw new Error(`Simulation failed: ${sim.error}`);
          }
        }

        // 3. Sign
        setStage("signing");
        const signedXdr = await signTransaction(unsignedXdr);

        // 4. Submit
        setStage("submitting");
        let hash: string;

        if (signedXdr.startsWith("mock_")) {
          await new Promise((r) => setTimeout(r, 800));
          hash = Array.from({ length: 64 }, () =>
            Math.floor(Math.random() * 16).toString(16)
          ).join("");
        } else {
          const result = await submitTransaction(signedXdr);
          if (result.status === "ERROR") throw new Error("Transaction submission failed");
          hash = result.hash;
        }

        // 5. Poll
        setStage("polling", { txHash: hash });
        if (!signedXdr.startsWith("mock_")) {
          await pollWithBackoff(hash);
        } else {
          await new Promise((r) => setTimeout(r, 1000));
        }

        // 6. Confirmed
        setState({ status: "confirmed", txHash: hash });
        toast.success(
          options?.successMessage ?? "Transaction confirmed!",
          hash,
          TOAST_ID,
          options?.successNotificationType ?? "txConfirmed"
        );

        options?.onSuccess?.(hash);
        return hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Transaction failed";
        setState({ status: "failed", error: message });
        toast.error(
          "Transaction failed",
          message,
          () => setState({ status: "idle" }),
          TOAST_ID,
          "txConfirmed"
        );
        options?.onError?.(err);
        return null;
      }
    },
    [signTransaction]
  );

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return {
    execute,
    reset,
    status: state.status,
    txHash: state.txHash,
    error: state.error,
  };
}
