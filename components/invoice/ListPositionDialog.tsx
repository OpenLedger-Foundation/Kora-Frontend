"use client";

import { useState } from "react";
import { Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { formatCurrency } from "@/lib/utils";
import { computeImpliedDiscount } from "@/types/invoice";
import type { InvestorPosition } from "@/types/invoice";

interface ListPositionDialogProps {
  position: InvestorPosition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (askPrice: number) => void;
}

/**
 * Listing form for the secondary market (#442): lets an investor set an ask
 * price for an active position and previews the implied discount before
 * submitting.
 */
export function ListPositionDialog({
  position,
  open,
  onOpenChange,
  onSubmit,
}: ListPositionDialogProps) {
  const [askPrice, setAskPrice] = useState<string>("");

  if (!position) return null;

  const currency = position.invoice?.metadata.currency ?? "USDC";
  const parsedAsk = Number.parseFloat(askPrice);
  const askIsValid = Number.isFinite(parsedAsk) && parsedAsk > 0;
  const impliedDiscount = askIsValid
    ? computeImpliedDiscount(parsedAsk, position.expectedReturn)
    : null;

  const handleSubmit = () => {
    if (!askIsValid) return;
    onSubmit(parsedAsk);
    setAskPrice("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" aria-hidden />
            List position for sale
          </DialogTitle>
          <DialogDescription>
            Set an ask price for this position on the secondary market.
            Expected return: {formatCurrency(position.expectedReturn, currency)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <NumberInput
            label="Ask price"
            placeholder={position.expectedReturn.toFixed(2)}
            value={askPrice}
            onChange={(e) => setAskPrice(e.target.value)}
            min={0}
            step="0.01"
            showUSDC={currency === "USDC"}
            error={
              askPrice.length > 0 && !askIsValid
                ? "Enter a valid ask price greater than 0"
                : undefined
            }
          />

          {impliedDiscount !== null && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Implied discount
              </p>
              <p
                className={
                  impliedDiscount >= 0
                    ? "mt-1 text-lg font-bold text-success"
                    : "mt-1 text-lg font-bold text-warning"
                }
              >
                {(impliedDiscount * 100).toFixed(2)}%
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {impliedDiscount >= 0
                  ? "Buyer receives a discount versus your expected return."
                  : "You're asking above your expected return."}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!askIsValid}>
            List for sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
