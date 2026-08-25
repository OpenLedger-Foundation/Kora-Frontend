import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CancelInvoiceDialog } from "../CancelInvoiceDialog";
import type { Invoice } from "@/types";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, any>) => {
    if (key === "partiallyFundedDesc") return `Funded ${params?.amount}`;
    return key;
  },
}));

// Mock useFormatters
vi.mock("@/hooks/useFormatters", () => ({
  useFormatters: () => ({
    formatCurrency: (val: number, curr?: string) => `$${val} ${curr || "USDC"}`,
    formatDate: (d: string) => d,
  }),
}));

const mockInvoice: Invoice = {
  id: "inv-cancel-test",
  tokenId: "100",
  contractAddress: "G123",
  ipfsCid: "QmTest",
  metadata: {
    invoiceNumber: "INV-100",
    issuerName: "Issuer Inc",
    issuerAddress: "G123",
    debtorName: "Debtor Ltd",
    debtorAddress: "G456",
    amount: 10000,
    currency: "USDC",
    issueDate: "2025-01-01",
    dueDate: "2025-03-01",
    description: "Cancel test invoice",
    jurisdiction: "US",
    category: "technology",
    documentHash: "QmDoc",
    documentUrl: "https://ipfs.io/ipfs/QmDoc",
  },
  terms: {
    discountRate: 0.05,
    apr: 12,
    financingAmount: 9500,
    minInvestment: 500,
    maxInvestment: 9500,
    tenor: 60,
    repaymentDate: "2025-03-01",
  },
  funding: {
    totalRaised: 0,
    targetAmount: 9500,
    fundingProgress: 0,
    investorCount: 0,
    remainingCapacity: 9500,
  },
  riskTier: "A",
  riskScore: 85,
  debtorPrivacy: "full",
  status: "listed",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  ownerAddress: "G123",
};

describe("CancelInvoiceDialog", () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders invoice summary and disabled confirm button when no reason selected", () => {
    render(
      <CancelInvoiceDialog
        invoice={mockInvoice}
        open={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByTestID("cancel-invoice-confirm")).toBeDisabled();
    expect(screen.getByTestID("cancel-reason-select")).toBeInTheDocument();
  });

  it("enables confirm button and passes selected reason and notes on confirm", () => {
    render(
      <CancelInvoiceDialog
        invoice={mockInvoice}
        open={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const select = screen.getByTestID("cancel-reason-select");
    fireEvent.change(select, { target: { value: "duplicate_invoice" } });

    const notesInput = screen.getByTestID("cancel-notes-input");
    fireEvent.change(notesInput, { target: { value: "Accidental duplicate" } });

    const confirmBtn = screen.getByTestID("cancel-invoice-confirm");
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith("duplicate_invoice", "Accidental duplicate");
  });
});
