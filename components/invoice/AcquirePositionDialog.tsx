"use client";

import { AlertCircle, AlertTriangle, CheckCircle, ShieldAlert, ArrowRight, Clock, User, Tag } from "lucide-react";
import { cn, RISK_TIER_COLORS } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFormatters } from "@/hooks/useFormatters";
import { useTranslations } from "next-intl";

interface AcquirePositionDialogProps {
  item: {
    listing: {
      positionId: string;
      askPrice: number;
      impliedDiscount: number;
      listedAt: string;
    };
    positionId: string;
    invoice: any;
    investedAmount: number;
    expectedReturn: number;
    sellerAddress: string;
    remainingTenor: number;
    yieldPercent: number;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export const DEFAULT_THRESHOLDS = {
  extremeDiscountThreshold: 0.3,
  extremePremiumThreshold: 0.2,
  warningDiscountThreshold: 0.2,
  warningPremiumThreshold: 0.1,
};

export function AcquirePositionDialog({
  item,
  open,
  onOpenChange,
  onConfirm,
}: AcquirePositionDialogProps) {
  const { formatCurrency, formatPercentage } = useFormatters();
  useTranslations("secondaryMarket.acquireDialog");

  if (!item) return null;

  const currency = item.invoice?.metadata?.currency ?? "USDC";

  const isExtremeDiscountAlert = item.listing.impliedDiscount <= -DEFAULT_THRESHOLDS.extremeDiscountThreshold;
  const isExtremePremiumAlert = item.listing.impliedDiscount >= DEFAULT_THRESHOLDS.extremePremiumThreshold;
  const isWarningDiscountAlert = item.listing.impliedDiscount <= -DEFAULT_THRESHOLDS.warningDiscountThreshold;
  const isWarningPremiumAlert = item.listing.impliedDiscount >= DEFAULT_THRESHOLDS.warningPremiumThreshold;

  const isExtremeAlert = isExtremeDiscountAlert || isExtremePremiumAlert;
  const isWarningAlert = isWarningDiscountAlert || isWarningPremiumAlert;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-warning" aria-hidden />
            Confirm Acquisition
          </DialogTitle>
          <DialogDescription>
            Review the position details before acquiring this position on the secondary market.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Position Summary */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Position
                </p>
                <p className="font-mono text-sm font-medium text-white">
                  {item.invoice?.metadata?.invoiceNumber ?? `Invoice ${item.positionId}`}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] uppercase",
                  RISK_TIER_COLORS[item.invoice?.riskTier] ?? "text-zinc-400 border-zinc-700"
                )}
              >
                {item.invoice?.riskTier}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <div>
                <span className="text-zinc-400 block text-[10px] uppercase tracking-wider">
                  Ask Price
                </span>
                <span className="font-semibold text-white text-sm">
                  {formatCurrency(item.listing.askPrice, currency)}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[10px] uppercase tracking-wider">
                  Expected Return
                </span>
                <span className="font-medium text-success">
                  {formatCurrency(item.expectedReturn, currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Implied Discount/Premium Alert */}
          <div
            className={cn(
              "rounded-lg border p-3",
              item.listing.impliedDiscount >= 0
                ? "border-success/30 bg-success/5"
                : "border-warning/30 bg-warning/5"
            )}
          >
            <div className="flex items-start gap-2">
              {item.listing.impliedDiscount >= 0 ? (
                <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Implied discount
                </p>
                <p
                  className={
                    item.listing.impliedDiscount >= 0
                      ? "mt-1 text-lg font-bold text-success"
                      : "mt-1 text-lg font-bold text-warning"
                  }
                >
                  {formatPercentage(item.listing.impliedDiscount * 100, 2)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.listing.impliedDiscount >= 0
                    ? "Buyer receives a discount versus your expected return."
                    : "You're asking above your expected return (premium)."}
                </p>
              </div>
            </div>
          </div>

          {/* Price Impact Alerts */}
          {(isExtremeAlert || isWarningAlert) && (
            <div
              className={cn(
                "rounded-lg border p-3",
                isExtremeAlert
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-warning/30 bg-warning/5"
              )}
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive/80 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-destructive/90 uppercase tracking-wider">
                    {isExtremeAlert ? "Extreme Price Alert" : "Price Warning"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isExtremeDiscountAlert && "Extreme discount detected - this position is priced significantly below expected return."}
                    {isExtremePremiumAlert && "Extreme premium detected - this position is priced significantly above expected return."}
                    {isWarningDiscountAlert && "Warning: significant discount detected."}
                    {isWarningPremiumAlert && "Warning: significant premium detected."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Position Details */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Position Details
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary/80" />
                  Remaining Tenor
                </span>
                <span className="font-medium text-white">
                  {item.remainingTenor} days remaining
                </span>
              </div>

              <div className="flex items-center justify-between text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-emerald-400" />
                  Implied Discount
                </span>
                <span className="font-medium text-emerald-400">
                  {formatPercentage(item.listing.impliedDiscount * 100, 1)}%
                </span>
              </div>

              <div className="flex items-center justify-between text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-zinc-400" />
                  Seller Address
                </span>
                <span className="font-mono text-[11px] text-zinc-300">
                  {item.sellerAddress.slice(0, 4)}...{item.sellerAddress.slice(-4)}
                </span>
              </div>
            </div>
          </div>

          {/* Risk Tier Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Risk Tier</span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] uppercase",
                RISK_TIER_COLORS[item.invoice?.riskTier] ?? "text-zinc-400 border-zinc-700"
              )}
            >
              {item.invoice?.riskTier}
            </Badge>
            <span className="text-xs text-muted-foreground">
              (Risk Score: {item.invoice?.riskScore})
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className={cn(
              isExtremeAlert && "border-destructive/30 hover:bg-destructive/10"
            )}
          >
            Confirm Acquire
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
