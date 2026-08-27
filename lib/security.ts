/**
 * Security utilities: XSS prevention, URL validation, input sanitization,
 * and Stellar wallet-based upload request signing (Issue #275).
 */
import { isValidCID } from "./ipfs";

export type WalletDiagnosticsExport = {
  exportedAt: string;
  network: string;
  wallet: {
    provider: string | null;
    isConnected: boolean;
    addressSuffix: string | null;
    walletNetwork: string | null;
    passphraseMismatch: boolean;
    kitSessionActive: boolean;
  };
  flags: {
    enableDevtools: boolean;
    enableInvoiceComparison: boolean;
  };
};

export function redactWalletAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function sanitizeWalletDiagnosticsExport(
  input: WalletDiagnosticsExport
): WalletDiagnosticsExport {
  return {
    exportedAt: input.exportedAt,
    network: input.network,
    wallet: {
      provider: input.wallet.provider ?? null,
      isConnected: Boolean(input.wallet.isConnected),
      addressSuffix: redactWalletAddress(input.wallet.addressSuffix),
      walletNetwork: input.wallet.walletNetwork ?? null,
      passphraseMismatch: Boolean(input.wallet.passphraseMismatch),
      kitSessionActive: Boolean(input.wallet.kitSessionActive),
    },
    flags: {
      enableDevtools: Boolean(input.flags.enableDevtools),
      enableInvoiceComparison: Boolean(input.flags.enableInvoiceComparison),
    },
  };
}

export function parseWalletDiagnosticsImport(
  raw: string
): WalletDiagnosticsExport {
  const parsed = JSON.parse(raw) as Partial<WalletDiagnosticsExport>;
  return sanitizeWalletDiagnosticsExport({
    exportedAt:
      typeof parsed.exportedAt === "string"
        ? parsed.exportedAt
        : new Date().toISOString(),
    network:
      typeof parsed.network === "string" ? parsed.network : "unknown",
    wallet: {
      provider:
        typeof parsed.wallet?.provider === "string"
          ? parsed.wallet.provider
          : null,
      isConnected: Boolean(parsed.wallet?.isConnected),
      addressSuffix:
        typeof parsed.wallet?.addressSuffix === "string"
          ? parsed.wallet.addressSuffix
          : null,
      walletNetwork:
        typeof parsed.wallet?.walletNetwork === "string"
          ? parsed.wallet.walletNetwork
          : null,
      passphraseMismatch: Boolean(parsed.wallet?.passphraseMismatch),
      kitSessionActive: Boolean(parsed.wallet?.kitSessionActive),
    },
    flags: {
      enableDevtools: Boolean(parsed.flags?.enableDevtools),
      enableInvoiceComparison: Boolean(parsed.flags?.enableInvoiceComparison),
    },
  });
}

// ─── Upload Request Signing (#275) ────────────────────────────────────────────

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes anti-replay window

/**
 * Builds the challenge string that the wallet must sign.
 * Format: "kora-upload:{walletAddress}:{timestamp}"
 *
 * The timestamp is in milliseconds and is embedded so the server can
 * reject replayed tokens older than CHALLENGE_TTL_MS.
 */
export function buildUploadChallenge(walletAddress: string, timestamp: number): string {
  return `kora-upload:${walletAddress}:${timestamp}`;
}

/**
 * Signs an upload challenge using the Stellar Wallets Kit sign method.
 * Returns the hex-encoded signature string to be sent as a Bearer token.
 *
 * Usage (client-side):
 *   const token = await signUploadChallenge(walletAddress, (msg) =>
 *     walletKit.signMessage({ message: msg, address: walletAddress })
 *   );
 *   // Attach as: Authorization: Bearer <token>
 */
export async function signUploadChallenge(
  walletAddress: string,
  sign: (message: string) => Promise<{ signedMessage: string } | string>
): Promise<string> {
  const timestamp = Date.now();
  const challenge = buildUploadChallenge(walletAddress, timestamp);
  const result = await sign(challenge);
  const signedMessage = typeof result === "string" ? result : result.signedMessage;
  // Encode as base64url: "<walletAddress>.<timestamp>.<signature>"
  return btoa(`${walletAddress}.${timestamp}.${signedMessage}`);
}

/**
 * Verifies an upload Bearer token on the server.
 * Returns { ok: true, walletAddress } or { ok: false, error }.
 *
 * Verification steps:
 * 1. Decode the base64 token → walletAddress, timestamp, signature
 * 2. Reject if timestamp is older than CHALLENGE_TTL_MS (anti-replay)
 * 3. Verify the ed25519 signature against the challenge using @stellar/stellar-sdk
 */
export function verifyUploadToken(
  token: string
): { ok: true; walletAddress: string } | { ok: false; error: string } {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const firstDot = decoded.indexOf(".");
    const lastDot = decoded.lastIndexOf(".");
    if (firstDot === -1 || firstDot === lastDot) {
      return { ok: false, error: "Malformed token" };
    }

    const walletAddress = decoded.slice(0, firstDot);
    const timestampStr = decoded.slice(firstDot + 1, lastDot);
    const signature = decoded.slice(lastDot + 1);

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) return { ok: false, error: "Invalid timestamp" };

    // Anti-replay: reject tokens older than TTL
    if (Date.now() - timestamp > CHALLENGE_TTL_MS) {
      return { ok: false, error: "Token expired" };
    }

    // Validate Stellar public key format
    if (!/^G[A-Z2-7]{55}$/.test(walletAddress)) {
      return { ok: false, error: "Invalid wallet address" };
    }

    const challenge = buildUploadChallenge(walletAddress, timestamp);

    // Verify ed25519 signature using @stellar/stellar-sdk
    // eslint-disable-next-line
    const { Keypair } = require("@stellar/stellar-sdk") as typeof import("@stellar/stellar-sdk");
    const keypair = Keypair.fromPublicKey(walletAddress);
    const msgBuffer = Buffer.from(challenge, "utf8");
    const sigBuffer = Buffer.from(signature, "hex");

    if (!keypair.verify(msgBuffer, sigBuffer)) {
      return { ok: false, error: "Invalid signature" };
    }

    return { ok: true, walletAddress };
  } catch {
    return { ok: false, error: "Token verification failed" };
  }
}

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
 * Validates the CID format (v0/v1) before constructing the URL.
 */
export function safeIpfsUrl(cid: string | undefined | null, gateway?: string): string {
  if (!cid) return "#";
  if (!isValidCID(cid)) return "#";
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
