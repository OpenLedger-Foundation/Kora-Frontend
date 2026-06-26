import { describe, it, expect, vi } from "vitest";
import {
  scvAddress,
  buildCall,
  readCall,
  invoiceContract,
  marketplaceContract,
} from "../contracts";

// Mock the dependencies to avoid real network/RPC calls
vi.mock("../client", () => ({
  rpc: {
    simulateTransaction: vi.fn(),
    getAccount: vi.fn(),
  },
  networkConfig: {
    networkPassphrase: "Test SDF Network ; September 2015",
  },
}));

describe("Soroban Contract Client Address Validation", () => {
  const VALID_ADDRESS = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
  const INVALID_ADDRESS = "invalid-stellar-address";

  describe("scvAddress helper", () => {
    it("successfully creates ScVal for a valid Stellar address", () => {
      const result = scvAddress(VALID_ADDRESS);
      expect(result).toBeDefined();
    });

    it("throws a descriptive error for an invalid Stellar address", () => {
      expect(() => scvAddress(INVALID_ADDRESS)).toThrow("Invalid Stellar address format");
    });
  });

  describe("buildCall function", () => {
    it("throws a descriptive error if sourcePublicKey is invalid", async () => {
      await expect(
        buildCall("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4", "test_method", [], INVALID_ADDRESS)
      ).rejects.toThrow("Invalid Stellar address format");
    });
  });

  describe("readCall function", () => {
    it("throws a descriptive error if sourcePublicKey is invalid", async () => {
      await expect(
        readCall("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4", "test_method", [], INVALID_ADDRESS, (v) => v)
      ).rejects.toThrow("Invalid Stellar address format");
    });
  });

  describe("InvoiceContractClient / MarketplaceContractClient methods", () => {
    it("throws if debtor or other addresses are invalid in methods calling scvAddress", async () => {
      // getInvoice only takes a tokenId, but getPositions takes an investor address
      await expect(
        marketplaceContract.getPositions(INVALID_ADDRESS, VALID_ADDRESS)
      ).rejects.toThrow("Invalid Stellar address format");
    });
  });
});
