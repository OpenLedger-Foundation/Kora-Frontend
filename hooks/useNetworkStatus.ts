"use client";

import { useCallback, useEffect, useState } from "react";
import { checkRpcHealth, horizon } from "@/lib/stellar/client";

export type NetworkStatus = "operational" | "degraded" | "down";
/** Overall status includes the browser-offline state, which is distinct from a service outage. */
export type OverallNetworkStatus = NetworkStatus | "offline";

export interface ServiceHealth {
  status: NetworkStatus;
  responseTime: number;
  lastChecked: Date;
  error?: string;
}

export interface NetworkHealth {
  /** Last known service health. Kept unchanged while the browser is offline. */
  overall: NetworkStatus;
  soroban: ServiceHealth;
  horizon: ServiceHealth;
  network: "testnet" | "mainnet";
}

const HEALTH_CHECK_INTERVAL = 60000; // 60 seconds
const TIMEOUT_MS = 5000; // 5 seconds
const DEGRADED_THRESHOLD_MS = 2000; // 2 seconds

export function useNetworkStatus() {
  const [health, setHealth] = useState<NetworkHealth>({
    overall: "operational",
    soroban: {
      status: "operational",
      responseTime: 0,
      lastChecked: new Date(),
    },
    horizon: {
      status: "operational",
      responseTime: 0,
      lastChecked: new Date(),
    },
    network: process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE?.includes("Test") ? "testnet" : "mainnet",
  });

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof window !== "undefined" ? window.navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState<boolean>(
    typeof window !== "undefined" ? !window.navigator.onLine : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Sync initial state
    setIsOnline(window.navigator.onLine);
    if (!window.navigator.onLine) {
      setWasOffline(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const checkSorobanHealth = useCallback(async (): Promise<ServiceHealth> => {
    const { ok, latencyMs } = await checkRpcHealth();
    if (!ok) {
      return { status: "down", responseTime: latencyMs, lastChecked: new Date(), error: "RPC unreachable" };
    }
    return {
      status: latencyMs > DEGRADED_THRESHOLD_MS ? "degraded" : "operational",
      responseTime: latencyMs,
      lastChecked: new Date(),
    };
  }, []);

  const checkHorizonHealth = useCallback(async (): Promise<ServiceHealth> => {
    const startTime = Date.now();
    try {
      // Simple health check - get ledger info
      await Promise.race([
        horizon.ledgers().limit(1).call(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout")), TIMEOUT_MS)
        ),
      ]);
      
      const responseTime = Date.now() - startTime;
      const status: NetworkStatus = responseTime > DEGRADED_THRESHOLD_MS ? "degraded" : "operational";
      
      return {
        status,
        responseTime,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        status: "down",
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }, []);

  const performHealthCheck = useCallback(async () => {
    // A failed request while the browser has no connectivity says nothing
    // about service health. Skip the probes so the last known health is kept.
    if (typeof window !== "undefined" && !window.navigator.onLine) return;

    try {
      const [sorobanHealth, horizonHealth] = await Promise.all([
        checkSorobanHealth(),
        checkHorizonHealth(),
      ]);

      // The connection may have dropped while the probes were in flight.
      if (typeof window !== "undefined" && !window.navigator.onLine) return;

      // Determine overall status
      let overall: NetworkStatus = "operational";
      if (sorobanHealth.status === "down" || horizonHealth.status === "down") {
        overall = "down";
      } else if (sorobanHealth.status === "degraded" || horizonHealth.status === "degraded") {
        overall = "degraded";
      }

      setHealth(prev => ({
        ...prev,
        overall,
        soroban: sorobanHealth,
        horizon: horizonHealth,
      }));
    } catch (error) {
      console.error("Health check failed:", error);
    }
  }, [checkSorobanHealth, checkHorizonHealth]);

  useEffect(() => {
    // No remote checks while offline; re-check immediately on reconnect and
    // keep the last known service health until then.
    if (!isOnline) return;

    void performHealthCheck();
    const interval = setInterval(() => {
      void performHealthCheck();
    }, HEALTH_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [isOnline, performHealthCheck]);

  const status: OverallNetworkStatus = isOnline ? health.overall : "offline";

  return {
    health,
    refresh: performHealthCheck,
    isOnline,
    wasOffline,
    offline: !isOnline,
    status,
  };
}
