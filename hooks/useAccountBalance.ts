"use client";

/**
 * TanStack Query hooks for Horizon account data.
 *
 * All queries share a 30-second stale time and retry once on failure.
 * AccountNotFoundError is treated as a non-retryable condition so the
 * query settles immediately rather than burning retry budget.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAccountBalances,
  getAccountTransactions,
  getUSDCBalance,
  checkAccountExists,
  AccountNotFoundError,
} from "@/lib/stellar/client";
import { queryKeys } from "@/lib/queryKeys";
import type { AccountBalances, PaginatedTransactions } from "@/types/stellar";

const STALE_30S = 30_000;
const GC_5MIN = 5 * 60 * 1000;

// ─── Retry helper ─────────────────────────────────────────────────────────────

/**
 * Do not retry when the account simply doesn't exist — that's a known state,
 * not a transient failure. Retry once for everything else.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof AccountNotFoundError) return false;
  return failureCount < 1;
}

// ─── useAccountBalances ───────────────────────────────────────────────────────

/**
 * Fetches XLM and USDC balances (plus any other assets) for the given address.
 *
 * Returns `undefined` while loading and `null` when the account is not found.
 *
 * @example
 * const { data, isLoading, error } = useAccountBalances(address);
 * data?.xlm   // spendable XLM string
 * data?.usdc  // USDC trustline balance string
 */
export function useAccountBalances(address: string | undefined) {
  return useQuery<AccountBalances | null, Error>({
    queryKey: queryKeys.account.balances(address ?? ""),
    enabled: !!address,
    staleTime: STALE_30S,
    gcTime: GC_5MIN,
    retry: shouldRetry,
    queryFn: async () => {
      try {
        return await getAccountBalances(address!);
      } catch (err) {
        if (err instanceof AccountNotFoundError) return null;
        throw err;
      }
    },
  });
}

// ─── useUSDCBalance ───────────────────────────────────────────────────────────

/**
 * Returns the USDC trustline balance as a `number`.
 * Returns `0` when the account has no USDC trustline or does not exist.
 *
 * @example
 * const { data: usdcBalance } = useUSDCBalance(address);
 */
export function useUSDCBalance(address: string | undefined) {
  return useQuery<number, Error>({
    queryKey: queryKeys.account.usdcBalance(address ?? ""),
    enabled: !!address,
    staleTime: STALE_30S,
    gcTime: GC_5MIN,
    retry: shouldRetry,
    queryFn: async () => {
      try {
        return await getUSDCBalance(address!);
      } catch (err) {
        if (err instanceof AccountNotFoundError) return 0;
        throw err;
      }
    },
  });
}

// ─── useAccountTransactions ───────────────────────────────────────────────────

/**
 * Fetches a page of transaction history for the given address.
 *
 * Pass `cursor` (the `nextCursor` from a previous page) to fetch subsequent pages.
 * The query key includes both `limit` and `cursor` so each page is cached independently.
 *
 * @example
 * const { data } = useAccountTransactions(address, 20);
 * // Load next page:
 * const { data: page2 } = useAccountTransactions(address, 20, data?.nextCursor);
 */
export function useAccountTransactions(
  address: string | undefined,
  limit = 20,
  cursor?: string
) {
  return useQuery<PaginatedTransactions | null, Error>({
    queryKey: queryKeys.account.transactions(address ?? "", limit, cursor),
    enabled: !!address,
    staleTime: STALE_30S,
    gcTime: GC_5MIN,
    retry: shouldRetry,
    queryFn: async () => {
      try {
        return await getAccountTransactions(address!, limit, cursor);
      } catch (err) {
        if (err instanceof AccountNotFoundError) return null;
        throw err;
      }
    },
  });
}

// ─── useCheckAccountExists ────────────────────────────────────────────────────

/**
 * Returns `true` if the account exists on Horizon, `false` otherwise.
 * Primarily used before attempting to fund a new account via friendbot or transfer.
 *
 * @example
 * const { data: exists } = useCheckAccountExists(address);
 * if (exists === false) { // fund the account }
 */
export function useCheckAccountExists(address: string | undefined) {
  return useQuery<boolean, Error>({
    queryKey: queryKeys.account.exists(address ?? ""),
    enabled: !!address,
    staleTime: STALE_30S,
    gcTime: GC_5MIN,
    // Never retry existence checks — the answer is deterministic
    retry: false,
    queryFn: () => checkAccountExists(address!),
  });
}

// ─── Prefetch helper ──────────────────────────────────────────────────────────

/**
 * Returns a function that warms the balance cache for a given address.
 * Useful to call on wallet connect before the balance is needed in the UI.
 *
 * @example
 * const prefetch = usePrefetchAccountBalances();
 * prefetch(walletAddress);
 */
export function usePrefetchAccountBalances() {
  const queryClient = useQueryClient();
  return (address: string) =>
    queryClient.prefetchQuery({
      queryKey: queryKeys.account.balances(address),
      queryFn: async () => {
        try {
          return await getAccountBalances(address);
        } catch (err) {
          if (err instanceof AccountNotFoundError) return null;
          throw err;
        }
      },
      staleTime: STALE_30S,
    });
}
