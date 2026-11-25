"use client";

import { useSyncExternalStore } from "react";
import { checkRpcHealth, horizon } from "@/lib/stellar/client";

export type NetworkStatus = "checking" | "operational" | "degraded" | "down";
export interface ServiceHealth {
  status: NetworkStatus;
  responseTime: number;
  lastChecked: Date;
  error?: string;
}

export interface NetworkHealth {
  overall: NetworkStatus;
  soroban: ServiceHealth;
  horizon: ServiceHealth;
  network: "testnet" | "mainnet";
}

const HEALTH_CHECK_INTERVAL = 60_000;
const TIMEOUT_MS = 5_000;
const DEGRADED_THRESHOLD_MS = 2_000;

const unchecked: ServiceHealth = { status: "checking", responseTime: 0, lastChecked: new Date(0) };
const initialHealth: NetworkHealth = {
  overall: "checking",
  soroban: unchecked,
  horizon: unchecked,
  network: process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE?.includes("Test") ? "testnet" : "mainnet",
};

function measure(start: number, status?: NetworkStatus): ServiceHealth {
  const responseTime = Date.now() - start;
  return {
    status: status ?? (responseTime > DEGRADED_THRESHOLD_MS ? "degraded" : "operational"),
    responseTime,
    lastChecked: new Date(),
  };
}

async function checkHorizonHealth(): Promise<ServiceHealth> {
  const start = Date.now();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      horizon.ledgers().limit(1).call(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Timeout")), TIMEOUT_MS);
      }),
    ]);
    return measure(start);
  } catch (error) {
    const status = (error as { response?: { status?: number } } | null)?.response?.status;
    return measure(start, status && status >= 400 && status < 500 ? "degraded" : "down");
  } finally {
    clearTimeout(timeout);
  }
}

async function checkSorobanHealth(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const { ok, degraded, latencyMs } = await checkRpcHealth();
    const status = degraded || (ok && latencyMs > DEGRADED_THRESHOLD_MS)
      ? "degraded"
      : ok ? "operational" : "down";
    return { ...measure(start, status), responseTime: latencyMs };
  } catch {
    return measure(start, "down");
  }
}

const initialSnapshot = { health: initialHealth, isOnline: true, wasOffline: false };
let snapshot = initialSnapshot;
let revision = 0;
let pending: Promise<void> | undefined;
let interval: ReturnType<typeof setInterval> | undefined;
const subscribers = new Set<() => void>();

function publish(next: typeof snapshot) {
  snapshot = next;
  subscribers.forEach((listener) => listener());
}

function refresh(): Promise<void> {
  if (!subscribers.size || !snapshot.isOnline || !navigator.onLine) return Promise.resolve();
  if (pending) return pending;

  const current = revision;
  pending = Promise.all([checkSorobanHealth(), checkHorizonHealth()]).then(([soroban, horizon]) => {
    if (current !== revision) return;
    pending = undefined;
    const statuses = [soroban.status, horizon.status];
    const overall = statuses.includes("down") ? "down"
      : statuses.includes("degraded") ? "degraded" : "operational";
    publish({ ...snapshot, health: { ...initialHealth, overall, soroban, horizon } });
  });
  return pending;
}

function syncConnectivity() {
  const isOnline = navigator.onLine;
  if (snapshot.isOnline !== isOnline) {
    revision += 1;
    pending = undefined;
    publish({ health: initialHealth, isOnline, wasOffline: snapshot.wasOffline || !isOnline });
  }
  if (isOnline) void refresh();
}

function subscribe(listener: () => void) {
  subscribers.add(listener);
  if (subscribers.size === 1) {
    window.addEventListener("online", syncConnectivity);
    window.addEventListener("offline", syncConnectivity);
    interval = setInterval(refresh, HEALTH_CHECK_INTERVAL);
    syncConnectivity();
  }
  return () => {
    subscribers.delete(listener);
    if (subscribers.size) return;
    window.removeEventListener("online", syncConnectivity);
    window.removeEventListener("offline", syncConnectivity);
    clearInterval(interval);
    revision += 1;
    pending = undefined;
    snapshot = initialSnapshot;
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => initialSnapshot;

export function useNetworkStatus() {
  return { ...useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot), refresh };
}
