"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X, AlertTriangle, CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { useTransactionStore } from "@/store/transactionStore";
import { useSecondaryEscrowFlow } from "@/hooks/useTransaction";
import { cn } from "@/lib/utils";

/**
 * InProgressOverlay
 * Full-screen dimmed modal overlay shown during wallet signing step
 * and secondary market escrow flows.
 */
export function InProgressOverlay() {
  const { txState, setTxState } = useUIStore();
  const { escrowState, retryEscrow, resetEscrow } = useSecondaryEscrowFlow();
  const isSigningStage = txState.status === "signing";
  const isEscrowActive = escrowState.step !== "idle";
  const isOpen = isSigningStage || isEscrowActive;

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleCancel = () => {
    setTxState({ status: "idle" });
    resetEscrow();
  };

  const handleEscape = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
    }
  };

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      dialogRef.current?.focus();
    } else {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  const renderEscrowSteps = () => {
    const steps = [
      {
        id: "buyer_funding",
        label: "Buyer Deposit",
        desc: "Escrow funds locked in smart contract",
        active: escrowState.step === "buyer_funding",
        success: escrowState.step !== "idle" && escrowState.step !== "buyer_funding" && escrowState.step !== "failed" && !(escrowState.errorStep === "buyer_funding"),
        failed: escrowState.errorStep === "buyer_funding",
      },
      {
        id: "seller_transferring",
        label: "Seller Position Transfer",
        desc: "Seller signs over yield rights",
        active: escrowState.step === "seller_transferring",
        success: escrowState.step === "seller_transferred" || escrowState.step === "settled",
        failed: escrowState.errorStep === "seller_transferring",
      },
      {
        id: "settled",
        label: "Escrow Settlement Complete",
        desc: "Yield rights transferred to Buyer",
        active: false,
        success: escrowState.step === "settled",
        failed: false,
      },
    ];

    return (
      <div className="w-full space-y-4 my-2">
        {steps.map((s, index) => (
          <div
            key={s.id}
            className={cn(
              "flex gap-3 items-start p-3 rounded-lg border transition-colors",
              s.active
                ? "bg-primary/5 border-primary/20"
                : s.failed
                ? "bg-destructive/5 border-destructive/20"
                : s.success
                ? "bg-success/5 border-success/15"
                : "bg-muted/10 border-border/30 opacity-60"
            )}
          >
            <div className="mt-0.5">
              {s.active ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin text-primary" />
              ) : s.failed ? (
                <AlertTriangle className="h-4.5 w-4.5 text-destructive" />
              ) : s.success ? (
                <CheckCircle2 className="h-4.5 w-4.5 text-success" />
              ) : (
                <div className="h-4.5 w-4.5 rounded-full border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-500 font-bold">
                  {index + 1}
                </div>
              )}
            </div>
            <div className="space-y-0.5">
              <p className={cn("text-xs font-semibold", s.failed ? "text-destructive" : "text-zinc-200")}>
                {s.label}
              </p>
              <p className="text-[10px] text-muted-foreground">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="overlay"
          ref={dialogRef}
          tabIndex={-1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onKeyDown={handleEscape}
          role="dialog"
          aria-modal="true"
          aria-labelledby="overlay-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm focus:outline-none"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="relative flex flex-col items-center justify-center gap-6 rounded-2xl bg-card border border-border p-8 shadow-2xl max-w-sm w-full mx-4"
          >
            {isEscrowActive ? (
              // Escrow Flow Content
              <>
                <div className="flex flex-col items-center gap-2 text-center w-full">
                  <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-kora-muted text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h2 id="overlay-title" className="text-lg font-semibold text-zinc-200">
                    Escrow Settlement
                  </h2>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Secondary trade transaction in progress
                  </p>
                </div>

                {renderEscrowSteps()}

                {escrowState.errorMessage && (
                  <div className="w-full rounded-lg bg-destructive/10 border border-destructive/20 p-3 space-y-1">
                    <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" /> Transaction Failed
                    </p>
                    <p className="text-[10px] text-muted-foreground break-words leading-relaxed">
                      {escrowState.errorMessage}
                    </p>
                  </div>
                )}

                <div className="flex gap-3 w-full">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className={cn(
                      "flex-1 px-4 py-2.5 rounded-lg font-medium text-xs transition-all",
                      "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                      "border border-border/50 hover:border-border"
                    )}
                  >
                    {escrowState.step === "settled" ? "Close" : "Cancel"}
                  </button>

                  {escrowState.errorStep && (
                    <button
                      type="button"
                      onClick={() => retryEscrow("mock_pos", "mock_buyer", "mock_seller", 5000)}
                      className={cn(
                        "flex-1 px-4 py-2.5 rounded-lg font-medium text-xs transition-all",
                        "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/10",
                        "flex items-center justify-center gap-1"
                      )}
                    >
                      Retry Step <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </>
            ) : (
              // Standard Transaction signing Overlay Content
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="relative"
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/20 to-transparent blur-lg" />
                  <Loader2 className="h-12 w-12 text-primary relative z-10" />
                </motion.div>

                <div className="flex flex-col items-center gap-2 text-center">
                  <h2 id="overlay-title" className="text-lg font-semibold text-foreground">
                    Waiting for Signature
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Complete the signature request in your wallet extension or app
                  </p>
                </div>

                <div className="w-full rounded-lg bg-muted/50 border border-border/50 p-3 space-y-1.5">
                  <p className="text-xs font-medium text-foreground">Tips:</p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Check your wallet extension or app window</li>
                    <li>Review transaction details before approving</li>
                    <li>Keep this window open during signing</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={handleCancel}
                  aria-label="Cancel transaction signing"
                  className={cn(
                    "w-full px-4 py-2.5 rounded-lg font-medium text-sm transition-all",
                    "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                    "border border-border/50 hover:border-border",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50"
                  )}
                >
                  Cancel
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
