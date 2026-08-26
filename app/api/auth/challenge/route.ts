import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { logger } from "@/lib/logger";
import { verifyCsrf } from "@/lib/csrf";

interface ChallengeResponse {
  challenge: string;
  timestamp: number;
  nonce: string;
}

/**
 * In-memory nonce store for single-use enforcement.
 * Maps nonce -> { used: boolean, createdAt: number }.
 * Evicts entries older than 10 minutes.
 */
const nonceStore = new Map<string, { used: boolean; createdAt: number }>();

const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function evictStaleNonces(): void {
  const now = Date.now();
  for (const [key, entry] of nonceStore) {
    if (now - entry.createdAt > NONCE_TTL_MS) {
      nonceStore.delete(key);
    }
  }
}

/**
 * POST /api/auth/challenge
 * Generates a server-side nonce challenge for wallet ownership verification.
 * The client will sign this challenge with their private key.
 *
 * Replay protection:
 * - Each nonce is stored server-side and marked as used on verification.
 * - Nonces expire after 10 minutes.
 * - The verify endpoint checks and invalidates the nonce after use.
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  const csrfError = verifyCsrf(_request);
  if (csrfError) return csrfError;

  const requestId = _request.headers.get("x-request-id") ?? crypto.randomUUID();
  const route = "/api/auth/challenge";
  try {
    evictStaleNonces();

    const nonce = randomBytes(32).toString("hex");
    const timestamp = Date.now();
    const challenge = `Kora Protocol authentication: ${timestamp}:${nonce}`;

    nonceStore.set(nonce, { used: false, createdAt: timestamp });

    return NextResponse.json<ChallengeResponse>({ challenge, timestamp, nonce });
  } catch (error) {
    logger.error("Error generating challenge", { requestId, route, error });
    return NextResponse.json({ error: "Failed to generate challenge", requestId }, { status: 500 });
  }
}

/**
 * Checks if a nonce has already been used. Returns true if valid and marks as used.
 * Returns false if the nonce was already used or not found.
 */
export function consumeNonce(nonce: string): boolean {
  const entry = nonceStore.get(nonce);
  if (!entry || entry.used) return false;
  entry.used = true;
  return true;
}

/**
 * Checks if a nonce exists in the store (without consuming it).
 */
export function nonceExists(nonce: string): boolean {
  return nonceStore.has(nonce);
}