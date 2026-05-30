/**
 * Soroban contract client — type-safe builders for all invoice and marketplace
 * contract methods. Each method returns an unsigned XDR string ready for the
 * useTransaction hook.
 */
import * as StellarSdk from "@stellar/stellar-sdk";
import { rpc, networkConfig } from "./client";
import { env } from "@/lib/env";
import type {
  MintInvoiceParams,
  FundInvoiceParams,
  RepayInvoiceParams,
  ClaimYieldParams,
  OnChainInvoice,
} from "@/types/contract";

// ─── Error code → human-readable message ─────────────────────────────────────

const SOROBAN_ERROR_CODES: Record<number, string> = {
  1: "Invoice not found",
  2: "Invoice already funded",
  3: "Insufficient balance",
  4: "Unauthorized: caller is not the owner",
  5: "Invoice has already been repaid",
  6: "Funding amount exceeds remaining capacity",
  7: "Invoice is not in a fundable state",
  8: "Repayment amount is incorrect",
};

function parseSorobanError(error: string): string {
  // Extract numeric error code from Soroban error strings like "Error(Contract, #4)"
  const match = error.match(/#(\d+)/);
  if (match) {
    const code = parseInt(match[1], 10);
    return SOROBAN_ERROR_CODES[code] ?? `Contract error #${code}`;
  }
  return error;
}

// ─── XDR helpers ──────────────────────────────────────────────────────────────

function scvString(s: string): StellarSdk.xdr.ScVal {
  return StellarSdk.xdr.ScVal.scvString(s);
}

function scvU64(n: bigint): StellarSdk.xdr.ScVal {
  return StellarSdk.xdr.ScVal.scvU64(
    StellarSdk.xdr.Uint64.fromString(n.toString())
  );
}

function scvI128(n: bigint): StellarSdk.xdr.ScVal {
  return StellarSdk.xdr.ScVal.scvI128(
    new StellarSdk.xdr.Int128Parts({
      hi: StellarSdk.xdr.Int64.fromString("0"),
      lo: StellarSdk.xdr.Uint64.fromString(n.toString()),
    })
  );
}

function scvU32(n: number): StellarSdk.xdr.ScVal {
  return StellarSdk.xdr.ScVal.scvU32(n);
}

function scvAddress(address: string): StellarSdk.xdr.ScVal {
  return new StellarSdk.Address(address).toScVal();
}

// ─── Simulation wrapper ───────────────────────────────────────────────────────

/**
 * Simulate a transaction and return the assembled (resource-footprinted) XDR.
 * Throws a human-readable error if simulation fails.
 */
async function simulate(
  tx: StellarSdk.Transaction
): Promise<StellarSdk.Transaction> {
  const simResult = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simResult)) {
    throw new Error(parseSorobanError(simResult.error));
  }
  return StellarSdk.rpc.assembleTransaction(tx, simResult).build();
}

// ─── Core builder ─────────────────────────────────────────────────────────────

async function buildCall(
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[],
  sourcePublicKey: string
): Promise<string> {
  const account = await rpc.getAccount(sourcePublicKey);
  const contract = new StellarSdk.Contract(contractId);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: networkConfig.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const assembled = await simulate(tx);
  return assembled.toXDR();
}

/**
 * Simulate a read-only call and parse the return value.
 */
async function readCall<T>(
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[],
  sourcePublicKey: string,
  parser: (val: StellarSdk.xdr.ScVal) => T
): Promise<T> {
  const account = await rpc.getAccount(sourcePublicKey);
  const contract = new StellarSdk.Contract(contractId);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: networkConfig.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simResult = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simResult)) {
    throw new Error(parseSorobanError(simResult.error));
  }
  if (!simResult.result?.retval) {
    throw new Error("No return value from contract");
  }
  return parser(simResult.result.retval);
}

// ─── Invoice Contract ─────────────────────────────────────────────────────────

const INVOICE_CONTRACT_ID = env.NEXT_PUBLIC_INVOICE_CONTRACT_ID;

class InvoiceContractClient {
  readonly contractId = INVOICE_CONTRACT_ID;

  /**
   * Mint a new invoice NFT.
   * Returns unsigned XDR string.
   */
  async mintInvoice(
    params: MintInvoiceParams,
    sourcePublicKey: string
  ): Promise<string> {
    return buildCall(
      this.contractId,
      "mint_invoice",
      [
        scvString(params.ipfsCid),
        scvI128(params.amount),
        scvI128(params.financingAmount),
        scvU32(params.discountRate),
        scvU64(params.dueDate),
      ],
      sourcePublicKey
    );
  }

  /**
   * Read invoice state from chain (simulation only, no signature needed).
   */
  async getInvoice(
    tokenId: bigint,
    sourcePublicKey: string
  ): Promise<OnChainInvoice> {
    return readCall(
      this.contractId,
      "get_invoice",
      [scvU64(tokenId)],
      sourcePublicKey,
      parseOnChainInvoice
    );
  }

  /**
   * Update invoice status (owner only).
   * Returns unsigned XDR string.
   */
  async updateStatus(
    tokenId: bigint,
    status: number,
    sourcePublicKey: string
  ): Promise<string> {
    return buildCall(
      this.contractId,
      "update_status",
      [scvU64(tokenId), scvU32(status)],
      sourcePublicKey
    );
  }

  /**
   * Cancel an invoice (owner only). Only cancellable if pending or unfunded.
   * Status code: 6 for cancelled
   * Returns unsigned XDR string.
   */
  async cancelInvoice(
    tokenId: bigint,
    sourcePublicKey: string
  ): Promise<string> {
    // Status code 6 = cancelled
    return this.updateStatus(tokenId, 6, sourcePublicKey);
  }
}

// ─── Marketplace Contract ─────────────────────────────────────────────────────

const MARKETPLACE_CONTRACT_ID = env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID;

class MarketplaceContractClient {
  readonly contractId = MARKETPLACE_CONTRACT_ID;

  /**
   * Investor funds an invoice.
   * Returns unsigned XDR string.
   */
  async fundInvoice(
    params: FundInvoiceParams,
    sourcePublicKey: string
  ): Promise<string> {
    return buildCall(
      this.contractId,
      "fund_invoice",
      [scvU64(params.tokenId), scvI128(params.amount)],
      sourcePublicKey
    );
  }

  /**
   * SME repays an invoice; triggers yield distribution.
   * Returns unsigned XDR string.
   */
  async repayInvoice(
    params: RepayInvoiceParams,
    sourcePublicKey: string
  ): Promise<string> {
    return buildCall(
      this.contractId,
      "repay_invoice",
      [scvU64(params.tokenId)],
      sourcePublicKey
    );
  }

  /**
   * Read all investor positions (simulation only).
   */
  async getPositions(
    investor: string,
    sourcePublicKey: string
  ): Promise<StellarSdk.xdr.ScVal> {
    return readCall(
      this.contractId,
      "get_positions",
      [scvAddress(investor)],
      sourcePublicKey,
      (val) => val
    );
  }

  /**
   * Investor claims yield from a repaid position.
   * Returns unsigned XDR string.
   */
  async claimYield(
    params: ClaimYieldParams,
    sourcePublicKey: string
  ): Promise<string> {
    return buildCall(
      this.contractId,
      "claim_yield",
      [scvU64(params.tokenId)],
      sourcePublicKey
    );
  }
}

// ─── ScVal parsers ────────────────────────────────────────────────────────────

function parseOnChainInvoice(val: StellarSdk.xdr.ScVal): OnChainInvoice {
  // The contract returns a map; parse each field by key name.
  const map = val.map();
  if (!map) throw new Error("Expected map from get_invoice");

  function getField(key: string): StellarSdk.xdr.ScVal {
    const entry = map!.find(
      (e) => e.key().sym()?.toString() === key
    );
    if (!entry) throw new Error(`Missing field: ${key}`);
    return entry.val();
  }

  return {
    token_id: BigInt(getField("token_id").u64().toString()),
    owner: StellarSdk.Address.fromScVal(getField("owner")).toString(),
    ipfs_cid: getField("ipfs_cid").str()?.toString() ?? "",
    amount: BigInt(getField("amount").i128().lo().toString()),
    financing_amount: BigInt(getField("financing_amount").i128().lo().toString()),
    discount_rate: getField("discount_rate").u32(),
    due_date: BigInt(getField("due_date").u64().toString()),
    status: getField("status").u32(),
    funded_amount: BigInt(getField("funded_amount").i128().lo().toString()),
  };
}

// ─── Singleton exports ────────────────────────────────────────────────────────

export const invoiceContract = new InvoiceContractClient();
export const marketplaceContract = new MarketplaceContractClient();

// Re-export low-level helpers for advanced use
export { buildCall, readCall, parseSorobanError, simulate };
