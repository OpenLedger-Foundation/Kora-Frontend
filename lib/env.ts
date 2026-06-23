/**
 * Environment Variable Validation on Startup
 * 
 * Issue #57: Implement startup environment variable validation using Zod in a lib/env.ts
 * module — validating all required env vars on app boot and throwing descriptive errors
 * for missing or malformed values.
 * 
 * This module provides:
 * - ✅ Validation of all vars from .env.example using Zod schema
 * - ✅ Field-level error messages for invalid configuration
 * - ✅ Typed env object exported and used throughout the app (not raw process.env)
 * - ✅ Distinction between NEXT_PUBLIC_* (client-safe) vs server-only vars
 * - ✅ In development: log warnings for optional missing vars
 * - ✅ In production: hard fail on any missing required var
 * - ✅ Validation runs on app startup (imported in app/layout.tsx)
 * 
 * Usage:
 *   import { env } from "@/lib/env";
 *   console.log(env.NEXT_PUBLIC_STELLAR_NETWORK); // typed, validated value
 * 
 * Error Output Example:
 *   ❌ Invalid environment variables:
 *     NEXT_PUBLIC_STELLAR_RPC_URL: Invalid url
 *     NEXT_PUBLIC_STELLAR_HORIZON_URL: Invalid url
 */
import { z } from "zod";

// ─── Client-safe (NEXT_PUBLIC_*) schema ──────────────────────────────────────
const clientSchema = z.object({
  NEXT_PUBLIC_STELLAR_NETWORK: z.enum(["testnet", "mainnet", "futurenet"]).default("testnet"),
  NEXT_PUBLIC_STELLAR_RPC_URL: z.string().url(),
  NEXT_PUBLIC_STELLAR_HORIZON_URL: z.string().url(),
  NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: z.string().min(1),
  NEXT_PUBLIC_INVOICE_CONTRACT_ID: z.string().min(1),
  NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID: z.string().min(1),
  NEXT_PUBLIC_TOKEN_CONTRACT_ID: z.string().min(1),
  NEXT_PUBLIC_IPFS_GATEWAY: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("Kora"),
  NEXT_PUBLIC_APP_DESCRIPTION: z.string().default("On-chain Invoice Financing Protocol"),
  NEXT_PUBLIC_ENABLE_MOCK_DATA: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
  NEXT_PUBLIC_ENABLE_DEVTOOLS: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
});

// ─── Server-only schema ───────────────────────────────────────────────────────
const serverSchema = z.object({
  PINATA_JWT: z.string().min(1),
  PINATA_API_KEY: z.string().optional(),
  PINATA_SECRET_API_KEY: z.string().optional(),
  VIRUSTOTAL_API_KEY: z.string().optional(),
});

// ─── Parse & validate ─────────────────────────────────────────────────────────
function parseEnv() {
  const isServer = typeof window === "undefined";
  const isProd = process.env.NODE_ENV === "production";

  const clientResult = clientSchema.safeParse(process.env);
  if (!clientResult.success) {
    const msg = clientResult.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`❌ Invalid environment variables:\n${msg}`);
  }

  if (isServer) {
    const serverResult = serverSchema.safeParse(process.env);
    if (!serverResult.success) {
      const issues = serverResult.error.issues;
      const hasMissingPinataJwt = issues.some((i) => i.path.join(".") === "PINATA_JWT");
      if (isProd && hasMissingPinataJwt) {
        const msg = issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
        throw new Error(`❌ Missing required server environment variables:\n${msg}`);
      } else if (!isProd) {
        issues.forEach((i) => {
          console.warn(`⚠️  Optional env var missing: ${i.path.join(".")}`);
        });
      }
      return { ...clientResult.data, ...serverSchema.partial().parse(process.env) };
    }
    return { ...clientResult.data, ...serverResult.data };
  }

  return clientResult.data;
}

export const env = parseEnv();
