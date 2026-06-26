import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WalletState, WalletProvider } from "@/types";
import { createFallbackStorage } from "./storage";

interface WalletStore extends WalletState {
  connect: (provider: WalletProvider, address: string, publicKey: string) => void;
  disconnect: () => void;
  setBalance: (balance: WalletState["balance"]) => void;
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      address: null,
      publicKey: null,
      isConnected: false,
      provider: null,
      network:
        (process.env.NEXT_PUBLIC_STELLAR_NETWORK as WalletState["network"]) ||
        "testnet",
      balance: null,

      connect: (provider, address, publicKey) =>
        set({ provider, address, publicKey, isConnected: true }),

      disconnect: () =>
        set({
          address: null,
          publicKey: null,
          isConnected: false,
          provider: null,
          balance: null,
        }),

      setBalance: (balance) => set({ balance }),
    }),
    {
      name: "kora-wallet",
      storage: createFallbackStorage(),
      partialize: (s) => ({
        address: s.address,
        publicKey: s.publicKey,
        provider: s.provider,
        network: s.network,
      }),
    }
  )
);
