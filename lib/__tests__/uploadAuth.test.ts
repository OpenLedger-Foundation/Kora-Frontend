/**
 * Tests for upload request signing helpers — Issue #275
 * Covers: valid signature, invalid signature, expired token, malformed token.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildUploadChallenge,
  signUploadChallenge,
  verifyUploadToken,
} from "@/lib/security";
import * as StellarSdk from "@stellar/stellar-sdk";

// Generate a real Stellar keypair for tests
const keypair = StellarSdk.Keypair.random();
const walletAddress = keypair.publicKey();

/** Signs a challenge the same way verifyUploadToken expects */
function signChallenge(challenge: string): string {
  const sig = keypair.sign(Buffer.from(challenge, "utf8"));
  return Buffer.from(sig).toString("hex");
}

function makeToken(walletAddr: string, timestamp: number, signature: string): string {
  return btoa(`${walletAddr}.${timestamp}.${signature}`);
}

describe("buildUploadChallenge", () => {
  it("includes wallet address and timestamp", () => {
    const ts = 1700000000000;
    const c = buildUploadChallenge(walletAddress, ts);
    expect(c).toBe(`kora-upload:${walletAddress}:${ts}`);
  });
});

describe("signUploadChallenge", () => {
  it("returns a base64 token", async () => {
    const sign = async (msg: string) => ({
      signedMessage: signChallenge(msg),
    });
    const token = await signUploadChallenge(walletAddress, sign);
    expect(typeof token).toBe("string");
    // Should be decodable base64
    expect(() => atob(token)).not.toThrow();
  });
});

describe("verifyUploadToken", () => {
  it("accepts a valid token", () => {
    const timestamp = Date.now();
    const challenge = buildUploadChallenge(walletAddress, timestamp);
    const sig = signChallenge(challenge);
    const token = makeToken(walletAddress, timestamp, sig);

    const result = verifyUploadToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.walletAddress).toBe(walletAddress);
  });

  it("rejects an expired token", () => {
    const timestamp = Date.now() - 6 * 60 * 1000; // 6 min ago
    const challenge = buildUploadChallenge(walletAddress, timestamp);
    const sig = signChallenge(challenge);
    const token = makeToken(walletAddress, timestamp, sig);

    const result = verifyUploadToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/expired/i);
  });

  it("rejects a token with wrong signature", () => {
    const timestamp = Date.now();
    const wrongSig = "deadbeef".repeat(8); // 64 hex chars, invalid sig
    const token = makeToken(walletAddress, timestamp, wrongSig);

    const result = verifyUploadToken(token);
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed token", () => {
    const result = verifyUploadToken("notbase64!!!");
    expect(result.ok).toBe(false);
  });

  it("rejects a token with invalid wallet address", () => {
    const timestamp = Date.now();
    const sig = signChallenge(buildUploadChallenge("BADADDRESS", timestamp));
    const token = makeToken("BADADDRESS", timestamp, sig);

    const result = verifyUploadToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Invalid wallet/i);
  });
});
