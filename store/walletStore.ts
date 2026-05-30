import { create } from "zustand";
import { persist } from "zustand/middleware";
import { env } from "@/lib/env";
import type { WalletState, WalletProvider } from "@/types";

interface WalletStore extends WalletState {
  connect: (provider: WalletProvider, address: string, publicKey: string) => void;
  disconnect: () => void;
  setBalance: (balance: WalletState["balance"]) => void;
  setVerified: (isVerified: boolean, verifiedAt?: number) => void;
  clearVerification: () => void;
  isVerificationExpired: () => boolean;
  // Address book
  addressBook: { id: string; address: string; label: string }[];
  addAddressBookEntry: (address: string, label?: string) => void;
  updateAddressBookEntry: (id: string, updates: { address?: string; label?: string }) => void;
  removeAddressBookEntry: (id: string) => void;
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      address: null,
      publicKey: null,
      isConnected: false,
      provider: null,
      network: (env.NEXT_PUBLIC_STELLAR_NETWORK as WalletState["network"]) || "testnet",
      balance: null,
      isVerified: false,
      verifiedAt: null,

      connect: (provider, address, publicKey) =>
        set({ provider, address, publicKey, isConnected: true }),

      disconnect: () =>
        set({
          address: null,
          publicKey: null,
          isConnected: false,
          provider: null,
          balance: null,
          isVerified: false,
          verifiedAt: null,
        }),

      setBalance: (balance) => set({ balance }),

      setVerified: (isVerified, verifiedAt) =>
        set({
          isVerified,
          verifiedAt: verifiedAt || Date.now(),
        }),

      clearVerification: () =>
        set({
          isVerified: false,
          verifiedAt: null,
        }),

      isVerificationExpired: () => {
        const state = get();
        if (!state.isVerified || !state.verifiedAt) return true;
        const EXPIRY_TIME = 60 * 60 * 1000; // 1 hour
        return Date.now() - state.verifiedAt > EXPIRY_TIME;
      },
      // Address book actions
      addressBook: [],
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
