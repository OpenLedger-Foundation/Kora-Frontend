/**
 * Debtor Privacy & Masking Helpers — Issue #562
 *
 * Provides centralized privacy enforcement across marketplace cards, list rows,
 * comparison views, and screen reader announcements.
 *
 * Privacy Levels:
 * - "anonymized": Protects all debtor PII. Shows industry category moniker and jurisdiction (e.g. "Technology Company, Kenya").
 * - "partial": Displays debtor legal name, but masks street address (e.g. "Address hidden · Kenya").
 * - "full": Displays full debtor company name and street address.
 *
 * Post-Fund Reveal:
 * - Once an investor funds an invoice (`isFunded = true`), effective privacy elevates to "full" to allow legitimate contract verification.
 */

import type { Invoice, InvoiceJurisdiction, InvoiceCategory, DebtorPrivacyLevel } from "@/types/invoice";

export const JURISDICTION_NAMES: Record<InvoiceJurisdiction, string> = {
  US: "United States",
  EU: "European Union",
  UK: "United Kingdom",
  NG: "Nigeria",
  KE: "Kenya",
  GH: "Ghana",
  ZA: "South Africa",
  OTHER: "International",
};

export const CATEGORY_DESCRIPTORS: Record<InvoiceCategory, string> = {
  technology: "Technology Company",
  manufacturing: "Manufacturing Company",
  logistics: "Logistics Company",
  healthcare: "Healthcare Provider",
  retail: "Retail Company",
  construction: "Construction Company",
  agriculture: "Agribusiness",
  energy: "Energy Provider",
  finance: "Financial Services",
  other: "Commercial Enterprise",
};

/**
 * Resolves effective privacy level taking post-funding reveal into account.
 */
export function getEffectiveDebtorPrivacy(
  invoice: Partial<Invoice>,
  isFunded = false
): DebtorPrivacyLevel {
  if (isFunded) return "full";
  return invoice.debtorPrivacy || "anonymized";
}

/**
 * Returns privacy-safe debtor display name.
 * Under "anonymized", returns generic industry moniker without leaking raw company name.
 */
export function getMaskedDebtorName(
  invoice: Partial<Invoice>,
  isFunded = false
): string {
  const effectivePrivacy = getEffectiveDebtorPrivacy(invoice, isFunded);
  const metadata = invoice.metadata;

  if (effectivePrivacy === "anonymized" || !metadata) {
    const category = (metadata?.category as InvoiceCategory) || "other";
    const jurisdiction = (metadata?.jurisdiction as InvoiceJurisdiction) || "OTHER";
    const categoryDesc = CATEGORY_DESCRIPTORS[category] || "Commercial Enterprise";
    const jurisdictionName = JURISDICTION_NAMES[jurisdiction] || jurisdiction;
    return `${categoryDesc} (${jurisdictionName})`;
  }

  return metadata.debtorName || "Debtor";
}

/**
 * Returns privacy-safe debtor address line.
 */
export function getMaskedDebtorAddress(
  invoice: Partial<Invoice>,
  isFunded = false
): string {
  const effectivePrivacy = getEffectiveDebtorPrivacy(invoice, isFunded);
  const metadata = invoice.metadata;

  if (!metadata) return "";

  if (effectivePrivacy === "full") {
    return metadata.debtorAddress || "";
  }

  if (effectivePrivacy === "partial") {
    const jurisdiction = (metadata.jurisdiction as InvoiceJurisdiction) || "OTHER";
    const country = JURISDICTION_NAMES[jurisdiction] || jurisdiction;
    return `Address hidden · ${country}`;
  }

  return "Identity anonymized for privacy";
}

/**
 * Returns privacy-safe ARIA label string for cards and comparisons.
 */
export function getDebtorAriaLabel(
  invoice: Partial<Invoice>,
  isFunded = false
): string {
  const effectivePrivacy = getEffectiveDebtorPrivacy(invoice, isFunded);
  const maskedName = getMaskedDebtorName(invoice, isFunded);

  if (effectivePrivacy === "full") {
    return `Debtor: ${maskedName} (Full disclosure)`;
  }
  if (effectivePrivacy === "partial") {
    return `Debtor: ${maskedName} (Partial disclosure)`;
  }
  return `Debtor: ${maskedName} (Anonymized for privacy)`;
}

/**
 * Print redaction rules (#1182).
 *
 * Paper and saved PDFs leave the app's access controls behind, so printing
 * never reveals more than "partial", whatever the screen shows:
 *  - the post-funding "full" reveal does NOT apply to print;
 *  - a declared "full" invoice prints as "partial" (name, no street address);
 *  - "anonymized" stays anonymized.
 */
export function getPrintDebtorPrivacy(invoice: Partial<Invoice>): DebtorPrivacyLevel {
  return getEffectiveDebtorPrivacy(invoice, false) === "anonymized" ? "anonymized" : "partial";
}

/** Debtor name safe for print output. */
export function getPrintDebtorName(invoice: Partial<Invoice>): string {
  return getMaskedDebtorName({ ...invoice, debtorPrivacy: getPrintDebtorPrivacy(invoice) }, false);
}

/** Debtor address line safe for print output — never a street address. */
export function getPrintDebtorAddress(invoice: Partial<Invoice>): string {
  return getMaskedDebtorAddress({ ...invoice, debtorPrivacy: getPrintDebtorPrivacy(invoice) }, false);
}

/**
 * Stellar account (G…), contract (C…) and muxed (M…) strkeys. Muxed
 * addresses are 69 characters; accounts and contracts are 56.
 */
const STELLAR_ADDRESS_RE = /\b[GCM][A-Z2-7]{55}(?:[A-Z2-7]{13})?\b/g;

/** True when `text` contains a full Stellar address. */
export function containsStellarAddress(text: string | null | undefined): boolean {
  if (!text) return false;
  STELLAR_ADDRESS_RE.lastIndex = 0;
  return STELLAR_ADDRESS_RE.test(text);
}

/**
 * Replace every full Stellar address in `text` with a truncated form
 * (`GABC…WXYZ`) so free text shown or stored on a shared machine — command
 * palette recents (#1181), printouts (#1182) — never carries a full address.
 */
export function redactStellarAddresses(text: string, chars = 4): string {
  if (!text) return "";
  return text.replace(
    STELLAR_ADDRESS_RE,
    (address) => `${address.slice(0, chars)}…${address.slice(-chars)}`
  );
}

/**
 * Masking validation helpers
 */
export function isDebtorAnonymized(invoice: Partial<Invoice>, isFunded = false): boolean {
  return getEffectiveDebtorPrivacy(invoice, isFunded) === "anonymized";
}

export function isDebtorPartial(invoice: Partial<Invoice>, isFunded = false): boolean {
  return getEffectiveDebtorPrivacy(invoice, isFunded) === "partial";
}

export function isDebtorFull(invoice: Partial<Invoice>, isFunded = false): boolean {
  return getEffectiveDebtorPrivacy(invoice, isFunded) === "full";
}
