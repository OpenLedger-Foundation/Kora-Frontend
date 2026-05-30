"use client";

import { useState, useMemo } from "react";
import {
  ChevronDown,
  LogOut,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/CopyButton";
import { StellarAddress } from "@/components/ui/stellar-address";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/hooks/useWallet";
import { useAccountBalance } from "@/hooks/useAccountBalance";
import { useInvoices } from "@/hooks/useInvoices";
import { useUIStore } from "@/store";
import { cn } from "@/lib/utils";
import { safeStellarAccountUrl } from "@/lib/security";

// Stellar DEX link for acquiring USDC
const STELLAR_DEX_USDC_URL =
  "https://stellarterm.com/exchange/USDC-centre.io/XLM-native";

/**
 * Formats a USDC balance number as "1,234.56 USDC".
 */
function formatUsdc(amount: number): string {
  return (
    amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " USDC"
  );
}

export function WalletButton() {
  const { isConnected, address, balance: walletBalance, disconnectWallet } =
    useWallet();
  const { setWalletModalOpen } = useUIStore();
  const [open, setOpen] = useState(false);

  // Live balance via useAccountBalance (auto-refreshes every 60s)
  const { balance, isLoading: balanceLoading, isFetching, refetch } =
    useAccountBalance(isConnected ? address : undefined);

  // Fetch active invoices to determine minimum investment for low-balance warning
  const { data: invoicesPage } = useInvoices(1);
  const minActiveInvestment = useMemo(() => {
    if (!invoicesPage?.data) return null;
    const active = invoicesPage.data.filter(
      (inv) =>
        (inv.status === "listed" || inv.status === "partially_funded") &&
        inv.funding.fundingProgress < 1
    );
    if (active.length === 0) return null;
    return Math.min(...active.map((inv) => inv.terms.minInvestment));
  }, [invoicesPage]);

  // Determine if USDC balance is too low to fund any active invoice
  const usdcBalance = balance?.usdc ?? null;
  const isLowBalance =
    usdcBalance !== null &&
    minActiveInvestment !== null &&
    usdcBalance < minActiveInvestment;
  const isZeroBalance = usdcBalance !== null && usdcBalance === 0;

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
        aria-expanded={open}
        aria-haspopup="true"
      >
        {/* Connection indicator */}
        <span className="h-2 w-2 rounded-full bg-success animate-pulse" />

        {/* USDC balance display */}
        {balanceLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : isZeroBalance ? (
          <span className="text-muted-foreground text-xs">0 USDC</span>
        ) : usdcBalance !== null ? (
          <span
            className={cn(
              "text-xs font-medium tabular-nums",
              isLowBalance ? "text-amber-500" : "text-foreground"
            )}
          >
            {isLowBalance && (
              <AlertTriangle className="inline h-3 w-3 mr-0.5 text-amber-500" />
            )}
            {formatUsdc(usdcBalance)}
          </span>
        ) : null}

        {/* Wallet address */}
        <StellarAddress
          address={address!}
          chars={4}
          size="sm"
          showCopy={false}
          className="text-foreground"
        />

        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-background p-3 shadow-token-lg">
            {/* ── USDC Balance Card ── */}
            <div className="mb-3 rounded-lg bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">USDC Balance</p>
                {/* Manual refresh button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    refetch();
                  }}
                  disabled={isFetching}
                  className={cn(
                    "rounded p-1 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted",
                    isFetching && "opacity-50 cursor-not-allowed"
                  )}
                  aria-label="Refresh balance"
                  title="Refresh balance"
                >
                  <RefreshCw
                    className={cn("h-3 w-3", isFetching && "animate-spin")}
                  />
                </button>
              </div>

              {/* Balance value */}
              {balanceLoading ? (
                <Skeleton className="h-7 w-32" />
              ) : isZeroBalance ? (
                <div className="space-y-1">
                  <p className="text-xl font-semibold text-muted-foreground">
                    0 USDC
                  </p>
                  <a
                    href={STELLAR_DEX_USDC_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Coins className="h-3 w-3" />
                    Get USDC on Stellar DEX
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              ) : (
                <div className="space-y-1">
                  <p
                    className={cn(
                      "text-xl font-semibold tabular-nums",
                      isLowBalance ? "text-amber-500" : "text-foreground"
                    )}
                  >
                    {usdcBalance !== null ? formatUsdc(usdcBalance) : "—"}
                  </p>

                  {/* Low balance warning */}
                  {isLowBalance && minActiveInvestment !== null && (
                    <div className="flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5">
                      <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-600 dark:text-amber-400 leading-snug">
                        Balance below minimum investment of{" "}
                        {minActiveInvestment.toLocaleString("en-US")} USDC.{" "}
                        <a
                          href={STELLAR_DEX_USDC_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:no-underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Get USDC
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Other Balances ── */}
            {(walletBalance || balance) && (
              <div className="mb-3 rounded-lg bg-card p-3 space-y-1">
                <p className="text-xs text-muted-foreground mb-1">
                  Other Balances
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">XLM</span>
                  <span className="font-medium text-foreground tabular-nums">
                    {balance
                      ? balance.xlm.toFixed(2)
                      : walletBalance
                        ? parseFloat(walletBalance.xlm).toFixed(2)
                        : "—"}
                  </span>
                </div>
                {(balance?.eurc ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">EURC</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {balance!.eurc.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── Actions ── */}
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
                  disconnectWallet();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-3.5 w-3.5" /> Disconnect
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
