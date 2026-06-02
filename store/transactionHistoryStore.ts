import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TxType =
  | "mint_invoice"
  | "fund_invoice"
  | "repay_invoice"
  | "claim_yield"
  | "transfer"
  | "other";

export type TxStatus = "pending" | "confirmed" | "failed";

export interface TransactionRecord {
  hash: string;
  type: TxType;
  status: TxStatus;
  amount?: string; // in USDC or XLM
  assetCode?: string; // USDC, XLM, EURC
  timestamp: number; // Unix ms
  description?: string;
  invoiceId?: string;
  error?: string;
}

interface TransactionHistoryStore {
  transactions: TransactionRecord[];
  addTransaction: (tx: Omit<TransactionRecord, "timestamp">) => void;
  updateTransactionStatus: (hash: string, status: TxStatus, error?: string) => void;
  clearHistory: () => void;
  getRecentTransactions: (limit?: number) => TransactionRecord[];
  getTransactionByHash: (hash: string) => TransactionRecord | undefined;
}

export const useTransactionHistoryStore = create<TransactionHistoryStore>()(
  persist(
    (set, get) => ({
      transactions: [],

      addTransaction: (tx) => {
        set((state) => ({
          transactions: [
            {
              ...tx,
              timestamp: Date.now(),
            },
            ...state.transactions,
          ].slice(0, 100), // Keep last 100 transactions
        }));
      },

      updateTransactionStatus: (hash, status, error) => {
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.hash === hash ? { ...tx, status, error } : tx
          ),
        }));
      },

      clearHistory: () => set({ transactions: [] }),

      getRecentTransactions: (limit = 10) => {
        return get().transactions.slice(0, limit);
      },

      getTransactionByHash: (hash) => {
        return get().transactions.find((tx) => tx.hash === hash);
      },
    }),
    {
      name: "kora-transaction-history",
      partialize: (state) => ({
        transactions: state.transactions,
      }),
    }
  )
);
