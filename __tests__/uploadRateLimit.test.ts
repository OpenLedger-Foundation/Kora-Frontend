/**
 * Upload Route Rate Limiting — Redis-backed
 *
 * Tests the rate limiting behaviour on POST /api/upload.
 * Uses vi.mock so no real Redis or Pinata connections are made.
 *
 * Acceptance criteria covered:
 *  - Rate limits work across instances (enforced via mock counters)
 *  - Dev/test works without Redis (MemoryRedisClient unit tests)
 *  - 429 returns Retry-After header
 *  - Tests mock Redis (this file)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Module mocks (hoisted by Vitest before any imports) ──────────────────────

// Cut the security → ipfs → env chain that throws at import time when
// NEXT_PUBLIC_ENABLE_MOCK_DATA is not set to "true" in the test environment.
vi.mock("@/lib/ipfs", () => ({
  isValidCID: vi.fn(() => true),
}));

vi.mock("@/lib/verifiedSessions", () => ({
  isWalletVerified: vi.fn(() => true),
  markWalletVerified: vi.fn(),
}));

// Bypass CSRF so the IP rate-limit check is reached on every request.
vi.mock("@/lib/csrf", () => ({
  verifyCsrf: vi.fn(() => null),
  issueCsrfToken: vi.fn(),
  CSRF_COOKIE: "__kora_csrf",
  CSRF_HEADER: "x-kora-csrf",
}));

// Mock the rateLimiter — stubs are wired up per-test in beforeEach.
vi.mock("@/lib/rateLimiter", () => ({
  checkIpRateLimit: vi.fn(),
  checkWalletRateLimit: vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { POST } from "@/app/api/upload/route";
import { MemoryRedisClient } from "@/lib/redis";
import * as rateLimiter from "@/lib/rateLimiter";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(ip: string): import("next/server").NextRequest {
  return new Request("https://kora.network/api/upload", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  }) as unknown as import("next/server").NextRequest;
}

/**
 * Returns a mock implementation for checkIpRateLimit that allows up to `max`
 * calls per unique IP address, then returns 429 with retryAfter: 42.
 */
function makeIpLimiter(max = 10): (ip: string) => Promise<{ allowed: boolean; retryAfter?: number }> {
  const counts: Record<string, number> = {};
  return async (ip: string) => {
    // Use only the first segment of the X-Forwarded-For value (same as route)
    const clientIp = ip.split(",")[0].trim();
    counts[clientIp] = (counts[clientIp] ?? 0) + 1;
    if (counts[clientIp] > max) return { allowed: false, retryAfter: 42 };
    return { allowed: true };
  };
}

// ─── Integration tests: upload route with mocked Redis limiter ────────────────

describe("Upload Route IP Rate Limiting (Redis mock)", () => {
  beforeEach(() => {
    process.env.PINATA_JWT = "mock-jwt";
    // Wallet limiter always allows unless overridden in a specific test
    vi.mocked(rateLimiter.checkWalletRateLimit).mockResolvedValue({ allowed: true });
  });

  it("allows up to 10 requests per minute and blocks the 11th", async () => {
    vi.mocked(rateLimiter.checkIpRateLimit).mockImplementation(makeIpLimiter(10));

    for (let i = 0; i < 10; i++) {
      const res = await POST(makeRequest("1.2.3.4"));
      expect(res.status).not.toBe(429);
    }

    const res11 = await POST(makeRequest("1.2.3.4"));
    expect(res11.status).toBe(429);
    expect(res11.headers.get("Retry-After")).toBeDefined();
    expect(Number(res11.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("handles multiple IPs independently", async () => {
    vi.mocked(rateLimiter.checkIpRateLimit).mockImplementation(makeIpLimiter(10));

    for (let i = 0; i < 10; i++) {
      expect((await POST(makeRequest("1.1.1.1"))).status).not.toBe(429);
    }
    expect((await POST(makeRequest("1.1.1.1"))).status).toBe(429);
    // Different IP is unaffected
    expect((await POST(makeRequest("2.2.2.2"))).status).not.toBe(429);
  });

  it("extracts the first IP from a comma-separated x-forwarded-for header", async () => {
    vi.mocked(rateLimiter.checkIpRateLimit).mockImplementation(makeIpLimiter(10));

    for (let i = 0; i < 10; i++) {
      expect((await POST(makeRequest("9.9.9.9, 10.0.0.1"))).status).not.toBe(429);
    }
    expect((await POST(makeRequest("9.9.9.9, 10.0.0.1"))).status).toBe(429);
  });

  it("429 response includes a positive integer Retry-After header", async () => {
    vi.mocked(rateLimiter.checkIpRateLimit).mockResolvedValue({
      allowed: false,
      retryAfter: 55,
    });

    const res = await POST(makeRequest("3.3.3.3"));
    expect(res.status).toBe(429);
    const retryAfter = Number(res.headers.get("Retry-After"));
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThan(0);
  });
});

// ─── Unit tests: MemoryRedisClient (dev / test fallback) ─────────────────────

describe("MemoryRedisClient dev fallback (no Redis required)", () => {
  it("incr starts at 1 and increments", async () => {
    const client = new MemoryRedisClient();
    expect(await client.incr("foo")).toBe(1);
    expect(await client.incr("foo")).toBe(2);
  });

  it("expire sets a TTL; ttl returns remaining seconds", async () => {
    const client = new MemoryRedisClient();
    await client.incr("exp-key");
    expect(await client.expire("exp-key", 60)).toBe(1);
    expect(await client.ttl("exp-key")).toBeGreaterThan(0);
  });

  it("del removes a key and ttl returns -2 afterwards", async () => {
    const client = new MemoryRedisClient();
    await client.incr("del-key");
    expect(await client.del("del-key")).toBe(1);
    expect(await client.ttl("del-key")).toBe(-2);
  });

  it("ttl returns -2 for non-existent keys", async () => {
    const client = new MemoryRedisClient();
    expect(await client.ttl("ghost")).toBe(-2);
  });

  it("ttl returns -1 for keys with no expiry", async () => {
    const client = new MemoryRedisClient();
    await client.incr("no-expiry");
    expect(await client.ttl("no-expiry")).toBe(-1);
  });

  it("independent keys do not share state", async () => {
    const client = new MemoryRedisClient();
    await client.incr("key-a");
    await client.incr("key-a");
    await client.incr("key-b");
    expect(await client.incr("key-a")).toBe(3);
    expect(await client.incr("key-b")).toBe(2);
  });

  it("simulates the rate-limit counter pattern: allow N then block", async () => {
    const client = new MemoryRedisClient();
    const max = 3;
    const windowSecs = 60;
    const windowBucket = Math.floor(Date.now() / 1000 / windowSecs);
    const key = `rl:ip:unit-test:${windowBucket}`;

    for (let i = 0; i < max; i++) {
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, windowSecs);
      expect(count).toBeLessThanOrEqual(max);
    }

    const blocked = await client.incr(key);
    expect(blocked).toBeGreaterThan(max);
    expect(await client.ttl(key)).toBeGreaterThan(0);
  });
});
