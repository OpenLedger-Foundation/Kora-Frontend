/**
 * Invoice status state machine.
 *
 * On-chain enum indices (must match the Soroban contract):
 *   0 = pending_mint
 *   1 = listed        (UI: "Active")
 *   2 = partially_funded
 *   3 = fully_funded  (UI: "Funded")
 *   4 = active
 *   5 = repaid
 *   6 = defaulted
 *   7 = cancelled
 *
 * Allowed SME-triggered transitions (owner-only):
 *   listed        → fully_funded  ("Mark as Funded")
 *   partially_funded → fully_funded ("Mark as Funded")
 *   fully_funded  → repaid        ("Mark as Repaid")
 *   active        → repaid        ("Mark as Repaid")
 *   listed        → cancelled     ("Cancel Invoice")
 *   partially_funded → cancelled  ("Cancel Invoice")
 */

import type { InvoiceStatus } from "@/types/invoice";

// ─── On-chain enum index map ──────────────────────────────────────────────────

export const STATUS_TO_CHAIN_INDEX: Record<InvoiceStatus, number> = {
  draft: -1, // not a real on-chain state
  pending_mint: 0,
  listed: 1,
  partially_funded: 2,
  fully_funded: 3,
  active: 4,
  repaid: 5,
  defaulted: 6,
  cancelled: 7,
};

// ─── Transition definition ────────────────────────────────────────────────────

/**
 * Which contract method to call for this transition.
 * - "cancel"        → invoiceContract.cancelInvoice
 * - "update_status" → invoiceContract.updateStatus (generic)
 * - "repay"         → marketplaceContract.repayInvoice
 */
export type TransitionContractMethod = "cancel" | "update_status" | "repay";

export interface StatusTransition {
  /** The target status after this transition. */
  to: InvoiceStatus;
  /** Short label for the action button. */
  label: string;
  /** Variant used on the Button component. */
  variant: "default" | "destructive" | "outline";
  /** Human-readable description shown in tooltips and confirmation dialogs. */
  description: string;
  /**
   * Whether this transition is destructive and requires an explicit
   * confirmation dialog before firing any on-chain call.
   */
  isDestructive: boolean;
  /**
   * The contract method to invoke for this transition.
   * StatusTransitionButtons uses this to route the call correctly.
   */
  contractMethod: TransitionContractMethod;
}

/**
 * Defines the valid transitions an SME (owner) can trigger from each status.
 * Any transition not listed here is blocked client-side.
 */
const TRANSITIONS: Partial<Record<InvoiceStatus, StatusTransition[]>> = {
  listed: [
    {
      to: "fully_funded",
      label: "Mark as Funded",
      variant: "default",
      description: "Marks this invoice as fully funded. Investors will be notified.",
      isDestructive: false,
      contractMethod: "update_status",
    },
    {
      to: "cancelled",
      label: "Cancel Invoice",
      variant: "destructive",
      description: "Permanently cancels this invoice. Any invested amounts will be refunded.",
      isDestructive: true,
      contractMethod: "cancel",
    },
  ],
  partially_funded: [
    {
      to: "fully_funded",
      label: "Mark as Funded",
      variant: "default",
      description: "Marks this invoice as fully funded. Investors will be notified.",
      isDestructive: false,
      contractMethod: "update_status",
    },
    {
      to: "cancelled",
      label: "Cancel Invoice",
      variant: "destructive",
      description:
        "Permanently cancels this invoice. Existing investor positions will be refunded on-chain.",
      isDestructive: true,
      contractMethod: "cancel",
    },
  ],
  fully_funded: [
    {
      to: "repaid",
      label: "Mark as Repaid",
      variant: "default",
      description: "Marks repayment complete and triggers yield distribution to investors.",
      isDestructive: false,
      contractMethod: "repay",
    },
  ],
  active: [
    {
      to: "repaid",
      label: "Mark as Repaid",
      variant: "default",
      description: "Marks repayment complete and triggers yield distribution to investors.",
      isDestructive: false,
      contractMethod: "repay",
    },
  ],
};

/**
 * Returns the list of allowed transitions from a given status.
 * Terminal states (repaid, defaulted, cancelled, pending_mint, draft) return [].
 */
export function getAllowedTransitions(from: InvoiceStatus): StatusTransition[] {
  return TRANSITIONS[from] ?? [];
}

/**
 * Returns true if the transition from → to is valid per the state machine.
 */
export function isValidTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return getAllowedTransitions(from).some((t) => t.to === to);
}

/**
 * Returns a specific transition definition if it exists, otherwise null.
 */
export function getTransition(
  from: InvoiceStatus,
  to: InvoiceStatus
): StatusTransition | null {
  return getAllowedTransitions(from).find((t) => t.to === to) ?? null;
}

/**
 * Returns a human-readable reason why a transition is blocked.
 * Returns null when the transition is allowed.
 *
 * Checks (in order):
 *  1. Wallet not connected
 *  2. Caller is not the invoice owner
 *  3. Transition not in the state machine
 */
export function getBlockedReason(
  from: InvoiceStatus,
  to: InvoiceStatus,
  isOwner: boolean,
  walletConnected = true
): string | null {
  if (!walletConnected) {
    return "Connect your wallet to manage invoice status.";
  }
  if (!isOwner) {
    return "Only the invoice owner can trigger status changes.";
  }
  if (!isValidTransition(from, to)) {
    return `Cannot transition from "${from.replace(/_/g, " ")}" to "${to.replace(/_/g, " ")}".`;
  }
  return null;
}

/**
 * Returns the set of terminal statuses where no further transitions are possible.
 */
export const TERMINAL_STATUSES: ReadonlySet<InvoiceStatus> = new Set([
  "repaid",
  "defaulted",
  "cancelled",
  "draft",
  "pending_mint",
]);

export function isTerminalStatus(status: InvoiceStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
