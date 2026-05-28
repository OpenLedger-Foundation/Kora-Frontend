"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import type { Invoice } from "@/types";

interface RepaymentDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (invoice: Invoice) => void;
  isLoading: boolean;
  insufficientBalance: boolean;
}

/** Compute repayment breakdown: principal raised + interest owed */
function getRepaymentBreakdown(inv: Invoice) {
  const principal = inv.funding.totalRaised;
  const interest = principal * inv.terms.discountRate;
  return { principal, interest, total: principal + interest };
}

export function RepaymentDialog({
  invoice,
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  insufficientBalance,
}: RepaymentDialogProps) {
  if (!invoice) return null;

  const { principal, interest, total } = getRepaymentBreakdown(invoice);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm Repayment</DialogTitle>
          <DialogDescription>
            Invoice {invoice.metadata.invoiceNumber} · {invoice.metadata.debtorName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <Row label="Principal (raised)" value={formatCurrency(principal, "USDC", true)} />
          <Row label="Interest owed" value={formatCurrency(interest, "USDC", true)} />
          <div className="border-t border-border pt-3">
            <Row
              label="Total repayment"
              value={formatCurrency(total, "USDC", true)}
              bold
            />
          </div>
        </div>

        {insufficientBalance && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Insufficient USDC balance. You need {formatCurrency(total, "USDC", true)}.
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={() => onConfirm(invoice)}
            disabled={isLoading || insufficientBalance}
          >
            {isLoading ? "Processing…" : "Confirm Repayment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      <span className={bold ? "font-semibold text-foreground" : "text-foreground"}>
        {value}
      </span>
    </div>
  );
}
