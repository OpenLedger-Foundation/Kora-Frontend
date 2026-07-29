import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TxType = "mint" | "fund" | "repay" | "claim";
export type TxStatus = "confirmed" | "failed";

export interface TxRecord {
  /** Stellar transaction hash (64-char hex) */
  hash: string;
  /** Type of operation performed */
  type: TxType;
  /** Invoice ID this transaction relates to, if applicable */
  invoiceId?: string;
  /** Invoice number for display (e.g. "INV-2024-0891") */
  invoiceNumber?: string;
  /** Amount involved in the transaction (USDC) */
  amount?: number;
  /** Currency of the amount */
  currency?: string;
  /** Final status */
  status: TxStatus;
  /** ISO timestamp when the transaction was recorded */
  timestamp: string;
  /** Human-readable description */
  description?: string;
}

// ─── Store interface ──────────────────────────────────────────────────────────

export type EscrowStep = "idle" | "buyer_funding" | "buyer_funded" | "seller_transferring" | "seller_transferred" | "settled";

export interface EscrowState {
  step: EscrowStep;
  errorStep?: "buyer_funding" | "seller_transferring" | null;
  errorMessage?: string | null;
  txHash?: string | null;
}

interface TransactionStore {
  /** Ordered list of transactions — newest first */
  transactions: TxRecord[];

  /** Secondary Escrow State Machine state */
  escrowState: EscrowState;

  /** Add a new confirmed or failed transaction record */
  addTransaction: (record: Omit<TxRecord, "timestamp"> & { timestamp?: string }) => void;

  /** Remove a single transaction by hash */
  removeTransaction: (hash: string) => void;

  /** Wipe the entire history */
  clearHistory: () => void;

  /** Update escrow step */
  setEscrowStep: (step: EscrowStep) => void;

  /** Set escrow error step and message */
  setEscrowError: (errorStep: "buyer_funding" | "seller_transferring" | null, message: string | null) => void;

  /** Reset escrow state */
  resetEscrow: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const MAX_HISTORY = 200; // cap to avoid unbounded localStorage growth

const DEFAULT_ESCROW_STATE: EscrowState = {
  step: "idle",
  errorStep: null,
  errorMessage: null,
  txHash: null,
};

export const useTransactionStore = create<TransactionStore>()(
  persist(
    (set) => ({
      transactions: [],
      escrowState: DEFAULT_ESCROW_STATE,

      addTransaction: (record) =>
        set((s) => {
          const entry: TxRecord = {
            ...record,
            timestamp: record.timestamp ?? new Date().toISOString(),
          };
          // Deduplicate by hash — replace if already exists (e.g. status update)
          const filtered = s.transactions.filter((t) => t.hash !== entry.hash);
          return {
            transactions: [entry, ...filtered].slice(0, MAX_HISTORY),
          };
        }),

      removeTransaction: (hash) =>
        set((s) => ({
          transactions: s.transactions.filter((t) => t.hash !== hash),
        })),

      clearHistory: () => set({ transactions: [] }),

      setEscrowStep: (step) =>
        set((s) => ({
          escrowState: {
            ...s.escrowState,
            step,
            // Clear error when transitioning out of error states or starting over
            ...(step === "buyer_funding" || step === "seller_transferring" ? { errorStep: null, errorMessage: null } : {}),
          },
        })),

      setEscrowError: (errorStep, message) =>
        set((s) => ({
          escrowState: {
            ...s.escrowState,
            errorStep,
            errorMessage: message,
          },
        })),

      resetEscrow: () => set({ escrowState: DEFAULT_ESCROW_STATE }),
    }),
    {
      name: "kora-tx-history",
      // Persist the transactions array and escrowState
      partialize: (state) => ({
        transactions: state.transactions,
        escrowState: state.escrowState,
      }),
    }
  )
);
