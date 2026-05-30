// ─── Horizon / Stellar Account Types ─────────────────────────────────────────

/**
 * A single non-native (credit) asset held by an account.
 */
export interface AssetBalance {
  code: string;
  issuer: string;
  balance: string; // decimal string, e.g. "100.0000000"
}

/**
 * Typed balance summary returned by `getAccountBalances`.
 *
 * - `xlm`  — spendable XLM (raw balance minus base reserve), 7 decimal places
 * - `usdc` — USDC trustline balance (canonical Circle issuer), 7 decimal places
 * - `otherAssets` — all other credit assets held by the account
 */
export interface AccountBalances {
  xlm: string;
  usdc: string;
  otherAssets: AssetBalance[];
}

/**
 * A single transaction record from Horizon, normalised to the fields
 * most useful for display and pagination.
 */
export interface AccountTransaction {
  id: string;
  hash: string;
  createdAt: string; // ISO 8601
  sourceAccount: string;
  fee: string; // in stroops
  successful: boolean;
  memo: string | null;
  memoType: string | null;
  operationCount: number;
  pagingToken: string; // used as cursor for the next page
  ledger: number;
}

/**
 * Paginated response from `getAccountTransactions`.
 */
export interface PaginatedTransactions {
  records: AccountTransaction[];
  /** Paging token to pass as `cursor` to fetch the next page. Undefined when there are no more pages. */
  nextCursor: string | undefined;
  /** `true` when the returned page is full, indicating more records likely exist. */
  hasMore: boolean;
}
