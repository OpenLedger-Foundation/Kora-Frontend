"use client";

import { useState } from "react";
import { ChevronDown, LogOut, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/CopyButton";
import { useWallet } from "@/hooks/useWallet";
import { useUIStore } from "@/store";
import { shortenAddress } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function WalletButton() {
  const { isConnected, address, balance, disconnectWallet } = useWallet();
  const { setWalletModalOpen } = useUIStore();
  const [open, setOpen] = useState(false);

  if (!isConnected) {
    return (
      <Button onClick={() => setWalletModalOpen(true)} size="sm">
        Connect Wallet
      </Button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2",
          "text-sm text-foreground transition-colors hover:border-border hover:bg-muted"
        )}
      >
        <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
        <span className="font-mono text-xs">{shortenAddress(address!)}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-background p-3 shadow-token-lg">
          {balance && (
            <div className="mb-3 space-y-1 rounded-lg bg-card p-3">
              <p className="text-xs text-muted-foreground">Balances</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">XLM</span>
                <span className="font-medium text-foreground">{parseFloat(balance.xlm).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">USDC</span>
                <span className="font-medium text-foreground">{parseFloat(balance.usdc).toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground">
              <CopyButton text={address!} />
              Copy address
            </div>
            <a
              href={`https://stellar.expert/explorer/testnet/account/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View on Explorer
            </a>
            <button
              type="button"
              onClick={() => { disconnectWallet(); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-3.5 w-3.5" /> Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
