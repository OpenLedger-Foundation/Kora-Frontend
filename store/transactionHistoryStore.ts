import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createPersistentJSONStorage } from "./storageAdapter";

export type TransactionAuditType =
  | "mint_invoice"
  | "fund_invoice"
  | "repay_invoice"
  | "claim_yield"
  | "transfer"
  | "other";

export type TransactionAuditStatus = "pending" | "confirmed" | "failed";

export interface TransactionRecord {
  readonly hash: string;
  readonly type: TransactionAuditType;
  readonly status: TransactionAuditStatus;
  readonly amount?: string; // in USDC or XLM
  readonly assetCode?: string; // USDC, XLM, EURC
  readonly targetAddress: string;
  readonly timestamp: number; // Unix ms
  readonly description?: string;
  readonly invoiceId?: string;
  readonly error?: string;
}

interface TransactionHistoryStore {
  readonly transactions: readonly TransactionRecord[];
  appendAuditRecord: (tx: Omit<TransactionRecord, "timestamp"> & { timestamp?: number }) => void;
  getRecentTransactions: (limit?: number) => readonly TransactionRecord[];
  getTransactionByHash: (hash: string) => TransactionRecord | undefined;
  exportAuditLog: () => string;
}

export const useTransactionHistoryStore = create<TransactionHistoryStore>()(
  persist(
    (set, get) => ({
      transactions: [],

      appendAuditRecord: (tx) => {
        set((state) => ({
          transactions: state.transactions.some((entry) => entry.hash === tx.hash)
            ? state.transactions
            : [
                {
                  ...tx,
                  timestamp: tx.timestamp ?? Date.now(),
                },
                ...state.transactions,
              ].slice(0, 200), // Keep last 200 immutable audit records
        }));
      },

      getRecentTransactions: (limit = 10) => {
        return get().transactions.slice(0, limit);
      },

      getTransactionByHash: (hash) => {
        return get().transactions.find((tx) => tx.hash === hash);
      },

      exportAuditLog: () => {
        return JSON.stringify(get().transactions, null, 2);
      },
    }),
    {
      name: "kora-transaction-history",
      storage: createPersistentJSONStorage(),
      partialize: (state) => ({
        transactions: state.transactions,
      }),
      serialize: (state) => JSON.stringify(state),
      deserialize: (str) => {
        try {
          const data = JSON.parse(str);
          const state = data?.state ?? data;
          const rawTransactions = Array.isArray(state?.transactions) ? state.transactions : [];
          const transactions = rawTransactions
            .filter((tx) => tx && typeof tx.hash === "string")
            .map((tx) => ({
              hash: String(tx.hash),
              type: [
                "mint_invoice",
                "fund_invoice",
                "repay_invoice",
                "claim_yield",
                "transfer",
                "other",
              ].includes(tx.type)
                ? tx.type
                : "other",
              status: tx.status === "failed" ? "failed" : tx.status === "confirmed" ? "confirmed" : "pending",
              amount: typeof tx.amount === "string" ? tx.amount : undefined,
              assetCode: typeof tx.assetCode === "string" ? tx.assetCode : undefined,
              targetAddress:
                typeof tx.targetAddress === "string"
                  ? tx.targetAddress
                  : typeof tx.address === "string"
                    ? tx.address
                    : "",
              timestamp: Number(tx.timestamp) || Date.now(),
              description: typeof tx.description === "string" ? tx.description : undefined,
              invoiceId: typeof tx.invoiceId === "string" ? tx.invoiceId : undefined,
              error: typeof tx.error === "string" ? tx.error : undefined,
            }))
            .slice(0, 200);
          return { state: { transactions } };
        } catch {
          return { state: { transactions: [] } };
        }
      },
    }
  )
);
