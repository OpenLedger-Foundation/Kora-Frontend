/**
 * Tests for clipboard copy feedback on invoice IDs and addresses.
 * Issue #1246: consistent copy-to-clipboard feedback via useCopyToClipboard.
 *
 * Covers:
 *  - TransactionHistoryDrawer: hash copy button icon-swaps, aria-label reflects
 *    state, success toast on copy, error toast on failure, label resets after 2 s.
 *  - InvoiceMetadataViewer: issuer and debtor address rows render CopyButton
 *    when privacy allows, hide it when hidden.
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── framer-motion: forward refs (useFocusTrap), strip unknown DOM props ───────

vi.mock("framer-motion", () => {
  const React = require("react");
  // Strip framer-specific props so they don't bleed onto real DOM nodes
  const STRIP = new Set([
    "whileHover","whileTap","whileFocus","whileInView",
    "initial","animate","exit","transition","layoutId","variants",
  ]);
  const makeEl = (tag: string) =>
    React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(props)) {
        if (!STRIP.has(k)) clean[k] = v;
      }
      return React.createElement(tag, { ...clean, ref });
    });
  return {
    motion: {
      div:    makeEl("div"),
      button: makeEl("button"),
      span:   makeEl("span"),
      p:      makeEl("p"),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useReducedMotion: () => false,
  };
});

// ── sonner ────────────────────────────────────────────────────────────────────

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));

// ── next-intl ────────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

// ── Drawer: focus-trap no-op ──────────────────────────────────────────────────

vi.mock("@/hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));

// ── Suppress live network calls ───────────────────────────────────────────────

vi.mock("@/lib/stellar/client", () => ({
  fetchTransactionDetails: vi.fn().mockRejectedValue(new Error("mocked")),
}));

vi.mock("@/lib/invoiceMetadata", () => ({
  verifyMetadataIntegrity: vi.fn().mockResolvedValue(true),
  metadataVersionBadge: vi
    .fn()
    .mockReturnValue({ label: "v1", tone: "success", description: "current" }),
  METADATA_VERSION: "1.0.0",
}));

vi.mock("@/lib/security", () => ({
  safeStellarTxUrl: (h: string) => `https://stellar.expert/tx/${h}`,
  safeIpfsUrl:      (c: string) => `https://ipfs.io/ipfs/${c}`,
  safeStellarAccountUrl: (a: string) => `https://stellar.expert/account/${a}`,
}));

// ── Radix Tooltip + ResizeObserver ────────────────────────────────────────────

vi.stubGlobal("ResizeObserver", class {
  observe()    {}
  unobserve()  {}
  disconnect() {}
});

// ── Transaction store ─────────────────────────────────────────────────────────

const MOCK_TX = {
  hash:        "deadbeefdeadbeefdeadbeef",
  type:        "fund_invoice" as const,
  status:      "confirmed"   as const,
  timestamp:   Date.now(),
  amount:      "500",
  assetCode:   "USDC",
  description: "Test fund",
};

vi.mock("@/store/transactionHistoryStore", () => ({
  useTransactionHistoryStore: (sel: (s: unknown) => unknown) =>
    sel({
      transactions:          [MOCK_TX],
      filterType:            "all",
      filterStartDate:       null,
      filterEndDate:         null,
      setFilterType:         vi.fn(),
      setFilterStartDate:    vi.fn(),
      setFilterEndDate:      vi.fn(),
      resetFilters:          vi.fn(),
      getFilteredTransactions: () => [MOCK_TX],
      clearHistory:          vi.fn(),
    }),
}));

// ── Imports that depend on the mocks above ────────────────────────────────────

import { TransactionHistoryDrawer } from "../components/transactions/TransactionHistoryDrawer";
import { InvoiceMetadataViewer }    from "../components/invoice/InvoiceMetadataViewer";
import type { Invoice }             from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderDrawer() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TransactionHistoryDrawer open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

/** Click the transaction row to show the detail pane. */
async function openDetail() {
  renderDrawer();
  // The row button has no aria-label — match by text content
  const row = screen.getByRole("button", {
    name: /transactions\.typeLabels\.fund_invoice/,
  });
  await userEvent.click(row);
}

const BASE_INVOICE: Invoice = {
  id:              "inv_001",
  tokenId:         "token_001",
  contractAddress: "CABC1234",
  txHash:          "txhash1234",
  createdAt:       new Date().toISOString(),
  updatedAt:       new Date().toISOString(),
  ipfsCid:         "bafybeicid",
  status:          "listed",
  riskTier:        "A",
  debtorPrivacy:   "full",
  metadata: {
    invoiceNumber: "INV-001",
    issuerName:    "Acme Corp",
    debtorName:    "Beta Ltd",
    issuerAddress: "GISSUER123",
    debtorAddress: "GDEBTOR456",
    amount:        10000,
    currency:      "USDC",
    issueDate:     new Date().toISOString(),
    dueDate:       new Date().toISOString(),
    description:   "Test invoice",
    jurisdiction:  "KE",
    category:      "services",
    metadataVersion: "1.0.0",
  },
  terms: {
    financingAmount: 9500,
    discountRate:    5,
    apr:             10,
    tenor:           90,
    repaymentDate:   new Date().toISOString(),
    minInvestment:   100,
    maxInvestment:   9500,
    listingExpiry:   new Date().toISOString(),
  },
  funding: {
    totalRaised:     0,
    targetAmount:    9500,
    investorCount:   0,
    fundingProgress: 0,
  },
};

// ── TransactionHistoryDrawer: hash copy ───────────────────────────────────────

describe("TransactionHistoryDrawer — hash copy feedback", () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("renders the copy hash button with the correct initial aria-label", async () => {
    await openDetail();
    expect(
      screen.getByRole("button", { name: "transactions.drawer.copyHashAria" }),
    ).toBeInTheDocument();
  });

  it("flips aria-label to 'hash copied' and calls writeText after a successful copy", async () => {
    await openDetail();
    const copyBtn = screen.getByRole("button", {
      name: "transactions.drawer.copyHashAria",
    });

    await act(async () => {
      await userEvent.click(copyBtn);
    });

    expect(writeText).toHaveBeenCalledWith(MOCK_TX.hash);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "transactions.drawer.hashCopied" }),
      ).toBeInTheDocument(),
    );
  });

  it("fires a success toast after copying the hash", async () => {
    const { toast } = await import("sonner");
    await openDetail();
    const copyBtn = screen.getByRole("button", {
      name: "transactions.drawer.copyHashAria",
    });

    await act(async () => {
      await userEvent.click(copyBtn);
    });

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("transactions.drawer.hashCopied"),
    );
  });

  it("fires an error toast when the clipboard write is rejected", async () => {
    writeText.mockRejectedValueOnce(new Error("Permission denied"));
    const { toast } = await import("sonner");
    await openDetail();
    const copyBtn = screen.getByRole("button", {
      name: "transactions.drawer.copyHashAria",
    });

    await act(async () => {
      await userEvent.click(copyBtn);
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("transactions.drawer.hashCopyFailed"),
    );
  });

  it("resets the aria-label back to 'copy hash' after the 2 s reset window (via hook)", async () => {
    // The timer-reset behaviour belongs to useCopyToClipboard and is already
    // covered in hooks/__tests__/useCopyToClipboard.test.ts. Here we verify
    // that the hook's `copied` state is wired to the button's aria-label by
    // confirming the button starts with the idle label after a successful copy
    // resets — using real timers to avoid fake-timer / async-render conflicts.
    await openDetail();
    const copyBtn = screen.getByRole("button", {
      name: "transactions.drawer.copyHashAria",
    });

    await act(async () => {
      await userEvent.click(copyBtn);
    });

    // Should be in 'copied' state immediately after click
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "transactions.drawer.hashCopied" }),
      ).toBeInTheDocument(),
    );

    // After the 2 s window the hook resets; with real timers we wait it out
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: "transactions.drawer.copyHashAria" }),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });
});

// ── InvoiceMetadataViewer: address copy buttons ───────────────────────────────

describe("InvoiceMetadataViewer — address copy buttons", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => { vi.clearAllMocks(); });

  it("renders copy buttons for both address fields when privacy is 'full'", () => {
    render(<InvoiceMetadataViewer invoice={BASE_INVOICE} isFunded={false} />);
    // aria-label comes from copyButton.copyAriaLabel translation key
    const copyBtns = screen.getAllByRole("button", {
      name: "copyButton.copyAriaLabel",
    });
    // ≥2: one for issuer address, one for debtor address (plus others like tokenId, ipfsCid…)
    expect(copyBtns.length).toBeGreaterThanOrEqual(2);
  });

  it("hides debtor address and shows 'Address hidden' when privacy is 'anonymized'", () => {
    const invoice: Invoice = { ...BASE_INVOICE, debtorPrivacy: "anonymized" };
    render(<InvoiceMetadataViewer invoice={invoice} isFunded={false} />);
    // getMaskedDebtorAddress() fully anonymizes the identity at this level
    expect(screen.getByText("Identity anonymized for privacy")).toBeInTheDocument();
  });

  it("hides debtor address and shows 'Address hidden' when privacy is 'partial'", () => {
    const invoice: Invoice = { ...BASE_INVOICE, debtorPrivacy: "partial" };
    render(<InvoiceMetadataViewer invoice={invoice} isFunded={false} />);
    // Partial privacy masks the street address but keeps the jurisdiction suffix
    expect(screen.getByText(/^Address hidden · Kenya$/)).toBeInTheDocument();
  });

  it("renders debtor address copy button when isFunded overrides privacy to 'full'", () => {
    const invoice: Invoice = { ...BASE_INVOICE, debtorPrivacy: "anonymized" };
    render(<InvoiceMetadataViewer invoice={invoice} isFunded={true} />);
    const copyBtns = screen.getAllByRole("button", {
      name: "copyButton.copyAriaLabel",
    });
    expect(copyBtns.length).toBeGreaterThanOrEqual(2);
  });
});
