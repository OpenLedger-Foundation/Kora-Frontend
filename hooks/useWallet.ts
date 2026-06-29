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
import { generateChallenge, verifySignature } from "@/lib/walletVerification";

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

      // Get the wallet's network passphrase for validation
      let walletPassphrase: string | undefined;
      try {
        const networkInfo = await (walletKit as any).getNetworkDetails?.();
        walletPassphrase = networkInfo?.networkPassphrase;
      } catch {
        // Some wallet implementations may not support getNetworkDetails; fallback to null
      }

      connect(walletId as WalletProvider, addr, addr, walletPassphrase);
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

  const verifyOwnership = useCallback(async (): Promise<boolean> => {
    if (!isConnected || !address || !publicKey) {
      throw new Error("Wallet not connected");
    }

    try {
      // Generate challenge client-side
      const challenge = generateChallenge();

      // Sign the challenge with the wallet
      const walletKit = getKit();
      // signMessage may not exist on all wallet kit versions — cast to any
      const { result: signature } = await (walletKit as any).signMessage({
        message: challenge,
        publicKey: publicKey,
      });

      // Verify signature client-side
      const { valid, message } = verifySignature(challenge, signature, publicKey);

      if (valid) {
        const SESSION_DURATION = 60 * 60 * 1000; // 1 hour
        const expiresAt = Date.now() + SESSION_DURATION;
        setVerified(true, expiresAt);
        return true;
      } else {
        clearVerification();
        console.error("Verification failed:", message);
        throw new Error(message || "Verification failed");
      }
    } catch (error) {
      console.error("Error during verification:", error);
      clearVerification();
      throw error;
    }
  }, [isConnected, address, publicKey, setVerified, clearVerification]);

  /**
   * Signs an arbitrary UTF-8 message with the connected wallet.
   * Returns the signature as a base64-encoded string.
   * Used for metadata attestation during invoice creation.
   */
  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!isConnected || !publicKey) throw new Error("Wallet not connected");
      const walletKit = getKit();
      const { result: signature } = await (walletKit as any).signMessage({
        message,
        publicKey,
      });
      // Wallets may return hex or base64 — normalise to base64
      if (/^[0-9a-f]+$/i.test(signature) && signature.length % 2 === 0) {
        return Buffer.from(signature, "hex").toString("base64");
      }
      return signature as string;
    },
    [isConnected, publicKey]
  );

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
    signMessage,
    refreshBalance,
    verifyOwnership,
    checkVerification,
    requireVerification,
  };
}
