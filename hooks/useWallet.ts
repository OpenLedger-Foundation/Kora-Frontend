"use client";

import { useCallback } from "react";
import {
  StellarWalletsKit,
  WalletNetwork,
  FREIGHTER_ID,
  FreighterModule,
  xBullModule,
  LobstrModule,
  AlbedoModule,
} from "@creit.tech/stellar-wallets-kit";
import { useWalletStore } from "@/store";
import { getAccountBalances } from "@/lib/stellar/client";
import type { WalletProvider } from "@/types";

let kit: StellarWalletsKit | null = null;

const WALLET_NETWORK =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? WalletNetwork.PUBLIC
    : WalletNetwork.TESTNET;

function getKit(): StellarWalletsKit {
  if (!kit) {
    kit = new StellarWalletsKit({
      network: WALLET_NETWORK,
      selectedWalletId: FREIGHTER_ID,
      modules: [
        new FreighterModule(),
        new xBullModule(),
        new LobstrModule(),
        new AlbedoModule(),
      ],
    });
  }
  return kit;
}

export function useWallet() {
  const { address, publicKey, isConnected, provider, balance, connect, disconnect, setBalance } =
    useWalletStore();

  const connectWallet = useCallback(
    async (walletId: string = FREIGHTER_ID) => {
      const walletKit = getKit();
      walletKit.setWallet(walletId);

      const addr = await walletKit.getPublicKey();

      let bal = null;
      try {
        const raw = await getAccountBalances(addr);
        bal = {
          xlm: raw["XLM"] || "0",
          usdc: raw["USDC"] || "0",
          eurc: raw["EURC"] || "0",
        };
      } catch {
        // Account may not be funded yet on testnet
      }

      connect(walletId as WalletProvider, addr, addr);
      if (bal) setBalance(bal);
    },
    [connect, setBalance]
  );

  const disconnectWallet = useCallback(() => {
    kit = null;
    disconnect();
  }, [disconnect]);

  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      if (!isConnected) throw new Error("Wallet not connected");
      const walletKit = getKit();
      const { result } = await walletKit.signTx({
        xdr,
        publicKeys: [address!],
        network: WALLET_NETWORK,
      });
      return result;
    },
    [isConnected, address]
  );

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    try {
      const raw = await getAccountBalances(address);
      setBalance({
        xlm: raw["XLM"] || "0",
        usdc: raw["USDC"] || "0",
        eurc: raw["EURC"] || "0",
      });
    } catch {
      // silently fail
    }
  }, [address, setBalance]);

  return {
    address,
    publicKey,
    isConnected,
    provider,
    balance,
    connectWallet,
    disconnectWallet,
    signTransaction,
    refreshBalance,
  };
}
