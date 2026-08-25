/**
 * Tests for multi-gateway IPFS fallback + CID integrity verification (#393).
 *
 * Covers:
 *  - decodeCid for CIDv0 (base58) and CIDv1 (base32)
 *  - verifyCidIntegrity: match / mismatch / unverifiable
 *  - fetchFromIpfsWithFallback: gateway rotation, tamper rejection, unavailability
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  decodeCid,
  verifyCidIntegrity,
  fetchFromIpfsWithFallback,
  IpfsTamperError,
  IpfsUnavailableError,
  isValidCID,
} from "../ipfs";

// ─── Helpers: build a real raw (0x55) CIDv1 from content ──────────────────────

const B32 = "abcdefghijklmnopqrstuvwxyz234567";

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

/** Compute the canonical raw-codec sha2-256 CIDv1 for the given content. */
async function rawCidV1(content: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", content));
  const prefix = Uint8Array.from([0x01, 0x55, 0x12, 0x20]); // v1, raw, sha2-256, len 32
  const full = new Uint8Array(prefix.length + digest.length);
  full.set(prefix, 0);
  full.set(digest, prefix.length);
  return "b" + base32Encode(full);
}

function arrayBufferResponse(bytes: Uint8Array, ok = true) {
  return {
    ok,
    status: ok ? 200 : 502,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as unknown as Response;
}

const CID_V0 = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";

describe("decodeCid", () => {
  it("decodes a CIDv0 (base58 dag-pb) into a 32-byte sha2-256 digest", () => {
    const decoded = decodeCid(CID_V0);
    expect(decoded).not.toBeNull();
    expect(decoded!.version).toBe(0);
    expect(decoded!.codec).toBe(0x70); // dag-pb
    expect(decoded!.hashCode).toBe(0x12); // sha2-256
    expect(decoded!.digest.length).toBe(32);
  });

  it("decodes a raw CIDv1 (base32) into codec 0x55 + digest", async () => {
    const cid = await rawCidV1(new TextEncoder().encode("hello world"));
    const decoded = decodeCid(cid);
    expect(decoded).not.toBeNull();
    expect(decoded!.version).toBe(1);
    expect(decoded!.codec).toBe(0x55); // raw
    expect(decoded!.digest.length).toBe(32);
  });

  it("returns null for garbage", () => {
    expect(decodeCid("not-a-cid")).toBeNull();
  });
});

describe("verifyCidIntegrity", () => {
  it("returns true when content matches a raw CIDv1", async () => {
    const content = new TextEncoder().encode("kora invoice metadata");
    const cid = await rawCidV1(content);
    expect(await verifyCidIntegrity(cid, content)).toBe(true);
  });

  it("returns false when content does NOT match the CID (tampered)", async () => {
    const content = new TextEncoder().encode("original");
    const cid = await rawCidV1(content);
    const tampered = new TextEncoder().encode("tampered!");
    expect(await verifyCidIntegrity(cid, tampered)).toBe(false);
  });

  it("returns null (unverifiable) for dag-pb CIDv0 — cannot recompute raw hash", async () => {
    const content = new TextEncoder().encode("whatever");
    expect(await verifyCidIntegrity(CID_V0, content)).toBeNull();
  });
});

describe("fetchFromIpfsWithFallback", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  it("rotates to the next gateway when the first one fails", async () => {
    const content = new TextEncoder().encode("payload-A");
    const cid = await rawCidV1(content);

    mockFetch
      .mockRejectedValueOnce(new Error("gw1 down")) // gateway 1 unreachable
      .mockResolvedValueOnce(arrayBufferResponse(content)); // gateway 2 serves it

    const result = await fetchFromIpfsWithFallback(cid, {
      gateways: ["https://gw1/ipfs", "https://gw2/ipfs"],
      retriesPerGateway: 0,
    });

    expect(result.gateway).toBe("https://gw2/ipfs");
    expect(result.integrity).toBe("verified");
    expect(result.text).toBe("payload-A");
  });

  it("skips a gateway serving tampered content and fails over to a clean one", async () => {
    const content = new TextEncoder().encode("real-content");
    const cid = await rawCidV1(content);
    const tampered = new TextEncoder().encode("evil-content");

    mockFetch
      .mockResolvedValueOnce(arrayBufferResponse(tampered)) // gw1 tampered
      .mockResolvedValueOnce(arrayBufferResponse(content)); // gw2 clean

    const result = await fetchFromIpfsWithFallback(cid, {
      gateways: ["https://gw1/ipfs", "https://gw2/ipfs"],
      retriesPerGateway: 0,
    });

    expect(result.gateway).toBe("https://gw2/ipfs");
    expect(result.integrity).toBe("verified");
  });

  it("throws IpfsTamperError when every gateway serves tampered content", async () => {
    const content = new TextEncoder().encode("authentic");
    const cid = await rawCidV1(content);
    const tampered = new TextEncoder().encode("forged");

    mockFetch.mockResolvedValue(arrayBufferResponse(tampered));

    await expect(
      fetchFromIpfsWithFallback(cid, {
        gateways: ["https://gw1/ipfs", "https://gw2/ipfs"],
      })
    ).rejects.toBeInstanceOf(IpfsTamperError);
  });

  it("throws IpfsUnavailableError when all gateways are unreachable", async () => {
    const content = new TextEncoder().encode("x");
    const cid = await rawCidV1(content);

    mockFetch.mockRejectedValue(new Error("network down"));

    await expect(
      fetchFromIpfsWithFallback(cid, {
        gateways: ["https://gw1/ipfs", "https://gw2/ipfs"],
        retriesPerGateway: 0,
      })
    ).rejects.toBeInstanceOf(IpfsUnavailableError);
  });

  it("accepts unverifiable (dag-pb) content without flagging tampering", async () => {
    const content = new TextEncoder().encode('{"ok":true}');
    mockFetch.mockResolvedValueOnce(arrayBufferResponse(content));

    const result = await fetchFromIpfsWithFallback(CID_V0, {
      gateways: ["https://gw1/ipfs"],
    });
    expect(result.integrity).toBe("unverifiable");
  });

  it("still recognizes the broadened CID format", () => {
    expect(isValidCID(CID_V0)).toBe(true);
    expect(isValidCID("invalid-cid")).toBe(false);
  });
});
