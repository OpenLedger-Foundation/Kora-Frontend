"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormatters } from "@/hooks/useFormatters";

const GET_USDC_URL = "https://www.stellar.org/usdc";
const BRIDGE_USDC_URL = "https://www.circle.com/cross-chain-transfer-protocol";

interface InsufficientUsdcNoticeProps {
  /** Current USDC balance. */
  balance: number;
  /** Amount the user is trying to fund. */
  required: number;
}

/**
 * Explains why funding is blocked when the wallet lacks USDC and points
 * the investor to where they can acquire or bridge USDC.
 */
export function InsufficientUsdcNotice({ balance, required }: InsufficientUsdcNoticeProps) {
  const t = useTranslations("wallet");
  const { formatCurrency } = useFormatters();
  const shortfall = Math.max(required - balance, 0);

  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm"
    >
      <p className="flex items-center gap-1.5 font-semibold text-amber-400">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        {t("insufficientUsdcTitle")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {balance <= 0
          ? t("insufficientUsdcEmpty")
          : t("insufficientUsdcDesc", {
              shortfall: formatCurrency(shortfall, "USDC"),
              balance: formatCurrency(balance, "USDC"),
            })}
      </p>
      <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium">
        <a
          href={GET_USDC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-kora-400 hover:underline"
        >
          {t("insufficientUsdcCta")}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
        <a
          href={BRIDGE_USDC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-kora-400 hover:underline"
        >
          {t("insufficientUsdcBridge")}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
