"use client";

/**
 * StatusTransitionButtons — renders owner-only action buttons for valid invoice
 * status transitions and wires each button to the correct on-chain contract call.
 *
 * Routing logic (matches invoiceStateMachine contractMethod):
 *   "cancel"        → invoiceContract.cancelInvoice  (dedicated cancel endpoint)
 *   "repay"         → marketplaceContract.repayInvoice
 *   "update_status" → invoiceContract.updateStatus   (generic status bump)
 *
 * Guard order:
 *   1. Wallet not connected → all buttons disabled with tooltip
 *   2. Not the invoice owner → all buttons disabled with tooltip
 *   3. Transition not in state machine → button hidden (getAllowedTransitions)
 *
 * Destructive transitions (isDestructive=true) always open a confirmation dialog
 * before any on-chain call is fired. Non-destructive transitions confirm inline.
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  getAllowedTransitions,
  getBlockedReason,
  STATUS_TO_CHAIN_INDEX,
} from "@/lib/invoiceStateMachine";
import { useTransaction } from "@/hooks/useTransaction";
import { useTxSimulation } from "@/hooks/useTxSimulation";
import { TxSimulationPreview } from "@/components/invoice/TxSimulationPreview";
import { queryKeys } from "@/lib/queryKeys";
import { CancelInvoiceDialog } from "@/components/invoice/CancelInvoiceDialog";
import type { Invoice } from "@/types";
import type { InvoiceStatus } from "@/types/invoice";
import type { StatusTransition } from "@/lib/invoiceStateMachine";

// ─── Props ────────────────────────────────────────────────────────────────────

interface StatusTransitionButtonsProps {
  invoice: Invoice;
  /** Connected wallet address — null means wallet not connected. */
  walletAddress: string | null;
  /**
   * Optional callback fired after a transition is confirmed on-chain.
   * Receives the invoice and the new status so parents can refresh local state.
   */
  onSuccess?: (invoice: Invoice, newStatus: InvoiceStatus) => void;
  /** Legacy prop kept for backwards compat — prefer onSuccess. */
  onTransition?: (invoice: Invoice, to: InvoiceStatus) => Promise<void>;
  /** Set to true while a parent-managed async op is running. */
  isLoading?: boolean;
}

// ─── Inline confirm state (non-destructive transitions) ───────────────────────

interface InlineConfirm {
  transition: StatusTransition;
  invoice: Invoice;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StatusTransitionButtons({
  invoice,
  walletAddress,
  onSuccess,
  onTransition,
  isLoading: externalLoading = false,
}: StatusTransitionButtonsProps) {
  const t = useTranslations("statusTransition");
  const queryClient = useQueryClient();
  const { execute, status: txStatus } = useTransaction();
  const { simulationDialogProps, onSimulationPreview } = useTxSimulation();

  // Inline confirm dialog (non-destructive, e.g. "Mark as Funded")
  const [inlineConfirm, setInlineConfirm] = useState<InlineConfirm | null>(null);
  // Dedicated cancel dialog (destructive)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | undefined>();

  const isTxPending =
    txStatus === "signing" || txStatus === "submitting" || txStatus === "polling";
  const isDisabled = externalLoading || isTxPending;

  const isConnected = walletAddress !== null && walletAddress !== "";
  const isOwner = isConnected && walletAddress === invoice.ownerAddress;

  const transitions = getAllowedTransitions(invoice.status);
  if (transitions.length === 0) return null;

  // ── Core on-chain dispatcher ─────────────────────────────────────────────

  async function fireTransition(transition: StatusTransition) {
    if (!walletAddress) return;

    // Legacy callback path — lets parent pages that still use onTransition
    // continue to work without breaking.
    if (onTransition) {
      await onTransition(invoice, transition.to);
      return;
    }

    const tokenId = invoice.tokenId;

    await execute(
      async () => {
        switch (transition.contractMethod) {
          case "cancel": {
            const { invoiceContract } = await import("@/lib/stellar/contracts");
            return invoiceContract.cancelInvoice(BigInt(tokenId), walletAddress);
          }
          case "repay": {
            const { marketplaceContract } = await import("@/lib/stellar/contracts");
            return marketplaceContract.repayInvoice(
              { tokenId: BigInt(tokenId) },
              walletAddress
            );
          }
          case "update_status":
          default: {
            const chainIndex = STATUS_TO_CHAIN_INDEX[transition.to];
            if (chainIndex < 0) {
              throw new Error(`Status "${transition.to}" has no on-chain representation.`);
            }
            const { invoiceContract } = await import("@/lib/stellar/contracts");
            return invoiceContract.updateStatus(BigInt(tokenId), chainIndex, walletAddress);
          }
        }
      },
      {
        successMessage: `Invoice ${transition.to.replace(/_/g, " ")} successfully`,
        onSimulationPreview,
        onSuccess: () => {
          // Invalidate relevant TanStack Query caches so the UI refreshes
          queryClient.invalidateQueries({
            queryKey: queryKeys.invoices.byOwner(invoice.ownerAddress),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.invoices.detail(invoice.id),
          });
          onSuccess?.(invoice, transition.to);
        },
      }
    );
  }

  // ── Button click handler ─────────────────────────────────────────────────

  function handleClick(transition: StatusTransition) {
    if (transition.contractMethod === "cancel") {
      setCancelError(undefined);
      setCancelDialogOpen(true);
    } else {
      // Non-destructive: show inline confirm dialog
      setInlineConfirm({ transition, invoice });
    }
  }

  // ── Cancel dialog confirm ────────────────────────────────────────────────

  async function handleCancelConfirm() {
    const cancelTransition = transitions.find((t) => t.contractMethod === "cancel");
    if (!cancelTransition) return;
    setCancelError(undefined);
    try {
      await fireTransition(cancelTransition);
      setCancelDialogOpen(false);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Cancellation failed. Please try again.");
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <TooltipPrimitive.Provider delayDuration={200}>
        <div className="flex items-center gap-1.5">
          {transitions.map((tx) => {
            const blockedReason = getBlockedReason(
              invoice.status,
              tx.to,
              isOwner,
              isConnected
            );
            const isBlocked = blockedReason !== null;

            return (
              <TooltipPrimitive.Root key={tx.to}>
                <TooltipPrimitive.Trigger asChild>
                  <span className={isBlocked ? "cursor-not-allowed" : undefined}>
                    <Button
                      size="sm"
                      variant={tx.variant}
                      disabled={isBlocked || isDisabled}
                      onClick={() => handleClick(tx)}
                      aria-label={tx.label}
                      data-testid={`status-btn-${tx.to}`}
                    >
                      {isTxPending && inlineConfirm?.transition.to === tx.to
                        ? t("processing")
                        : tx.label}
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

      {/* ── Inline confirm dialog (non-destructive) ── */}
      <Dialog
        open={!!inlineConfirm}
        onOpenChange={(open) => {
          if (!open) setInlineConfirm(null);
        }}
      >
        {inlineConfirm && (
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {t("confirmTitle", { label: inlineConfirm.transition.label })}
              </DialogTitle>
              <DialogDescription>
                {inlineConfirm.transition.description}
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t("confirmBody", {
                invoiceNumber: inlineConfirm.invoice.metadata.invoiceNumber,
                from: inlineConfirm.invoice.status.replace(/_/g, " "),
                to: inlineConfirm.transition.to.replace(/_/g, " "),
              })}
            </p>
            <p className="text-xs text-muted-foreground">{t("onChainWarning")}</p>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setInlineConfirm(null)}
                disabled={isDisabled}
              >
                {t("goBack")}
              </Button>
              <Button
                variant={inlineConfirm.transition.variant}
                className="flex-1"
                disabled={isDisabled}
                data-testid="inline-confirm-btn"
                onClick={async () => {
                  await fireTransition(inlineConfirm.transition);
                  setInlineConfirm(null);
                }}
              >
                {isTxPending ? t("processing") : t("confirm")}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* ── Dedicated cancel dialog (destructive) ── */}
      <CancelInvoiceDialog
        invoice={invoice}
        open={cancelDialogOpen}
        loading={isTxPending}
        error={cancelError}
        onConfirm={handleCancelConfirm}
        onCancel={() => {
          setCancelDialogOpen(false);
          setCancelError(undefined);
        }}
      />

      {/* Transaction simulation preview */}
      <TxSimulationPreview {...simulationDialogProps} />
    </>
  );
}
