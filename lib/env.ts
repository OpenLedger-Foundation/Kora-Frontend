/**
 * Environment Variable Validation — Issue #269
 *
 * Validates all required env vars at startup using Zod.
 * - NEXT_PUBLIC_* vars are client-safe and validated on both server and client.
 * - Server-only vars (e.g. PINATA_JWT) are validated server-side only and are
 *   never included in the client bundle.
 * - Missing required vars throw at build time with a clear error listing each
 *   offending key.
 * - Optional vars fall back to documented defaults.
 *
 * Usage:
 *   import { env } from "@/lib/env";
 *   env.NEXT_PUBLIC_STELLAR_NETWORK  // "testnet" | "mainnet" | "futurenet"
 *   env.PINATA_JWT                   // server-side only
 */
import { z } from "zod";

// ─── Client-safe schema (NEXT_PUBLIC_*) ──────────────────────────────────────
// These vars are embedded into the client bundle by Next.js at build time.
// Never put secrets here.

const clientSchema = z.object({
  /** Stellar network to connect to. Defaults to "testnet". */
  NEXT_PUBLIC_STELLAR_NETWORK: z
    .enum(["testnet", "mainnet", "futurenet"])
    .default("testnet"),

  /** Soroban RPC endpoint URL. Required. */
  NEXT_PUBLIC_STELLAR_RPC_URL: z.string().url(),

  /** Horizon REST API endpoint URL. Required. */
  NEXT_PUBLIC_STELLAR_HORIZON_URL: z.string().url(),

  /** Stellar network passphrase used to sign transactions. Required. */
  NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: z.string().min(1),

  /** Soroban contract ID for the Invoice NFT contract. Required. */
  NEXT_PUBLIC_INVOICE_CONTRACT_ID: z.string().min(1),

  /** Soroban contract ID for the Marketplace contract. Required. */
  NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID: z.string().min(1),

  /** Soroban contract ID for the USDC/token contract. Required. */
  NEXT_PUBLIC_TOKEN_CONTRACT_ID: z.string().min(1),

  /** IPFS gateway base URL for resolving CIDs. Required. */
  NEXT_PUBLIC_IPFS_GATEWAY: z.string().url(),

  /** Public URL of this app deployment. Defaults to localhost:3000. */
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  /** App display name. Defaults to "Kora". */
  NEXT_PUBLIC_APP_NAME: z.string().default("Kora"),

  /** App description used in meta tags. */
  NEXT_PUBLIC_APP_DESCRIPTION: z
    .string()
    .default("On-chain Invoice Financing Protocol"),

  /** Enable mock data (no live Soroban connection required). Defaults to false. */
  NEXT_PUBLIC_ENABLE_MOCK_DATA: z
    .string()
    .transform((v) => v === "true")
    .default("false"),

  /** Enable React Query / debug devtools. Defaults to false. */
  NEXT_PUBLIC_ENABLE_DEVTOOLS: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
});

// ─── Server-only schema ───────────────────────────────────────────────────────
// These vars are NEVER exposed to the client bundle.
// Importing this module from a client component will only yield the client vars.

const serverSchema = z.object({
  /** Pinata JWT for IPFS pinning. Required in production. */
  PINATA_JWT: z.string().min(1),

  /** Optional legacy Pinata API key (v1 API). */
  PINATA_API_KEY: z.string().optional(),

  /** Optional legacy Pinata secret key (v1 API). */
  PINATA_SECRET_API_KEY: z.string().optional(),

  /** Optional VirusTotal API key for PDF scanning on upload. */
  VIRUSTOTAL_API_KEY: z.string().optional(),
});

// ─── Parse & validate ─────────────────────────────────────────────────────────

function parseEnv() {
  const isServer = typeof window === "undefined";

  // Validate client vars — runs on both server and client
  const clientResult = clientSchema.safeParse(process.env);
  if (!clientResult.success) {
    const msg = clientResult.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`❌ Invalid environment variables:\n${msg}`);
  }

  if (!isServer) {
    return clientResult.data;
  }

  // Validate server-only vars
  const serverResult = serverSchema.safeParse(process.env);
  if (!serverResult.success) {
    const issues = serverResult.error.issues;
    const isProd = process.env.NODE_ENV === "production";
    const missingRequired = issues.filter((i) => i.path[0] === "PINATA_JWT");

    if (isProd && missingRequired.length > 0) {
      const msg = issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
      throw new Error(`❌ Missing required server environment variables:\n${msg}`);
    }

    // Dev: warn about optional missing vars but don't throw
    issues.forEach((i) => {
      console.warn(`⚠️  Optional env var missing or invalid: ${i.path.join(".")}`);
    });

    return {
      ...clientResult.data,
      ...serverSchema.partial().parse(process.env),
    };
  }

  return { ...clientResult.data, ...serverResult.data };
}

export const env = parseEnv();
