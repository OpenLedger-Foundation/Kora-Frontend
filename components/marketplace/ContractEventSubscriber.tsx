"use client";

/**
 * ContractEventSubscriber — mounts the Soroban event polling hook.
 *
 * This is a render-nothing component that activates the useContractEvents
 * hook for the marketplace and dashboard pages. It is intentionally kept
 * separate from the layout so it can be dynamically imported (ssr: false)
 * without affecting server-rendered metadata.
 */

import { useContractEvents } from "@/hooks/useContractEvents";

export function ContractEventSubscriber() {
  useContractEvents();
  return null;
}
