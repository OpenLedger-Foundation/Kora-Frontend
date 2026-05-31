/**
 * lib/logger.ts
 *
 * Structured logger with levels, JSON output, and an in-memory ring buffer
 * consumed by the DevPanel. All output is gated behind
 * NEXT_PUBLIC_ENABLE_DEVTOOLS (debug/info) or always-on (warn/error).
 */

import { env } from "@/lib/env";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  level: LogLevel;
  /** Dot-separated namespace, e.g. "rpc-circuit", "render", "network" */
  namespace: string;
  message: string;
  data?: unknown;
  timestamp: number; // Date.now()
}

// ─── Ring buffer ──────────────────────────────────────────────────────────────

const MAX_ENTRIES = 200;
const _buffer: LogEntry[] = [];
const _listeners = new Set<(entry: LogEntry) => void>();

function push(entry: LogEntry): void {
  _buffer.push(entry);
  if (_buffer.length > MAX_ENTRIES) _buffer.shift();
  _listeners.forEach((fn) => fn(entry));
}

// ─── Subscriber API (used by DevPanel) ───────────────────────────────────────

export function subscribeToLogs(fn: (entry: LogEntry) => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function getLogBuffer(): readonly LogEntry[] {
  return _buffer;
}

export function clearLogBuffer(): void {
  _buffer.length = 0;
}

// ─── Level weights ────────────────────────────────────────────────────────────

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const IS_DEV = env.NEXT_PUBLIC_ENABLE_DEVTOOLS;

// ─── Core emit ────────────────────────────────────────────────────────────────

let _idCounter = 0;

function emit(level: LogLevel, namespace: string, message: string, data?: unknown): void {
  const entry: LogEntry = {
    id: `log-${Date.now()}-${++_idCounter}`,
    level,
    namespace,
    message,
    data,
    timestamp: Date.now(),
  };

  // Always store in buffer (DevPanel reads it)
  push(entry);

  // Console output: debug/info only in devtools mode; warn/error always
  const weight = LEVEL_WEIGHT[level];
  if (weight < LEVEL_WEIGHT.warn && !IS_DEV) return;

  const prefix = `[kora:${namespace}]`;
  const structured = { level, namespace, message, ...(data !== undefined ? { data } : {}) };

  if (level === "debug") console.debug(prefix, message, data ?? "");
  else if (level === "info") console.info(prefix, message, data ?? "");
  else if (level === "warn") console.warn(prefix, message, data ?? "");
  else console.error(prefix, message, data ?? "");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const logger = {
  debug: (namespace: string, message: string, data?: unknown) =>
    emit("debug", namespace, message, data),
  info: (namespace: string, message: string, data?: unknown) =>
    emit("info", namespace, message, data),
  warn: (namespace: string, message: string, data?: unknown) =>
    emit("warn", namespace, message, data),
  error: (namespace: string, message: string, data?: unknown) =>
    emit("error", namespace, message, data),
};

// ─── Network request interceptor ─────────────────────────────────────────────

export interface NetworkLogEntry {
  id: string;
  url: string;
  method: string;
  status: number | null;
  durationMs: number | null;
  error: string | null;
  timestamp: number;
}

const MAX_NETWORK_ENTRIES = 100;
const _networkBuffer: NetworkLogEntry[] = [];
const _networkListeners = new Set<(entry: NetworkLogEntry) => void>();

function pushNetwork(entry: NetworkLogEntry): void {
  _networkBuffer.push(entry);
  if (_networkBuffer.length > MAX_NETWORK_ENTRIES) _networkBuffer.shift();
  _networkListeners.forEach((fn) => fn(entry));
}

export function subscribeToNetworkLog(fn: (entry: NetworkLogEntry) => void): () => void {
  _networkListeners.add(fn);
  return () => _networkListeners.delete(fn);
}

export function getNetworkLogBuffer(): readonly NetworkLogEntry[] {
  return _networkBuffer;
}

export function clearNetworkLogBuffer(): void {
  _networkBuffer.length = 0;
}

/**
 * Patches the global `fetch` to log all requests to the network buffer.
 * Only installed when NEXT_PUBLIC_ENABLE_DEVTOOLS=true and in the browser.
 * Safe to call multiple times — installs only once.
 */
let _fetchPatched = false;

export function installNetworkInterceptor(): void {
  if (_fetchPatched || typeof window === "undefined" || !IS_DEV) return;
  _fetchPatched = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? "GET";
    const start = performance.now();
    let status: number | null = null;
    let error: string | null = null;

    try {
      const response = await originalFetch(input, init);
      status = response.status;
      return response;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const durationMs = Math.round(performance.now() - start);
      pushNetwork({
        id: `net-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        url,
        method,
        status,
        durationMs,
        error,
        timestamp: Date.now(),
      });
    }
  };
}
