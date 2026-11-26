"use client";

/**
 * Secondary market fee tooltip (issue #1247).
 *
 * Renders an icon trigger with a localised accessible name that opens a
 * Tooltip containing the full FeeDisclosure breakdown.  Keeping the trigger
 * and the disclosure in one component means the accessible name and the
 * content are always in sync with the same translation namespace.
 *
 * Usage:
 *   <FeeTooltip fees={computeAcquisitionFees(askPrice, schedule)} />
 */

import { CircleHelp } from "lucide-react";
import { useTranslations } from "next-intl";

import { Tooltip } from "@/components/ui/tooltip";
import { FeeDisclosure } from "@/components/secondary/FeeDisclosure";
import type { FeeBreakdown } from "@/lib/secondaryFees";

interface FeeTooltipProps {
  fees: FeeBreakdown;
  /** Side the tooltip opens toward (default: "top"). */
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

/**
 * Icon trigger whose tooltip shows the full fee breakdown.
 *
 * The trigger button carries `aria-label` from the `secondaryFees.tooltipTriggerLabel`
 * translation key so screen readers announce a meaningful name rather than
 * "button" or the icon glyph name.
 */
export function FeeTooltip({ fees, side = "top", className }: FeeTooltipProps) {
  const t = useTranslations("secondaryFees");

  return (
    <Tooltip
      side={side}
      content={
        <FeeDisclosure
          fees={fees}
          className="min-w-[220px]"
          data-testid="fee-tooltip-content"
        />
      }
      contentClassName="p-0 border-0 bg-transparent shadow-none"
    >
      <button
        type="button"
        aria-label={t("tooltipTriggerLabel")}
        data-testid="fee-tooltip-trigger"
        className={className}
      >
        <CircleHelp
          className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-hidden
        />
      </button>
    </Tooltip>
  );
}

export default FeeTooltip;
