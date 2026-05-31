/**
 * lib/stellar/client.ts
 *
 * Resilient Stellar/Soroban RPC client with:
 *  - Multiple endpoint support (primary + configurable fallbacks)
 *  - Automatic failover on error
 *  - Per-endpoint exponential backoff retry (1s → 2s → 4s)
 *  - Circuit breaker: opens after 5 consecutive failures, resets after 60s
 *  - Startup latency health-check to rank endpoints
 *  - Dev-mode console logging for all failover/circuit events
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type {
  AccountBalances,
  AccountTransaction,
  PaginatedTransactions,
} from "@/types/stellar";

// ─── Endpoint configuration ───────────────────────────────────────────────────

const PRIMARY_URL = env.NEXT_PUBLIC_STELLAR_RPC_URL;
const FALLBACK_URLS: string[] = env.NEXT_PUBLIC_STELLAR_RPC_FALLBACK_URLS
  ? env.NEXT_PUBLIC_STELLAR_RPC_FALLBACK_URLS
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean)
  : [];

/** All RPC endpoints in priority order (primary first) */
const ALL_RPC_URLS: string[] = [PRIMARY_URL, ...FALLBACK_URLS];

const NETWORK_PASSPHRASE = env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE;
const HORIZON_URL = env.NEXT_PUBLIC_STELLAR_HORIZON_URL;

// ─── Circuit breaker ──────────────────────────────────────────────────────────

const CIRCUIT_FAILURE_THRESHOLD = 5;   // consecutive failures before opening
const CIRCUIT_RESET_MS = 60_000;       // 60 s before half-open retry

type CircuitState = "closed" | "open" | "half-open";

interface EndpointCircuit {
  url: string;
  state: CircuitState;
  consecutiveFailures: number;
  openedAt: number | null;
}

const circuits = new Map<string, EndpointCircuit>(
  ALL_RPC_URLS.map((url) => [
    url,
    { url, state: "closed", consecutiveFailures: 0, openedAt: null },
  ])
);

function getCircuit(url: string): EndpointCircuit {
  if (!circuits.has(url)) {
    circuits.set(url, { url, state: "closed", consecutiveFailures: 0, openedAt: null });
  }
  return circuits.get(url)!;
}

function recordSuccess(url: string): void {
  const c = getCircuit(url);
  if (c.state !== "closed" || c.consecutiveFailures > 0) {
    logger.info("rpc-circuit", `Circuit closed for ${url}`);
  }
  c.state = "closed";
  c.consecutiveFailures = 0;
  c.openedAt = null;
}

function recordFailure(url: string): void {
  const c = getCircuit(url);
  c.consecutiveFailures += 1;
  if (c.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD && c.state === "closed") {
    c.state = "open";
    c.openedAt = Date.now();
    logger.warn("rpc-circuit", `Circuit OPENED for ${url} after ${c.consecutiveFailures} failures`);
  }
}

function isAvailable(url: string): boolean {
  const c = getCircuit(url);
  if (c.state === "closed") return true;
  if (c.state === "open") {
    const elapsed = Date.now() - (c.openedAt ?? 0);
    if (elapsed >= CIRCUIT_RESET_MS) {
      c.state = "half-open";
      logger.info("rpc-circuit", `Circuit HALF-OPEN for ${url}, probing…`);
      return true;
    }
    return false;
  }
  // half-open: allow one probe through
  return true;
}

// ─── Retry with exponential backoff ──────────────────────────────────────────

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 1_000;

async function withRetry<T>(
  url: string,
  fn: (server: StellarSdk.rpc.Server) => Promise<T>
): Promise<T> {
  const server = new StellarSdk.rpc.Server(url, { allowHttp: url.startsWith("http://") });
  let lastErr: unknown;

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await fn(server);
      recordSuccess(url);
      return result;
    } catch (err) {
      lastErr = err;
      const delay = RETRY_BASE_MS * Math.pow(2, attempt); // 1s, 2s, 4s
      logger.debug("rpc-retry", `Attempt ${attempt + 1}/${RETRY_ATTEMPTS} failed for ${url}, retrying in ${delay}ms`, { err });
      if (attempt < RETRY_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  recordFailure(url);
  throw lastErr;
}

// ─── Resilient RPC client ─────────────────────────────────────────────────────

/**
 * Executes `fn` against each available RPC endpoint in order.
 * Skips endpoints whose circuit breaker is open.
 * Falls back to the next endpoint on failure.
 */
async function callWithFailover<T>(
  fn: (server: StellarSdk.rpc.Server) => Promise<T>,
  operationName = "rpc-call"
): Promise<T> {
  const available = ALL_RPC_URLS.filter(isAvailable);

  if (available.length === 0) {
    throw new Error("All RPC endpoints are unavailable (circuit breakers open)");
  }

  let lastErr: unknown;

  for (let i = 0; i < available.length; i++) {
    const url = available[i];
    if (i > 0) {
      logger.warn("rpc-failover", `Failing over to endpoint ${i + 1}/${available.length}: ${url}`, { operation: operationName });
    }
    try {
      return await withRetry(url, fn);
    } catch (err) {
      lastErr = err;
      logger.warn("rpc-failover", `Endpoint ${url} exhausted for ${operationName}`, { err });
    }
  }

  throw lastErr;
}

// ─── Startup health check ─────────────────────────────────────────────────────

/**
 * Pings all configured RPC endpoints, measures latency, and re-orders
 * ALL_RPC_URLS so the fastest endpoint is tried first.
 * Called once on module load in the browser; no-ops on the server.
 */
async function runHealthCheck(): Promise<void> {
  if (typeof window === "undefined") return; // server-side: skip
  if (ALL_RPC_URLS.length <= 1) return;      // nothing to rank

  logger.debug("rpc-health", `Pinging ${ALL_RPC_URLS.length} RPC endpoints…`);

  const results = await Promise.allSettled(
    ALL_RPC_URLS.map(async (url) => {
      const start = performance.now();
      const server = new StellarSdk.rpc.Server(url, { allowHttp: url.startsWith("http://") });
      await server.getHealth();
      const latency = Math.round(performance.now() - start);
      return { url, latency };
    })
  );

  const ranked: Array<{ url: string; latency: number }> = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      ranked.push(r.value);
      logger.debug("rpc-health", `${r.value.url} — ${r.value.latency}ms`);
    } else {
      const url = ALL_RPC_URLS[results.indexOf(r)];
      logger.warn("rpc-health", `${url} — unreachable`, { err: r.reason });
      recordFailure(url);
    }
  }

  // Re-order ALL_RPC_URLS in-place by ascending latency
  ranked.sort((a, b) => a.latency - b.latency);
  const rankedUrls = ranked.map((r) => r.url);
  // Preserve any URLs that failed (keep them at the end)
  const failed = ALL_RPC_URLS.filter((u) => !rankedUrls.includes(u));
  ALL_RPC_URLS.length = 0;
  ALL_RPC_URLS.push(...rankedUrls, ...failed);

  logger.info("rpc-health", `Endpoint ranking: ${ALL_RPC_URLS.join(" > ")}`);
}

// Fire health check on module load (browser only, non-blocking)
if (typeof window !== "undefined") {
  runHealthCheck().catch((err) =>
    logger.warn("rpc-health", "Health check failed", { err })
  );
}

// ─── Public RPC proxy ─────────────────────────────────────────────────────────

/**
 * Drop-in replacement for `StellarSdk.rpc.Server` that routes all calls
 * through the failover + circuit-breaker logic.
 *
 * Exposes the same methods used across the codebase:
 *   rpc.getAccount, rpc.simulateTransaction, rpc.sendTransaction,
 *   rpc.getTransaction, rpc.getHealth
 */
export const rpc = {
  getAccount: (publicKey: string) =>
    callWithFailover((s) => s.getAccount(publicKey), "getAccount"),

  simulateTransaction: (tx: StellarSdk.Transaction) =>
    callWithFailover((s) => s.simulateTransaction(tx), "simulateTransaction"),

  sendTransaction: (tx: StellarSdk.Transaction) =>
    callWithFailover((s) => s.sendTransaction(tx), "sendTransaction"),

  getTransaction: (hash: string) =>
    callWithFailover((s) => s.getTransaction(hash), "getTransaction"),

  getHealth: () =>
    callWithFailover((s) => s.getHealth(), "getHealth"),

  /** Expose circuit state for the DevPanel */
  getCircuitStates: (): ReadonlyMap<string, Readonly<EndpointCircuit>> => circuits,
};

// ─── Horizon server ───────────────────────────────────────────────────────────

export const horizon = new StellarSdk.Horizon.Server(HORIZON_URL);

export const networkConfig = {
  rpcUrl: PRIMARY_URL,
  networkPassphrase: NETWORK_PASSPHRASE,
  horizonUrl: HORIZON_URL,
};

// ─── USDC asset definition ────────────────────────────────────────────────────

export const USDC_ASSET = new StellarSdk.Asset(
  "USDC",
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
);

// ─── Custom error types ───────────────────────────────────────────────────────

export class AccountNotFoundError extends Error {
  constructor(address: string) {
    super(`Account not found: ${address}`);
    this.name = "AccountNotFoundError";
  }
}

export class HorizonRateLimitError extends Error {
  constructor() {
    super("Horizon rate limit exceeded. Please try again shortly.");
    this.name = "HorizonRateLimitError";
  }
}

export class HorizonNetworkError extends Error {
  constructor(message: string) {
    super(`Horizon network error: ${message}`);
    this.name = "HorizonNetworkError";
  }
}

// ─── Internal error normaliser ────────────────────────────────────────────────

function normaliseHorizonError(err: unknown, address?: string): never {
  if (err instanceof Error) {
    const anyErr = err as { response?: { status?: number } };
    const status = anyErr.response?.status;
    if (status === 404) throw new AccountNotFoundError(address ?? "unknown");
    if (status === 429) throw new HorizonRateLimitError();
    if (status !== undefined) throw new HorizonNetworkError(`HTTP ${status}: ${err.message}`);
  }
  throw new HorizonNetworkError(String(err));
}

// ─── Account helpers ──────────────────────────────────────────────────────────

export async function getAccount(publicKey: string) {
  return horizon.loadAccount(publicKey);
}

export async function getAccountBalances(address: string): Promise<AccountBalances> {
  let account: Awaited<ReturnType<typeof horizon.loadAccount>>;
  try {
    account = await horizon.loadAccount(address);
  } catch (err) {
    normaliseHorizonError(err, address);
  }

  let xlm = "0";
  let usdc = "0";
  const otherAssets: AccountBalances["otherAssets"] = [];

  for (const b of account.balances) {
    if (b.asset_type === "native") {
      const raw = parseFloat(b.balance);
      const subentryCount =
        "subentry_count" in account ? (account as { subentry_count: number }).subentry_count : 0;
      const reserve = (2 + subentryCount) * 0.5;
      xlm = Math.max(0, raw - reserve).toFixed(7);
    } else if (
      b.asset_type === "credit_alphanum4" ||
      b.asset_type === "credit_alphanum12"
    ) {
      const code = b.asset_code;
      const issuer = b.asset_issuer;
      if (code === "USDC" && issuer === USDC_ASSET.getIssuer()) {
        usdc = b.balance;
      } else {
        otherAssets.push({ code, issuer, balance: b.balance });
      }
    }
  }

  return { xlm, usdc, otherAssets };
}

export async function getUSDCBalance(address: string): Promise<number> {
  const balances = await getAccountBalances(address);
  return parseFloat(balances.usdc);
}

export async function checkAccountExists(address: string): Promise<boolean> {
  try {
    await horizon.loadAccount(address);
    return true;
  } catch (err) {
    const anyErr = err as { response?: { status?: number } };
    if (anyErr.response?.status === 404) return false;
    normaliseHorizonError(err, address);
  }
}

export async function fundTestnetAccount(address: string): Promise<void> {
  const url = `https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`;
  const response = await fetch(url);
  if (!response.ok) {
    let message = `Friendbot request failed (${response.status})`;
    try {
      const data = await response.json();
      if (typeof data?.detail === "string" && data.detail.length > 0) {
        message = data.detail;
      }
    } catch { /* best-effort */ }
    throw new Error(message);
  }
}

// ─── Transaction history ──────────────────────────────────────────────────────

export async function getAccountTransactions(
  address: string,
  limit = 20,
  cursor?: string
): Promise<PaginatedTransactions> {
  let builder = horizon
    .transactions()
    .forAccount(address)
    .limit(Math.min(Math.max(limit, 1), 200))
    .order("desc");

  if (cursor) builder = builder.cursor(cursor);

  let page: Awaited<ReturnType<typeof builder.call>>;
  try {
    page = await builder.call();
  } catch (err) {
    normaliseHorizonError(err, address);
  }

  const records: AccountTransaction[] = page.records.map((tx) => ({
    id: tx.id,
    hash: tx.hash,
    createdAt: tx.created_at,
    sourceAccount: tx.source_account,
    fee: tx.fee_charged,
    successful: tx.successful,
    memo: tx.memo ?? null,
    memoType: tx.memo_type ?? null,
    operationCount: tx.operation_count,
    pagingToken: tx.paging_token,
    ledger: tx.ledger_attr,
  }));

  const nextCursor =
    records.length > 0 ? records[records.length - 1].pagingToken : undefined;

  return { records, nextCursor, hasMore: records.length === limit };
}

// ─── Transaction submission ───────────────────────────────────────────────────

export async function submitTransaction(signedXdr: string) {
  const tx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  return rpc.sendTransaction(tx as StellarSdk.Transaction);
}

export async function waitForTransaction(
  hash: string,
  maxAttempts = 30,
  intervalMs = 2000
): Promise<StellarSdk.rpc.Api.GetTransactionResponse> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await rpc.getTransaction(hash);
    if (result.status !== "NOT_FOUND") return result;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Transaction ${hash} not confirmed after ${maxAttempts} attempts`);
}
