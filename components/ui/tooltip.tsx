"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

// ─── Provider ─────────────────────────────────────────────────────────────────

const TooltipProvider = TooltipPrimitive.Provider;

// ─── Root ─────────────────────────────────────────────────────────────────────

const TooltipRoot = TooltipPrimitive.Root;

// ─── Trigger ──────────────────────────────────────────────────────────────────

const TooltipTrigger = TooltipPrimitive.Trigger;

// ─── Content ──────────────────────────────────────────────────────────────────

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-w-xs rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow className="fill-border" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// ─── Compound Tooltip ─────────────────────────────────────────────────────────

export interface TooltipProps {
  /** Tooltip content — string or rich JSX */
  content: React.ReactNode;
  /** Placement of the tooltip relative to the trigger */
  side?: "top" | "right" | "bottom" | "left";
  /** Open delay in ms (default: 300) */
  delay?: number;
  /** When true, tooltip is not rendered */
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * Tooltip — wraps any trigger element with a Radix UI tooltip.
 *
 * - Shows on hover and keyboard focus
 * - Hides on blur and Escape
 * - Supports rich JSX content via `content` prop
 * - Arrow indicator pointing to trigger
 * - Long-press on mobile (300 ms) via touch events
 *
 * @example
 * <Tooltip content="Risk tier explanation">
 *   <RiskBadge tier="A" tooltip={false} />
 * </Tooltip>
 *
 * <Tooltip content={<><strong>APR</strong><br />Annual Percentage Rate</>} side="right">
 *   <InfoIcon />
 * </Tooltip>
 */
function Tooltip({
  content,
  side = "top",
  delay = 300,
  disabled = false,
  children,
  contentClassName,
}: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Long-press for mobile
  const handleTouchStart = React.useCallback(() => {
    longPressTimer.current = setTimeout(() => setOpen(true), 500);
  }, []);

  const handleTouchEnd = React.useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  if (disabled) return <>{children}</>;

  return (
    <TooltipProvider delayDuration={delay}>
      <TooltipRoot open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          asChild
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          {/* Wrap in span to ensure trigger works with non-interactive children */}
          <span className="inline-flex">{children}</span>
        </TooltipTrigger>
        <TooltipContent side={side} className={contentClassName}>
          {content}
        </TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}

export {
  Tooltip,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
};
