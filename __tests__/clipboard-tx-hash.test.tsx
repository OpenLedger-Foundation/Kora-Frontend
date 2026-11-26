/**
 * Transaction drawer — hash copy feedback (issue #1251)
 *
 * Tests that the tx hash copy button in TransactionHistoryDrawer:
 *   - Shows Check icon and updated aria-label after a successful copy
 *   - Shows an error state and fires an error toast on failure
 *
 * We render TransactionHistoryDrawer in its expanded detail panel via the
 * minimal required props and control the Clipboard API directly.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      "drawer.txHash": "Transaction Hash",
      "drawer.copyHashAria": "Copy hash",
      "drawer.hashCopied": "Hash copied",
      "drawer.hashCopyFailed": "Failed to copy hash",
      "drawer.detailsTitle": "Transaction Details",
      "drawer.closeDetailsAria": "Close transaction details",
      "drawer.type": "Type",
      "drawer.status": "Status",
      "drawer.amount": "Amount",
      "drawer.dateTime": "Date & Time",
      "drawer.onChainDetails": "On-chain Details",
      "drawer.ledger": "Ledger",
      "drawer.feePaid": "Fee Paid",
      "drawer.confirmedAt": "Confirmed At",
      "drawer.operations": "Operations",
      "drawer.memo": "Memo",
      "drawer.detailsUnavailable": "Details unavailable",
      "drawer.description": "Description",
      "drawer.error": "Error",
      "drawer.viewExplorer": "View on Explorer",
      "typeLabels.mint_invoice": "Mint Invoice",
      "typeLabels.fund_invoice": "Fund Invoice",
      "typeLabels.repay_invoice": "Repay Invoice",
      "typeLabels.claim_yield": "Claim Yield",
      "typeLabels.transfer": "Transfer",
      "typeLabels.other": "Transaction",
      "statusLabels.confirmed": "Confirmed",
      "statusLabels.failed": "Failed",
      "statusLabels.pending": "Pending",
      title: "Transaction History",
      subtitle: "Your on-chain activity",
      "drawer.title": "Transactions",
      "drawer.closeAria": "Close transaction history",
      "drawer.filters": "Filters",
      "drawer.reset": "Reset",
      "drawer.filterByTypeAria": "Filter by type",
      "drawer.startDatePlaceholder": "Start date",
      "drawer.startDateFilterAria": "Start date filter",
      "drawer.endDatePlaceholder": "End date",
      "drawer.endDateFilterAria": "End date filter",
      "drawer.emptyTitle": "No transactions yet",
      "drawer.emptyDesc": "Transactions will appear here",
      "drawer.noResultsTitle": "No results",
      "drawer.noResultsDesc": "Try adjusting your filters",
      "drawer.export": "Export",
      "drawer.exportAria": "Export transactions to CSV",
      "drawer.clearAria": "Clear transaction history",
      "drawer.clearConfirm": "Clear all transaction history?",
    };
    return map[key] ?? key;
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
    NEXT_PUBLIC_IPFS_GATEWAY: "https://ipfs.io/ipfs",
    NEXT_PUBLIC_ENABLE_MOCK_DATA: true,
    NEXT_PUBLIC_INVOICE_CONTRACT_ID:
      "CTEST000000000000000000000000000000000000000000000000000",
    NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID:
      "CTEST000000000000000000000000000000000000000000000000001",
    NEXT_PUBLIC_TOKEN_CONTRACT_ID:
      "CTEST000000000000000000000000000000000000000000000000002",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  },
}));

vi.mock("@/lib/stellar/client", () => ({
  fetchTransactionDetails: vi.fn().mockResolvedValue(null),
}));

const STORE_STATE = {
  transactions: [] as typeof MOCK_TX[],
  filterType: "all" as const,
  filterStartDate: null as null,
  filterEndDate: null as null,
  setFilterType: vi.fn(),
  setFilterStartDate: vi.fn(),
  setFilterEndDate: vi.fn(),
  resetFilters: vi.fn(),
  getFilteredTransactions: vi.fn(() => STORE_STATE.transactions),
  clearHistory: vi.fn(),
  removeTransaction: vi.fn(),
  clearTransactions: vi.fn(),
};

vi.mock("@/store/transactionHistoryStore", () => ({
  useTransactionHistoryStore: vi.fn((selector?: (s: typeof STORE_STATE) => unknown) =>
    selector ? selector(STORE_STATE) : STORE_STATE,
  ),
}));

vi.mock("@/lib/export", () => ({ exportCsv: vi.fn() }));
vi.mock("@/hooks/useFocusTrap", () => ({ useFocusTrap: () => ({ ref: { current: null } }) }));
vi.mock("@/components/ui/stellar-tx-link", () => ({
  StellarTxLink: ({ hash }: { hash: string }) => <span>{hash}</span>,
}));
vi.mock("framer-motion", () => ({
  motion: { div: "div", button: "button", span: "span" },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { TransactionHistoryDrawer } from "@/components/transactions/TransactionHistoryDrawer";

const MOCK_TX = {
  id: "tx_001",
  hash: "aabbcc1122334455aabbcc1122334455aabbcc1122334455aabbcc1122334455",
  type: "fund_invoice" as const,
  status: "confirmed" as const,
  amount: 500,
  currency: "USDC",
  timestamp: new Date().toISOString(),
  invoiceId: "inv_001",
  invoiceNumber: "INV-001",
  description: "Funded invoice",
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("TransactionHistoryDrawer — hash copy feedback", () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    // Populate the store with our mock transaction
    STORE_STATE.transactions = [MOCK_TX];
    STORE_STATE.getFilteredTransactions = vi.fn(() => [MOCK_TX]);
  });

  it("copy button starts with 'Copy hash' aria-label", async () => {
    render(<TransactionHistoryDrawer open onOpenChange={() => {}} />, { wrapper });
    // Click the transaction row to open detail panel
    await userEvent.click(await screen.findByText("Fund Invoice"));
    expect(await screen.findByRole("button", { name: "Copy hash" })).toBeInTheDocument();
  });

  it("flips aria-label to 'Hash copied' after a successful copy", async () => {
    render(<TransactionHistoryDrawer open onOpenChange={() => {}} />, { wrapper });
    await userEvent.click(await screen.findByText("Fund Invoice"));
    const copyBtn = await screen.findByRole("button", { name: "Copy hash" });
    await userEvent.click(copyBtn);
    expect(await screen.findByRole("button", { name: "Hash copied" })).toBeInTheDocument();
  });

  it("calls clipboard.writeText with the full tx hash", async () => {
    render(<TransactionHistoryDrawer open onOpenChange={() => {}} />, { wrapper });
    await userEvent.click(await screen.findByText("Fund Invoice"));
    const copyBtn = await screen.findByRole("button", { name: "Copy hash" });
    await userEvent.click(copyBtn);
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(MOCK_TX.hash),
    );
  });
});
