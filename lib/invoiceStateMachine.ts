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
 *
 * Allowed amendment states (#568):
 *   listed, partially_funded — may amend description + category (not amount/dueDate)
 *   fully_funded, active, repaid, defaulted, cancelled — amend blocked
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

/** Number of seconds the user has to undo a destructive transition. */
export const DESTRUCTIVE_TRANSITION_UNDO_SECONDS = 5;

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
 * Stable support codes for blocked invoice transitions.
 *
 * These codes are surfaced to users (and included in support toasts) so that
 * support agents can identify the exact failure without guessing. They are
 * part of the public contract — do not rename without a migration.
 */
export const INVOICE_TRANSITION_ERROR_CODES = {
  /** Wallet is not connected. */
  WALLET_NOT_CONNECTED: "INV_WALLET_NOT_CONNECTED",
  /** Caller is not the invoice owner. */
  NOT_OWNER: "INV_NOT_OWNER",
  /** Transition is not part of the state machine. */
  ILLEGAL_TRANSITION: "INV_ILLEGAL_TRANSITION",
} as const;

export type InvoiceTransitionErrorCode =
  (typeof INVOICE_TRANSITION_ERROR_CODES)[keyof typeof INVOICE_TRANSITION_ERROR_CODES];

/** Result of evaluating whether a transition is blocked. */
export interface BlockedTransitionResult {
  /** Stable support code identifying the failure. */
  code: InvoiceTransitionErrorCode;
  /** Human-readable reason (English fallback; UI should localize via `code`). */
  reason: string;
}

/**
 * Returns the stable support code + human-readable reason why a transition is
 * blocked, or `null` when the transition is allowed.
 *
 * Checks (in order):
 *  1. Wallet not connected
 *  2. Caller is not the invoice owner
 *  3. Transition not in the state machine
 */
export function getBlockedTransition(
  from: InvoiceStatus,
  to: InvoiceStatus,
  isOwner: boolean,
  walletConnected = true
): BlockedTransitionResult | null {
  if (!walletConnected) {
    return {
      code: INVOICE_TRANSITION_ERROR_CODES.WALLET_NOT_CONNECTED,
      reason: "Connect your wallet to manage invoice status.",
    };
  }
  if (!isOwner) {
    return {
      code: INVOICE_TRANSITION_ERROR_CODES.NOT_OWNER,
      reason: "Only the invoice owner can trigger status changes.",
    };
  }
  if (!isValidTransition(from, to)) {
    return {
      code: INVOICE_TRANSITION_ERROR_CODES.ILLEGAL_TRANSITION,
      reason: `Cannot transition from "${from.replace(/_/g, " ")}" to "${to.replace(/_/g, " ")}".`,
    };
  }
  return null;
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
  return getBlockedTransition(from, to, isOwner, walletConnected)?.reason ?? null;
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

// ─── UI CTA guards (#1163) ───────────────────────────────────────────────────

/**
 * A CTA rendered in the invoice UI. Each CTA maps to exactly one target
 * status; the guard below decides whether it may be clicked.
 */
export type InvoiceCta = "mark_funded" | "mark_repaid" | "cancel";

/** Maps each CTA to the target status it would request on-chain. */
export const CTA_TARGET_STATUS: Record<InvoiceCta, InvoiceStatus> = {
  mark_funded: "fully_funded",
  mark_repaid: "repaid",
  cancel: "cancelled",
};

export interface CtaGuardResult {
  /** Whether the CTA may be clicked. */
  enabled: boolean;
  /** Whether the CTA should be rendered at all. */
  visible: boolean;
  /** Reason the CTA is disabled, or null when enabled. */
  reason: string | null;
}

/**
 * Resolves whether a CTA is enabled/visible for the given invoice status.
 *
 * Guards against illegal transitions and stale indexer status: when the
 * caller passes the last-known on-chain status via `onChainStatus`, the
 * guard uses that authoritative value instead of the possibly-stale
 * `displayStatus` from the indexer.
 */
export function getCtaGuard(
  cta: InvoiceCta,
  displayStatus: InvoiceStatus,
  options: {
    isOwner?: boolean;
    walletConnected?: boolean;
    /** Authoritative on-chain status, if known. Overrides displayStatus. */
    onChainStatus?: InvoiceStatus | null;
  } = {}
): CtaGuardResult {
  const { isOwner = true, walletConnected = true, onChainStatus = null } = options;
  const status = onChainStatus ?? displayStatus;
  const target = CTA_TARGET_STATUS[cta];

  // Hide CTAs that are not part of the state machine for this status at all.
  if (!isValidTransition(status, target)) {
    return { enabled: false, visible: false, reason: null };
  }

  const reason = getBlockedReason(status, target, isOwner, walletConnected);
  return { enabled: reason === null, visible: true, reason };
}

// ─── Amendment eligibility (#568) ────────────────────────────────────────────

/**
 * Statuses in which an SME may propose a metadata amendment.
 *
 * Only pre-funding statuses are eligible — once investors have committed
 * capital the financial terms cannot change, and funded/repaid/cancelled
 * invoices are immutable.
 */
export const AMENDMENT_ELIGIBLE_STATUSES: ReadonlySet<InvoiceStatus> = new Set<InvoiceStatus>([
  "listed",
  "partially_funded",
]);

/**
 * Fields that an SME is permitted to amend post-listing.
 *
 * Financial terms (amount, discountRate, dueDate) and identity fields
 * (invoiceNumber, issuerAddress) are locked once the invoice is listed
 * to protect investors who have reviewed those terms.
 */
export const AMENDABLE_FIELDS = ["description", "category"] as const;
export type AmendableField = (typeof AMENDABLE_FIELDS)[number];

/** Amendments the user can propose — a partial record of amendable fields. */
export type InvoiceAmendment = Partial<Record<AmendableField, string>>;

/**
 * Returns `true` when the invoice is in a state that allows metadata amendment.
 */
export function canAmend(status: InvoiceStatus): boolean {
  return AMENDMENT_ELIGIBLE_STATUSES.has(status);
}

/**
 * Returns a human-readable reason why amendment is blocked, or `null` when
 * amendment is allowed.
 */
export function getAmendBlockedReason(
  status: InvoiceStatus,
  isOwner: boolean,
  walletConnected = true
): string | null {
  if (!walletConnected) {
    return "Connect your wallet to amend this invoice.";
  }
  if (!isOwner) {
    return "Only the invoice owner can amend metadata.";
  }
  if (!canAmend(status)) {
    const label = status.replace(/_/g, " ");
    return `Amendments are not allowed for invoices with status "${label}". Only listed or partially funded invoices may be amended.`;
  }
  return null;
}
