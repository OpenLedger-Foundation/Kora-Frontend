/// <reference types="@testing-library/jest-dom" />
/**
 * KycStatusCard — unit tests (Issue #822)
 *
 * Covers all four kycStatus UI variants:
 *  1. "none"     → Shield icon, unverified description, "Verify" CTA button
 *  2. "pending"  → Loader2 spinner icon, pending description, pending badge
 *  3. "verified" → ShieldCheck icon, verified description, verified badge (no CTA button)
 *  4. "rejected" → ShieldAlert icon, rejected description, "Re-verify" danger button
 *
 * Additional:
 *  5. "none" / "rejected" CTA buttons open the KYC modal on click
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Hoisted store mock ─────────────────────────────────────────────────────────
// Use a real Zustand store so useWalletStore() (no selector) and
// useWalletStore(selector) both work correctly.

const { mockWalletStore } = vi.hoisted(() => {
  const { create } = require("zustand");
  const mockWalletStore = create<any>()(() => ({
    kycStatus: "none" as "none" | "pending" | "verified" | "rejected",
    setKycStatus: (status: string) =>
      mockWalletStore.setState({ kycStatus: status }),
  }));
  return { mockWalletStore };
});

vi.mock("@/store/walletStore", () => ({
  useWalletStore: mockWalletStore,
}));

// next-intl: return the dotted key so assertions are copy-change-proof
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// SynapsKycModal: lightweight stub — renders a sentinel when open=true
vi.mock("@/components/wallet/SynapsKycModal", () => ({
  SynapsKycModal: ({ open }: { open: boolean; onOpenChange: (v: boolean) => void }) =>
    open ? <div data-testid="kyc-modal" /> : null,
}));

import { KycStatusCard } from "@/components/dashboard/KycStatusCard";

// ── Helpers ───────────────────────────────────────────────────────────────────

function setStatus(status: "none" | "pending" | "verified" | "rejected") {
  mockWalletStore.setState({ kycStatus: status });
}

function renderCard() {
  return render(<KycStatusCard />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("KycStatusCard", () => {
  beforeEach(() => {
    setStatus("none");
  });

  // ── 1. "none" variant ──────────────────────────────────────────────────────

  describe('status "none" (unverified)', () => {
    beforeEach(() => setStatus("none"));

    it("renders without crashing", () => {
      const { container } = renderCard();
      expect(container).not.toBeEmptyDOMElement();
    });

    it("shows the unverified description key", () => {
      renderCard();
      expect(screen.getByText("desc.unverified")).toBeInTheDocument();
    });

    it("shows the Verify CTA button", () => {
      renderCard();
      expect(screen.getByRole("button", { name: /cta\.verify/i })).toBeInTheDocument();
    });

    it("does not show a status badge", () => {
      renderCard();
      expect(screen.queryByText("status.verified")).not.toBeInTheDocument();
      expect(screen.queryByText("status.pending")).not.toBeInTheDocument();
    });

    it("does not show the Re-verify button", () => {
      renderCard();
      expect(screen.queryByRole("button", { name: /cta\.reverify/i })).not.toBeInTheDocument();
    });

    it("opens the KYC modal when the Verify button is clicked", () => {
      renderCard();
      expect(screen.queryByTestId("kyc-modal")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /cta\.verify/i }));
      expect(screen.getByTestId("kyc-modal")).toBeInTheDocument();
    });
  });

  // ── 2. "pending" variant ───────────────────────────────────────────────────

  describe('status "pending"', () => {
    beforeEach(() => setStatus("pending"));

    it("shows the pending description key", () => {
      renderCard();
      expect(screen.getByText("desc.pending")).toBeInTheDocument();
    });

    it("shows the pending status badge", () => {
      renderCard();
      expect(screen.getByText("status.pending")).toBeInTheDocument();
    });

    it("does not show a CTA button", () => {
      renderCard();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("does not show the verified badge", () => {
      renderCard();
      expect(screen.queryByText("status.verified")).not.toBeInTheDocument();
    });
  });

  // ── 3. "verified" variant ──────────────────────────────────────────────────

  describe('status "verified"', () => {
    beforeEach(() => setStatus("verified"));

    it("shows the verified description key", () => {
      renderCard();
      expect(screen.getByText("desc.verified")).toBeInTheDocument();
    });

    it("shows the verified status badge", () => {
      renderCard();
      expect(screen.getByText("status.verified")).toBeInTheDocument();
    });

    it("does not show any CTA button", () => {
      renderCard();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("does not show the pending badge", () => {
      renderCard();
      expect(screen.queryByText("status.pending")).not.toBeInTheDocument();
    });
  });

  // ── 4. "rejected" variant ──────────────────────────────────────────────────

  describe('status "rejected"', () => {
    beforeEach(() => setStatus("rejected"));

    it("shows the rejected description key", () => {
      renderCard();
      expect(screen.getByText("desc.rejected")).toBeInTheDocument();
    });

    it("shows the Re-verify danger button", () => {
      renderCard();
      expect(screen.getByRole("button", { name: /cta\.reverify/i })).toBeInTheDocument();
    });

    it("does not show the Verify CTA button", () => {
      renderCard();
      expect(screen.queryByRole("button", { name: /^cta\.verify$/i })).not.toBeInTheDocument();
    });

    it("does not show any status badge", () => {
      renderCard();
      expect(screen.queryByText("status.verified")).not.toBeInTheDocument();
      expect(screen.queryByText("status.pending")).not.toBeInTheDocument();
    });

    it("opens the KYC modal when the Re-verify button is clicked", () => {
      renderCard();
      expect(screen.queryByTestId("kyc-modal")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /cta\.reverify/i }));
      expect(screen.getByTestId("kyc-modal")).toBeInTheDocument();
    });
  });
});
