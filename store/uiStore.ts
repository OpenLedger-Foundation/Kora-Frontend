import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TxState } from "@/types";

export type Theme = "light" | "dark";

interface UIStore {
  walletModalOpen: boolean;
  setWalletModalOpen: (open: boolean) => void;

  txState: TxState;
  setTxState: (state: Partial<TxState>) => void;
  resetTxState: () => void;

  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      walletModalOpen: false,
      setWalletModalOpen: (walletModalOpen) => set({ walletModalOpen }),

      txState: { status: "idle" },
      setTxState: (state) =>
        set((s) => ({ txState: { ...s.txState, ...state } })),
      resetTxState: () => set({ txState: { status: "idle" } }),

      sidebarOpen: false,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

      theme: "dark",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set({ theme: get().theme === "dark" ? "light" : "dark" }),
    }),
    {
      name: "kora-ui-store",
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
