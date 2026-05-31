/**
 * Stellar/Soroban RPC client singleton.
 * Reads network config from environment variables.
 */
import * as StellarSdk from "@stellar/stellar-sdk";
import { env } from "@/lib/env";
import type {
  AccountBalances,
  AccountTransaction,
  PaginatedTransactions,
} from "@/types/stellar";

const RPC_URL = env.NEXT_PUBLIC_STELLAR_RPC_URL;
const NETWORK_PASSPHRASE = env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE;
const HORIZON_URL = env.NEXT_PUBLIC_STELLAR_HORIZON_URL;

// Soroban RPC client
export const rpc = new StellarSdk.rpc.Server(RPC_URL, { allowHttp: false });

// Horizon server (for account info, balances)
export const horizon = new StellarSdk.Horizon.Server(HORIZON_URL);

export const networkConfig = {
  rpcUrl: RPC_URL,
  networkPassphrase: NETWORK_PASSPHRASE,
  horizonUrl: HORIZON_URL,
};

// ─── USDC asset definition ────────────────────────────────────────────────────

/**
 * The canonical USDC asset on Stellar (issued by Centre / Circle).
 * Issuer is the same on both testnet and mainnet for the official asset.
 */
export const USDC_ASSET = new StellarSdk.Asset(
  "USDC",
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
);

// ─── Custom error types ───────────────────────────────────────────────────────

export class AccountNotFoundError extends Error {
  constructor(address: string) {
    super(`Account not found: ${address}`);
    this.name = "AccountNotFoundError";
  }
}

export class HorizonRateLimitError extends Error {
  constructor() {
    super("Horizon rate limit exceeded. Please try again shortly.");
    this.name = "HorizonRateLimitError";
  }
}

export class HorizonNetworkError extends Error {
  constructor(message: string) {
    super(`Horizon network error: ${message}`);
    this.name = "HorizonNetworkError";
  }
}

// ─── Internal error normaliser ────────────────────────────────────────────────

function normaliseHorizonError(err: unknown, address?: string): never {
  if (err instanceof Error) {
    // Horizon SDK wraps HTTP errors — check the response status
    const anyErr = err as { response?: { status?: number } };
    const status = anyErr.response?.status;

    if (status === 404) throw new AccountNotFoundError(address ?? "unknown");
    if (status === 429) throw new HorizonRateLimitError();
    if (status !== undefined) throw new HorizonNetworkError(`HTTP ${status}: ${err.message}`);
  }
  throw new HorizonNetworkError(String(err));
}

// ─── Account helpers ──────────────────────────────────────────────────────────

/**
 * Fetch raw account details from Horizon.
 */
export async function getAccount(publicKey: string) {
  return horizon.loadAccount(publicKey);
}

/**
 * Fetch typed XLM + USDC + all token balances for a given account.
 *
 * - XLM balance has the minimum reserve subtracted so callers see spendable XLM.
 * - USDC is parsed from the trustline matching the canonical USDC issuer.
 * - All other credit assets are included in `otherAssets`.
 *
 * Throws `AccountNotFoundError` if the account does not exist on-chain.
 */
export async function getAccountBalances(address: string): Promise<AccountBalances> {
  let account: Awaited<ReturnType<typeof horizon.loadAccount>>;
  try {
    account = await horizon.loadAccount(address);
  } catch (err) {
    normaliseHorizonError(err, address);
  }

  let xlm = "0";
  let usdc = "0";
  const otherAssets: AccountBalances["otherAssets"] = [];

  for (const b of account.balances) {
    if (b.asset_type === "native") {
      // Subtract the base reserve (0.5 XLM per entry) so callers see spendable balance
      const raw = parseFloat(b.balance);
      const subentryCount =
        "subentry_count" in account ? (account as { subentry_count: number }).subentry_count : 0;
      const reserve = (2 + subentryCount) * 0.5;
      xlm = Math.max(0, raw - reserve).toFixed(7);
    } else if (
      b.asset_type === "credit_alphanum4" ||
      b.asset_type === "credit_alphanum12"
    ) {
      const code = b.asset_code;
      const issuer = b.asset_issuer;

      if (code === "USDC" && issuer === USDC_ASSET.getIssuer()) {
        usdc = b.balance;
      } else {
        otherAssets.push({ code, issuer, balance: b.balance });
      }
    }
  }

  return { xlm, usdc, otherAssets };
}

/**
 * Returns only the USDC trustline balance as a number.
 * Returns `0` if the account has no USDC trustline.
 *
 * Throws `AccountNotFoundError` if the account does not exist.
 */
export async function getUSDCBalance(address: string): Promise<number> {
  const balances = await getAccountBalances(address);
  return parseFloat(balances.usdc);
}

/**
 * Returns `true` if the account exists on Horizon, `false` if it does not.
 * Used before attempting to fund a new account.
 *
 * Network errors other than 404 are re-thrown.
 */
export async function checkAccountExists(address: string): Promise<boolean> {
  try {
    await horizon.loadAccount(address);
    return true;
  } catch (err) {
    const anyErr = err as { response?: { status?: number } };
    if (anyErr.response?.status === 404) return false;
    // Re-throw unexpected errors
    normaliseHorizonError(err, address);
  }
}

// ─── Transaction history ──────────────────────────────────────────────────────

/**
 * Fetch paginated transaction history for an account from Horizon.
 *
 * @param address  - Stellar public key
 * @param limit    - Number of records per page (1–200, default 20)
 * @param cursor   - Paging token from a previous response for cursor-based pagination
 *
 * Returns a `PaginatedTransactions` object with the records and the next cursor.
 * Throws `AccountNotFoundError` if the account does not exist.
 */
export async function getAccountTransactions(
  address: string,
  limit = 20,
  cursor?: string
): Promise<PaginatedTransactions> {
  let builder = horizon
    .transactions()
    .forAccount(address)
    .limit(Math.min(Math.max(limit, 1), 200))
    .order("desc");

  if (cursor) {
    builder = builder.cursor(cursor);
  }

  let page: Awaited<ReturnType<typeof builder.call>>;
  try {
    page = await builder.call();
  } catch (err) {
    normaliseHorizonError(err, address);
  }

  const records: AccountTransaction[] = page.records.map((tx) => ({
    id: tx.id,
    hash: tx.hash,
    createdAt: tx.created_at,
    sourceAccount: tx.source_account,
    fee: tx.fee_charged,
    successful: tx.successful,
    memo: tx.memo ?? null,
    memoType: tx.memo_type ?? null,
    operationCount: tx.operation_count,
    pagingToken: tx.paging_token,
    ledger: tx.ledger_attr,
  }));

  // The next cursor is the paging_token of the last record
  const nextCursor =
    records.length > 0 ? records[records.length - 1].pagingToken : undefined;

  return {
    records,
    nextCursor,
    hasMore: records.length === limit,
  };
}

// ─── Transaction submission ───────────────────────────────────────────────────

/**
 * Submit a signed XDR transaction to the Soroban RPC.
 */
export async function submitTransaction(signedXdr: string) {
  const tx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  return rpc.sendTransaction(tx);
}

/**
 * Poll for transaction confirmation.
 */
export async function waitForTransaction(
  hash: string,
  maxAttempts = 30,
  intervalMs = 2000
): Promise<StellarSdk.rpc.Api.GetTransactionResponse> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await rpc.getTransaction(hash);
    if (result.status !== "NOT_FOUND") return result;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Transaction ${hash} not confirmed after ${maxAttempts} attempts`);
}
