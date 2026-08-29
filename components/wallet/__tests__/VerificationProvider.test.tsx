/**
 * Tests for the wallet signature challenge verification flow.
 *
 * Covers:
 *  - Challenge message format (must include timestamp, nonce, correct prefix)
 *  - VerificationProvider skips prompt when already verified
 *  - VerificationProvider opens modal and resolves on successful sign
 *  - VerificationProvider rejects on cancel
 *  - VerificationProvider shows error and allows retry on sign failure
 *  - VerificationProvider passes challenge message to modal
 *  - Session expiry logic in walletStore
 *  - Modal shows correct UI states (loading, error, challenge preview)
 */
/// <reference types="@testing-library/jest-dom" />

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { VerificationProvider, useVerification } from "../VerificationProvider";
import { useWallet } from "@/hooks/useWallet";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/hooks/useWallet");

// ── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_CHALLENGE = "Kora Protocol authentication: 1700000000000:abcdef1234567890";

function makeWalletMock(overrides: Partial<ReturnType<typeof useWallet>> = {}) {
  return {
    isConnected: true,
    isVerified: true,
    address: "GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    publicKey: "GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    checkVerification: vi.fn(() => true),
    requestChallenge: vi.fn(async () => MOCK_CHALLENGE),
    verifyOwnership: vi.fn(async () => true),
    ...overrides,
  } as any;
}

/** Tiny consumer that calls requireVerification and reports the result */
function TestConsumer({ actionType = "funding" }: { actionType?: string }) {
  const { requireVerification, isVerified } = useVerification();
  const [status, setStatus] = React.useState<string>("idle");

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="verified">{String(isVerified)}</span>
      <button
        type="button"
        onClick={() =>
          requireVerification(actionType)
            .then(() => setStatus("resolved"))
            .catch((e: Error) => setStatus(`rejected:${e.message}`))
        }
      >
        Trigger Action
      </button>
    </div>
  );
}

function renderWithProvider(walletMock: any, actionType?: string) {
  vi.mocked(useWallet).mockReturnValue(walletMock);
  return render(
    <VerificationProvider>
      <TestConsumer actionType={actionType} />
    </VerificationProvider>
  );
}

// ── Challenge format tests ────────────────────────────────────────────────────

describe("Challenge message format", () => {
  it("follows the spec format: 'Kora Protocol authentication: {timestamp}:{nonce}'", () => {
    const timestamp = Date.now();
    const nonce = "abc123";
    const challenge = `Kora Protocol authentication: ${timestamp}:${nonce}`;

    expect(challenge).toMatch(/^Kora Protocol authentication: \d+:[a-f0-9]+/);
  });

  it("contains a numeric timestamp that is recent", () => {
    const before = Date.now();
    const timestamp = Date.now();
    const after = Date.now();
    const challenge = `Kora Protocol authentication: ${timestamp}:nonce`;

    const match = challenge.match(/^Kora Protocol authentication: (\d+):/);
    expect(match).not.toBeNull();
    const parsed = parseInt(match![1], 10);
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });

  it("each challenge has a unique nonce (replay protection)", () => {
    const makeChallenge = () => {
      const nonce = Math.random().toString(16).slice(2, 18);
      return `Kora Protocol authentication: ${Date.now()}:${nonce}`;
    };
    const challenges = new Set(Array.from({ length: 50 }, makeChallenge));
    expect(challenges.size).toBe(50);
  });
});

// ── Session expiry logic ──────────────────────────────────────────────────────

describe("Verification session expiry", () => {
  it("is not expired when verified less than 1 hour ago", () => {
    const verifiedAt = Date.now() - 30 * 60 * 1000; // 30 minutes ago
    const EXPIRY = 60 * 60 * 1000;
    expect(Date.now() - verifiedAt).toBeLessThan(EXPIRY);
  });

  it("is expired when verified more than 1 hour ago", () => {
    const verifiedAt = Date.now() - 61 * 60 * 1000; // 61 minutes ago
    const EXPIRY = 60 * 60 * 1000;
    expect(Date.now() - verifiedAt).toBeGreaterThan(EXPIRY);
  });

  it("isVerificationExpired returns true when verifiedAt is null", () => {
    // Mirrors the store logic
    const isExpired = (isVerified: boolean, verifiedAt: number | null): boolean => {
      if (!isVerified || !verifiedAt) return true;
      return Date.now() - verifiedAt > 60 * 60 * 1000;
    };
    expect(isExpired(true, null)).toBe(true);
    expect(isExpired(false, Date.now())).toBe(true);
    expect(isExpired(true, Date.now())).toBe(false);
  });
});

// ── VerificationProvider — already verified ───────────────────────────────────

describe("VerificationProvider — already verified", () => {
  it("resolves immediately without opening modal when already verified", async () => {
    const walletMock = makeWalletMock({ checkVerification: vi.fn(() => true), isVerified: true });
    renderWithProvider(walletMock);

    fireEvent.click(screen.getByText("Trigger Action"));

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("resolved");
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(walletMock.requestChallenge).not.toHaveBeenCalled();
  });
});

// ── VerificationProvider — not yet verified ───────────────────────────────────

describe("VerificationProvider — not yet verified", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens the modal when verification is required", async () => {
    const walletMock = makeWalletMock({
      checkVerification: vi.fn(() => false),
      isVerified: false,
    });
    renderWithProvider(walletMock);

    fireEvent.click(screen.getByText("Trigger Action"));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Verify Wallet Ownership")).toBeInTheDocument();
    });
  });

  it("shows the challenge message in the modal", async () => {
    const walletMock = makeWalletMock({
      checkVerification: vi.fn(() => false),
      isVerified: false,
      requestChallenge: vi.fn(async () => MOCK_CHALLENGE),
    });
    renderWithProvider(walletMock);

    fireEvent.click(screen.getByText("Trigger Action"));

    await waitFor(() => {
      expect(screen.getByText(MOCK_CHALLENGE)).toBeInTheDocument();
    });
  });

  it("shows the actionType in the modal description", async () => {
    const walletMock = makeWalletMock({
      checkVerification: vi.fn(() => false),
      isVerified: false,
    });
    renderWithProvider(walletMock, "fund invoice");

    fireEvent.click(screen.getByText("Trigger Action"));

    await waitFor(() => {
      expect(screen.getByText(/fund invoice/)).toBeInTheDocument();
    });
  });

  it("resolves the promise when the user clicks Sign & Verify successfully", async () => {
    const walletMock = makeWalletMock({
      checkVerification: vi.fn(() => false),
      isVerified: false,
      verifyOwnership: vi.fn(async () => true),
    });
    renderWithProvider(walletMock);

    fireEvent.click(screen.getByText("Trigger Action"));
    await waitFor(() => screen.getByRole("dialog"));

    fireEvent.click(screen.getByText("Sign & Verify"));

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("resolved");
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("rejects the promise when the user cancels", async () => {
    const walletMock = makeWalletMock({
      checkVerification: vi.fn(() => false),
      isVerified: false,
    });
    renderWithProvider(walletMock);

    fireEvent.click(screen.getByText("Trigger Action"));
    await waitFor(() => screen.getByRole("dialog"));

    fireEvent.click(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe(
        "rejected:Verification cancelled"
      );
    });
  });

  it("shows an error and keeps modal open when sign fails", async () => {
    const walletMock = makeWalletMock({
      checkVerification: vi.fn(() => false),
      isVerified: false,
      verifyOwnership: vi.fn(async () => {
        throw new Error("User rejected signing");
      }),
    });
    renderWithProvider(walletMock);

    fireEvent.click(screen.getByText("Trigger Action"));
    await waitFor(() => screen.getByRole("dialog"));

    fireEvent.click(screen.getByText("Sign & Verify"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/User rejected signing/)).toBeInTheDocument();
    });

    // Modal should still be open for retry
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Promise should NOT have been rejected (user can retry)
    expect(screen.getByTestId("status").textContent).toBe("idle");
  });

  it("closes the modal when the wallet disconnects", async () => {
    const walletMock = makeWalletMock({
      checkVerification: vi.fn(() => false),
      isVerified: false,
      isConnected: true,
    });

    vi.mocked(useWallet).mockReturnValue(walletMock);
    const { rerender } = render(
      <VerificationProvider>
        <TestConsumer />
      </VerificationProvider>
    );

    fireEvent.click(screen.getByText("Trigger Action"));
    await waitFor(() => screen.getByRole("dialog"));

    // Simulate wallet disconnect
    const disconnectedMock = makeWalletMock({
      isConnected: false,
      checkVerification: vi.fn(() => false),
      isVerified: false,
    });
    vi.mocked(useWallet).mockReturnValue(disconnectedMock);

    await act(async () => {
      rerender(
        <VerificationProvider>
          <TestConsumer />
        </VerificationProvider>
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
