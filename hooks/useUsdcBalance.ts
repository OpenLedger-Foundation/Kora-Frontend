"use client";

import { useQuery } from "@tanstack/react-query";
import { getAccountBalances } from "@/lib/stellar/client";

const USE_MOCK = process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA === "true";

/**
 * Returns the wallet's USDC balance as a number.
 * Falls back to a large mock balance when mock mode is on.
 */
export function useUsdcBalance(address: string | undefined) {
  return useQuery({
    queryKey: ["usdc-balance", address],
    enabled: !!address,
    staleTime: 30_000,
    queryFn: async () => {
      if (USE_MOCK || !address) return 999_999;
      const balances = await getAccountBalances(address);
      return parseFloat(balances["USDC"] ?? "0");
    },
  });
}
