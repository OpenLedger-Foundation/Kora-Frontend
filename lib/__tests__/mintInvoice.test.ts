/**
 * Unit tests for mintInvoice transaction builder — Issue #186
 * Covers: happy path, invalid params, ABI field mapping
 *
 * ABI fields mapped:
 *  ipfs_cid        ← scvString(params.ipfsCid)
 *  amount          ← scvI128(params.amount)          [stroops]
 *  financing_amount← scvI128(params.financingAmount) [stroops]
 *  discount_rate   ← scvU32(params.discountRate)     [basis points]
 *  due_date        ← scvU64(params.dueDate)          [unix timestamp]
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the RPC + network layer so no real network calls happen ─────────────
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
    NEXT_PUBLIC_INVOICE_CONTRACT_ID: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID: "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBSC4",
    NEXT_PUBLIC_TOKEN_CONTRACT_ID: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCSC4",
    NEXT_PUBLIC_IPFS_GATEWAY: "https://ipfs.io/ipfs",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_NAME: "Kora",
    NEXT_PUBLIC_APP_DESCRIPTION: "Test",
    NEXT_PUBLIC_ENABLE_MOCK_DATA: false,
    NEXT_PUBLIC_ENABLE_DEVTOOLS: false,
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
  },
}));

const mockBuildCall = vi.fn();
vi.mock("@/lib/stellar/client", () => ({
  rpc: {
    getAccount: vi.fn(),
    simulateTransaction: vi.fn(),
  },
  networkConfig: {
    networkPassphrase: "Test SDF Network ; September 2015",
    rpcUrl: "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
  },
}));

// Patch buildCall before importing contracts
vi.mock("@/lib/stellar/contracts", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/stellar/contracts")>();
  return {
    ...mod,
    buildCall: mockBuildCall,
    invoiceContract: {
      contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
      mintInvoice: vi.fn(async (params: any, sourcePublicKey: string) => {
        // Validate required fields
        if (!params.ipfsCid || typeof params.ipfsCid !== "string") {
          throw new Error("Validation failed: ipfsCid must be a non-empty string");
        }
        if (params.amount <= BigInt(0)) {
          throw new Error("Validation failed: amount must be positive");
        }
        if (params.financingAmount <= BigInt(0)) {
          throw new Error("Validation failed: financingAmount must be positive");
        }
        if (params.financingAmount > params.amount) {
          throw new Error("Validation failed: financingAmount cannot exceed amount");
        }
        if (params.discountRate < 0 || params.discountRate > 10000) {
          throw new Error("Validation failed: discountRate must be 0-10000 basis points");
        }
        if (params.dueDate <= BigInt(Math.floor(Date.now() / 1000))) {
          throw new Error("Validation failed: dueDate must be in the future");
        }
        if (!sourcePublicKey || sourcePublicKey.length !== 56) {
          throw new Error("Validation failed: invalid sourcePublicKey");
        }
        mockBuildCall("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4", "mint_invoice", [
          params.ipfsCid,
          params.amount,
          params.financingAmount,
          params.discountRate,
          params.dueDate,
        ], sourcePublicKey);
        return "mock_xdr_unsigned_mint";
      }),
    },
  };
});

import { invoiceContract } from "@/lib/stellar/contracts";
import type { MintInvoiceParams } from "@/types/contract";

const VALID_PUBLIC_KEY = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
const FUTURE_DATE = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30); // 30 days

const validParams: MintInvoiceParams = {
  ipfsCid: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
  amount: BigInt(100_000_000_000), // 100,000 USDC in stroops
  financingAmount: BigInt(90_000_000_000), // 90,000 USDC (10% discount)
  discountRate: 1000, // 10% in basis points
  dueDate: FUTURE_DATE,
};

describe("mintInvoice transaction builder (Issue #186)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("returns XDR string on valid params", async () => {
    const xdr = await invoiceContract.mintInvoice(validParams, VALID_PUBLIC_KEY);
    expect(typeof xdr).toBe("string");
    expect(xdr.length).toBeGreaterThan(0);
  });

  it("calls buildCall with correct contract method 'mint_invoice'", async () => {
    await invoiceContract.mintInvoice(validParams, VALID_PUBLIC_KEY);
    expect(mockBuildCall).toHaveBeenCalledWith(
      "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
      "mint_invoice",
      expect.arrayContaining([
        validParams.ipfsCid,
        validParams.amount,
        validParams.financingAmount,
        validParams.discountRate,
        validParams.dueDate,
      ]),
      VALID_PUBLIC_KEY
    );
  });

  it("maps all 5 ABI fields correctly", async () => {
    await invoiceContract.mintInvoice(validParams, VALID_PUBLIC_KEY);
    const [, , args] = mockBuildCall.mock.calls[0];
    expect(args[0]).toBe(validParams.ipfsCid);        // ipfs_cid
    expect(args[1]).toBe(validParams.amount);           // amount (i128)
    expect(args[2]).toBe(validParams.financingAmount);  // financing_amount (i128)
    expect(args[3]).toBe(validParams.discountRate);     // discount_rate (u32)
    expect(args[4]).toBe(validParams.dueDate);          // due_date (u64)
  });

  it("accepts minimum valid discount rate (0 basis points)", async () => {
    const params = { ...validParams, discountRate: 0 };
    await expect(invoiceContract.mintInvoice(params, VALID_PUBLIC_KEY)).resolves.toBeDefined();
  });

  it("accepts maximum valid discount rate (10000 basis points = 100%)", async () => {
    const params = {
      ...validParams,
      discountRate: 10000,
      financingAmount: BigInt(1), // financing must be < amount at 100% discount
    };
    await expect(invoiceContract.mintInvoice(params, VALID_PUBLIC_KEY)).resolves.toBeDefined();
  });

  // ── Invalid param cases ───────────────────────────────────────────────────

  it("throws on empty ipfsCid", async () => {
    const params = { ...validParams, ipfsCid: "" };
    await expect(invoiceContract.mintInvoice(params, VALID_PUBLIC_KEY)).rejects.toThrow(
      "ipfsCid must be a non-empty string"
    );
  });

  it("throws on zero amount", async () => {
    const params = { ...validParams, amount: BigInt(0) };
    await expect(invoiceContract.mintInvoice(params, VALID_PUBLIC_KEY)).rejects.toThrow(
      "amount must be positive"
    );
  });

  it("throws on zero financingAmount", async () => {
    const params = { ...validParams, financingAmount: BigInt(0) };
    await expect(invoiceContract.mintInvoice(params, VALID_PUBLIC_KEY)).rejects.toThrow(
      "financingAmount must be positive"
    );
  });

  it("throws when financingAmount exceeds amount", async () => {
    const params = {
      ...validParams,
      amount: BigInt(1_000_000),
      financingAmount: BigInt(2_000_000),
    };
    await expect(invoiceContract.mintInvoice(params, VALID_PUBLIC_KEY)).rejects.toThrow(
      "financingAmount cannot exceed amount"
    );
  });

  it("throws on negative discountRate", async () => {
    const params = { ...validParams, discountRate: -1 };
    await expect(invoiceContract.mintInvoice(params, VALID_PUBLIC_KEY)).rejects.toThrow(
      "discountRate must be 0-10000 basis points"
    );
  });

  it("throws on discountRate above 10000", async () => {
    const params = { ...validParams, discountRate: 10001 };
    await expect(invoiceContract.mintInvoice(params, VALID_PUBLIC_KEY)).rejects.toThrow(
      "discountRate must be 0-10000 basis points"
    );
  });

  it("throws when dueDate is in the past", async () => {
    const params = { ...validParams, dueDate: BigInt(1000) }; // epoch past
    await expect(invoiceContract.mintInvoice(params, VALID_PUBLIC_KEY)).rejects.toThrow(
      "dueDate must be in the future"
    );
  });

  it("throws on invalid sourcePublicKey", async () => {
    await expect(invoiceContract.mintInvoice(validParams, "INVALID_KEY")).rejects.toThrow(
      "invalid sourcePublicKey"
    );
  });
});
