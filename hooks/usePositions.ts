"use client";

import { useQuery } from "@tanstack/react-query";
import { getPositions } from "@/lib/stellar/contracts";
import type { InvestorPosition } from "@/types/invoice";

export function usePositions(investorAddress?: string, opts?: { refetchInterval?: number }) {
  return useQuery<InvestorPosition[]>({
    queryKey: ["positions", investorAddress],
    queryFn: async () => {
      if (!investorAddress) return [];
      const positions = await getPositions(investorAddress);
      return positions.map((p) => ({
        id: p.invoiceId,
        invoiceId: p.invoiceId,
        invoice: p.invoice,
        investedAmount: p.investedAmount,
        expectedReturn: p.expectedReturn,
        status: p.status,
      }));
    },
    enabled: !!investorAddress,
    staleTime: 30_000,
    refetchInterval: opts?.refetchInterval,
  });
}

export default usePositions;
