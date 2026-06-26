"use client";

import { useQuery } from "@tanstack/react-query";
import { getPositions } from "@/lib/stellar/contracts";
import type { InvestorPosition } from "@/types/invoice";

export function usePositions(investorAddress?: string, opts?: { refetchInterval?: number }) {
  return useQuery<InvestorPosition[]>({
    queryKey: ["positions", investorAddress],
    queryFn: async () => {
      if (!investorAddress) return [];
      return getPositions(investorAddress);
    },
    enabled: !!investorAddress,
    staleTime: 30_000,
    refetchInterval: opts?.refetchInterval,
  });
}

export default usePositions;
