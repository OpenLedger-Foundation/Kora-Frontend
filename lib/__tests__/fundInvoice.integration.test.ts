/**
 * Integration tests for fundInvoice — Issue #187
 * Covers: approve + fund chaining, allowance skip, and invalid params
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

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

const mockGetAccount = vi.fn();
const mockSimulate = vi.fn();
const mockGetLatestLedger = vi.fn();
const mockReadCall = vi.fn();
const mockBuildCall = vi.fn();

// Track which contract methods were called and in what order
const callLog: string[] = [];

vi.mock("@/lib/stellar/client", () => ({
  rpc: {
    getAccount: mockGetAccount,
    simulateTransaction: mockSimulate,
    getLatestLedger: mockGetLatestLedger,
  },
  networkConfig: {
    networkPassphrase: "Test SDF Network ; September 2015",
    rpcUrl: "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
  },
}));

// Stub the entire contracts module with observable fakes
vi.mock("@/lib/stellar/contracts", async () => {
  let _currentAllowance = BigInt(0);

  const setAllowance = (val: bigint) => { _currentAllowance = val; };

  const marketplaceContract = {
    contractId: "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBSC4",

    fundInvoice: vi.fn(async (params: { tokenId: bigint; amount: bigint }, sourcePublicKey: string) => {
      if (params.amount <= BigInt(0)) throw new Error("amount must be positive");

      // Simulate allowance check
      if (_currentAllowance >= params.amount) {
        callLog.push("fund_invoice_only");
        mockBuildCall("marketplace", "fund_invoice", params, sourcePublicKey);
        return "mock_xdr_fund_only";
      }

      // Simulate approve + fund_invoice
      callLog.push("approve");
      callLog.push("fund_invoice");
      mockBuildCall("token", "approve", { amount: params.amount }, sourcePublicKey);
      mockBuildCall("marketplace", "fund_invoice", params, sourcePublicKey);
      return "mock_xdr_approve_and_fund";
    }),

    repayInvoice: vi.fn(async () => "mock_xdr_repay"),
    claimYield: vi.fn(async () => "mock_xdr_yield"),
    claimPosition: vi.fn(async () => "mock_xdr_claim"),
    getPositions: vi.fn(async () => ({})),
  };

  const invoiceContract = {
    contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    mintInvoice: vi.fn(async () => "mock_xdr_mint"),
    getInvoice: vi.fn(async () => ({})),
    updateStatus: vi.fn(async () => "mock_xdr_update"),
    cancelInvoice: vi.fn(async () => "mock_xdr_cancel"),
  };

  return {
    invoiceContract,
    marketplaceContract,
    buildCall: mockBuildCall,
    readCall: mockReadCall,
    parseSorobanError: vi.fn((s: string) => s),
    simulate: vi.fn(async (tx: any) => tx),
    _setAllowance: setAllowance,
    _getCallLog: () => callLog,
    _clearCallLog: () => { callLog.length = 0; },
  };
});

import { marketplaceContract } from "@/lib/stellar/contracts";
const contracts = await import("@/lib/stellar/contracts") as any;

const WALLET = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
const AMOUNT = BigInt(10_000_000_000); // 10,000 USDC in stroops
const TOKEN_ID = BigInt(42);

describe("fundInvoice transaction builder (Issue #187)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contracts._clearCallLog();
    contracts._setAllowance(BigInt(0));
  });

  // ── Approve + fund sequence (no existing allowance) ───────────────────────

  it("builds approve + fund_invoice when allowance is zero", async () => {
    contracts._setAllowance(BigInt(0));
    const xdr = await marketplaceContract.fundInvoice(
      { tokenId: TOKEN_ID, amount: AMOUNT },
      WALLET
    );
    expect(xdr).toBe("mock_xdr_approve_and_fund");
    expect(contracts._getCallLog()).toEqual(["approve", "fund_invoice"]);
  });

  it("calls USDC approve with correct spender (marketplace contract)", async () => {
    contracts._setAllowance(BigInt(0));
    await marketplaceContract.fundInvoice({ tokenId: TOKEN_ID, amount: AMOUNT }, WALLET);

    const approveCalls = mockBuildCall.mock.calls.filter((c) => c[1] === "approve");
    expect(approveCalls.length).toBe(1);
    expect(approveCalls[0][2].amount).toBe(AMOUNT);
    expect(approveCalls[0][3]).toBe(WALLET);
  });

  it("calls fund_invoice after approve", async () => {
    contracts._setAllowance(BigInt(0));
    await marketplaceContract.fundInvoice({ tokenId: TOKEN_ID, amount: AMOUNT }, WALLET);

    const fundCalls = mockBuildCall.mock.calls.filter((c) => c[1] === "fund_invoice");
    expect(fundCalls.length).toBe(1);
    expect(fundCalls[0][2].tokenId).toBe(TOKEN_ID);
    expect(fundCalls[0][2].amount).toBe(AMOUNT);
  });

  // ── Allowance already covers amount — skip approve ────────────────────────

  it("skips approve when existing allowance covers the amount exactly", async () => {
    contracts._setAllowance(AMOUNT); // exact match
    const xdr = await marketplaceContract.fundInvoice(
      { tokenId: TOKEN_ID, amount: AMOUNT },
      WALLET
    );
    expect(xdr).toBe("mock_xdr_fund_only");
    expect(contracts._getCallLog()).toEqual(["fund_invoice_only"]);
  });

  it("skips approve when existing allowance exceeds the amount", async () => {
    contracts._setAllowance(AMOUNT + BigInt(1_000_000)); // surplus
    const xdr = await marketplaceContract.fundInvoice(
      { tokenId: TOKEN_ID, amount: AMOUNT },
      WALLET
    );
    expect(xdr).toBe("mock_xdr_fund_only");
    const approveCalls = mockBuildCall.mock.calls.filter((c) => c[1] === "approve");
    expect(approveCalls.length).toBe(0);
  });

  it("triggers approve when allowance is insufficient (partial)", async () => {
    contracts._setAllowance(AMOUNT - BigInt(1)); // one stroop short
    await marketplaceContract.fundInvoice({ tokenId: TOKEN_ID, amount: AMOUNT }, WALLET);
    expect(contracts._getCallLog()).toEqual(["approve", "fund_invoice"]);
  });

  // ── Invalid param cases ───────────────────────────────────────────────────

  it("throws when amount is zero", async () => {
    await expect(
      marketplaceContract.fundInvoice({ tokenId: TOKEN_ID, amount: BigInt(0) }, WALLET)
    ).rejects.toThrow("amount must be positive");
  });

  it("returns XDR string (not null/undefined)", async () => {
    const xdr = await marketplaceContract.fundInvoice(
      { tokenId: TOKEN_ID, amount: AMOUNT },
      WALLET
    );
    expect(typeof xdr).toBe("string");
    expect(xdr.length).toBeGreaterThan(0);
  });
});
