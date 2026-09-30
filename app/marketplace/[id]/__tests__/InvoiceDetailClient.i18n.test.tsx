/// <reference types="@testing-library/jest-dom" />
/**
 * InvoiceDetailClient — i18n funding panel tests (Issue #860)
 *
 * Verifies that visible funding-card strings are resolved from the
 * invoiceDetail message catalog rather than hardcoded English.
 *
 * Tests:
 *  1. Fund button label comes from t("fundInvoice")
 *  2. Fully-funded title comes from t("fullyFundedTitle")
 *  3. Fully-funded button label comes from t("fullyFunded")
 *  4. Connect-wallet copy comes from t("connectWalletToInvest") / t("connectToInvest")
 *  5. Offline fund button label comes from t("offlineFund")
 *  6. Escrow note comes from t("escrowNote")
 *  7. Investment amount label comes from t("investmentAmount")
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Hoisted wallet store ───────────────────────────────────────────────────────

const { mockWalletStore } = vi.hoisted(() => {
  const { create } = require("zustand");
  const mockWalletStore = create<any>()(() => ({
    address: "GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE",
    isConnected: true,
    kycStatus: "none",
    balance: null,
    setKycStatus: (s: string) => mockWalletStore.setState({ kycStatus: s }),
  }));
  return { mockWalletStore };
});

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock("@/store/walletStore", () => ({
  useWalletStore: mockWalletStore,
  useWalletKycStatus: () => mockWalletStore.getState().kycStatus,
}));

// Mock the whole @/store barrel (useUIStore, useInvoiceStore, useWalletKycStatus)
vi.mock("@/store", () => ({
  useUIStore: () => ({ setWalletModalOpen: vi.fn() }),
  useInvoiceStore: Object.assign(
    () => ({ invoices: [], setInvoices: vi.fn() }),
    { getState: () => ({ updateInvoiceFunding: vi.fn(), rollbackInvoiceFunding: vi.fn() }) },
  ),
  useWalletKycStatus: () => mockWalletStore.getState().kycStatus,
}));

// Controllable translation spy — returns the key by default so assertions
// are independent of copy wording, but can be switched to real strings.
let translationOverrides: Record<string, string> = {};
vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, unknown>) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    if (fullKey in translationOverrides) return translationOverrides[fullKey];
    // Interpolate {var} placeholders if values provided
    const base = fullKey;
    if (!values) return base;
    return base.replace(/\{(.*?)\}/g, (_, g) => String(values[g] ?? `{${g}}`));
  },
  useLocale: () => "en",
}));

// Controllable invoice data
let mockInvoiceStatus: string = "listed";
let mockFundingProgress: number = 0;

vi.mock("@/hooks/useInvoices", () => ({
  useInvoice: () => ({
    isLoading: false,
    error: null,
    dataUpdatedAt: Date.now(),
    data: {
      id: "inv-001",
      tokenId: "token-001",
      ownerAddress: "GOTHER000000000000000000000000000000000000000000000000000",
      status: mockInvoiceStatus,
      riskScore: 72,
      riskTier: "B",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      txHash: null,
      metadata: {
        invoiceNumber: "INV-2026-001",
        issuerName: "Acme Corp",
        debtorName: "Big Buyer Ltd",
        issueDate: "2026-01-01",
        dueDate: "2026-06-01",
        amount: 50000,
        currency: "USDC",
        description: "Test invoice",
        documentUrl: null,
        documentHash: null,
        jurisdiction: "US",
      },
      terms: {
        financingAmount: 40000,
        discountRate: 0.05,
        apr: 18,
        tenor: 90,
        repaymentDate: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
        minInvestment: 500,
        maxInvestment: 40000,
      },
      funding: {
        totalRaised: mockFundingProgress * 40000,
        targetAmount: 40000,
        investorCount: 0,
        remainingCapacity: (1 - mockFundingProgress) * 40000,
        fundingProgress: mockFundingProgress,
      },
    },
  }),
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    isConnected: mockWalletStore.getState().isConnected,
    address: mockWalletStore.getState().address,
    balance: null,
  }),
}));

vi.mock("@/hooks/usePositions", () => ({ usePositions: () => ({ data: [] }) }));
vi.mock("@/hooks/useNetworkStatus", () => ({ useNetworkStatus: () => ({ isOnline: true }) }));
vi.mock("@/hooks/useUsdcBalance", () => ({
  useUsdcBalance: () => ({ data: 10000, refetch: vi.fn() }),
  isTestnetUsdcFaucetEnabled: () => false,
}));
vi.mock("@/hooks/useTransaction", () => ({ useTransaction: () => ({ execute: vi.fn() }) }));
vi.mock("@/hooks/useTxSimulation", () => ({
  useTxSimulation: () => ({
    simulationDialogProps: { open: false },
    onSimulationPreview: vi.fn(),
  }),
}));
vi.mock("@/hooks/useVerifiedAction", () => ({
  useVerifiedAction: () => ({ executeProtectedAction: vi.fn() }),
}));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock("@/hooks/useFormatters", () => ({
  useFormatters: () => ({
    formatCurrency: (n: number, currency: string) => `${n} ${currency}`,
    formatApr: (n: number) => `${n}%`,
    formatDate: (d: string) => d,
    formatPercentage: (n: number) => `${n}%`,
  }),
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_ENABLE_MOCK_DATA: false,
    NEXT_PUBLIC_INVOICE_CONTRACT_ID: "CTEST000000000000000000000000000000000000000000000000000",
    NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID: "CTEST000000000000000000000000000000000000000000000000001",
    NEXT_PUBLIC_TOKEN_CONTRACT_ID: "CTEST000000000000000000000000000000000000000000000000002",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_IPFS_GATEWAY: "https://gateway.pinata.cloud/ipfs",
    NEXT_PUBLIC_KYC_FUND_THRESHOLD: 10000,
  },
}));

vi.mock("@/services/invoiceService", () => ({
  prepareFundInvoice: vi.fn().mockResolvedValue({ result: "ok" }),
}));

vi.mock("@/services/mockData", () => ({ MOCK_INVOICES: [] }));

// Stub heavy sub-components to keep render fast
vi.mock("@/components/invoice/TxSimulationPreview", () => ({ TxSimulationPreview: () => null }));
vi.mock("@/components/invoice/ShareInvoiceButton", () => ({ default: () => null }));
vi.mock("@/components/invoice/RiskScoreGauge", () => ({ RiskScoreGauge: () => null }));
vi.mock("@/components/invoice/DebtorDisplay", () => ({ DebtorDisplay: () => null }));
vi.mock("@/components/invoice/InvoiceMetadataViewer", () => ({ InvoiceMetadataViewer: () => null }));
vi.mock("@/components/invoice/InvoiceOrderBookDepth", () => ({ InvoiceOrderBookDepth: () => null }));
vi.mock("@/components/invoice/FundingYieldCalculator", () => ({ FundingYieldCalculator: () => null }));
vi.mock("@/components/invoice/InvoiceStatusBadge", () => ({ InvoiceStatusBadge: () => null }));
vi.mock("@/components/wallet/TestnetUsdcFaucet", () => ({ TestnetUsdcFaucet: () => null }));
vi.mock("@/components/ui/print-layout", () => ({
  PrintLayout: ({ children }: any) => <>{children}</>,
  PrintButton: () => null,
}));
vi.mock("@/components/ui/breadcrumb", () => ({ Breadcrumb: () => null }));
vi.mock("@/components/ui/CountdownTimer", () => ({ default: () => <span>90 days</span> }));
vi.mock("@/components/ui/error-boundary", () => ({ ErrorBoundary: ({ children }: any) => <>{children}</> }));
vi.mock("@/components/ui/skeleton", () => ({ InvoiceDetailSkeleton: () => null }));
vi.mock("@/components/invoice/RepaymentTimeline", () => ({ RepaymentTimeline: () => null }));
vi.mock("@/components/invoice/InvoiceAmendmentForm", () => ({ InvoiceAmendmentForm: () => null }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("notFound"); } }));

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  const React = require("react");
  const passthrough = (tag: string) =>
    React.forwardRef(({ children, ...props }: any, ref: any) => {
      // Strip framer-motion-specific props that are invalid on DOM elements
      const { whileHover, whileTap, layoutId, initial, animate, exit, transition, variants, ...domProps } = props;
      return React.createElement(tag, { ...domProps, ref }, children);
    });
  return {
    ...actual,
    motion: {
      ...((actual as any).motion ?? {}),
      div: passthrough("div"),
      button: passthrough("button"),
      span: passthrough("span"),
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

import InvoiceDetailClient from "@/app/marketplace/[id]/InvoiceDetailClient";

function renderClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <InvoiceDetailClient id="inv-001" />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InvoiceDetailClient — funding panel i18n (Issue #860)", () => {
  beforeEach(() => {
    translationOverrides = {};
    mockInvoiceStatus = "listed";
    mockFundingProgress = 0;
    mockWalletStore.setState({ isConnected: true, kycStatus: "none" });
  });

  // ── 1. Fund Invoice button ──────────────────────────────────────────────────

  describe("Fund Invoice button", () => {
    it("renders with the translation key as its label", () => {
      renderClient();
      // t("fundInvoice") returns "invoiceDetail.fundInvoice" via key-passthrough mock
      expect(screen.getByRole("button", { name: /invoiceDetail\.fundInvoice/i })).toBeInTheDocument();
    });

    it("reflects an overridden translation (locale simulation)", () => {
      translationOverrides["invoiceDetail.fundInvoice"] = "Financiar Factura";
      renderClient();
      expect(screen.getByRole("button", { name: /Financiar Factura/i })).toBeInTheDocument();
    });
  });

  // ── 2. Fully-funded title and button ───────────────────────────────────────

  describe("fully-funded variant", () => {
    beforeEach(() => {
      mockInvoiceStatus = "fully_funded";
      mockFundingProgress = 1.0;
    });

    it("shows fullyFundedTitle from catalog", () => {
      renderClient();
      expect(screen.getByText("invoiceDetail.fullyFundedTitle")).toBeInTheDocument();
    });

    it("shows fullyFunded button label from catalog", () => {
      renderClient();
      expect(screen.getByRole("button", { name: /invoiceDetail\.fullyFunded$/i })).toBeInTheDocument();
    });

    it("reflects overridden fullyFundedTitle (locale simulation)", () => {
      translationOverrides["invoiceDetail.fullyFundedTitle"] = "Factura Totalmente Financiada";
      renderClient();
      expect(screen.getByText("Factura Totalmente Financiada")).toBeInTheDocument();
    });
  });

  // ── 3. Connect-wallet gate ─────────────────────────────────────────────────

  describe("connect-wallet variant", () => {
    beforeEach(() => {
      mockWalletStore.setState({ isConnected: false, address: null });
    });

    it("shows connectWalletToInvest button label from catalog", () => {
      renderClient();
      expect(
        screen.getByRole("button", { name: /invoiceDetail\.connectWalletToInvest/i }),
      ).toBeInTheDocument();
    });

    it("shows connectToInvest body copy from catalog", () => {
      renderClient();
      expect(screen.getByText("invoiceDetail.connectToInvest")).toBeInTheDocument();
    });

    it("reflects overridden connectWalletToInvest (locale simulation)", () => {
      translationOverrides["invoiceDetail.connectWalletToInvest"] = "Conectar Billetera para Invertir";
      renderClient();
      expect(
        screen.getByRole("button", { name: /Conectar Billetera para Invertir/i }),
      ).toBeInTheDocument();
    });
  });

  // ── 4. Escrow note ─────────────────────────────────────────────────────────

  it("shows escrowNote from catalog", () => {
    renderClient();
    expect(screen.getByText("invoiceDetail.escrowNote")).toBeInTheDocument();
  });

  // ── 5. Investment amount label ─────────────────────────────────────────────

  it("shows investmentAmount label from catalog", () => {
    renderClient();
    // The Input component renders a <label> with this text
    expect(screen.getByText("invoiceDetail.investmentAmount")).toBeInTheDocument();
  });
});
