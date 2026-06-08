import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WalletBalance, WalletNetwork, WalletProvider, WalletState } from "@/types";
import { env } from "@/lib/env";

const EMPTY_BALANCE: WalletBalance = {
  xlm: "0",
  usdc: "0",
  eurc: "0",
};

function getConfiguredNetwork(): WalletNetwork {
  return (env.NEXT_PUBLIC_STELLAR_NETWORK as WalletNetwork) || "testnet";
}

type WalletStoreState = WalletState & {
  isConnected: boolean;
  isVerified: boolean;
  verifiedAt: number | null;
  addressBook: { id: string; address: string; label: string }[];
};

type WalletStoreActions = {
  connect: (provider: WalletProvider, address: string, publicKey: string) => void;
  disconnect: () => void;
  setBalance: (balance: WalletBalance) => void;
  setVerified: (isVerified: boolean, verifiedAt?: number) => void;
  clearVerification: () => void;
  isVerificationExpired: () => boolean;
  isWrongNetwork: () => boolean;
  addAddressBookEntry: (address: string, label?: string) => void;
  updateAddressBookEntry: (id: string, updates: { address?: string; label?: string }) => void;
  removeAddressBookEntry: (id: string) => void;
};

type WalletStore = WalletStoreState & WalletStoreActions;

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      status: "disconnected",
      address: null,
      publicKey: null,
      isConnected: false,
      provider: null,
      network: getConfiguredNetwork(),
      balance: null,
      isVerified: false,
      verifiedAt: null,
      addressBook: [],

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
          isVerified: false,
          verifiedAt: null,
        }),

      setBalance: (balance) =>
        set((state) => (state.status === "connected" ? { balance } : {})),

      setVerified: (isVerified, verifiedAt) =>
        set({ isVerified, verifiedAt: verifiedAt || Date.now() }),

      clearVerification: () =>
        set({ isVerified: false, verifiedAt: null }),

      isVerificationExpired: () => {
        const state = get();
        if (!state.isVerified || !state.verifiedAt) return true;
        const EXPIRY_TIME = 60 * 60 * 1000; // 1 hour
        return Date.now() - state.verifiedAt > EXPIRY_TIME;
      },

      isWrongNetwork: () => {
        const state = get();
        const expectedNetwork = getConfiguredNetwork();
        return state.isConnected && state.network !== expectedNetwork;
      },

      addAddressBookEntry: (address, label = "") =>
        set((s) => ({
          addressBook: [
            ...s.addressBook,
            { id: String(Date.now()) + Math.random().toString(36).slice(2, 8), address, label },
          ],
        })),

      updateAddressBookEntry: (id, updates) =>
        set((s) => ({
          addressBook: s.addressBook.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),

      removeAddressBookEntry: (id) =>
        set((s) => ({ addressBook: s.addressBook.filter((e) => e.id !== id) })),
    }),
    {
      name: "kora-wallet",
      partialize: (s) => ({
        address: s.address,
        publicKey: s.publicKey,
        provider: s.provider,
        network: s.network,
        isVerified: s.isVerified,
        verifiedAt: s.verifiedAt,
        addressBook: s.addressBook,
      }),
    }
  )
);
