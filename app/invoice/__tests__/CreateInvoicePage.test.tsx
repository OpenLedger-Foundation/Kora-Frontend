/// <reference types="@testing-library/jest-dom" />
/**
 * Integration tests for the Create Invoice wizard.
 *
 * Covers:
 *  - Step 1 (Invoice Details): field filling, validation errors, Next gating
 *  - Step 2 (Financing Terms): slider interaction, APR display, Next gating
 *  - Step 3 (Upload & Review): file upload, submit success, submit error
 *  - Back navigation with value preservation
 *  - Full end-to-end happy path
 *
 * Mocks:
 *  - lib/ipfs.ts              → uploadFileToPinata, uploadInvoiceMetadata
 *  - lib/stellar/contracts.ts → invoiceContract.mintInvoice
 *  - hooks/useWallet.ts       → isConnected, address, signTransaction
 *  - store                    → useUIStore, useInvoiceStore (in-memory, no persistence)
 *
 * MSW handles /api/upload at the network layer (see mocks/handlers.ts).
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";

// ── Hoisted variables (must be declared before vi.mock factories run) ─────────

const { mockSignTransaction, mockSetWalletModalOpen } = vi.hoisted(() => ({
  mockSignTransaction: vi.fn().mockImplementation(async (xdr: string) => `${xdr}_signed`),
  mockSetWalletModalOpen: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/ipfs", () => ({
  uploadFileToPinata: vi.fn().mockResolvedValue(
    "QmMockPdfCid1234567890abcdefghijklmnopqrstuvwxyz12"
  ),
  uploadInvoiceMetadata: vi.fn().mockResolvedValue(
    "QmMockMetaCid1234567890abcdefghijklmnopqrstuvwxyz1"
  ),
  uploadInvoicePDF: vi.fn().mockResolvedValue(
    "QmMockPdfCid1234567890abcdefghijklmnopqrstuvwxyz12"
  ),
  validateCid: vi.fn(),
  ipfsUrl: vi.fn((cid: string) => `https://gateway.pinata.cloud/ipfs/${cid}`),
}));

vi.mock("@/lib/stellar/contracts", () => ({
  invoiceContract: {
    mintInvoice: vi.fn().mockResolvedValue("mock_unsigned_xdr_mint_invoice"),
  },
  marketplaceContract: {
    fundInvoice: vi.fn(),
    repayInvoice: vi.fn(),
  },
}));

vi.mock("@/lib/stellar/client", () => ({
  rpc: {
    getAccount: vi.fn(),
    simulateTransaction: vi.fn(),
    getTransaction: vi.fn(),
  },
  submitTransaction: vi.fn(),
  waitForTransaction: vi.fn(),
  networkConfig: { networkPassphrase: "Test SDF Network ; September 2015" },
}));

// Wallet hook — connected by default; individual tests can override
vi.mock("@/hooks/useWallet", () => ({
  useWallet: vi.fn(() => ({
    isConnected: true,
    address: "GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE",
    signTransaction: mockSignTransaction,
    isVerified: false,
    checkVerification: vi.fn(() => false),
  })),
}));

vi.mock("@/store", async () => {
  const { create } = await import("zustand");

  const useUIStore = create<any>()((set) => ({
    walletModalOpen: false,
    txState: { status: "idle" },
    setWalletModalOpen: mockSetWalletModalOpen,
    setTxState: (s: any) => set((prev: any) => ({ txState: { ...prev.txState, ...s } })),
    resetTxState: () => set({ txState: { status: "idle" } }),
    sidebarOpen: false,
    setSidebarOpen: vi.fn(),
    theme: "dark",
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
  }));

  const useInvoiceStore = create<any>()((set) => ({
    createDraft: { currency: "USDC" },
    setCreateDraft: (draft: any) =>
      set((s: any) => ({ createDraft: { ...s.createDraft, ...draft } })),
    clearCreateDraft: () => set({ createDraft: { currency: "USDC" } }),
    invoices: [],
    filters: {
      categories: [],
      jurisdictions: [],
      riskTiers: [],
      aprRange: [0, 50],
      activeOnly: false,
    },
    sort: { sortBy: "apr", sortDir: "desc" },
    searchQuery: "",
    setFilters: vi.fn(),
    setSort: vi.fn(),
    setSearchQuery: vi.fn(),
  }));

  const useWalletStore = create<any>()(() => ({
    address: "GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE",
    isConnected: true,
    isVerified: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    setBalance: vi.fn(),
    setVerified: vi.fn(),
    clearVerification: vi.fn(),
    isVerificationExpired: vi.fn(() => true),
  }));

  const useTransactionStore = create<any>()(() => ({
    transactions: [],
    addTransaction: vi.fn(),
    removeTransaction: vi.fn(),
    clearHistory: vi.fn(),
  }));

  return { useUIStore, useInvoiceStore, useWalletStore, useTransactionStore };
});

// ── Import SUT after mocks ────────────────────────────────────────────────────

import CreateInvoicePage from "@/app/invoice/create/page";
import { useWallet } from "@/hooks/useWallet";

// ── Helpers ───────────────────────────────────────────────────────────────────

function setup() {
  const user = userEvent.setup();
  const utils = render(<CreateInvoicePage />);
  return { user, ...utils };
}

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

/**
 * Trigger a date change on a DatePicker's hidden input.
 *
 * DatePicker renders:
 *   <label for="due-date">Due Date</label>
 *   <input type="hidden" id="due-date" name="dueDate" onChange={rhfOnChange} />
 *
 * We use the native value setter + dispatch events so RHF's register picks it up.
 */
function selectDate(labelRegex: RegExp, dateStr: string) {
  const allHiddenInputs = document.querySelectorAll<HTMLInputElement>('input[type="hidden"]');
  let target: HTMLInputElement | null = null;
  for (const inp of allHiddenInputs) {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${inp.id}"]`);
    if (label && labelRegex.test(label.textContent || "")) {
      target = inp;
      break;
    }
  }
  if (!target) throw new Error(`DatePicker hidden input not found for label: ${labelRegex}`);

  const nativeValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;
  nativeValueSetter?.call(target, dateStr);
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Fill all Step 1 fields with valid data */
async function fillStep1(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/invoice number/i), "INV-2024-0001");
  await user.type(screen.getByLabelText(/debtor company name/i), "Acme Corporation Ltd");
  await user.type(screen.getByLabelText(/debtor address/i), "123 Business St, Nairobi, Kenya");

  const amountInput = screen.getByRole("spinbutton", { name: /invoice amount/i });
  await user.clear(amountInput);
  await user.type(amountInput, "50000");

  selectDate(/due date/i, futureDate(90));
}

/** Fill all Step 2 fields with valid data */
async function fillStep2(user: ReturnType<typeof userEvent.setup>) {
  const discountInput = screen.getByRole("spinbutton", { name: /discount rate/i });
  await user.clear(discountInput);
  await user.type(discountInput, "5");

  const minInvInput = screen.getByRole("spinbutton", { name: /minimum investment/i });
  await user.clear(minInvInput);
  await user.type(minInvInput, "1000");

  selectDate(/listing expiry date/i, futureDate(30));
}

function mockPdfFile(name = "invoice.pdf"): File {
  return new File(["mock-pdf-content"], name, { type: "application/pdf" });
}

async function uploadFile(user: ReturnType<typeof userEvent.setup>, file: File) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("File input not found");
  await user.upload(input, file);
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Step 1 — Invoice Details", () => {
  beforeEach(() => {
    vi.mocked(useWallet).mockReturnValue({
      isConnected: true,
      address: "GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE",
      signTransaction: mockSignTransaction,
      isVerified: false,
      checkVerification: vi.fn(() => false),
    } as any);
  });

  it("renders all Step 1 fields", () => {
    setup();
    expect(screen.getByLabelText(/invoice number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/debtor company name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/debtor address/i)).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: /invoice amount/i })).toBeInTheDocument();
    // DatePicker label points to a hidden input — query the label text directly
    expect(screen.getByText(/^due date$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/jurisdiction/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/industry category/i)).toBeInTheDocument();
  });

  it("shows step indicator with Step 1 label", () => {
    setup();
    expect(screen.getByText("Invoice Details")).toBeInTheDocument();
  });

  it("Next button is disabled when form is empty (step0Valid = false)", () => {
    setup();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("Next button becomes enabled after all required fields are filled", async () => {
    const { user } = setup();
    await fillStep1(user);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled()
    );
  });

  it("shows validation error for empty invoice number on blur", async () => {
    const { user } = setup();
    const field = screen.getByLabelText(/invoice number/i);
    await user.click(field);
    fireEvent.blur(field);
    await waitFor(() =>
      expect(screen.getByText(/invoice number is required/i)).toBeInTheDocument()
    );
  });

  it("shows validation error for invoice number with special characters", async () => {
    const { user } = setup();
    const field = screen.getByLabelText(/invoice number/i);
    await user.type(field, "INV@#$%");
    fireEvent.blur(field);
    await waitFor(() =>
      expect(
        screen.getByText(/alphanumeric characters and hyphens/i)
      ).toBeInTheDocument()
    );
  });

  it("shows validation error for amount below minimum", async () => {
    const { user } = setup();
    const field = screen.getByRole("spinbutton", { name: /invoice amount/i });
    await user.type(field, "50");
    fireEvent.blur(field);
    await waitFor(() =>
      expect(screen.getByText(/minimum \$100/i)).toBeInTheDocument()
    );
  });

  it("shows validation error for debtor name too short", async () => {
    const { user } = setup();
    const field = screen.getByLabelText(/debtor company name/i);
    await user.type(field, "A");
    fireEvent.blur(field);
    await waitFor(() =>
      expect(screen.getByText(/debtor name is required/i)).toBeInTheDocument()
    );
  });

  it("shows validation error for debtor address too short", async () => {
    const { user } = setup();
    const field = screen.getByLabelText(/debtor address/i);
    await user.type(field, "123");
    fireEvent.blur(field);
    await waitFor(() =>
      expect(screen.getByText(/debtor address is required/i)).toBeInTheDocument()
    );
  });

  it("advances to Step 2 when all fields are valid and Next is clicked", async () => {
    const { user } = setup();
    await fillStep1(user);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled()
    );
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() =>
      expect(screen.getByText(/financing terms/i)).toBeInTheDocument()
    );
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  it("Back button is disabled on Step 1", () => {
    setup();
    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
  });

  it("jurisdiction defaults to Kenya (KE)", () => {
    setup();
    const select = screen.getByLabelText(/jurisdiction/i) as HTMLSelectElement;
    expect(select.value).toBe("KE");
  });

  it("category defaults to technology", () => {
    setup();
    const select = screen.getByLabelText(/industry category/i) as HTMLSelectElement;
    expect(select.value).toBe("technology");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Step 2 — Financing Terms", () => {
  async function goToStep2() {
    const { user, ...utils } = setup();
    await fillStep1(user);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled()
    );
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() =>
      expect(screen.getByText(/live financing preview/i)).toBeInTheDocument()
    );
    return { user, ...utils };
  }

  it("renders discount rate slider and number input", async () => {
    await goToStep2();
    expect(screen.getByRole("slider")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: /discount rate/i })).toBeInTheDocument();
  });

  it("renders minimum investment and listing expiry fields", async () => {
    await goToStep2();
    expect(screen.getByRole("spinbutton", { name: /minimum investment/i })).toBeInTheDocument();
    expect(screen.getByText(/listing expiry date/i)).toBeInTheDocument();
  });

  it("typing in discount rate number input updates the slider", async () => {
    const { user } = await goToStep2();
    const numInput = screen.getByRole("spinbutton", { name: /discount rate/i });
    await user.clear(numInput);
    await user.type(numInput, "8");
    const slider = screen.getByRole("slider") as HTMLInputElement;
    await waitFor(() => expect(parseFloat(slider.value)).toBe(8));
  });

  it("slider change updates the discount rate number input", async () => {
    await goToStep2();
    const slider = screen.getByRole("slider") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "10" } });
    const numInput = screen.getByRole("spinbutton", { name: /discount rate/i }) as HTMLInputElement;
    await waitFor(() => expect(parseFloat(numInput.value)).toBe(10));
  });

  it("shows Live Financing Preview panel", async () => {
    await goToStep2();
    expect(screen.getByText(/live financing preview/i)).toBeInTheDocument();
    expect(screen.getByText(/financing amount/i)).toBeInTheDocument();
    expect(screen.getByText(/investor payout at maturity/i)).toBeInTheDocument();
  });

  it("financing amount updates when discount rate changes", async () => {
    const { user } = await goToStep2();
    const numInput = screen.getByRole("spinbutton", { name: /discount rate/i });
    await user.clear(numInput);
    await user.type(numInput, "5");
    // $50,000 * (1 - 0.05) = $47,500
    await waitFor(() =>
      expect(screen.getByText(/47,500/)).toBeInTheDocument()
    );
  });

  it("shows validation error when discount rate is below 0.5", async () => {
    const { user } = await goToStep2();
    const numInput = screen.getByRole("spinbutton", { name: /discount rate/i });
    await user.clear(numInput);
    await user.type(numInput, "0.1");
    fireEvent.blur(numInput);
    await waitFor(() =>
      expect(screen.getByText(/min 0\.5%/i)).toBeInTheDocument()
    );
  });

  it("shows validation error when discount rate exceeds 20", async () => {
    const { user } = await goToStep2();
    const numInput = screen.getByRole("spinbutton", { name: /discount rate/i });
    await user.clear(numInput);
    await user.type(numInput, "25");
    fireEvent.blur(numInput);
    await waitFor(() =>
      expect(screen.getByText(/max 20%/i)).toBeInTheDocument()
    );
  });

  it("shows validation error when min investment exceeds invoice amount", async () => {
    const { user } = await goToStep2();
    const minInvInput = screen.getByRole("spinbutton", { name: /minimum investment/i });
    await user.clear(minInvInput);
    await user.type(minInvInput, "99999");
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/minimum investment cannot exceed/i)
      ).toBeInTheDocument()
    );
  });

  it("does not advance to Step 3 when discount rate is invalid", async () => {
    const { user } = await goToStep2();
    const numInput = screen.getByRole("spinbutton", { name: /discount rate/i });
    await user.clear(numInput);
    await user.type(numInput, "0");
    fireEvent.blur(numInput);
    await user.click(screen.getByRole("button", { name: /next/i }));
    // Should still be on Step 2
    await waitFor(() =>
      expect(screen.getByText(/live financing preview/i)).toBeInTheDocument()
    );
  });

  it("advances to Step 3 when all Step 2 fields are valid", async () => {
    const { user } = await goToStep2();
    await fillStep2(user);
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() =>
      expect(screen.getByText(/upload & review/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/invoice document/i)).toBeInTheDocument();
  });

  it("Back button is enabled on Step 2", async () => {
    await goToStep2();
    expect(screen.getByRole("button", { name: /back/i })).not.toBeDisabled();
  });
});
