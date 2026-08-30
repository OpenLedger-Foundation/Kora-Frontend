import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { InProgressOverlay } from "../InProgressOverlay";
import { useUIStore } from "@/store/uiStore";

// Mock framer-motion to simplify DOM output
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}));

// Mock useTransaction hook and providers
vi.mock("@/hooks/useTransaction", () => ({
  useTransaction: () => ({
    cancel: vi.fn(),
    extendTimeout: vi.fn(),
  }),
  useSecondaryEscrowFlow: () => ({
    escrowState: { step: "idle", attemptHistory: [] },
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
    escrowState: { attemptHistory: [] },
  }),
}));

describe("InProgressOverlay - Accessibility & Live Regions", () => {
  beforeEach(() => {
    useUIStore.setState({
      txState: { status: "idle" },
    });
  });

  it("does not render when txState is idle", () => {
    render(<InProgressOverlay />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders with role=dialog, aria-modal=true, and live region during signing stage", () => {
    useUIStore.setState({
      txState: {
        status: "signing",
        startedAt: Date.now(),
        timeoutMs: 60000,
      },
    });

    render(<InProgressOverlay />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const liveRegion = screen.getByTestId("tx-overlay-announcement");
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute("role", "status");
    expect(liveRegion).toHaveAttribute("aria-live", "assertive");
    expect(liveRegion).toHaveTextContent(/Waiting for transaction signature/i);
  });

  it("announces timeout when txState status is timeout", () => {
    useUIStore.setState({
      txState: {
        status: "timeout",
      },
    });

    render(<InProgressOverlay />);

    const liveRegion = screen.getByTestId("tx-overlay-announcement");
    expect(liveRegion).toHaveTextContent(/signing request timed out/i);
  });
});
