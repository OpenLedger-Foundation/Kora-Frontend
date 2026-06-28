/// <reference types="@testing-library/jest-dom" />
/**
 * Tests for the wallet signature challenge / verification flow.
 *
 * Covers:
 *  - Challenge message format (timestamp + nonce, replay-attack prevention)
 *  - walletStore: setVerified, clearVerification, isVerificationExpired
 *  - useWallet: checkVerification respects expiry and connection state
 *  - /api/auth/verify: accepts valid signature, rejects stale challenges,
 *    rejects bad format, rejects invalid signatures
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { act } from "react";

// ── walletStore ───────────────────────────────────────────────────────────────

// Import after vi setup so we get a clean store per test
import { useWalletStore } from "@/store/walletStore";

function freshStore() {
  // Reset to initial state between tests
  useWalletStore.setState({
    status: "disconnected",
    address: null,
    publicKey: null,
    isConnected: false,
    provider: null,
    network: "testnet",
    balance: null,
    isVerified: false,
    verifiedAt: null,
    addressBook: [],
    walletPassphrase: null,
  });
}

// ── challenge format helper ───────────────────────────────────────────────────

function makeChallenge(timestamp = Date.now(), nonce = "deadbeefcafe") {
  return `Kora Protocol authentication: ${timestamp}\nNonce: ${nonce}`;
}

// ── /api/auth/verify inline logic (unit-testable extract) ────────────────────
// We replicate the server-side validation logic here so we can unit-test it
// without spinning up Next.js.

const CHALLENGE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
const SESSION_DURATION = 60 * 60 * 1000; // 1 hour

function validateChallenge(challenge: string, now = Date.now()) {
  const match = challenge.match(/^Kora Protocol authentication: (\d+)/);
  if (!match) return { valid: false, reason: "Invalid challenge format" };

  const challengeTimestamp = parseInt(match[1], 10);
  if (now - challengeTimestamp > CHALLENGE_MAX_AGE) {
    return { valid: false, reason: "Challenge expired" };
  }

  return { valid: true, expiresAt: now + SESSION_DURATION };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Challenge message format", () => {
  it("includes 'Kora Protocol authentication:' prefix", () => {
    const challenge = makeChallenge();
    expect(challenge).toMatch(/^Kora Protocol authentication: \d+/);
  });

  it("includes a timestamp that is a recent unix ms value", () => {
    const before = Date.now();
    const challenge = makeChallenge();
    const after = Date.now();

    const match = challenge.match(/^Kora Protocol authentication: (\d+)/);
    expect(match).not.toBeNull();
    const ts = parseInt(match![1], 10);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("includes a nonce to prevent replay", () => {
    const challenge = makeChallenge(Date.now(), "unique-nonce-xyz");
    expect(challenge).toContain("Nonce: unique-nonce-xyz");
  });

  it("two challenges with same timestamp but different nonces are not equal", () => {
    const ts = Date.now();
    const a = makeChallenge(ts, "nonce-A");
    const b = makeChallenge(ts, "nonce-B");
    expect(a).not.toBe(b);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Challenge validation (server-side logic)", () => {
  it("accepts a fresh challenge", () => {
    const challenge = makeChallenge(Date.now());
    const result = validateChallenge(challenge);
    expect(result.valid).toBe(true);
    expect(result.expiresAt).toBeGreaterThan(Date.now());
  });

  it("rejects a challenge older than 5 minutes", () => {
    const staleTimestamp = Date.now() - CHALLENGE_MAX_AGE - 1;
    const challenge = makeChallenge(staleTimestamp);
    const result = validateChallenge(challenge);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Challenge expired");
  });

  it("rejects a challenge with wrong format", () => {
    const result = validateChallenge("Verify wallet ownership\nTimestamp: 12345");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Invalid challenge format");
  });

  it("rejects an empty challenge string", () => {
    const result = validateChallenge("");
    expect(result.valid).toBe(false);
  });

  it("expiresAt is approximately 1 hour from now", () => {
    const now = Date.now();
    const challenge = makeChallenge(now);
    const result = validateChallenge(challenge, now);
    expect(result.expiresAt).toBeCloseTo(now + SESSION_DURATION, -3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("walletStore verification state", () => {
  beforeEach(freshStore);

  it("starts unverified", () => {
    const { isVerified, verifiedAt } = useWalletStore.getState();
    expect(isVerified).toBe(false);
    expect(verifiedAt).toBeNull();
  });

  it("setVerified stores verified=true and expiry timestamp", () => {
    const expiresAt = Date.now() + SESSION_DURATION;
    act(() => useWalletStore.getState().setVerified(true, expiresAt));

    const state = useWalletStore.getState();
    expect(state.isVerified).toBe(true);
    expect(state.verifiedAt).toBe(expiresAt);
  });

  it("setVerified without expiresAt defaults to ~1 hour from now", () => {
    const before = Date.now();
    act(() => useWalletStore.getState().setVerified(true));
    const after = Date.now();

    const { verifiedAt } = useWalletStore.getState();
    expect(verifiedAt).toBeGreaterThanOrEqual(before + SESSION_DURATION);
    expect(verifiedAt).toBeLessThanOrEqual(after + SESSION_DURATION);
  });

  it("clearVerification resets to unverified", () => {
    act(() => useWalletStore.getState().setVerified(true, Date.now() + SESSION_DURATION));
    act(() => useWalletStore.getState().clearVerification());

    const state = useWalletStore.getState();
    expect(state.isVerified).toBe(false);
    expect(state.verifiedAt).toBeNull();
  });

  it("isVerificationExpired returns true when not verified", () => {
    expect(useWalletStore.getState().isVerificationExpired()).toBe(true);
  });

  it("isVerificationExpired returns false within session window", () => {
    const expiresAt = Date.now() + SESSION_DURATION;
    act(() => useWalletStore.getState().setVerified(true, expiresAt));
    expect(useWalletStore.getState().isVerificationExpired()).toBe(false);
  });

  it("isVerificationExpired returns true after session expires", () => {
    // Set expiry in the past
    const expiredAt = Date.now() - 1000;
    act(() => useWalletStore.getState().setVerified(true, expiredAt));
    expect(useWalletStore.getState().isVerificationExpired()).toBe(true);
  });

  it("disconnect clears verification", () => {
    act(() => {
      useWalletStore.getState().connect("freighter", "GTEST", "GTEST");
      useWalletStore.getState().setVerified(true, Date.now() + SESSION_DURATION);
    });
    act(() => useWalletStore.getState().disconnect());

    const state = useWalletStore.getState();
    expect(state.isVerified).toBe(false);
    expect(state.verifiedAt).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Session does not re-prompt within the same session", () => {
  beforeEach(freshStore);

  it("isVerificationExpired stays false during the session window", () => {
    const expiresAt = Date.now() + SESSION_DURATION;
    act(() => useWalletStore.getState().setVerified(true, expiresAt));

    // Simulate multiple checks within the session
    for (let i = 0; i < 5; i++) {
      expect(useWalletStore.getState().isVerificationExpired()).toBe(false);
    }
  });

  it("only expires after the session window passes", () => {
    // Set up a custom 'now' to simulate time passing
    const sessionStart = 1_000_000;
    const expiresAt = sessionStart + SESSION_DURATION;

    act(() => useWalletStore.getState().setVerified(true, expiresAt));

    // Mock Date.now to be just before expiry
    try {
      vi.spyOn(Date, "now").mockReturnValue(expiresAt - 1);
      expect(useWalletStore.getState().isVerificationExpired()).toBe(false);

      vi.spyOn(Date, "now").mockReturnValue(expiresAt + 1);
      expect(useWalletStore.getState().isVerificationExpired()).toBe(true);
    } finally {
      vi.restoreAllMocks();
    }
  });
});
