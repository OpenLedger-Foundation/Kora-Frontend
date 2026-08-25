"use client";

/**
 * CancelInvoiceDialog — dedicated destructive-action confirmation dialog for
 * invoice cancellation.
 *
 * Behaviour:
 *  - Always shows full invoice details so the user knows exactly what they're
 *    cancelling.
 *  - If the invoice has any funded amount, warns that on-chain refunds will be
 *    triggered (partially_funded cancels ARE allowed on-chain).
 *  - The confirm button is disabled only while a tx is in-flight (loading=true).
 *    Owner-mismatch and invalid-state guards live in StatusTransitionButtons —
 *    this dialog is only opened when those guards have already passed.
 *  - Surfaces any on-chain error returned by the caller via the `error` prop.
 */

import React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
import type { Invoice, CancellationReason } from "@/types";
import { useFormatters } from "@/hooks/useFormatters";

interface CancelInvoiceDialogProps {
  invoice: Invoice | null;
  open: boolean;
  /** True while the on-chain cancel tx is in-flight. */
  loading?: boolean;
  /** On-chain or service error message to surface inside the dialog. */
  error?: string;
  onConfirm: (reason: CancellationReason, notes?: string) => void;
  onCancel: () => void;
}

const CANCELLATION_REASONS: CancellationReason[] = [
  "duplicate_invoice",
  "debtor_paid_directly",
  "terms_renegotiated",
  "incorrect_amount",
  "other",
];

export function CancelInvoiceDialog({
  invoice,
  open,
  loading = false,
  error,
  onConfirm,
  onCancel,
}: CancelInvoiceDialogProps) {
  const t = useTranslations("cancelDialog");
  const { formatCurrency, formatDate } = useFormatters();

  const [selectedReason, setSelectedReason] = React.useState<CancellationReason | "">("");
  const [notes, setNotes] = React.useState<string>("");
  const [validationError, setValidationError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setSelectedReason("");
      setNotes("");
      setValidationError(null);
    }
  }, [open]);

  if (!invoice) return null;

  const { metadata, terms, funding, status } = invoice;
  const isFunded = funding.totalRaised > 0;

  const handleConfirmClick = () => {
    if (!selectedReason) {
      setValidationError(t("reasonRequired"));
      return;
    }
    setValidationError(null);
    onConfirm(selectedReason as CancellationReason, notes.trim() || undefined);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" aria-hidden="true" />
            <DialogTitle>{t("title")}</DialogTitle>
          </div>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {/* On-chain / service / validation error */}
        {(error || validationError) && (
          <div
            role="alert"
            className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20"
          >
            {error || validationError}
          </div>
        )}

        <div className="space-y-4 py-4">
          {/* Invoice summary */}
          <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/30">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("fields.debtor")}</p>
                <p className="font-semibold text-foreground">{metadata.debtorName}</p>
              </div>
              <Badge variant="outline">{status.replace(/_/g, " ")}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t("fields.invoiceAmount")}</p>
                <p className="font-semibold text-foreground">
                  {formatCurrency(metadata.amount, metadata.currency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("fields.financingAmount")}</p>
                <p className="font-semibold text-foreground">
                  {formatCurrency(terms.financingAmount, metadata.currency)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t("fields.dueDate")}</p>
                <p className="font-semibold text-foreground">
                  {formatDate(metadata.dueDate)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("fields.fundedAmount")}</p>
                <p
                  className={`font-semibold ${
                    isFunded ? "text-amber-400" : "text-foreground"
                  }`}
                >
                  {formatCurrency(funding.totalRaised, metadata.currency)}
                </p>
              </div>
            </div>
          </div>

          {/* Cancellation Reason Dropdown (Required) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>{t("reasonLabel")} *</span>
            </label>
            <select
              value={selectedReason}
              onChange={(e) => {
                setSelectedReason(e.target.value as CancellationReason);
                if (e.target.value) setValidationError(null);
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="cancel-reason-select"
            >
              <option value="" disabled>
                -- {t("selectReasonPlaceholder")} --
              </option>
              {CANCELLATION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`reasons.${r}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Additional Notes (Optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t("notesLabel")}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notesPlaceholder")}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              data-testid="cancel-notes-input"
            />
          </div>

          {/* Live mode on-chain limitation note */}
          <p className="text-[11px] text-muted-foreground italic">
            {t("liveNote")}
          </p>

          {/* Partial-funding warning */}
          {isFunded && (
            <div className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 border border-amber-500/20 dark:text-amber-400">
              <p className="font-semibold mb-1">⚠ {t("partiallyFunded")}</p>
              <p>
                {t("partiallyFundedDesc", {
                  amount: formatCurrency(funding.totalRaised, metadata.currency),
                })}
              </p>
            </div>
          )}

          {/* Consequences list */}
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
            <p className="font-semibold mb-1">⚠ {t("effectsTitle")}</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>{t("effects.markedOnChain")}</li>
              <li>{t("effects.removedMarketplace")}</li>
              <li>{t("effects.investorsNotified")}</li>
              <li>{t("effects.ipfsCleanup")}</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {t("keepInvoice")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmClick}
            disabled={loading || !selectedReason}
            data-testid="cancel-invoice-confirm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                {t("cancelling")}
              </>
            ) : (
              t("cancelInvoice")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
