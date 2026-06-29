"use client";

import { useState, useEffect, useCallback } from "react";
import { checkPinataHealth } from "@/lib/ipfs";

export type PinataHealthStatus = "idle" | "checking" | "healthy" | "unhealthy";

export interface UsePinataHealthResult {
  status: PinataHealthStatus;
  isHealthy: boolean;
  isChecking: boolean;
  recheck: () => void;
}

/**
 * Checks whether Pinata is reachable before the user attempts an upload.
 * - Fires automatically on mount
 * - Result is implicitly cached for 60 s inside checkPinataHealth()
 * - Exposes a manual `recheck()` for the retry button
 */
export function usePinataHealth(): UsePinataHealthResult {
  const [status, setStatus] = useState<PinataHealthStatus>("idle");

  const run = useCallback(async () => {
    setStatus("checking");
    const healthy = await checkPinataHealth();
    setStatus(healthy ? "healthy" : "unhealthy");
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  return {
    status,
    isHealthy: status === "healthy",
    isChecking: status === "checking",
    recheck: run,
  };
}
