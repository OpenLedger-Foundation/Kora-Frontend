"use client";

import { useQuery } from "@tanstack/react-query";
import { env } from "@/lib/env";
import { marketplaceContract } from "@/lib/stellar/contracts";
import { fetchPositions } from "@/services/invoiceService";
import type { InvoicePosition } from "@/types/invoice";

async function loadPositions(investorAddress: string): Promise<InvoicePosition[]> {
  // Use mock service when mock data is enabled
  if (env.NEXT_PUBLIC_ENABLE_MOCK_DATA) {
    return fetchPositions(investorAddress);
  }
  // Live path: call the contract directly
  return marketplaceContract.getPositions(investorAddress, investorAddress);
}

export function usePositions(
  investorAddress?: string,
  opts?: { refetchInterval?: number }
) {
  return useQuery({
    queryKey: ["positions", investorAddress],
    queryFn: () => loadPositions(investorAddress!),
    enabled: !!investorAddress,
    staleTime: 30_000,
    refetchInterval: opts?.refetchInterval,
    // Never throw — return empty array so the dashboard shows empty state
    placeholderData: [] as InvoicePosition[],
  });
}

export default usePositions;
