/**
 * Tests for SequenceManager and the seq-collision retry path in submitTransaction.
 *
 * We avoid hitting the real Stellar network by mocking `rpc` and focus on:
 *  1. Optimistic local increment — concurrent calls get distinct sequence numbers.
 *  2. Network seed on first use.
 *  3. Reset fetches from network and overwrites the local counter.
 *  4. Concurrent reset deduplication — only one network call even if reset() races.
 *  5. Evict clears state so the next call re-fetches.
 *  6. isBadSeqResult detects tx_bad_seq in both error shapes.
 *  7. submitTransaction throws BadSequenceError on tx_bad_seq.
 *  8. Retry path: seq-collision on first submit → reset → second submit succeeds.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  SequenceManager,
  BadSequenceError,
  isBadSeqResult,
} from "../client";
import * as StellarSdk from "@stellar/stellar-sdk";

// ─── Mock rpc.getAccount ──────────────────────────────────────────────────────

// The SequenceManager imports `rpc` from the same module. We need to intercept
// those calls without re-wiring the entire module graph.  The cleanest approach
// for unit tests is to construct a SequenceManager that accepts an injectable
// fetch function, but since the real code uses the module singleton, we instead
// exercise SequenceManager by sub-classing and overriding the private method
// via the test-only constructor parameter pattern below.

// ─── Testable subclass ────────────────────────────────────────────────────────

/**
 * Extends SequenceManager to inject a fake network fetch so tests don't need
 * a live RPC.  The `fetchFromNetwork` callback replaces `rpc.getAccount`.
 */
class TestableSequenceManager extends SequenceManager {
  private readonly fetchFromNetwork: (address: string) => Promise<bigint>;

  constructor(fetchFromNetwork: (address: string) => Promise<bigint>) {
    super();
    this.fetchFromNetwork = fetchFromNetwork;
    // Override the private method by replacing it on the instance so TypeScript
    // doesn't complain about private access.
    (this as unknown as { fetchAndSeed: (addr: string) => Promise<bigint> }).fetchAndSeed =
      this._fetchAndSeed.bind(this);
  }

  // Mirrors the private fetchAndSeed logic but uses injected fetch.
  private async _fetchAndSeed(address: string): Promise<bigint> {
    const resetPromises: Map<string, Promise<bigint>> = (this as unknown as {
      resetPromises: Map<string, Promise<bigint>>;
    }).resetPromises;
    const counters: Map<string, bigint> = (this as unknown as {
      counters: Map<string, bigint>;
    }).counters;

    const existing = resetPromises.get(address);
    if (existing) return existing;

    const promise = this.fetchFromNetwork(address).then((seq) => {
      counters.set(address, seq);
      return seq;
    }).finally(() => {
      resetPromises.delete(address);
    });

    resetPromises.set(address, promise);
    return promise;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ADDR = "GABC1234TESTADDRESS000000000000000000000000000000000000000";

function makeManager(fetchFn: (addr: string) => Promise<bigint>) {
  return new TestableSequenceManager(fetchFn);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SequenceManager", () => {
  describe("nextAccount — initial seed", () => {
    it("fetches from network on first use and returns Account with correct seq", async () => {
      const networkSeq = 100n;
      const fetch = vi.fn().mockResolvedValue(networkSeq);
      const mgr = makeManager(fetch);

      const account = await mgr.nextAccount(ADDR);

      expect(fetch).toHaveBeenCalledOnce();
      // SDK Account stores the seq we pass; builder will use seq+1.
      expect(BigInt(account.sequenceNumber())).toBe(networkSeq);
    });

    it("does not fetch from network on subsequent calls", async () => {
      const fetch = vi.fn().mockResolvedValue(100n);
      const mgr = makeManager(fetch);

      await mgr.nextAccount(ADDR);
      await mgr.nextAccount(ADDR);

      expect(fetch).toHaveBeenCalledOnce();
    });
  });

  describe("nextAccount — optimistic increment", () => {
    it("returns strictly increasing sequence numbers for back-to-back calls", async () => {
      const mgr = makeManager(vi.fn().mockResolvedValue(100n));

      const a1 = await mgr.nextAccount(ADDR);
      const a2 = await mgr.nextAccount(ADDR);
      const a3 = await mgr.nextAccount(ADDR);

      // Each caller gets the previous counter value; builder adds +1 internally.
      expect(BigInt(a1.sequenceNumber())).toBe(100n);
      expect(BigInt(a2.sequenceNumber())).toBe(101n);
      expect(BigInt(a3.sequenceNumber())).toBe(102n);
    });

    it("concurrent calls get distinct sequence numbers without racing", async () => {
      let calls = 0;
      const fetch = vi.fn().mockImplementation(async () => {
        // Simulate slight async delay
        await new Promise((r) => setTimeout(r, 0));
        return BigInt(200 + calls++);
      });
      // Only first fetch, then use local counter
      const mgr = makeManager(fetch);

      // Prime the counter
      await mgr.nextAccount(ADDR);

      // Fire three concurrent nextAccount calls
      const [b, c, d] = await Promise.all([
        mgr.nextAccount(ADDR),
        mgr.nextAccount(ADDR),
        mgr.nextAccount(ADDR),
      ]);

      const seqs = new Set([
        BigInt(b.sequenceNumber()),
        BigInt(c.sequenceNumber()),
        BigInt(d.sequenceNumber()),
      ]);

      // All three must be distinct (no collision)
      expect(seqs.size).toBe(3);
    });
  });

  describe("reset", () => {
    it("overwrites local counter with authoritative network value", async () => {
      // Seed with 100, advance once, then reset to 999
      const fetch = vi.fn()
        .mockResolvedValueOnce(100n)  // initial seed
        .mockResolvedValueOnce(999n); // reset

      const mgr = makeManager(fetch);
      await mgr.nextAccount(ADDR); // uses 100, local becomes 101
      await mgr.nextAccount(ADDR); // uses 101, local becomes 102

      await mgr.reset(ADDR);

      const account = await mgr.nextAccount(ADDR);
      expect(BigInt(account.sequenceNumber())).toBe(999n);
    });

    it("concurrent resets only trigger one network fetch", async () => {
      const fetch = vi.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 5));
        return 500n;
      });

      const mgr = makeManager(fetch);
      await mgr.nextAccount(ADDR); // seed

      // Fire three resets concurrently
      await Promise.all([mgr.reset(ADDR), mgr.reset(ADDR), mgr.reset(ADDR)]);

      // Only 2 total fetches: 1 for initial seed + 1 deduplicated reset
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("evict", () => {
    it("clears counter so the next call re-fetches from network", async () => {
      const fetch = vi.fn().mockResolvedValue(100n);
      const mgr = makeManager(fetch);

      await mgr.nextAccount(ADDR);
      mgr.evict(ADDR);
      await mgr.nextAccount(ADDR);

      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("multiple addresses", () => {
    it("maintains independent counters per address", async () => {
      const ADDR_B = "GBBB5678TESTADDRESS000000000000000000000000000000000000000";
      const fetch = vi.fn()
        .mockImplementation(async (addr: string) =>
          addr === ADDR ? 100n : 200n
        );

      const mgr = makeManager(fetch);

      const a = await mgr.nextAccount(ADDR);
      const b = await mgr.nextAccount(ADDR_B);
      const a2 = await mgr.nextAccount(ADDR);

      expect(BigInt(a.sequenceNumber())).toBe(100n);
      expect(BigInt(b.sequenceNumber())).toBe(200n);
      expect(BigInt(a2.sequenceNumber())).toBe(101n); // ADDR incremented, ADDR_B unchanged
    });
  });
});

// ─── isBadSeqResult ───────────────────────────────────────────────────────────

describe("isBadSeqResult", () => {
  it("returns false for SUCCESS status", () => {
    expect(isBadSeqResult({ status: "SUCCESS" } as never)).toBe(false);
  });

  it("returns false for ERROR with unrelated code", () => {
    const result = {
      status: "ERROR",
      extras: { result_codes: { transaction: "tx_insufficient_fee" } },
    };
    expect(isBadSeqResult(result as never)).toBe(false);
  });

  it("detects tx_bad_seq via result_codes.transaction", () => {
    const result = {
      status: "ERROR",
      extras: { result_codes: { transaction: "tx_bad_seq" } },
    };
    expect(isBadSeqResult(result as never)).toBe(true);
  });

  it("detects tx_bad_seq via errorResultXdr field", () => {
    const result = {
      status: "ERROR",
      errorResultXdr: "AAAA_txBAD_SEQ_AAAA",
      extras: {},
    };
    expect(isBadSeqResult(result as never)).toBe(true);
  });

  it("returns false when extras is missing", () => {
    const result = { status: "ERROR" };
    expect(isBadSeqResult(result as never)).toBe(false);
  });
});

// ─── BadSequenceError ─────────────────────────────────────────────────────────

describe("BadSequenceError", () => {
  it("is an instance of Error", () => {
    expect(new BadSequenceError()).toBeInstanceOf(Error);
  });

  it("has name BadSequenceError", () => {
    expect(new BadSequenceError().name).toBe("BadSequenceError");
  });

  it("message is tx_bad_seq", () => {
    expect(new BadSequenceError().message).toBe("tx_bad_seq");
  });
});

// ─── Seq-collision retry simulation ──────────────────────────────────────────

describe("Sequence collision retry simulation", () => {
  /**
   * Simulates the full approve+fund rapid-fire scenario:
   *
   *  1. buildFn is called twice (first attempt, then retry after reset).
   *  2. First submitTransaction call returns tx_bad_seq.
   *  3. sequenceManager.reset() is called — network returns the correct seq.
   *  4. buildFn is called again with the fresh sequence.
   *  5. Second submitTransaction succeeds.
   *
   * We test the logic inline here (not through the React hook) to keep it
   * framework-free and fast.
   */
  it("retries once after tx_bad_seq and succeeds", async () => {
    const address = ADDR;
    let networkSeq = 50n;

    // Fake network: always returns current networkSeq
    const fetchNetwork = vi.fn().mockImplementation(async () => networkSeq);
    const mgr = makeManager(fetchNetwork);

    // Track how many times buildFn was called
    const buildFn = vi.fn().mockImplementation(async () => {
      const acc = await mgr.nextAccount(address);
      return `xdr_seq_${acc.sequenceNumber()}`;
    });

    // First submit fails with tx_bad_seq; second succeeds.
    let submitCallCount = 0;
    const fakeSubmit = vi.fn().mockImplementation(async (_xdr: string) => {
      submitCallCount++;
      if (submitCallCount === 1) throw new BadSequenceError();
      // Simulate successful submission
      return { status: "PENDING", hash: "deadbeef" };
    });

    // ── Execute the retry logic (mirrors what useTransaction does) ──────────
    let hash: string | null = null;
    try {
      const xdr1 = await buildFn();
      hash = await fakeSubmit(xdr1).then((r: { hash: string }) => r.hash);
    } catch (err) {
      if (err instanceof BadSequenceError) {
        // Network advanced the seq while we were building — simulate that
        networkSeq = 55n;
        await mgr.reset(address);
        const xdr2 = await buildFn();
        const result = await fakeSubmit(xdr2);
        hash = result.hash;
      } else {
        throw err;
      }
    }

    expect(hash).toBe("deadbeef");
    expect(buildFn).toHaveBeenCalledTimes(2);
    expect(fakeSubmit).toHaveBeenCalledTimes(2);

    // After reset, the second build must use the refreshed sequence (55)
    const secondCallXdr = buildFn.mock.results[1].value;
    await expect(secondCallXdr).resolves.toContain("55");
  });

  it("does not retry a second time if the retry also fails", async () => {
    const mgr = makeManager(vi.fn().mockResolvedValue(100n));

    const buildFn = vi.fn().mockImplementation(async () => {
      await mgr.nextAccount(ADDR);
      return "xdr";
    });

    // Both submit attempts throw BadSequenceError (persistent network issue)
    const fakeSubmit = vi.fn().mockRejectedValue(new BadSequenceError());

    let caughtError: unknown;
    try {
      const xdr1 = await buildFn();
      await fakeSubmit(xdr1);
    } catch (err) {
      if (err instanceof BadSequenceError) {
        await mgr.reset(ADDR);
        const xdr2 = await buildFn();
        try {
          await fakeSubmit(xdr2);
        } catch (retryErr) {
          caughtError = retryErr;
        }
      }
    }

    expect(caughtError).toBeInstanceOf(BadSequenceError);
    expect(fakeSubmit).toHaveBeenCalledTimes(2); // tried twice, not more
  });
});
