"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  fundTestnetAccount,
  submitTransaction,
  waitForTransaction,
} from "@/lib/stellar/client";
import type { WalletProvider } from "@/types";
import { env } from "@/lib/env";
import { buildTestnetUsdcMintTx } from "@/lib/stellar/contracts";
import {
  fetchAccountBalanceSnapshot,
  toWalletStoreBalance,
} from "@/lib/walletBalances";
import { pollUsdcBalanceAfterMint } from "@/hooks/useUsdcBalance";

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

export function useNetworkValidation(targetNetwork?: string) {
  const expectedNetwork = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";
  const isNetworkMismatch = Boolean(
    targetNetwork && targetNetwork.toLowerCase() !== expectedNetwork.toLowerCase()
  );
  return { expectedNetwork, isNetworkMismatch };
}

export function useWallet() {
  const {
    address,
    publicKey,
    isConnected,
    provider,
    balance,
    network,
    kitSessionActive,
    kycStatus,
    connect,
    disconnect,
    setBalance,
    setKitSessionActive,
  } = useWalletStore();
  const [isReconnecting, setIsReconnecting] = useState(false);
  const attemptedRestoreRef = useRef<string | null>(null);

  const validateNetwork = useCallback((targetNetwork: string) => {
    const expected = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";
    return targetNetwork.toLowerCase() === expected.toLowerCase();
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!address) return null;

    try {
      const raw = await fetchAccountBalanceSnapshot(address);
      const nextBalance = toWalletStoreBalance(raw);
      setBalance(nextBalance);
      return nextBalance;
    } catch {
      return null;
    }
  }, [address, setBalance]);

  const restoreKitSession = useCallback(async () => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    setIsReconnecting(true);
    setKitSessionActive(null);

    try {
      if (env.NEXT_PUBLIC_ENABLE_MOCK_DATA) {
        setKitSessionActive(true);
        return;
      }

      const restoredAddress = await getKit().getPublicKey();

      if (restoredAddress !== address) {
        throw new Error("Wallet address changed during reconnect");
      }

      setKitSessionActive(true);
      await refreshBalance();
    } catch (error) {
      setKitSessionActive(false);
      throw error;
    } finally {
      setIsReconnecting(false);
    }
  }, [address, refreshBalance, setKitSessionActive]);

  const connectWallet = useCallback(
    async (walletId: string = FREIGHTER_ID) => {
      const walletKit = getKit();
      walletKit.setWallet(walletId);

      const addr = await walletKit.getPublicKey();

      connect(walletId as WalletProvider, addr, addr);
      setKitSessionActive(true);

      try {
        const raw = await fetchAccountBalanceSnapshot(addr);
        setBalance(toWalletStoreBalance(raw));
      } catch {
        // Account may not be funded yet on testnet.
      }
    },
    [connect, setBalance, setKitSessionActive],
  );

  const disconnectWallet = useCallback(async () => {
    kit = null;
    disconnect();
  }, [disconnect]);

  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      if (!isConnected) throw new Error("Wallet not connected");
      if (process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA === "true" || xdr.startsWith("mock_")) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return `${xdr}_signed`;
      }

      if (kitSessionActive !== true) {
        await restoreKitSession();
      }

      const walletKit = getKit();
      const { result } = await walletKit.signTx({
        xdr,
        publicKeys: [address!],
        network: WALLET_NETWORK,
      });
      return result;
    },
    [address, isConnected, kitSessionActive, restoreKitSession],
  );

  const fundWalletOnTestnet = useCallback(async () => {
    if (!address) return;
    if (env.NEXT_PUBLIC_STELLAR_NETWORK !== "testnet") {
      throw new Error("Testnet funding is only available on testnet");
    }

    await fundTestnetAccount(address);
    await refreshBalance();
  }, [address, refreshBalance]);

  const mintTestnetUsdc = useCallback(async () => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    const previousBalance = Number.parseFloat(balance?.usdc ?? "0");

    if (env.NEXT_PUBLIC_ENABLE_MOCK_DATA) {
      const nextBalance = Math.max(previousBalance + 10_000, 999_999);
      setBalance({
        xlm: balance?.xlm ?? "10000",
        usdc: String(nextBalance),
        eurc: balance?.eurc ?? "5000",
      });
      return nextBalance;
    }

    const unsignedXdr = await buildTestnetUsdcMintTx(address, address);
    const signedXdr = await signTransaction(unsignedXdr);
    const submitResult = await submitTransaction(signedXdr);

    if (submitResult.status === "ERROR") {
      throw new Error("USDC mint transaction failed");
    }

    await waitForTransaction(submitResult.hash);

    const nextBalance = await pollUsdcBalanceAfterMint(address, {
      previousBalance,
      minIncrease: 1,
    });

    await refreshBalance();

    return nextBalance;
  }, [address, balance, refreshBalance, setBalance, signTransaction]);

  const manualReconnect = useCallback(async () => {
    attemptedRestoreRef.current = address ?? null;
    await restoreKitSession();
  }, [address, restoreKitSession]);

  useEffect(() => {
    if (!isConnected || !address) {
      attemptedRestoreRef.current = null;
      return;
    }

    if (kitSessionActive !== false || attemptedRestoreRef.current === address) {
      return;
    }

    attemptedRestoreRef.current = address;

    void restoreKitSession().catch(() => {
      // Keep the reconnect prompt visible until the user retries manually.
    });
  }, [address, isConnected, kitSessionActive, restoreKitSession]);

  return {
    address,
    publicKey,
    isConnected,
    provider,
    balance,
    network,
    kitSessionActive,
    kycStatus,
    showReconnectPrompt: isConnected && kitSessionActive === false,
    isReconnecting,
    validateNetwork,
    connectWallet,
    disconnectWallet,
    signTransaction,
    refreshBalance,
    manualReconnect,
    fundWalletOnTestnet,
    mintTestnetUsdc,
  };
}
