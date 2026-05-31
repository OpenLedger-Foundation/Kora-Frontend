import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WalletBalance, WalletNetwork, WalletProvider, WalletState } from "@/types";

const EMPTY_BALANCE: WalletBalance = {
  xlm: "0",
  usdc: "0",
  eurc: "0",
};

function getConfiguredNetwork(): WalletNetwork {
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK;
  return network === "mainnet" || network === "futurenet" ? network : "testnet";
}

type WalletStoreState = WalletState & {
  isConnected: boolean;
};

type WalletStoreActions = {
  connect: (provider: WalletProvider, address: string, publicKey: string) => void;
  disconnect: () => void;
  setBalance: (balance: WalletBalance) => void;
};

type WalletStore = WalletStoreState & WalletStoreActions;

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      status: "disconnected",
      address: null,
      publicKey: null,
      isConnected: false,
      provider: null,
      network: getConfiguredNetwork(),
      balance: null,

      connect: (provider, address, publicKey) =>
        set({ status: "connected", provider, address, publicKey, balance: EMPTY_BALANCE, isConnected: true }),

      disconnect: () =>
        set({
          status: "disconnected",
          address: null,
          publicKey: null,
          isConnected: false,
          provider: null,
          balance: null,
        }),

      setBalance: (balance) => set((state) => (
        state.status === "connected" ? { balance } : {}
      )),
    }),
    {
      name: "kora-wallet",
      partialize: (s) => ({
        address: s.address,
        publicKey: s.publicKey,
        provider: s.provider,
        network: s.network,
      }),
    }
  )
);
