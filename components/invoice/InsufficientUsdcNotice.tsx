"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { TestnetUsdcFaucet } from "@/components/wallet/TestnetUsdcFaucet";
import { isTestnetUsdcFaucetEnabled } from "@/hooks/useUsdcBalance";
import { env } from "@/lib/env";
import { formatCurrency, cn } from "@/lib/utils";

interface InsufficientUsdcNoticeProps {
  /** Spendable USDC in the connected wallet. */
  available: number;
  /** Smallest amount the wallet needs for this investment. */
  required: number;
  /** Called after a successful testnet faucet mint. */
  onFaucetSuccess?: () => void;
  className?: string;
}

/**
 * Replaces the silently disabled fund CTA when the wallet cannot cover the
 * investment (#1245). Testnet offers the in-app faucet; other networks link to
 * the configured USDC acquisition page.
 */
export function InsufficientUsdcNotice({
  available,
  required,
  onFaucetSuccess,
  className,
}: InsufficientUsdcNoticeProps) {
  const t = useTranslations("invoiceDetail.insufficientUsdc");

  return (
    <div
      role="alert"
      data-testid="insufficient-usdc"
      className={cn(
        "space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3",
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-300">{t("title")}</p>
          <p className="text-xs leading-relaxed text-zinc-400">
            {t("description", {
              available: formatCurrency(available, "USDC", true),
              required: formatCurrency(required, "USDC", true),
            })}
          </p>
        </div>
      </div>

      {isTestnetUsdcFaucetEnabled() ? (
        <TestnetUsdcFaucet compact onSuccess={onFaucetSuccess} />
      ) : (
        <Button asChild variant="secondary" size="sm" className="w-full">
          <a href={env.NEXT_PUBLIC_USDC_ACQUIRE_URL} target="_blank" rel="noopener noreferrer">
            {t("acquire")}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </Button>
      )}
    </div>
  );
}

export default InsufficientUsdcNotice;
