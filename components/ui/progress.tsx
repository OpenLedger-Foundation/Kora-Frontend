"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as Tooltip from "@radix-ui/react-tooltip";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Base Progress ────────────────────────────────────────────────────────────

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    value?: number;
    indicatorClassName?: string;
  }
>(({ className, value = 0, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={value}
    className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        "h-full w-full flex-1 rounded-full bg-primary transition-all duration-500",
        indicatorClassName
      )}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

// ─── InvoiceFundingProgress ───────────────────────────────────────────────────

const MILESTONES = [25, 50, 75, 100] as const;

function interpolateColor(pct: number): string {
  // teal (0,188,212) → green (34,197,94)
  const r = Math.round(0 + (34 - 0) * (pct / 100));
  const g = Math.round(188 + (197 - 188) * (pct / 100));
  const b = Math.round(212 + (94 - 212) * (pct / 100));
  return `rgb(${r},${g},${b})`;
}

interface InvoiceFundingProgressProps {
  funded: number;
  target: number;
  currency?: string;
  className?: string;
  /** Pass query dataUpdatedAt (ms) to show "Updated X ago" */
  updatedAt?: number;
}

function useRelativeTime(updatedAt?: number) {
  const [label, setLabel] = React.useState("");
  React.useEffect(() => {
    if (!updatedAt) return;
    const update = () => {
      const secs = Math.floor((Date.now() - updatedAt) / 1000);
      if (secs < 5) setLabel("just now");
      else if (secs < 60) setLabel(`${secs}s ago`);
      else setLabel(`${Math.floor(secs / 60)}m ago`);
    };
    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, [updatedAt]);
  return label;
}

function InvoiceFundingProgress({
  funded,
  target,
  currency = "USDC",
  className,
  updatedAt,
}: InvoiceFundingProgressProps) {
  const pct = Math.min(100, target > 0 ? (funded / target) * 100 : 0);
  const isFullyFunded = pct >= 100;
  const color = interpolateColor(pct);
  const showInnerLabel = pct >= 30;
  const relativeTime = useRelativeTime(updatedAt);

  // Respect prefers-reduced-motion
  const prefersReduced = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  // Flash the bar when funded amount changes
  const prevFunded = React.useRef(funded);
  const [flash, setFlash] = React.useState(false);
  React.useEffect(() => {
    if (funded > prevFunded.current) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      prevFunded.current = funded;
      return () => clearTimeout(t);
    }
    prevFunded.current = funded;
  }, [funded]);

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className={cn("space-y-1.5", className)}>
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {isFullyFunded
            ? `Invoice fully funded at ${currency} ${target.toLocaleString()}`
            : `Funding progress ${Math.round(pct)}%. ${funded.toLocaleString()} of ${target.toLocaleString()} ${currency} funded.`}
        </span>
        {/* Bar */}
        <div className="relative h-5 w-full overflow-visible rounded-full bg-muted">
          <motion.div
            className={cn("absolute inset-y-0 left-0 rounded-full", flash && "brightness-125")}
            style={{ backgroundColor: color }}
            initial={prefersReduced ? false : { width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
          >
            {showInnerLabel && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-white">
                {Math.round(pct)}%
              </span>
            )}
          </motion.div>

          {/* Milestone markers */}
          {MILESTONES.map((m) => (
            <Tooltip.Root key={m}>
              <Tooltip.Trigger asChild>
                <div
                  className={cn(
                    "absolute top-0 h-full w-px cursor-default",
                    pct >= m ? "bg-white/30" : "bg-border"
                  )}
                  style={{ left: `${m}%` }}
                />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  side="top"
                  className="rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md"
                >
                  {m}% milestone
                  <Tooltip.Arrow className="fill-foreground" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          ))}
        </div>

        {/* Labels */}
        <div className="flex items-center justify-between text-xs">
          {isFullyFunded ? (
            <span className="flex items-center gap-1 font-semibold text-green-500">
              <CheckCircle2 className="h-3.5 w-3.5" /> Fully Funded
            </span>
          ) : (
            <span className="text-muted-foreground">
              {funded.toLocaleString()} {currency} of {target.toLocaleString()} {currency} funded
            </span>
          )}
          <div className="flex items-center gap-2">
            {relativeTime && (
              <span className="text-[10px] text-muted-foreground/60">
                Updated {relativeTime}
              </span>
            )}
            {!showInnerLabel && (
              <span className="font-medium text-foreground">{Math.round(pct)}%</span>
            )}
          </div>
        </div>
      </div>
    </Tooltip.Provider>
  );
}

export { Progress, InvoiceFundingProgress };
