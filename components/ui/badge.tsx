import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Badge ────────────────────────────────────────────────────────────────────

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-foreground",
        success: "border-success/20 bg-success/10 text-success",
        warning: "border-warning/20 bg-warning/10 text-warning",
        danger: "border-destructive/20 bg-destructive/10 text-destructive",
        info: "border-info/20 bg-info/10 text-info",
        kora: "border-primary/20 bg-kora-muted text-primary",
        outline: "border-border bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// ─── RiskBadge ────────────────────────────────────────────────────────────────

/**
 * Supported risk tiers.
 * A/B/C/D are the simplified 4-tier system used in the issue spec.
 * AAA–CCC are the existing extended tiers used in the codebase.
 */
export type RiskTierSimple = "A" | "B" | "C" | "D";
export type RiskTierExtended = "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "CCC";
export type AnyRiskTier = RiskTierSimple | RiskTierExtended;

interface TierConfig {
  label: string;
  description: string;
  scoreRange: string;
  className: string;
  /** Icon that accompanies the color, ensuring color is not the sole means of conveying the tier (WCAG 1.4.1) */
  icon: React.ElementType;
}

const TIER_CONFIG: Record<AnyRiskTier, TierConfig> = {
  // Simple 4-tier (issue spec)
  A: {
    label: "A",
    description: "Low risk — strong repayment history and creditworthiness.",
    scoreRange: "75–100",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    icon: ShieldCheck,
  },
  B: {
    label: "B",
    description: "Moderate risk — generally reliable with minor concerns.",
    scoreRange: "50–74",
    className: "border-teal-500/30 bg-teal-500/10 text-teal-400",
    icon: ShieldAlert,
  },
  C: {
    label: "C",
    description: "Elevated risk — some repayment uncertainty.",
    scoreRange: "25–49",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    icon: ShieldAlert,
  },
  D: {
    label: "D",
    description: "High risk — significant default probability. Proceed with caution.",
    scoreRange: "0–24",
    className: "border-red-500/30 bg-red-500/10 text-red-400",
    icon: ShieldX,
  },
  // Extended tiers (existing codebase)
  AAA: {
    label: "AAA",
    description: "Exceptional quality — highest creditworthiness.",
    scoreRange: "95–100",
    className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
    icon: ShieldCheck,
  },
  AA: {
    label: "AA",
    description: "Very high quality — very low credit risk.",
    scoreRange: "85–94",
    className: "border-teal-400/30 bg-teal-400/10 text-teal-400",
    icon: ShieldCheck,
  },
  BBB: {
    label: "BBB",
    description: "Medium grade — adequate capacity to meet obligations.",
    scoreRange: "55–69",
    className: "border-yellow-400/30 bg-yellow-400/10 text-yellow-400",
    icon: ShieldAlert,
  },
  BB: {
    label: "BB",
    description: "Speculative — faces ongoing uncertainties.",
    scoreRange: "40–54",
    className: "border-orange-400/30 bg-orange-400/10 text-orange-400",
    icon: ShieldAlert,
  },
  CCC: {
    label: "CCC",
    description: "Very high risk — currently vulnerable to non-payment.",
    scoreRange: "0–24",
    className: "border-red-600/30 bg-red-600/10 text-red-500",
    icon: ShieldX,
  },
};

/** Returns true for tiers that should pulse (high-risk) */
function isHighRisk(tier: AnyRiskTier): boolean {
  return tier === "D" || tier === "CCC";
}

export interface RiskBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  tier: AnyRiskTier;
  /** Show tooltip on hover (default: true) */
  tooltip?: boolean;
}

function RiskBadgeInner(
  { tier, className, ...props }: Omit<RiskBadgeProps, "tooltip">,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const config = TIER_CONFIG[tier] ?? TIER_CONFIG["D"];
  const highRisk = isHighRisk(tier);
  const TierIcon = config.icon;

  const badge = (
    <div
      ref={ref}
      role="status"
      aria-label={`Risk tier ${config.label}: ${config.description} Score range ${config.scoreRange}`}
      className={cn(
        "relative inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold",
        config.className,
        className
      )}
      {...props}
    >
      {/* Pulse ring for high-risk tiers */}
      {highRisk && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-md border border-red-500/50"
          animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.15, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {/* Icon ensures color is not sole means of conveying tier (WCAG 1.4.1) */}
      <TierIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="relative">{config.label}</span>
    </div>
  );

  return badge;
}

const RiskBadgeBase = React.forwardRef(RiskBadgeInner);
RiskBadgeBase.displayName = "RiskBadge";

/**
 * RiskBadge — color-coded badge with Radix Tooltip and animated pulse for D/CCC tiers.
 *
 * @example
 * <RiskBadge tier="A" />
 * <RiskBadge tier="D" />
 * <RiskBadge tier="BBB" tooltip={false} />
 */
function RiskBadge({ tier, tooltip = true, ...props }: RiskBadgeProps) {
  const config = TIER_CONFIG[tier] ?? TIER_CONFIG["D"];

  if (!tooltip) {
    return <RiskBadgeBase tier={tier} {...props} />;
  }

  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <RiskBadgeBase tier={tier} {...props} />
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={6}
            className={cn(
              "z-50 max-w-[220px] rounded-lg border border-border bg-popover px-3 py-2 shadow-md",
              "text-xs text-popover-foreground animate-in fade-in-0 zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
            )}
          >
            <p className="font-semibold">Tier {config.label}</p>
            <p className="mt-0.5 text-muted-foreground">{config.description}</p>
            <p className="mt-1 text-muted-foreground">Score: {config.scoreRange}</p>
            <TooltipPrimitive.Arrow className="fill-border" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export { Badge, badgeVariants, RiskBadge };
