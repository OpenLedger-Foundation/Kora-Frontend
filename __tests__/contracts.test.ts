import { describe, expect, it } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { parseInvestorPositions } from "../lib/stellar/contracts";

describe("parseInvestorPositions", () => {
  it("returns an empty array for an empty contract vector", () => {
    const emptyResponse = StellarSdk.xdr.ScVal.scvVec([]);

    expect(parseInvestorPositions(emptyResponse)).toEqual([]);
  });

  it("maps a position map into the investor position shape", () => {
    const position = StellarSdk.xdr.ScVal.scvMap([
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol("invoice_id"),
        val: StellarSdk.xdr.ScVal.scvU64(StellarSdk.xdr.Uint64.fromString("7")),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol("invested_amount"),
        val: StellarSdk.xdr.ScVal.scvI128(
          new StellarSdk.xdr.Int128Parts({
            hi: StellarSdk.xdr.Int64.fromString("0"),
            lo: StellarSdk.xdr.Uint64.fromString("1000000000"),
          })
        ),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol("expected_return"),
        val: StellarSdk.xdr.ScVal.scvI128(
          new StellarSdk.xdr.Int128Parts({
            hi: StellarSdk.xdr.Int64.fromString("0"),
            lo: StellarSdk.xdr.Uint64.fromString("1050000000"),
          })
        ),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol("status"),
        val: StellarSdk.xdr.ScVal.scvU32(1),
      }),
    ]);

    const response = StellarSdk.xdr.ScVal.scvVec([position]);

    expect(parseInvestorPositions(response)).toEqual([
      expect.objectContaining({
        invoiceId: "7",
        investedAmount: 1000,
        expectedReturn: 1050,
        status: "repaid",
      }),
    ]);
  });
});
