"use client";

/**
 * ContractEventSubscriber — mounts the Soroban event streaming hook.
 *
 * Activates useContractEvents (stream + polling fallback) for marketplace and
 * dashboard pages. Kept separate so it can be dynamically imported (ssr: false).
 */

import { useContractEvents } from "@/hooks/useContractEvents";

export function ContractEventSubscriber() {
  useContractEvents();
  return null;
}
