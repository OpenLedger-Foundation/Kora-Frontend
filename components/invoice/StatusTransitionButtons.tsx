"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { getAllowedTransitions, getBlockedReason } from "@/lib/invoiceStateMachine";
import type { Invoice } from "@/types";
import type { InvoiceStatus } from "@/types/invoice";
import type { StatusTransition } from "@/lib/invoiceStateMachine";

interface StatusTransitionButtonsProps {
  invoice: Invoice;
  walletAddress: string | null;
  onTransition: (invoice: Invoice, to: InvoiceStatus) => Promise<void>;
  isLoading: boolean;
}

interface ConfirmState {
  transition: StatusTransition;
  invoice: Invoice;
}

export function StatusTransitionButtons({
  invoice,
  walletAddress,
  onTransition,
  isLoading,
}: StatusTransitionButtonsProps) {
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const transitions = getAllowedTransitions(invoice.status);
  if (transitions.length === 0) return null;

  const isOwner = !!walletAddress && walletAddress === invoice.ownerAddress;

  return (
    <>
      <TooltipPrimitive.Provider delayDuration={200}>
        <div className="flex items-center gap-1.5">
          {transitions.map((t) => {
            const blockedReason = getBlockedReason(invoice.status, t.to, isOwner);
            const isBlocked = blockedReason !== null;

            return (
              <TooltipPrimitive.Root key={t.to}>
                <TooltipPrimitive.Trigger asChild>
                  {/* Wrap in span so tooltip works even when button is disabled */}
                  <span className={isBlocked ? "cursor-not-allowed" : undefined}>
                    <Button
                      size="sm"
                      variant={t.variant}
                      disabled={isBlocked || isLoading}
                      onClick={() => setConfirm({ transition: t, invoice })}
                      aria-label={t.label}
                    >
                      {t.label}
                    </Button>
                  </span>
                </TooltipPrimitive.Trigger>
                {isBlocked && (
                  <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                      sideOffset={6}
                      className="z-50 max-w-xs rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md"
                    >
                      {blockedReason}
                      <TooltipPrimitive.Arrow className="fill-popover" />
                    </TooltipPrimitive.Content>
                  </TooltipPrimitive.Portal>
                )}
              </TooltipPrimitive.Root>
            );
          })}
        </div>
      </TooltipPrimitive.Provider>

      {/* Confirmation dialog */}
      <Dialog
        open={!!confirm}
        onOpenChange={(open) => { if (!open) setConfirm(null); }}
      >
        {confirm && (
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Confirm: {confirm.transition.label}</DialogTitle>
              <DialogDescription>
                {confirm.transition.description}
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Invoice <span className="font-medium text-foreground">{confirm.invoice.metadata.invoiceNumber}</span>
              {" "}will be moved from{" "}
              <span className="font-medium text-foreground capitalize">{confirm.invoice.status.replace(/_/g, " ")}</span>
              {" "}to{" "}
              <span className="font-medium text-foreground capitalize">{confirm.transition.to.replace(/_/g, " ")}</span>.
            </p>
            <p className="text-xs text-muted-foreground">This action is recorded on-chain and cannot be reversed.</p>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirm(null)}
                disabled={isLoading}
              >
                Go back
              </Button>
              <Button
                variant={confirm.transition.variant}
                className="flex-1"
                disabled={isLoading}
                onClick={async () => {
                  await onTransition(confirm.invoice, confirm.transition.to);
                  setConfirm(null);
                }}
              >
                {isLoading ? "Processing…" : "Confirm"}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
