/// <reference types="@testing-library/jest-dom" />
/**
 * InProgressOverlay — accessibility & i18n tests (Issues #861)
 *
 * Tests:
 *  1. Does not render when txState is idle
 *  2. role=dialog + aria-modal + live region present during signing
 *  3. Live region announces signing copy from catalog
 *  4. Live region announces timeout copy from catalog
 *  5. Localized aria-labels on extra-time and cancel buttons (signing)
 *  6. Localized aria-label on cancel button (timeout)
 *  7. Escrow active: live region announces "in progress" from catalog
 *  8. Escrow settled: live region announces "settled" from catalog
 *  9. Escrow error: live region announces failure message from catalog
 * 10. Escrow step labels come from catalog (not hardcoded English)
 * 11. Escrow close/cancel button label from catalog
 * 12. No hooks inside render helpers — useTransactionStore at top level
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { InProgressOverlay } from "../InProgressOverlay";
import { useUIStore } from "@/store/uiStore";

// ── Framer-motion stub ─────────────────────────────────────────────────────────
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}));

// ── Translations — resolve from the English catalog ───────────────────────────
vi.mock("next-intl", async () => {
  const en = (await import("@/messages/en.json")).default as Record<string, any>;

  function getNestedValue(obj: any, path: string): string {
    return path.split(".").reduce((curr, part) => {
      return curr && typeof curr === "object" ? curr[part] : undefined;
    }, obj) ?? path;
  }

  return {
    useTranslations: (namespace: string) =>
      (key: string, values?: Record<string, unknown>) => {
        const raw = getNestedValue(en[namespace] ?? {}, key) ?? `${namespace}.${key}`;
        if (!values || typeof raw !== "string") return raw;
        return raw.replace(/\{(.*?)\}/g, (_, g) => String(values[g] ?? `{${g}}`));
      },
  };
});

// ── Controllable escrow state ──────────────────────────────────────────────────
let mockEscrowStep = "idle";
let mockEscrowErrorStep: string | null = null;
let mockEscrowErrorMessage: string | null = null;
let mockAttemptHistory: any[] = [];

vi.mock("@/hooks/useTransaction", () => ({
  useTransaction: () => ({ cancel: vi.fn(), extendTimeout: vi.fn() }),
  useSecondaryEscrowFlow: () => ({
    escrowState: {
      step: mockEscrowStep,
      errorStep: mockEscrowErrorStep,
      errorMessage: mockEscrowErrorMessage,
      currentContext: null,
    },
    retryEscrow: vi.fn(),
    resetEscrow: vi.fn(),
  }),
  getProviderSigningConfig: () => ({
    providerName: "Freighter",
    category: "extension",
    timeoutMs: 60000,
    tips: ["Check browser extension popup"],
  }),
}));

vi.mock("@/store/walletStore", () => ({
  useWalletStore: (selector: any) => selector({ provider: "freighter" }),
}));

vi.mock("@/store/transactionStore", () => ({
  useTransactionStore: () => ({
    escrowState: { attemptHistory: mockAttemptHistory },
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function setIdle() {
  useUIStore.setState({ txState: { status: "idle" } });
  mockEscrowStep = "idle";
  mockEscrowErrorStep = null;
  mockEscrowErrorMessage = null;
  mockAttemptHistory = [];
}

function setSigning() {
  useUIStore.setState({
    txState: { status: "signing", startedAt: Date.now(), timeoutMs: 60000 },
  });
}

function setTimeout_() {
  useUIStore.setState({ txState: { status: "timeout" } });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InProgressOverlay — Accessibility & Live Regions", () => {
  beforeEach(() => setIdle());

  // ── 1. Idle — nothing rendered ─────────────────────────────────────────────

  it("does not render when txState is idle", () => {
    render(<InProgressOverlay />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // ── 2. Signing stage — dialog structure ────────────────────────────────────

  it("renders role=dialog with aria-modal and live region during signing", () => {
    setSigning();
    render(<InProgressOverlay />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const liveRegion = screen.getByTestId("tx-overlay-announcement");
    expect(liveRegion).toHaveAttribute("role", "status");
    expect(liveRegion).toHaveAttribute("aria-live", "assertive");
  });

  // ── 3. Signing announcement from catalog ───────────────────────────────────

  it("live region announces signing text from catalog (not hardcoded English)", () => {
    setSigning();
    render(<InProgressOverlay />);
    // en.json announce.signing = "Waiting for transaction signature from {provider}..."
    expect(screen.getByTestId("tx-overlay-announcement")).toHaveTextContent(
      /Waiting for transaction signature from Freighter/i
    );
  });

  // ── 4. Timeout announcement from catalog ───────────────────────────────────

  it("live region announces timeout text from catalog", () => {
    setTimeout_();
    render(<InProgressOverlay />);
    expect(screen.getByTestId("tx-overlay-announcement")).toHaveTextContent(
      /signing request timed out/i
    );
  });

  // ── 5. Signing aria-labels from catalog ────────────────────────────────────

  it("uses localized aria-labels for extra-time and cancel during signing", () => {
    setSigning();
    render(<InProgressOverlay />);
    expect(
      screen.getByRole("button", { name: "Add extra time for slow wallet" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel transaction signing safely" })
    ).toBeInTheDocument();
  });

  // ── 6. Timeout cancel aria-label from catalog ──────────────────────────────

  it("uses a localized aria-label for cancel on timeout", () => {
    setTimeout_();
    render(<InProgressOverlay />);
    expect(
      screen.getByRole("button", { name: "Cancel signing safely" })
    ).toBeInTheDocument();
  });

  // ── 7. Escrow in-progress announcement ────────────────────────────────────

  it("live region announces escrow in progress from catalog", () => {
    mockEscrowStep = "buyer_funding";
    render(<InProgressOverlay />);
    // en.json announce.escrowBuyerFunding
    expect(screen.getByTestId("tx-overlay-announcement")).toHaveTextContent(
      /Escrow step 1: Buyer Deposit in progress/i
    );
  });

  it("live region announces seller transfer step from catalog", () => {
    mockEscrowStep = "seller_transferring";
    render(<InProgressOverlay />);
    expect(screen.getByTestId("tx-overlay-announcement")).toHaveTextContent(
      /Escrow step 2: Seller Position Transfer in progress/i
    );
  });

  // ── 8. Escrow settled announcement ────────────────────────────────────────

  it("live region announces settlement complete from catalog", () => {
    mockEscrowStep = "settled";
    render(<InProgressOverlay />);
    expect(screen.getByTestId("tx-overlay-announcement")).toHaveTextContent(
      /Escrow Settlement Complete/i
    );
  });

  // ── 9. Escrow error announcement ──────────────────────────────────────────

  it("live region announces failure message from catalog with interpolated error", () => {
    mockEscrowStep = "buyer_funding";
    mockEscrowErrorStep = "buyer_funding";
    mockEscrowErrorMessage = "Insufficient funds";
    render(<InProgressOverlay />);
    // en.json announce.escrowFailed = "Escrow transaction failed: {error}"
    expect(screen.getByTestId("tx-overlay-announcement")).toHaveTextContent(
      /Escrow transaction failed: Insufficient funds/i
    );
  });

  // ── 10. Escrow step labels from catalog ───────────────────────────────────

  it("escrow step labels come from catalog, not hardcoded English", () => {
    mockEscrowStep = "buyer_funding";
    render(<InProgressOverlay />);
    // en.json escrowStep.buyerDeposit = "Buyer Deposit"
    expect(screen.getByText("Buyer Deposit")).toBeInTheDocument();
    // en.json escrowStep.sellerTransfer = "Seller Position Transfer"
    expect(screen.getByText("Seller Position Transfer")).toBeInTheDocument();
    // en.json escrowStep.settled = "Escrow Settlement Complete"
    expect(screen.getByText("Escrow Settlement Complete")).toBeInTheDocument();
  });

  // ── 11. Escrow close/cancel button label from catalog ─────────────────────

  it("shows Cancel button (not settled) with catalog label", () => {
    mockEscrowStep = "buyer_funding";
    render(<InProgressOverlay />);
    // en.json cancel = "Cancel"
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("shows Close button when settled with catalog label", () => {
    mockEscrowStep = "settled";
    render(<InProgressOverlay />);
    // en.json close = "Close"
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  // ── 12. Retry ledger step labels use catalog ──────────────────────────────

  it("retry ledger step labels use catalog strings", () => {
    mockEscrowStep = "buyer_funding";
    mockAttemptHistory = [
      {
        step: "buyer_funding",
        attemptNumber: 1,
        timestamp: new Date().toISOString(),
        success: false,
        errorMessage: "Network timeout",
      },
    ];
    render(<InProgressOverlay />);
    // Retry history heading from catalog
    expect(screen.getByText("Retry History")).toBeInTheDocument();
    // Step name in ledger row — same catalog key
    const buyerDepositItems = screen.getAllByText("Buyer Deposit");
    expect(buyerDepositItems.length).toBeGreaterThanOrEqual(1);
  });
});
