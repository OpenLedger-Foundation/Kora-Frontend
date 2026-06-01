"use client";

import { useState } from "react";
import { ChevronDown, LogOut, ExternalLink, Bell, Coins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/CopyButton";
import { StellarAddress } from "@/components/ui/stellar-address";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import { useUIStore } from "@/store";
import { cn } from "@/lib/utils";
import { safeStellarAccountUrl } from "@/lib/security";
import { env } from "@/lib/env";

export function WalletButton() {
  const { isConnected, address, balance, disconnectWallet, fundWalletOnTestnet, refreshBalance } = useWallet();
  const { setWalletModalOpen } = useUIStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);
  const [isFunding, setIsFunding] = useState(false);

  const isTestnet = env.NEXT_PUBLIC_STELLAR_NETWORK === "testnet";

  const handleFundTestnetAccount = async () => {
    setIsFunding(true);
    const toastId = "testnet-funding";
    try {
      toast.loading("Funding testnet account...", toastId);
      await fundWalletOnTestnet();
      await refreshBalance();
      toast.success("Testnet account funded with 10,000 XLM", undefined, toastId);
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fund testnet account";
      toast.error("Funding failed", message, undefined, toastId);
    } finally {
      setIsFunding(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectWallet();
    setConfirmDisconnectOpen(false);
    setOpen(false);
  };

  const expectedNetwork = (env.NEXT_PUBLIC_STELLAR_NETWORK as typeof network) || "testnet";
  const networkLabel = {
    testnet: "Testnet",
    mainnet: "Mainnet",
    futurenet: "Futurenet",
  };

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
          "flex items-center gap-2 rounded-lg border px-3 py-2",
          "text-sm transition-colors",
          isWrongNetwork()
            ? "border-destructive/30 bg-destructive/5 text-destructive hover:border-destructive/40 hover:bg-destructive/10"
            : "border-input bg-card text-foreground hover:border-border hover:bg-muted"
        )}
        aria-label={`Wallet menu${isWrongNetwork() ? " - Wrong network" : ""}`}
      >
        {isWrongNetwork() ? (
          <AlertCircle className="h-4 w-4 shrink-0" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
        )}
        <StellarAddress address={address!} chars={4} size="sm" showCopy={false} className="text-current" />
        <div className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
          {networkLabel[network] || network}
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-background p-3 shadow-token-lg">
          {isWrongNetwork() && (
            <div className="mb-3 flex items-start gap-2 rounded-lg bg-destructive/10 p-2.5 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">
                Connected to <span className="capitalize font-medium">{networkLabel[network]}</span> but app requires{" "}
                <span className="capitalize font-medium">{networkLabel[expectedNetwork]}</span>
              </p>
            </div>
          )}
          
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
              href={safeStellarAccountUrl(address)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View on Explorer
            </a>
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(true);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Bell className="h-3.5 w-3.5" /> Notification settings
            </button>
            {isTestnet && (
              <button
                type="button"
                disabled={isFunding}
                onClick={handleFundTestnetAccount}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
              >
                {isFunding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Coins className="h-3.5 w-3.5" />}
                {isFunding ? "Funding..." : "Fund Testnet Account"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmDisconnectOpen(true)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-3.5 w-3.5" /> Disconnect
            </button>
          </div>
        </div>
      )}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notification Settings</DialogTitle>
            <DialogDescription>
              Configure toast notifications for transaction and invoice events.
            </DialogDescription>
          </DialogHeader>
          <NotificationSettings />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDisconnectOpen} onOpenChange={setConfirmDisconnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect wallet?</DialogTitle>
            <DialogDescription>
              Are you sure? This will clear your wallet session and redirect from protected pages.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDisconnectOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDisconnect}>
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
