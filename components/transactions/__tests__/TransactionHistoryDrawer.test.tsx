/**
 * TransactionHistoryDrawer — Issue #1118
 *
 * Covers:
 *  - Localized filters (type select, date placeholders, aria labels)
 *  - Fully localized clear-history confirmation dialog (title, description,
 *    cancel/confirm actions and success feedback) — replaced `window.confirm`,
 *    whose chrome came from the browser locale instead of the app catalog
 *  - Cancel keeps history intact; confirm clears it
 *  - Empty-history state renders localized copy
 *  - Spanish catalog drives the dialog copy when locale is `es`
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { TransactionHistoryDrawer } from "../TransactionHistoryDrawer";
import { useTransactionHistoryStore } from "@/store/transactionHistoryStore";
import type { TransactionRecord } from "@/store/transactionHistoryStore";

vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: () => null,
}));

// `lib/security` reaches `lib/ipfs` → `lib/env`, whose schema throws when the
// NEXT_PUBLIC_* contract ids are absent (they only exist in a deployed env).
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    NEXT_PUBLIC_INVOICE_CONTRACT_ID: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    NEXT_PUBLIC_TOKEN_CONTRACT_ID: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    NEXT_PUBLIC_IPFS_GATEWAY: "https://ipfs.io/ipfs/",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_NAME: "Kora",
    NEXT_PUBLIC_ENABLE_MOCK_DATA: true,
    NEXT_PUBLIC_KYC_FUND_THRESHOLD: 10000,
    NEXT_PUBLIC_SECONDARY_PROTOCOL_FEE_BPS: 30,
    NEXT_PUBLIC_SECONDARY_MARKET_FEE_BPS: 100,
  },
}));

// The drawer only fetches Horizon details for the selected row; keep the RPC
// client module (which builds network singletons at import) out of the test.
vi.mock("@/lib/stellar/client", () => ({
  fetchTransactionDetails: vi.fn(async () => null),
}));

import { toast } from "sonner";

const RECORDS: TransactionRecord[] = [
  {
    hash: "aaa111",
    type: "fund_invoice",
    status: "confirmed",
    amount: "500",
    assetCode: "USDC",
    timestamp: Date.now() - 60_000,
    description: "Funded invoice INV-001",
  },
  {
    hash: "bbb222",
    type: "claim_yield",
    status: "pending",
    amount: "42",
    assetCode: "USDC",
    timestamp: Date.now(),
    description: "Yield claim",
  },
];

function renderDrawer(locale: "en" | "es" = "en") {
  const messages = locale === "es" ? es : en;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <TransactionHistoryDrawer open onOpenChange={vi.fn()} />
    </NextIntlClientProvider>
  );
}

/**
 * `useToast` wraps its payload in a `TxToast` element before handing it to
 * sonner, so read the message off the element rather than the raw argument.
 */
function lastSuccessToast(): { message?: string; options?: Record<string, unknown> } {
  const calls = (toast.success as ReturnType<typeof vi.fn>).mock.calls;
  const [element, options] = calls[calls.length - 1] ?? [];
  return { message: element?.props?.message, options };
}

describe("TransactionHistoryDrawer (#1118)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTransactionHistoryStore.setState({
      transactions: [...RECORDS],
      filterType: "all",
      filterStartDate: null,
      filterEndDate: null,
    });
  });

  it("renders localized filters", async () => {
    renderDrawer();

    expect(
      await screen.findByLabelText("Filter by type")
    ).toBeInTheDocument();
    for (const label of ["All Types", "Mints", "Funding", "Repayments", "Claims"]) {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Start date" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End date" })).toBeInTheDocument();
    expect(screen.getByLabelText("Start date filter")).toBeInTheDocument();
    expect(screen.getByLabelText("End date filter")).toBeInTheDocument();
    expect(screen.getByText("Filters")).toBeInTheDocument();
    expect(screen.getByText("Export")).toBeInTheDocument();
  });

  it("shows localized empty state when history is empty", async () => {
    useTransactionHistoryStore.setState({ transactions: [] });
    renderDrawer();

    expect(await screen.findByText("No transactions yet")).toBeInTheDocument();
    expect(screen.getByText("Transactions will appear here")).toBeInTheDocument();
    // No rows, no footer actions
    expect(
      screen.queryByLabelText("Clear transaction history")
    ).not.toBeInTheDocument();
  });

  it("opens a fully localized clear-history confirmation dialog", async () => {
    renderDrawer();

    fireEvent.click(await screen.findByLabelText("Clear transaction history"));

    const dialog = await screen.findByRole("dialog", {
      name: "Clear transaction history?",
    });
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByText(
        "Clear all transaction history? This cannot be undone."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(
      screen.getByTestId("confirm-clear-history")
    ).toHaveTextContent("Clear history");
  });

  it("cancel keeps history intact", async () => {
    renderDrawer();

    fireEvent.click(await screen.findByLabelText("Clear transaction history"));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Clear transaction history?" })
      ).not.toBeInTheDocument()
    );
    expect(useTransactionHistoryStore.getState().transactions).toHaveLength(2);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("confirm clears history and surfaces localized feedback", async () => {
    renderDrawer();

    fireEvent.click(await screen.findByLabelText("Clear transaction history"));
    fireEvent.click(await screen.findByTestId("confirm-clear-history"));

    await waitFor(() =>
      expect(useTransactionHistoryStore.getState().transactions).toHaveLength(0)
    );
    expect(lastSuccessToast()).toEqual({
      message: "Transaction history cleared",
      options: expect.objectContaining({ id: "tx-history-cleared" }),
    });
    // Drawer now shows the empty state rather than stale rows.
    expect(await screen.findByText("No transactions yet")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Clear transaction history")
    ).not.toBeInTheDocument();
  });

  it("uses the Spanish catalog for the confirmation dialog", async () => {
    renderDrawer("es");

    fireEvent.click(
      await screen.findByLabelText("Limpiar historial de transacciones")
    );

    const dialog = await screen.findByRole("dialog", {
      name: "¿Borrar el historial de transacciones?",
    });
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByText(
        "¿Limpiar todo el historial de transacciones? Esta acción no se puede deshacer."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(screen.getByTestId("confirm-clear-history")).toHaveTextContent(
      "Borrar historial"
    );

    fireEvent.click(screen.getByTestId("confirm-clear-history"));
    await waitFor(() =>
      expect(useTransactionHistoryStore.getState().transactions).toHaveLength(0)
    );
    expect(lastSuccessToast()).toEqual({
      message: "Historial de transacciones borrado",
      options: expect.objectContaining({ id: "tx-history-cleared" }),
    });
  });
});
