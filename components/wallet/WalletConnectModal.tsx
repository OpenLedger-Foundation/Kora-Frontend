"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Wallet, ChevronRight, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useUIStore } from "@/store";
import { useWallet } from "@/hooks/useWallet";
import { cn } from "@/lib/utils";

const WALLETS = [
  {
    id: "freighter",
    name: "Freighter",
    description: "Browser extension by Stellar Development Foundation",
    icon: "🔑",
    popular: true,
  },
  {
    id: "xbull",
    name: "xBull Wallet",
    description: "Feature-rich Stellar wallet",
    icon: "🐂",
    popular: false,
  },
  {
    id: "lobstr",
    name: "LOBSTR",
    description: "Simple and secure Stellar wallet",
    icon: "🦞",
    popular: false,
  },
  {
    id: "albedo",
    name: "Albedo",
    description: "Web-based Stellar signer",
    icon: "✨",
    popular: false,
  },
];

export function WalletConnectModal() {
  const { walletModalOpen, setWalletModalOpen } = useUIStore();
  const { connectWallet, isConnected } = useWallet();
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = async (walletId: string) => {
    setConnecting(walletId);
    try {
      await connectWallet(walletId);
      setWalletModalOpen(false);
    } catch (err) {
      console.error("Wallet connection failed:", err);
    } finally {
      setConnecting(null);
    }
  };

  if (isConnected) return null;

  return (
    <Dialog open={walletModalOpen} onOpenChange={setWalletModalOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-kora-muted text-primary">
            <Wallet className="h-5 w-5" />
          </div>
          <DialogTitle>Connect Wallet</DialogTitle>
          <DialogDescription>
            Connect your Stellar wallet to access Kora Protocol.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-2">
          {WALLETS.map((wallet, i) => (
            <motion.button
              key={wallet.id}
              type="button"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => handleConnect(wallet.id)}
              disabled={!!connecting}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3.5",
                "text-left transition-all hover:border-border hover:bg-muted",
                "disabled:cursor-not-allowed disabled:opacity-50",
                connecting === wallet.id && "border-primary/30 bg-kora-muted"
              )}
            >
              <span className="text-2xl">{wallet.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{wallet.name}</span>
                  {wallet.popular && (
                    <span className="rounded bg-kora-muted px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      Popular
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{wallet.description}</p>
              </div>
              {connecting === wallet.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </motion.button>
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          By connecting, you agree to our{" "}
          <a href="/terms" className="text-muted-foreground hover:text-foreground">
            Terms of Service
          </a>
        </p>
      </DialogContent>
    </Dialog>
  );
}
