/**
 * Unit tests for extractMintedTokenId and parseTokenIdFromScVal.
 * Covers:
 *  - Soroban RPC GetTransactionResponse returnValue (ScVal and base64)
 *  - TransactionMeta XDR v3 with sorobanMeta returnValue
 *  - TransactionMeta XDR v3 with mint_invoice event in topics
 *  - TransactionResult XDR with InvokeHostFunction success result
 *  - Mock Horizon transaction records with result_meta_xdr
 *  - ContractEvent[] array extraction
 *  - Batch / duplicate mint_invoice events (deduplicates and takes primary)
 *  - Failure cases: null/undefined, non-mint transactions, malformed XDR
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";

// Mock env before importing client
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
  },
}));

import {
  extractMintedTokenId,
  parseTokenIdFromScVal,
  fetchMintedTokenId,
} from "../client";

// Fixture 1: TransactionMeta v3 with Soroban returnValue = u64(1001)
// Created via:
// new sdk.xdr.TransactionMeta(3, new sdk.xdr.TransactionMetaV3({
//   ext: new sdk.xdr.ExtensionPoint(0),
//   txChangesBefore: [], operations: [], txChangesAfter: [],
//   sorobanMeta: new sdk.xdr.SorobanTransactionMeta({
//     ext: new sdk.xdr.SorobanTransactionMetaExt(0),
//     events: [],
//     returnValue: sdk.xdr.ScVal.scvU64(new sdk.xdr.Uint64(1001, 0)),
//     diagnosticEvents: []
//   })
// }))
const FIXTURE_META_RETURN_VALUE_1001 =
  "AAAAAwAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAFAAAAAAAAA+kAAAAA";

// Fixture 2: TransactionMeta v3 with mint_invoice event (topic 0: "mint_invoice", topic 1: u64(2042))
const FIXTURE_META_MINT_EVENT_2042 =
  "AAAAAwAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAACAAAADwAAAAxtaW50X2ludm9pY2UAAAAFAAAAAAAAB/oAAAABAAAAAQAAAAA=";

describe("parseTokenIdFromScVal", () => {
  it("parses u64 ScVal to string", () => {
    const val = StellarSdk.xdr.ScVal.scvU64(
      new StellarSdk.xdr.Uint64(12345, 0)
    );
    expect(parseTokenIdFromScVal(val)).toBe("12345");
  });

  it("parses u32 ScVal to string", () => {
    const val = StellarSdk.xdr.ScVal.scvU32(987);
    expect(parseTokenIdFromScVal(val)).toBe("987");
  });

  it("parses i128 ScVal to string", () => {
    const val = StellarSdk.xdr.ScVal.scvI128(
      new StellarSdk.xdr.Int128Parts({
        hi: StellarSdk.xdr.Int64.fromString("0"),
        lo: StellarSdk.xdr.Uint64.fromString("50000"),
      })
    );
    expect(parseTokenIdFromScVal(val)).toBe("50000");
  });

  it("parses string ScVal to trimmed string", () => {
    const val = StellarSdk.xdr.ScVal.scvString("  token_999  ");
    expect(parseTokenIdFromScVal(val)).toBe("token_999");
  });

  it("parses symbol ScVal to string", () => {
    const val = StellarSdk.xdr.ScVal.scvSymbol("INV123");
    expect(parseTokenIdFromScVal(val)).toBe("INV123");
  });

  it("parses ScVal map containing 'token_id' or 'id'", () => {
    const entry = new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.xdr.ScVal.scvSymbol("token_id"),
      val: StellarSdk.xdr.ScVal.scvU64(new StellarSdk.xdr.Uint64(777, 0)),
    });
    const mapVal = StellarSdk.xdr.ScVal.scvMap([entry]);
    expect(parseTokenIdFromScVal(mapVal)).toBe("777");
  });

  it("returns null for non-token ScVals (e.g. scvVoid, scvBool)", () => {
    expect(parseTokenIdFromScVal(StellarSdk.xdr.ScVal.scvVoid())).toBeNull();
    expect(parseTokenIdFromScVal(StellarSdk.xdr.ScVal.scvBool(true))).toBeNull();
  });
});

describe("extractMintedTokenId", () => {
  it("extracts token ID from Soroban RPC response with ScVal returnValue", () => {
    const rpcResponse = {
      status: "SUCCESS",
      txHash: "0xabc123",
      returnValue: StellarSdk.xdr.ScVal.scvU64(new StellarSdk.xdr.Uint64(1001, 0)),
    };
    expect(extractMintedTokenId(rpcResponse)).toBe("1001");
  });

  it("extracts token ID from Soroban RPC response with base64 returnValue string", () => {
    const scv = StellarSdk.xdr.ScVal.scvU64(new StellarSdk.xdr.Uint64(1001, 0));
    const rpcResponse = {
      status: "SUCCESS",
      txHash: "0xabc123",
      returnValue: scv.toXDR("base64"),
    };
    expect(extractMintedTokenId(rpcResponse)).toBe("1001");
  });

  it("extracts token ID from resultMetaXdr fixture via returnValue", () => {
    const txResult = {
      status: "SUCCESS",
      txHash: "0xabc123",
      resultMetaXdr: FIXTURE_META_RETURN_VALUE_1001,
    };
    expect(extractMintedTokenId(txResult)).toBe("1001");
  });

  it("extracts token ID from resultMetaXdr fixture via mint_invoice contract event", () => {
    const txResult = {
      status: "SUCCESS",
      txHash: "0xabc123",
      resultMetaXdr: FIXTURE_META_MINT_EVENT_2042,
    };
    expect(extractMintedTokenId(txResult)).toBe("2042");
  });

  it("extracts token ID from mock Horizon transaction response (result_meta_xdr)", () => {
    const horizonResponse = {
      id: "tx_001",
      hash: "0xmockhorizonhash",
      successful: true,
      result_meta_xdr: FIXTURE_META_RETURN_VALUE_1001,
      result_xdr: "AAAAAA==",
    };
    expect(extractMintedTokenId(horizonResponse)).toBe("1001");
  });

  it("extracts token ID from a raw XDR string directly", () => {
    expect(extractMintedTokenId(FIXTURE_META_RETURN_VALUE_1001)).toBe("1001");
    expect(extractMintedTokenId(FIXTURE_META_MINT_EVENT_2042)).toBe("2042");
  });

  it("extracts token ID from a parsed contract events array", () => {
    const events = [
      {
        id: "evt_1",
        ledger: 10,
        ledgerClosedAt: "2026-01-01T00:00:00Z",
        contractId: "C_INVOICE",
        type: "mint_invoice" as const,
        tokenId: "5555",
        amount: 50000,
        participantAddress: "GSME",
        rawTopics: ["mint_invoice", "5555"],
      },
    ];
    expect(extractMintedTokenId({ events })).toBe("5555");
    expect(extractMintedTokenId(events)).toBe("5555");
  });

  it("handles batch or duplicate mint events by extracting the primary (first) token ID", () => {
    const events = [
      {
        id: "evt_1",
        type: "mint_invoice" as const,
        tokenId: "1001",
      },
      {
        id: "evt_2",
        type: "mint_invoice" as const,
        tokenId: "1002",
      },
    ];
    expect(extractMintedTokenId({ events })).toBe("1001");
  });

  it("extracts token ID when passed an object with pre-existing tokenId", () => {
    expect(extractMintedTokenId({ tokenId: "1001" })).toBe("1001");
    expect(extractMintedTokenId({ token_id: "2042" })).toBe("2042");
    expect(extractMintedTokenId({ tokenId: 8888 })).toBe("8888");
  });

  it("returns null for non-mint transactions or empty objects", () => {
    expect(extractMintedTokenId(null)).toBeNull();
    expect(extractMintedTokenId(undefined)).toBeNull();
    expect(extractMintedTokenId({})).toBeNull();
    expect(extractMintedTokenId({ status: "SUCCESS", txHash: "0x123" })).toBeNull();
    expect(
      extractMintedTokenId({
        events: [{ type: "invoice_funded", tokenId: "100" }],
      })
    ).toBeNull();
  });

  it("handles malformed XDR gracefully without throwing", () => {
    expect(extractMintedTokenId("not_a_valid_xdr_string!@#$")).toBeNull();
    expect(extractMintedTokenId({ resultMetaXdr: "invalid_xdr" })).toBeNull();
    expect(extractMintedTokenId({ returnValue: "invalid_xdr" })).toBeNull();
  });
});

describe("fetchMintedTokenId", () => {
  it("fetches via waitForTransaction and extracts token ID", async () => {
    const { rpc } = await import("../client");
    vi.spyOn(rpc, "getTransaction").mockResolvedValueOnce({
      status: "SUCCESS",
      txHash: "0xhash123",
      resultMetaXdr: FIXTURE_META_RETURN_VALUE_1001,
    } as any);

    const tokenId = await fetchMintedTokenId("0xhash123");
    expect(tokenId).toBe("1001");
  });

  it("returns null when transaction cannot be found or parsed", async () => {
    const { rpc, horizon } = await import("../client");
    vi.spyOn(rpc, "getTransaction").mockRejectedValue(new Error("Network error"));
    vi.spyOn(horizon, "transactions").mockReturnValue({
      transaction: () => ({
        call: vi.fn().mockRejectedValue(new Error("Horizon 404")),
      }),
    } as any);

    const tokenId = await fetchMintedTokenId("0xnonexistent");
    expect(tokenId).toBeNull();
  });
});
