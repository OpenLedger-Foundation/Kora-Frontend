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
import { buildAddTrustlineTx, buildTestnetUsdcMintTx } from "@/lib/stellar/contracts";
import { useInvoiceStore } from "@/store/invoiceStore";
import { env } from "@/lib/env";
import type { WalletProvider } from "@/types";
import { WALLET_ASSETS, getAssetBalance, hasTrustline } from "@/config/walletAssets";
import {
  parseWalletDiagnosticsImport,
  sanitizeWalletDiagnosticsExport,
  type WalletDiagnosticsExport,
} from "@/lib/security";

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

export type WalletProviderHealth = {
  id: string;
  installed: boolean;
  state: "ready" | "missing" | "locked" | "unsupported_network" | "error";
  message: string;
};

export async function probeWalletProviderHealth(
  walletId: string
): Promise<WalletProviderHealth> {
  const installed =
    walletId === "albedo" ||
    (walletId === "freighter" &&
      typeof window !== "undefined" &&
      !!(window as Window & { freighter?: unknown }).freighter) ||
    (walletId === "xbull" &&
      typeof window !== "undefined" &&
      !!(window as Window & { xBullSDK?: unknown }).xBullSDK) ||
    (walletId === "lobstr" &&
      typeof window !== "undefined" &&
      !!(window as Window & { lobstr?: unknown }).lobstr);

  if (!installed) {
    return {
      id: walletId,
      installed: false,
      state: "missing",
      message: "Not installed",
    };
  }

  try {
    const walletKit = getKit();
    walletKit.setWallet(walletId);
    await walletKit.getPublicKey();
    const networkInfo = await (walletKit as any).getNetworkDetails?.();
    const walletPassphrase = networkInfo?.networkPassphrase;
    if (
      walletPassphrase &&
      walletPassphrase !== env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE
    ) {
      return {
        id: walletId,
        installed: true,
        state: "unsupported_network",
        message: "Wallet is on a different Stellar network",
      };
    }
    return {
      id: walletId,
      installed: true,
      state: "ready",
      message: "Ready to connect",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Probe failed";
    if (/locked|unlock|denied|rejected/i.test(message)) {
      return {
        id: walletId,
        installed: true,
        state: "locked",
        message: "Unlock the wallet before connecting",
      };
    }
    return {
      id: walletId,
      installed: true,
      state: "error",
      message,
    };
  }
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
    hasPassphraseMismatch,
    setDiagnosticsImport,
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
          eurc: getAssetBalance(raw.otherAssets, "EURC", WALLET_ASSETS.eurc.issuer),
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
        eurc: getAssetBalance(raw.otherAssets, "EURC", WALLET_ASSETS.eurc.issuer),
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

  const addEurcTrustlineOnTestnet = useCallback(async () => {
    if (!address) throw new Error("Wallet not connected");
    if (env.NEXT_PUBLIC_STELLAR_NETWORK !== "testnet") {
      throw new Error("EURC trustline onboarding is only available on testnet");
    }

    const raw = await getAccountBalances(address);
    if (hasTrustline(raw.otherAssets, "EURC", WALLET_ASSETS.eurc.issuer)) {
      await refreshBalance();
      return;
    }

    const trustlineXdr = await buildAddTrustlineTx(address, "eurc");
    const signedTrustlineXdr = await signTransaction(trustlineXdr);
    const submit = await submitTransaction(signedTrustlineXdr);
    if (submit.status === "ERROR") {
      throw new Error("EURC trustline transaction submission failed");
    }
    if (submit.hash) {
      await waitForTransaction(submit.hash);
    }
    await refreshBalance();
  }, [address, refreshBalance, signTransaction]);

  const exportWalletDiagnostics = useCallback((): WalletDiagnosticsExport => {
    return sanitizeWalletDiagnosticsExport({
      exportedAt: new Date().toISOString(),
      network: env.NEXT_PUBLIC_STELLAR_NETWORK,
      wallet: {
        provider,
        isConnected,
        addressSuffix: address,
        walletNetwork: useWalletStore.getState().network,
        passphraseMismatch: hasPassphraseMismatch(),
        kitSessionActive: Boolean(kit),
      },
      flags: {
        enableDevtools: env.NEXT_PUBLIC_ENABLE_DEVTOOLS,
        enableInvoiceComparison: env.NEXT_PUBLIC_ENABLE_INVOICE_COMPARISON,
      },
    });
  }, [address, hasPassphraseMismatch, isConnected, provider]);

  const importWalletDiagnostics = useCallback((raw: string) => {
    if (!env.NEXT_PUBLIC_ENABLE_DEVTOOLS) {
      throw new Error("Diagnostics import is only enabled when devtools are enabled");
    }
    const parsed = parseWalletDiagnosticsImport(raw);
    setDiagnosticsImport(JSON.stringify(parsed, null, 2));
    return parsed;
  }, [setDiagnosticsImport]);

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
    addEurcTrustlineOnTestnet,
    signTransaction,
    refreshBalance,
    exportWalletDiagnostics,
    importWalletDiagnostics,
    requestChallenge,
    verifyOwnership,
    checkVerification,
    requireVerification,
  };
}
