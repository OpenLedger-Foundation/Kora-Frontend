"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Invoice } from "@/types";

interface CancelInvoiceDialogProps {
  invoice: Invoice | null;
  open: boolean;
  loading?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * CancelInvoiceDialog shows a confirmation dialog with invoice details before cancellation.
 * Warns about irreversibility and shows key invoice information.
 */
export function CancelInvoiceDialog({
  invoice,
  open,
  loading = false,
  error,
  onConfirm,
  onCancel,
}: CancelInvoiceDialogProps) {
  if (!invoice) return null;

  const { metadata, terms, funding, status } = invoice;
  const isFunded = funding.totalRaised > 0;
  const canCancel =
    status === "pending_mint" || status === "draft" || (status === "listed" && funding.totalRaised === 0);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <DialogTitle>Cancel Invoice</DialogTitle>
          </div>
          <DialogDescription>
            This action cannot be undone. The invoice will be permanently cancelled.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
            {error}
          </div>
        )}

        <div className="space-y-4 py-4">
          {/* Invoice Details */}
          <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/30">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Debtor</p>
                <p className="font-semibold text-foreground">{metadata.debtorName}</p>
              </div>
              <Badge variant="outline">{status}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Invoice Amount</p>
                <p className="font-semibold text-foreground">
                  {formatCurrency(metadata.amount, metadata.currency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Financing Amount</p>
                <p className="font-semibold text-foreground">
                  {formatCurrency(terms.financingAmount, metadata.currency)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="font-semibold text-foreground">
                  {formatDate(metadata.dueDate)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Funded Amount</p>
                <p className={`font-semibold ${isFunded ? "text-amber-400" : "text-foreground"}`}>
                  {formatCurrency(funding.totalRaised, metadata.currency)}
                </p>
              </div>
            </div>
          </div>

          {/* Warning for partially funded */}
          {isFunded && (
            <div className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 border border-amber-500/20 dark:text-amber-400">
              <p className="font-semibold mb-1">⚠ Partially Funded</p>
              <p>
                This invoice has {formatCurrency(funding.totalRaised, metadata.currency)} in funding.
                Cancellation is not allowed for partially funded invoices.
              </p>
            </div>
          )}

          {/* Warning message */}
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
            <p className="font-semibold mb-1">⚠ Cancellation Effects</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Invoice will be marked as cancelled on-chain</li>
              <li>It will be removed from the marketplace</li>
              <li>Investors will be notified</li>
              <li>IPFS-pinned files will be cleaned up</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Keep Invoice
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={loading || isFunded || !canCancel}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cancelling...
              </>
            ) : (
              "Cancel Invoice"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
