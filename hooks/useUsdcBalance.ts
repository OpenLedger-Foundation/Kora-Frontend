"use client";

import { useQuery } from "@tanstack/react-query";
import { getAccountBalances } from "@/lib/stellar/client";
import { queryKeys } from "@/lib/queryKeys";
import { env } from "@/lib/env";

const USE_MOCK = env.NEXT_PUBLIC_ENABLE_MOCK_DATA;

/**
 * Returns the wallet's USDC balance as a number.
 * Falls back to a large mock balance when mock mode is on.
 *
 * @deprecated Prefer `useUSDCBalance` from `hooks/useAccountBalance` for
 * new code — it uses the shared `queryKeys.account` key factory and proper
 * error handling. This hook is kept for backward compatibility.
 */
export function useUsdcBalance(address: string | undefined) {
  return useQuery({
    queryKey: queryKeys.account.usdcBalance(address ?? ""),
    enabled: !!address,
    staleTime: 30_000,
    queryFn: async () => {
      if (USE_MOCK || !address) return 999_999;
      const balances = await getAccountBalances(address);
      return parseFloat(balances.usdc ?? "0");
    },
  });
}
