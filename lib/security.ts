/**
 * Security utilities: XSS prevention, URL validation, input sanitization.
 */

// ─── HTML Sanitization ────────────────────────────────────────────────────────

/**
 * Sanitize an HTML string with DOMPurify (browser-only).
 * Returns an empty string on the server.
 */
export function sanitizeHtml(dirty: string): string {
  if (typeof window === "undefined") return "";
  // Dynamic import is not possible in a sync context; DOMPurify is browser-only.
  // eslint-disable-next-line
  const DOMPurify = require("dompurify");
  return DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } });
}

// ─── URL Validation ───────────────────────────────────────────────────────────

const ALLOWED_EXTERNAL_ORIGINS = new Set([
  "https://stellar.expert",
  "https://gateway.pinata.cloud",
  "https://ipfs.io",
  "https://cloudflare-ipfs.com",
]);

/**
 * Returns true if the URL is same-origin (safe for internal navigation).
 */
export function isSameOrigin(url: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Validates a redirect target is same-origin. Returns "/" on failure.
 */
export function safeRedirectUrl(url: string): string {
  if (!url || !isSameOrigin(url)) return "/";
  return url;
}

/**
 * Validates an external href is from an allowed origin.
 * Returns "#" if not allowed.
 */
export function safeExternalUrl(url: string | undefined | null): string {
  if (!url) return "#";
  try {
    const parsed = new URL(url);
    // Allow same-origin
    if (typeof window !== "undefined" && parsed.origin === window.location.origin) return url;
    // Allow known safe external origins
    for (const allowed of ALLOWED_EXTERNAL_ORIGINS) {
      if (url.startsWith(allowed)) return url;
    }
    return "#";
  } catch {
    return "#";
  }
}

/**
 * Builds a safe IPFS gateway URL from a CID.
 * Validates the CID contains only alphanumeric chars and allowed IPFS chars.
 */
export function safeIpfsUrl(cid: string | undefined | null, gateway?: string): string {
  if (!cid) return "#";
  // IPFS CIDs: base58 (v0) or base32 (v1) — alphanumeric + limited punctuation
  if (!/^[a-zA-Z0-9+/=_-]{10,100}$/.test(cid)) return "#";
  const gw = gateway || "https://gateway.pinata.cloud/ipfs";
  return `${gw}/${cid}`;
}

// ─── Route Param Validation ───────────────────────────────────────────────────

/**
 * Validates a route param (e.g. invoice id) is safe alphanumeric + hyphens.
 * Returns null if invalid.
 */
export function validateRouteId(id: string | undefined | null): string | null {
  if (!id) return null;
  if (/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return id;
  return null;
}

/**
 * Validates a search/filter query string param — strips anything non-printable.
 */
export function sanitizeQueryParam(value: string | undefined | null): string {
  if (!value) return "";
  // Remove control characters and limit length
  return value.replace(/[^\x20-\x7E]/g, "").slice(0, 256);
}

// ─── IPFS Metadata Sanitization ───────────────────────────────────────────────

const ALLOWED_STRING_KEYS = new Set([
  "name", "description", "image", "invoiceNumber", "issuerAddress",
  "debtorName", "debtorAddress", "currency", "issueDate", "dueDate",
  "jurisdiction", "category", "documentHash", "documentUrl",
]);

const ALLOWED_NUMBER_KEYS = new Set(["amount", "apr"]);

/**
 * Builds a safe Stellar Expert explorer URL for a transaction hash.
 * Validates the hash is hex or a known mock prefix before constructing the URL.
 */
export function safeStellarTxUrl(hash: string | undefined | null): string {
  if (!hash) return "#";
  if (hash.startsWith("mock_")) return "#";
  // Stellar tx hashes are 64-char hex strings
  if (!/^[a-fA-F0-9]{64}$/.test(hash)) return "#";
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${network}/tx/${hash}`;
}

/**
 * Builds a safe Stellar Expert explorer URL for an account address.
 */
export function safeStellarAccountUrl(address: string | undefined | null): string {
  if (!address) return "#";
  // Stellar addresses: G + 55 base32 chars
  if (!/^G[A-Z2-7]{55}$/.test(address)) return "#";
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${network}/account/${address}`;
}

/**
 * Sanitizes untrusted IPFS metadata to prevent prototype pollution and XSS.
 * Only allows known keys with expected types; strips everything else.
 */
export function sanitizeIpfsMetadata(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const result: Record<string, unknown> = Object.create(null);
  const obj = raw as Record<string, unknown>;

  for (const key of ALLOWED_STRING_KEYS) {
    if (key in obj && typeof obj[key] === "string") {
      // Strip HTML tags from string values
      result[key] = obj[key].replace(/<[^>]*>/g, "").slice(0, 2048);
    }
  }

  for (const key of ALLOWED_NUMBER_KEYS) {
    if (key in obj && typeof obj[key] === "number" && isFinite(obj[key] as number)) {
      result[key] = obj[key];
    }
  }

  return result;
}
