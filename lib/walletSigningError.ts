/**
 * Wallet signing-error classification (issue #1121).
 *
 * `walletKit.signTx()` rejects with whatever string the provider felt like
 * sending — Freighter, xBull, LOBSTR and Albedo all word the same failure
 * differently, and the wording is not stable across versions. Before this
 * module every one of those rejections landed in the same generic
 * "Transaction failed" toast, so a user who merely closed the popup was told
 * their transaction had failed when nothing had been submitted at all.
 *
 * The classifier turns that noise into one of five kinds so the caller can
 * choose the right recovery:
 *
 *  - `rejected`           the user explicitly declined the request — do not
 *                         re-prompt, the choice was deliberate
 *  - `interrupted`        the request never got an answer (popup closed,
 *                         timeout, no response) — the transaction was NOT
 *                         signed or submitted, so it is safe to re-sign the
 *                         same unsigned XDR
 *  - `missing-extension`  the wallet software is not there — tell the user to
 *                         install it rather than retrying
 *  - `disconnected`       the session/wallet is present but not connected to
 *                         this account — reconnection, not re-signing, is the
 *                         fix
 *  - `unknown`            anything else — keep the original message
 *
 * This module is deliberately dependency-free (no React, no wallet kit) so it
 * can be imported from both `hooks/useWallet.ts` and `hooks/useTransaction.ts`
 * without dragging the wallet kit into either import graph.
 */

export type SigningErrorKind =
  | "rejected"
  | "interrupted"
  | "missing-extension"
  | "disconnected"
  | "unknown";

/** Error type thrown/wrapped by the wallet layer once a kind is known. */
export class WalletSigningError extends Error {
  readonly kind: SigningErrorKind;

  constructor(kind: SigningErrorKind, message?: string, options?: { cause?: unknown }) {
    super(message ?? kind, options);
    this.name = "WalletSigningError";
    this.kind = kind;
  }
}

/**
 * Ordered rules — first match wins.
 *
 * Order matters:
 *  - `rejected` runs first so an explicit "user rejected the popup" is never
 *    mistaken for an interruption (that would nag a user who said no).
 *  - `interrupted` before the rest so "the popup was closed" — the recoverable
 *    case this issue exists for — always wins.
 *  - `disconnected` before `missing-extension`: both mention the wallet not
 *    being usable, and "Wallet not connected" must not be read as "the
 *    extension is not installed".
 */
const RULES: Array<[SigningErrorKind, RegExp]> = [
  [
    "rejected",
    /\b(reject|rejected|declin(e|ed)|denied|refus(e|ed)|cancel(led|ed)?|abort(ed)? by user|user (action )?(stopped|aborted))\b|code[:\s-]*4001|"4001"/i,
  ],
  // Written as one literal rather than concatenated fragments: a RegExp joined
  // with strings coerces to a string, which would silently drop the pattern.
  [
    "interrupted",
    /\b(popup|window|dialog|prompt|request|modal)\b[^.]{0,40}\b(clos|dismiss|shut|terminat|interrupt|no response|not respond(ed|ing)?|timed?[- ]?out|expire)|\b(clos|dismiss)(ed|ing)?\b[^.]{0,30}\b(popup|window|dialog|prompt|modal)|\b(timeout|timed out|time out|no response|not respond(ed|ing)?|interrupted|connection (lost|closed|reset)|aborted|terminated|end of file|network error)\b/i,
  ],
  [
    "disconnected",
    /\b(not connected|connect(ion)? (failed|error|refused)|unauthorized|not authorized|no public key|account (is )?not (connected|selected|authorized)|wrong network|different (stellar )?network|session (expired|invalid|inactive)|not authenticated|reconnect)\b/i,
  ],
  [
    "missing-extension",
    /\b(not (yet )?installed|install the|no wallet|wallet (is )?(not|unavailable|missing)|extension (is )?(not|missing)|not available|could not find|cannot find|not found|is not defined|undefined is not|module not found|not supported|unsupported wallet)\b/i,
  ],
];

function messageOf(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const { message, code, error: inner } = error as {
      message?: unknown;
      code?: unknown;
      error?: unknown;
    };
    const parts = [
      typeof message === "string" ? message : "",
      typeof code === "string" || typeof code === "number" ? `code ${String(code)}` : "",
    ];
    if (inner) parts.push(messageOf(inner));
    const text = parts.filter(Boolean).join(" ");
    if (text) return text;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error ?? "");
}

/**
 * Map a wallet rejection onto a recovery kind.
 *
 * Pure and total: never throws, always returns a kind, and an unknown value
 * degrades to `"unknown"` rather than guessing.
 */
export function classifySigningError(error: unknown): SigningErrorKind {
  // Already classified upstream (e.g. re-thrown from a nested call).
  if (error instanceof WalletSigningError) return error.kind;

  // EIP-1193 style user-rejection code.
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 4001 || code === "4001") return "rejected";

  // A cancelled AbortController is an interruption, not a refusal.
  if (error instanceof Error && error.name === "AbortError") return "interrupted";

  const message = messageOf(error);
  if (!message.trim()) return "unknown";

  for (const [kind, pattern] of RULES) {
    if (pattern.test(message)) return kind;
  }
  return "unknown";
}

/** Convenience guard — `catch` blocks rarely need the kind itself. */
export function isInterruptedSigningError(error: unknown): boolean {
  return classifySigningError(error) === "interrupted";
}
