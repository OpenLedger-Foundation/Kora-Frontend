"use client";

import { useState } from "react";
import { Coins } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import {
  isTestnetUsdcFaucetEnabled,
  USDC_FAUCET_POLL_INTERVAL_MS,
  useUsdcBalance,
} from "@/hooks/useUsdcBalance";
import { cn } from "@/lib/utils";

export interface TestnetUsdcFaucetProps {
  /** When true, renders a compact inline CTA (fund panel). */
  compact?: boolean;
  /** Optional className for the outer wrapper. */
  className?: string;
  /** Called after a successful mint + balance poll. */
  onSuccess?: (newBalance: number) => void;
}

/**
 * One-click testnet USDC faucet CTA for investor onboarding.
 * Renders nothing on mainnet / futurenet.
 */
export function TestnetUsdcFaucet({
  compact = false,
  className,
  onSuccess,
}: TestnetUsdcFaucetProps) {
  const t = useTranslations("wallet");
  const { address, mintTestnetUsdc, refreshBalance } = useWallet();
  const toast = useToast();
  const [isMinting, setIsMinting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const shouldPoll = isMinting || isPolling;
  const { invalidate } = useUsdcBalance(address ?? undefined, {
    refetchInterval: shouldPoll ? USDC_FAUCET_POLL_INTERVAL_MS : false,
  });

  if (!isTestnetUsdcFaucetEnabled()) {
    return null;
  }

  const handleMint = async () => {
    setIsMinting(true);
    const toastId = "testnet-usdc-faucet";
    try {
      toast.loading(t("mintingUsdc"), toastId);
      setIsPolling(true);
      const newBalance = await mintTestnetUsdc();
      await invalidate();
      await refreshBalance();
      toast.success(t("mintUsdcSuccess"), undefined, toastId);
      onSuccess?.(newBalance);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("mintUsdcFailed");
      toast.error(t("mintUsdcFailed"), message, undefined, toastId);
    } finally {
      setIsMinting(false);
      setIsPolling(false);
    }
  };

  const busy = isMinting || isPolling;

  if (compact) {
    return (
      <div
        className={cn(
          "rounded-lg border border-kora-500/20 bg-kora-500/5 p-3 space-y-2",
          className,
        )}
        data-testid="testnet-usdc-faucet"
      >
        <p className="text-xs text-zinc-400 leading-relaxed">
          {t("faucetHint")}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={busy || !address}
          loading={busy}
          onClick={handleMint}
          leftIcon={busy ? undefined : <Coins className="h-3.5 w-3.5" />}
          data-testid="testnet-usdc-faucet-button"
        >
          {busy ? t("mintingUsdcShort") : t("getTestnetUsdc")}
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={busy || !address}
      loading={busy}
      onClick={handleMint}
      leftIcon={busy ? undefined : <Coins className="h-3.5 w-3.5" />}
      className={className}
      data-testid="testnet-usdc-faucet-button"
    >
      {busy ? t("mintingUsdcShort") : t("getTestnetUsdc")}
    </Button>
  );
}
