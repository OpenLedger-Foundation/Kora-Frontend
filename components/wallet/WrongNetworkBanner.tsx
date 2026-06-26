"use client";

import { AlertCircle, X } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/hooks/useWallet";
import { useWalletStore } from "@/store";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

export function WrongNetworkBanner() {
  const { isConnected } = useWallet();
  const { isWrongNetwork, hasPassphraseMismatch } = useWalletStore();
  const [dismissed, setDismissed] = useState(false);
  
  // Reset dismissal when navigating or network state changes
  useEffect(() => {
    setDismissed(false);
  }, [isConnected, isWrongNetwork(), hasPassphraseMismatch()]);

  const networkMismatch = isWrongNetwork();
  const passphraseMismatch = hasPassphraseMismatch();
  const isWrongNetworkState = (networkMismatch || passphraseMismatch) && !dismissed;

  if (!isWrongNetworkState) return null;

  const networkLabel = {
    testnet: "Testnet",
    mainnet: "Mainnet",
    futurenet: "Futurenet",
  };

  const { network } = useWalletStore();
  const expectedNetwork = (env.NEXT_PUBLIC_STELLAR_NETWORK as typeof network) || "testnet";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-destructive/10 px-4 py-3 text-sm text-destructive border-b border-destructive/20"
      >
        <div className="flex items-center gap-2 flex-1">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="font-medium">
            Wrong Network: Connected to{" "}
            <span className="capitalize">{networkLabel[network] || network}</span>, but this app requires{" "}
            <span className="capitalize">{networkLabel[expectedNetwork] || expectedNetwork}</span>
            {passphraseMismatch && " (passphrase mismatch)"}.
            Please switch your wallet network to continue.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss wrong network warning"
          className="shrink-0 rounded-md p-1 hover:bg-destructive/20 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
