/**
 * Distributed rate limiting for the upload API route.
 *
 * Strategy: fixed-window counter backed by Redis INCR + EXPIRE.
 *  - Key format:  `rl:{scope}:{identifier}:{windowStart}`
 *  - On each request the counter is INCRed.  On the first request in a window
 *    EXPIRE is set so Redis auto-deletes the key at window end.
 *  - Returns { allowed: true } or { allowed: false, retryAfter: number }.
 *
 * Fallback: if the Redis call throws (e.g. transient connection error) the
 * request is allowed through so a Redis outage never fully blocks uploads.
 * The error is logged but does not surface to the caller.
 *
 * Two independent limiters are exported:
 *  - checkIpRateLimit(ip)       — 10 requests per minute per IP
 *  - checkWalletRateLimit(wallet) — 10 requests per hour per wallet
 *
 * Keys are namespaced by window-start epoch so they naturally expire and a
 * Redis flush is never required between test runs when using the memory backend.
 */

import { redis } from "./redis";
import { logger } from "./logger";

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the client may retry (only set when allowed === false). */
  retryAfter?: number;
}

// ─── Configuration ─────────────────────────────────────────────────────────────

const IP_WINDOW_SECONDS = 60;        // 1 minute
const IP_MAX_REQUESTS   = 10;

const WALLET_WINDOW_SECONDS = 3600;  // 1 hour
const WALLET_MAX_REQUESTS   = 10;

// ─── Core helper ───────────────────────────────────────────────────────────────

/**
 * Check and increment a rate-limit counter in Redis.
 *
 * @param scope       - logical namespace, e.g. "ip" or "wallet"
 * @param identifier  - value being limited (IP address or wallet address)
 * @param windowSeconds - window duration in seconds
 * @param maxRequests   - maximum requests allowed per window
 */
export async function checkRateLimit(
  scope: string,
  identifier: string,
  windowSeconds: number,
  maxRequests: number,
): Promise<RateLimitResult> {
  // Window key bucketed to the current window start (floor division).
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `rl:${scope}:${identifier}:${windowStart}`;

  try {
    const count = await redis.incr(key);

    if (count === 1) {
      // First request in this window — set the TTL so Redis cleans up.
      await redis.expire(key, windowSeconds);
    }

    if (count > maxRequests) {
      const ttl = await redis.ttl(key);
      const retryAfter = Math.max(1, ttl);
      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  } catch (err) {
    // Degrade gracefully on Redis failure — allow the request through.
    logger.error("[rate-limiter] Redis error, allowing request", {
      scope,
      identifier,
      error: (err as Error).message,
    });
    return { allowed: true };
  }
}

// ─── Named limiters used by the upload route ───────────────────────────────────

/**
 * Rate-limit by client IP address: 10 requests per minute.
 */
export async function checkIpRateLimit(ip: string): Promise<RateLimitResult> {
  return checkRateLimit("ip", ip, IP_WINDOW_SECONDS, IP_MAX_REQUESTS);
}

/**
 * Rate-limit by wallet address: 10 uploads per hour.
 */
export async function checkWalletRateLimit(wallet: string): Promise<RateLimitResult> {
  return checkRateLimit("wallet", wallet, WALLET_WINDOW_SECONDS, WALLET_MAX_REQUESTS);
}
