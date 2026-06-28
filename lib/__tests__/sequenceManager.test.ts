/**
 * Tests for SequenceManager and related sequence-collision helpers.
 *
 * All tests run in the node environment (no DOM required).
 * We mock rpc.getAccount so tests are fully offline.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Inline the pure logic under test ────────────────────────────────────────
//
// We can't import the real client.ts because it instantiates StellarSdk RPC
// servers at module load time (network calls). Instead we inline the exact
// SequenceManager class and isBadSeqResult helper so we're testing the
// actual algorithm without the side-effectful module initialisation.
//
// This mirrors the production code in lib/stellar/client.ts exactly.

interface MockAccount {
  sequenceNumber: () => string;
}

class SequenceManager {
  private readonly counters = new Map<string, bigint>();
  private readonly resetPromises = new Map<string, Promise<bigint>>();

  constructor(
    private readonly fetchAccount: (address: string) => Promise<MockAccount>
  ) {}

  async nextAccount(address: string): Promise<{ address: string; seq: bigint }> {
    if (!this.counters.has(address)) {
      await this.fetchAndSeed(address);
    }
    const seq = this.counters.get(address)!;
    this.counters.set(address, seq + 1n);
    return { address, seq };
  }

  async reset(address: string): Promise<void> {
    await this.fetchAndSeed(address);
  }

  evict(address: string): void {
    this.counters.delete(address);
    this.resetPromises.delete(address);
  }

  getCounter(address: string): bigint | undefined {
    return this.counters.get(address);
  }

  private async fetchAndSeed(address: string): Promise<bigint> {
    const existing = this.resetPromises.get(address);
    if (existing) return existing;

    const promise = this.fetchAccount(address)
      .then((account) => {
        const seq = BigInt(account.sequenceNumber());
        this.counters.set(address, seq);
        return seq;
      })
      .finally(() => {
        this.resetPromises.delete(address);
      });

    this.resetPromises.set(address, promise);
    return promise;
  }
}

function isBadSeqResult(result: {
  status: string;
  extras?: { result_codes?: { transaction?: string } };
  errorResultXdr?: string;
}): boolean {
  if (result.status !== "ERROR") return false;
  const txCode = result.extras?.result_codes?.transaction ?? "";
  const xdr = result.errorResultXdr ?? "";
  return txCode === "tx_bad_seq" || xdr.includes("txBAD_SEQ");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ADDR_A = "GABC123";
const ADDR_B = "GXYZ456";

function makeManager(networkSeq: Record<string, bigint> = {}) {
  const fetchAccount = vi.fn(async (address: string) => ({
    sequenceNumber: () => (networkSeq[address] ?? 100n).toString(),
  }));
  return { manager: new SequenceManager(fetchAccount), fetchAccount };
}

// ─── SequenceManager.nextAccount ─────────────────────────────────────────────

describe("SequenceManager.nextAccount", () => {
  it("seeds from network on first call", async () => {
    const { manager, fetchAccount } = makeManager({ [ADDR_A]: 100n });
    const { seq } = await manager.nextAccount(ADDR_A);
    expect(fetchAccount).toHaveBeenCalledOnce();
    expect(seq).toBe(100n);
  });

  it("increments optimistically on consecutive calls without network", async () => {
    const { manager, fetchAccount } = makeManager({ [ADDR_A]: 100n });

    const r1 = await manager.nextAccount(ADDR_A);
    const r2 = await manager.nextAccount(ADDR_A);
    const r3 = await manager.nextAccount(ADDR_A);

    expect(fetchAccount).toHaveBeenCalledOnce(); // only seeded once
    expect(r1.seq).toBe(100n);
    expect(r2.seq).toBe(101n);
    expect(r3.seq).toBe(102n);
  });

  it("tracks counters independently per address", async () => {
    const { manager } = makeManager({ [ADDR_A]: 50n, [ADDR_B]: 200n });

    const a1 = await manager.nextAccount(ADDR_A);
    const b1 = await manager.nextAccount(ADDR_B);
    const a2 = await manager.nextAccount(ADDR_A);

    expect(a1.seq).toBe(50n);
    expect(b1.seq).toBe(200n);
    expect(a2.seq).toBe(51n);
  });
});

// ─── SequenceManager.reset ────────────────────────────────────────────────────

describe("SequenceManager.reset", () => {
  it("refetches from network and overwrites the local counter", async () => {
    const fetchAccount = vi.fn()
      .mockResolvedValueOnce({ sequenceNumber: () => "100" })  // seed
      .mockResolvedValueOnce({ sequenceNumber: () => "105" }); // reset (network advanced)

    const manager = new SequenceManager(fetchAccount);

    await manager.nextAccount(ADDR_A); // seeds at 100, local counter → 101
    await manager.nextAccount(ADDR_A); // local → 102

    await manager.reset(ADDR_A); // re-fetches → 105

    const { seq } = await manager.nextAccount(ADDR_A); // should use 105
    expect(seq).toBe(105n);
  });

  it("deduplicate concurrent resets — only one network call", async () => {
    const fetchAccount = vi.fn()
      .mockResolvedValueOnce({ sequenceNumber: () => "100" })
      .mockResolvedValue({ sequenceNumber: () => "110" }); // concurrent resets

    const manager = new SequenceManager(fetchAccount);
    await manager.nextAccount(ADDR_A); // seed

    // Fire two resets concurrently
    await Promise.all([manager.reset(ADDR_A), manager.reset(ADDR_A)]);

    // fetchAccount: 1 seed + 1 reset (second reset reuses the in-flight promise)
    expect(fetchAccount).toHaveBeenCalledTimes(2);
  });

  it("after reset, next seq reflects network value not stale local counter", async () => {
    const fetchAccount = vi.fn()
      .mockResolvedValueOnce({ sequenceNumber: () => "10" })
      .mockResolvedValueOnce({ sequenceNumber: () => "99" }); // network caught up

    const manager = new SequenceManager(fetchAccount);

    // Advance local counter well past what network knows
    for (let i = 0; i < 5; i++) await manager.nextAccount(ADDR_A);

    await manager.reset(ADDR_A);

    const { seq } = await manager.nextAccount(ADDR_A);
    expect(seq).toBe(99n); // network value wins
  });
});

// ─── SequenceManager.evict ───────────────────────────────────────────────────

describe("SequenceManager.evict", () => {
  it("forces a re-seed on next use after eviction", async () => {
    const fetchAccount = vi.fn()
      .mockResolvedValueOnce({ sequenceNumber: () => "100" })
      .mockResolvedValueOnce({ sequenceNumber: () => "200" });

    const manager = new SequenceManager(fetchAccount);
    await manager.nextAccount(ADDR_A);

    manager.evict(ADDR_A);

    const { seq } = await manager.nextAccount(ADDR_A);
    expect(fetchAccount).toHaveBeenCalledTimes(2);
    expect(seq).toBe(200n);
  });
});

// ─── isBadSeqResult ──────────────────────────────────────────────────────────

describe("isBadSeqResult", () => {
  it("returns false for SUCCESS status", () => {
    expect(isBadSeqResult({ status: "SUCCESS" })).toBe(false);
  });

  it("returns false for ERROR with a different result code", () => {
    expect(
      isBadSeqResult({
        status: "ERROR",
        extras: { result_codes: { transaction: "tx_insufficient_fee" } },
      })
    ).toBe(false);
  });

  it("returns true when result code is tx_bad_seq", () => {
    expect(
      isBadSeqResult({
        status: "ERROR",
        extras: { result_codes: { transaction: "tx_bad_seq" } },
      })
    ).toBe(true);
  });

  it("returns true when errorResultXdr contains txBAD_SEQ", () => {
    expect(
      isBadSeqResult({
        status: "ERROR",
        errorResultXdr: "AAAAAAAAAMj////7AAAAA==txBAD_SEQ",
      })
    ).toBe(true);
  });

  it("returns false for ERROR with neither code nor matching xdr", () => {
    expect(
      isBadSeqResult({
        status: "ERROR",
        errorResultXdr: "some_other_error",
        extras: { result_codes: {} },
      })
    ).toBe(false);
  });
});

// ─── Seq collision simulation ─────────────────────────────────────────────────

describe("sequence collision simulation", () => {
  it("two concurrent nextAccount calls get distinct sequence numbers", async () => {
    const { manager } = makeManager({ [ADDR_A]: 1000n });

    // Simulate approve + fund fired at the same time
    const [r1, r2] = await Promise.all([
      manager.nextAccount(ADDR_A),
      manager.nextAccount(ADDR_A),
    ]);

    // Without a manager both would be 1000; with it they must differ
    expect(r1.seq).not.toBe(r2.seq);
    const seqs = new Set([r1.seq, r2.seq]);
    expect(seqs.size).toBe(2);
  });

  it("retry-after-reset produces the correct next seq from network", async () => {
    // Simulate: local is at 105 (stale), network says committed is 102
    const fetchAccount = vi.fn()
      .mockResolvedValueOnce({ sequenceNumber: () => "100" }) // seed
      .mockResolvedValueOnce({ sequenceNumber: () => "102" }); // after reset

    const manager = new SequenceManager(fetchAccount);

    // Advance local counter past what's confirmed on-chain
    for (let i = 0; i < 5; i++) await manager.nextAccount(ADDR_A);

    // Simulate tx_bad_seq → reset
    await manager.reset(ADDR_A);

    const { seq } = await manager.nextAccount(ADDR_A);
    expect(seq).toBe(102n); // fresh from network, not the stale local value
  });
});
