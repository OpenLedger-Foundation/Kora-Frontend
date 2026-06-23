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
import * as StellarSdk from "@stellar/stellar-sdk";
import { useWalletStore, useUIStore } from "@/store";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { getAccountBalances, fundTestnetAccount, submitTransaction, waitForTransaction } from "@/lib/stellar/client";
import { buildTestnetUsdcMintTx } from "@/lib/stellar/contracts";
import { useInvoiceStore } from "@/store/invoiceStore";
import { env } from "@/lib/env";
import type { WalletProvider } from "@/types";

let kit: StellarWalletsKit | null = null;

const WALLET_NETWORK =
  env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
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
  const {
    address,
    publicKey,
    isConnected,
    provider,
    balance,
    isVerified,
    verifiedAt,
    connect,
    disconnect,
    setBalance,
    setVerified,
    clearVerification,
    isVerificationExpired,
  } = useWalletStore();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const connectWallet = useCallback(
    async (walletId: string = FREIGHTER_ID) => {
      const walletKit = getKit();
      walletKit.setWallet(walletId);

      const addr = await walletKit.getPublicKey();

      let bal = null;
      try {
        const raw = await getAccountBalances(addr);
        bal = {
          xlm: raw.xlm,
          usdc: raw.usdc,
          eurc: raw.otherAssets.find((a) => a.code === "EURC")?.balance ?? "0",
        };
      } catch {
        // Account may not be funded yet on testnet
      }

      connect(walletId as WalletProvider, addr, addr);
      if (bal) setBalance(bal);
      try {
        const intended = useUIStore.getState().intendedDestination;
        if (intended) {
          useUIStore.getState().setIntendedDestination(null);
          router.push(intended);
        }
      } catch {
        // best-effort redirect; ignore failures
      }
    },
    [connect, setBalance]
  );

  const disconnectWallet = useCallback(async () => {
    const walletAddress = address;
    kit = null;
    queryClient.clear();
    useInvoiceStore.setState({
      invoices: [],
      selectedInvoice: null,
      searchQuery: "",
      createDraft: { currency: "USDC" },
    });
    if (typeof window !== "undefined") {
      localStorage.removeItem("kora-wallet");
    }
    disconnect();

    if (
      pathname?.startsWith("/dashboard") ||
      pathname === "/invoice/create" ||
      pathname?.startsWith("/invoice/create/")
    ) {
      router.push("/marketplace");
    }

    // Best-effort refresh after teardown for any address-bound views.
    if (walletAddress) {
      await queryClient.invalidateQueries({
        predicate: (q) => JSON.stringify(q.queryKey).includes(walletAddress),
      });
    }
  }, [address, disconnect, pathname, queryClient, router]);

  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      if (!isConnected) throw new Error("Wallet not connected");
      if (env.NEXT_PUBLIC_ENABLE_MOCK_DATA || xdr.startsWith("mock_")) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return `${xdr}_signed`;
      }
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
        xlm: raw.xlm,
        usdc: raw.usdc,
        eurc: raw.otherAssets.find((a) => a.code === "EURC")?.balance ?? "0",
      });
    } catch {
      // silently fail
    }
  }, [address, setBalance]);

  const fundWalletOnTestnet = useCallback(async () => {
    if (!address) throw new Error("Wallet not connected");
    if (env.NEXT_PUBLIC_STELLAR_NETWORK !== "testnet") {
      throw new Error("Testnet funding is only available on testnet");
    }

    await fundTestnetAccount(address);

    const usdcMintXdr = await buildTestnetUsdcMintTx(address, address);
    const signedUsdcMintXdr = await signTransaction(usdcMintXdr);
    const submit = await submitTransaction(signedUsdcMintXdr);
    if (submit.status === "ERROR") {
      throw new Error("USDC faucet transaction submission failed");
    }
    if (submit.hash) {
      await waitForTransaction(submit.hash);
    }

    await refreshBalance();
  }, [address, refreshBalance, signTransaction]);

  const requestChallenge = useCallback(async (): Promise<string> => {
    try {
      const res = await fetch("/api/auth/challenge", { method: "POST" });
      if (!res.ok) throw new Error("Failed to request challenge");
      const data = await res.json();
      return data.challenge;
    } catch (error) {
      console.error("Error requesting challenge:", error);
      throw error;
    }
  }, []);

  const verifyOwnership = useCallback(async (): Promise<boolean> => {
    if (!isConnected || !address || !publicKey) {
      throw new Error("Wallet not connected");
    }

    try {
      // Request a challenge from the server
      const challenge = await requestChallenge();

      // Sign the challenge with the wallet
      const walletKit = getKit();
      // signMessage may not exist on all wallet kit versions — cast to any
      const { result: signature } = await (walletKit as any).signMessage({
        message: challenge,
        publicKey: publicKey,
      });

      // Send signature to server for verification
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge,
          signature,
          publicKey,
        }),
      });

      if (!verifyRes.ok) throw new Error("Verification request failed");
      const verifyData = await verifyRes.json();

      if (verifyData.verified) {
        setVerified(true, verifyData.expiresAt);
        return true;
      } else {
        clearVerification();
        console.error("Verification failed:", verifyData.message);
        return false;
      }
    } catch (error) {
      console.error("Error during verification:", error);
      clearVerification();
      throw error;
    }
  }, [isConnected, address, publicKey, requestChallenge, setVerified, clearVerification]);

  const checkVerification = useCallback((): boolean => {
    if (!isConnected) return false;
    if (isVerificationExpired()) {
      clearVerification();
      return false;
    }
    return isVerified;
  }, [isConnected, isVerified, isVerificationExpired, clearVerification]);

  const requireVerification = useCallback(async (): Promise<void> => {
    if (!checkVerification()) {
      throw new Error("VERIFICATION_REQUIRED");
    }
  }, [checkVerification]);

  return {
    address,
    publicKey,
    isConnected,
    provider,
    balance,
    isVerified: checkVerification(),
    verifiedAt,
    connectWallet,
    disconnectWallet,
    fundWalletOnTestnet,
    signTransaction,
    refreshBalance,
    requestChallenge,
    verifyOwnership,
    checkVerification,
    requireVerification,
  };
}
