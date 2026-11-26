"use client";

/**
 * Secondary market fee disclosure (issue #597).
 *
 * Renders the breakdown returned by `lib/secondaryFees` — it does no
 * arithmetic of its own, so the figures shown and the figures charged cannot
 * diverge.
 */

import { useTranslations } from "next-intl";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";

import { formatBps, type FeeBreakdown } from "@/lib/secondaryFees";
import { formatCurrency } from "@/lib/utils";

interface FeeDisclosureProps {
  fees: FeeBreakdown;
  /** Compact single-line form for listing cards. */
  variant?: "full" | "inline";
  className?: string;
}

/**
 * A fee-row info affordance. The trigger is a real button with a translated
 * accessible name, so screen readers announce what the tooltip explains even
 * before it opens (#1242).
 */
function FeeInfo({ label, description }: { label: string; description: string }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-zinc-500 transition-colors hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <Info className="h-3 w-3" aria-hidden />
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-50 max-w-xs rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
        >
          {description}
          <TooltipPrimitive.Arrow className="fill-border" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function FeeDisclosure({ fees, variant = "full", className }: FeeDisclosureProps) {
  const t = useTranslations("secondaryFees");

  if (fees.totalBps === 0) {
    return (
      <p className={className} data-testid="fee-disclosure-none">
        {t("noFees")}
      </p>
    );
  }

  if (variant === "inline") {
    return (
      <p className={className} data-testid="fee-disclosure-inline">
        {t("listingNote", { rate: formatBps(fees.totalBps) })}
      </p>
    );
  }

  return (
    <div className={className} data-testid="fee-disclosure">
      <h4 className="text-xs font-medium text-zinc-300">{t("title")}</h4>
      <p className="text-[11px] text-zinc-500">{t("subtitle")}</p>

      <TooltipPrimitive.Provider delayDuration={200}>
        <dl className="mt-2 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <dt className="text-zinc-400">{t("subtotal")}</dt>
            <dd className="font-mono text-zinc-200">{formatCurrency(fees.subtotal)}</dd>
          </div>

          {fees.schedule.protocolBps > 0 && (
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1 text-zinc-400">
                {t("protocolFee", { rate: formatBps(fees.schedule.protocolBps) })}
                <FeeInfo
                  label={t("protocolFeeAria")}
                  description={t("protocolFeeTooltip", {
                    rate: formatBps(fees.schedule.protocolBps),
                  })}
                />
              </dt>
              <dd className="font-mono text-zinc-200">{formatCurrency(fees.protocolFee)}</dd>
            </div>
          )}

          {fees.schedule.marketBps > 0 && (
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1 text-zinc-400">
                {t("marketFee", { rate: formatBps(fees.schedule.marketBps) })}
                <FeeInfo
                  label={t("marketFeeAria")}
                  description={t("marketFeeTooltip", {
                    rate: formatBps(fees.schedule.marketBps),
                  })}
                />
              </dt>
              <dd className="font-mono text-zinc-200">{formatCurrency(fees.marketFee)}</dd>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-zinc-800 pt-1 font-medium">
            <dt className="flex items-center gap-1 text-zinc-200">
              {t("total")}
              <FeeInfo
                label={t("totalFeeAria")}
                description={t("totalFeeTooltip", {
                  fees: formatCurrency(fees.totalFees),
                  total: formatCurrency(fees.total),
                })}
              />
            </dt>
            <dd className="font-mono text-zinc-100" data-testid="fee-total">
              {formatCurrency(fees.total)}
            </dd>
          </div>
        </dl>
      </TooltipPrimitive.Provider>
    </div>
  );
}

export default FeeDisclosure;
