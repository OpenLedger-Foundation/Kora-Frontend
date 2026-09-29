import { describe, it, expect, vi, beforeEach } from "vitest";

// Force mock-data mode so tests exercise MockInvoiceService paths without
// needing live Soroban RPC or Stellar SDK.
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_ENABLE_MOCK_DATA: true,
    NEXT_PUBLIC_SOROBAN_RPC_URL: "https://rpc.example.com",
    NEXT_PUBLIC_INVOICE_CONTRACT_ADDRESS: "CTEST",
    NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS: "CTEST",
    NEXT_PUBLIC_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    NEXT_PUBLIC_HORIZON_URL: "https://horizon.example.com",
  },
}));

import {
  prepareTransferPosition,
  prepareAcceptPositionTransfer,
} from "../invoiceService";

const VALID_SELLER = "GSELLER1111111111111111111111111111111111111111111111111";
const VALID_BUYER = "GBUYER22222222222222222222222222222222222222222222222222";
const POSITION_ID = "pos_101";

describe("prepareTransferPosition (mock mode)", () => {
  it("returns a mock XDR envelope for valid inputs", async () => {
    const xdr = await prepareTransferPosition(POSITION_ID, VALID_BUYER, VALID_SELLER);
    expect(xdr).toBe(`mock_unsigned_xdr_transfer_${POSITION_ID}_${VALID_BUYER}_${VALID_SELLER}`);
  });

  it("throws when toAddress is invalid", async () => {
    await expect(prepareTransferPosition(POSITION_ID, "not-a-g-address", VALID_SELLER)).rejects.toThrow();
  });

  it("throws when seller and buyer address are the same", async () => {
    await expect(prepareTransferPosition(POSITION_ID, VALID_SELLER, VALID_SELLER)).rejects.toThrow();
  });
});

describe("prepareAcceptPositionTransfer (mock mode — #863)", () => {
  it("returns a mock XDR envelope without throwing NOT_IMPLEMENTED", async () => {
    const xdr = await prepareAcceptPositionTransfer(POSITION_ID, VALID_BUYER);
    expect(xdr).toBe(`mock_unsigned_xdr_accept_transfer_${POSITION_ID}_${VALID_BUYER}`);
  });

  it("throws when buyerAddress is invalid", async () => {
    await expect(prepareAcceptPositionTransfer(POSITION_ID, "not-a-g-address")).rejects.toThrow();
  });

  it("resolves to a string (not undefined/null)", async () => {
    const xdr = await prepareAcceptPositionTransfer(POSITION_ID, VALID_BUYER);
    expect(typeof xdr).toBe("string");
    expect(xdr.length).toBeGreaterThan(0);
  });
});
