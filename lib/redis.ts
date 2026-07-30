/**
 * Redis client singleton for distributed rate limiting and session storage.
 *
 * Production:  set REDIS_URL=redis://...  (or REDIS_TLS_URL for TLS)
 * Development: omit REDIS_URL — falls back to an in-memory adapter so the
 *              app starts without a running Redis instance.
 *
 * The exported `redis` object exposes only the subset of commands used by
 * Kora: `incr`, `expire`, `ttl`, `del`, and `quit`.  Both the real ioredis
 * client and the in-memory fallback implement this same interface so callers
 * never need to branch on the backend.
 */

// ─── Client interface (minimal surface used by Kora) ─────────────────────────

export interface RedisClient {
  /** Increment the integer stored at key by 1 (creates key with value 1 if absent). */
  incr(key: string): Promise<number>;
  /** Set a timeout (seconds) on key. Returns 1 if set, 0 if key does not exist. */
  expire(key: string, seconds: number): Promise<number>;
  /** Return the remaining TTL in seconds, or -1 if no expiry, -2 if key missing. */
  ttl(key: string): Promise<number>;
  /** Delete one or more keys. Returns number of keys deleted. */
  del(key: string): Promise<number>;
  /** Gracefully close the connection (no-op for memory backend). */
  quit(): Promise<void>;
}

// ─── Minimal shape of the ioredis client we rely on ──────────────────────────

interface IoRedisLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  del(key: string): Promise<number>;
  quit(): Promise<string>;
  on(event: string, listener: (...args: unknown[]) => void): this;
}

// ─── In-memory fallback (dev / test) ─────────────────────────────────────────

interface MemEntry {
  value: number;
  expiresAt: number | null; // null = no expiry
}

export class MemoryRedisClient implements RedisClient {
  private readonly store = new Map<string, MemEntry>();

  private getEntry(key: string): MemEntry | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  async incr(key: string): Promise<number> {
    const entry = this.getEntry(key);
    const newVal = (entry?.value ?? 0) + 1;
    this.store.set(key, { value: newVal, expiresAt: entry?.expiresAt ?? null });
    return newVal;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.getEntry(key);
    if (!entry) return 0;
    this.store.set(key, { value: entry.value, expiresAt: Date.now() + seconds * 1000 });
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.getEntry(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async quit(): Promise<void> {
    this.store.clear();
  }

  /** Test helper — wipes all stored entries. */
  _flush(): void {
    this.store.clear();
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

type IoRedisConstructor = new (url: string, opts: Record<string, unknown>) => IoRedisLike;

function createRedisClient(): RedisClient {
  const url = process.env.REDIS_URL ?? process.env.REDIS_TLS_URL;

  if (!url) {
    // No Redis URL — use the in-memory fallback (dev / test).
    return new MemoryRedisClient();
  }

  // Lazy-require ioredis so builds without the package still work in dev.
  const ioredisModule = require("ioredis") as IoRedisConstructor & { default?: IoRedisConstructor };
  // ioredis exports the class as the default export in ESM interop, or as the
  // module root in CJS. Handle both shapes.
  const RedisConstructor: IoRedisConstructor =
    typeof ioredisModule === "function"
      ? ioredisModule
      : (ioredisModule.default as IoRedisConstructor);

  const client = new RedisConstructor(url, {
    // Fail fast on connection errors rather than queuing forever.
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
    lazyConnect: false,
    enableOfflineQueue: false,
    tls: url.startsWith("rediss://") ? {} : undefined,
  });

  client.on("error", (...args: unknown[]) => {
    // Don't crash the process on Redis connection errors.
    // Rate limiting degrades gracefully via the try/catch in rateLimiter.ts.
    const err = args[0] as Error;
    console.error("[redis] connection error:", err?.message ?? err);
  });

  return {
    incr: (key) => client.incr(key),
    expire: (key, seconds) => client.expire(key, seconds).then((r) => Number(r)),
    ttl: (key) => client.ttl(key),
    del: (key) => client.del(key),
    quit: () => client.quit().then(() => undefined),
  };
}

// Module-level singleton — reused across hot-reloads in Next.js dev server.
declare global {
  // eslint-disable-next-line no-var
  var __koraRedis: RedisClient | undefined;
}

export const redis: RedisClient =
  globalThis.__koraRedis ?? (globalThis.__koraRedis = createRedisClient());
