import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

/**
 * `useNetworkStatus` talks to two very different backends: the Soroban RPC
 * (via `checkRpcHealth`) and Horizon (via `horizon.ledgers()`). Both are
 * mocked here so the roll-up logic — operational / degraded / down — can be
 * asserted deterministically without touching the network.
 */
const mocks = vi.hoisted(() => ({
  checkRpcHealth: vi.fn(),
  horizonCall: vi.fn(),
  ledgers: vi.fn(),
}));

vi.mock("@/lib/stellar/client", () => ({
  checkRpcHealth: mocks.checkRpcHealth,
  horizon: {
    ledgers: (...args: unknown[]) => mocks.ledgers(...args),
  },
}));

import { useNetworkStatus } from "../useNetworkStatus";

/** Lets a test control how long the (already-resolved) Horizon call reports. */
let clock = 0;
let dateNowSpy: ReturnType<typeof vi.spyOn>;

/**
 * Renders the hook and waits for the initial health check to settle.
 * `waitFor` is used instead of a fixed tick so the assertion holds regardless
 * of microtask scheduling.
 */
const renderAndSettle = async () => {
  const view = renderHook(() => useNetworkStatus());
  await waitFor(() => expect(mocks.checkRpcHealth).toHaveBeenCalled());
  // Let the Promise.all in performHealthCheck resolve.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return view;
};

describe("useNetworkStatus", () => {
  beforeEach(() => {
    clock = 1_000_000;
    dateNowSpy = vi.spyOn(Date, "now").mockImplementation(() => clock);

    mocks.checkRpcHealth.mockResolvedValue({ ok: true, latencyMs: 120 });
    mocks.horizonCall.mockResolvedValue({ sequence: 1 });
    mocks.ledgers.mockReturnValue({ limit: () => ({ call: mocks.horizonCall }) });
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
    vi.restoreAllMocks();
  });

  // ─── overall roll-up ────────────────────────────────────────────────────────

  describe("overall roll-up", () => {
    it("reports operational when both services are fast and healthy", async () => {
      const { result } = await renderAndSettle();

      expect(result.current.health.overall).toBe("operational");
      expect(result.current.health.soroban.status).toBe("operational");
      expect(result.current.health.horizon.status).toBe("operational");
    });

    it("reports degraded when only Soroban exceeds the latency threshold", async () => {
      mocks.checkRpcHealth.mockResolvedValue({ ok: true, latencyMs: 2500 });

      const { result } = await renderAndSettle();

      expect(result.current.health.soroban.status).toBe("degraded");
      expect(result.current.health.soroban.responseTime).toBe(2500);
      expect(result.current.health.horizon.status).toBe("operational");
      expect(result.current.health.overall).toBe("degraded");
    });

    it("reports degraded when only Horizon exceeds the latency threshold", async () => {
      let release: (() => void) | undefined;
      mocks.horizonCall.mockImplementation(
        () => new Promise<void>((resolve) => { release = resolve; }),
      );

      const { result } = await renderAndSettle();

      // Advance past the 2000ms degraded threshold, then let Horizon resolve.
      clock += 3000;
      await act(async () => {
        release?.();
      });

      expect(result.current.health.horizon.status).toBe("degraded");
      expect(result.current.health.horizon.responseTime).toBe(3000);
      expect(result.current.health.soroban.status).toBe("operational");
      expect(result.current.health.overall).toBe("degraded");
    });

    it("reports down when Soroban RPC is unreachable", async () => {
      mocks.checkRpcHealth.mockResolvedValue({ ok: false, latencyMs: 400 });

      const { result } = await renderAndSettle();

      expect(result.current.health.soroban.status).toBe("down");
      expect(result.current.health.soroban.error).toBe("RPC unreachable");
      expect(result.current.health.overall).toBe("down");
    });

    it("reports down and surfaces the Horizon error message", async () => {
      mocks.horizonCall.mockRejectedValue(new Error("Horizon 503"));

      const { result } = await renderAndSettle();

      expect(result.current.health.horizon.status).toBe("down");
      expect(result.current.health.horizon.error).toBe("Horizon 503");
      expect(result.current.health.overall).toBe("down");
    });

    it("reports down when both services are down", async () => {
      mocks.checkRpcHealth.mockResolvedValue({ ok: false, latencyMs: 900 });
      mocks.horizonCall.mockRejectedValue(new Error("connection refused"));

      const { result } = await renderAndSettle();

      expect(result.current.health.soroban.status).toBe("down");
      expect(result.current.health.horizon.status).toBe("down");
      expect(result.current.health.overall).toBe("down");
    });

    it("treats a healthy-but-slow RPC as degraded rather than down", async () => {
      mocks.checkRpcHealth.mockResolvedValue({ ok: true, latencyMs: 2001 });

      const { result } = await renderAndSettle();

      expect(result.current.health.soroban.status).toBe("degraded");
      expect(result.current.health.soroban.error).toBeUndefined();
      expect(result.current.health.overall).toBe("degraded");
    });

    it("keeps a non-Error rejection on the down path", async () => {
      mocks.horizonCall.mockRejectedValue("string failure");

      const { result } = await renderAndSettle();

      expect(result.current.health.horizon.status).toBe("down");
      expect(result.current.health.horizon.error).toBe("Unknown error");
      expect(result.current.health.overall).toBe("down");
    });
  });

  // ─── per-service health shape ───────────────────────────────────────────────

  describe("service health payload", () => {
    it("stamps lastChecked on both services", async () => {
      const { result } = await renderAndSettle();

      expect(result.current.health.soroban.lastChecked).toBeInstanceOf(Date);
      expect(result.current.health.horizon.lastChecked).toBeInstanceOf(Date);
    });

    it("records the measured response time for each service", async () => {
      mocks.checkRpcHealth.mockResolvedValue({ ok: true, latencyMs: 640 });

      const { result } = await renderAndSettle();

      expect(result.current.health.soroban.responseTime).toBe(640);
    });

    it("queries the most recent ledger from Horizon", async () => {
      await renderAndSettle();

      expect(mocks.ledgers).toHaveBeenCalled();
      expect(mocks.horizonCall).toHaveBeenCalled();
    });
  });

  // ─── manual refresh ─────────────────────────────────────────────────────────

  describe("refresh", () => {
    it("re-runs the checks on demand", async () => {
      const { result } = await renderAndSettle();
      expect(mocks.checkRpcHealth).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.refresh();
      });

      expect(mocks.checkRpcHealth).toHaveBeenCalledTimes(2);
    });

    it("reflects a degraded result after a manual refresh", async () => {
      const { result } = await renderAndSettle();
      expect(result.current.health.overall).toBe("operational");

      mocks.checkRpcHealth.mockResolvedValue({ ok: false, latencyMs: 1000 });
      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.health.overall).toBe("down");
    });
  });

  // ─── browser connectivity ───────────────────────────────────────────────────

  describe("browser connectivity", () => {
    const setOnline = (value: boolean) => {
      Object.defineProperty(window.navigator, "onLine", {
        value,
        configurable: true,
      });
    };

    afterEach(() => {
      setOnline(true);
    });

    it("starts online with no prior offline event", async () => {
      setOnline(true);

      const { result } = await renderAndSettle();

      expect(result.current.isOnline).toBe(true);
      expect(result.current.wasOffline).toBe(false);
    });

    it("flips to offline and records that it was offline", async () => {
      setOnline(true);
      const { result } = await renderAndSettle();

      await act(async () => {
        setOnline(false);
        window.dispatchEvent(new Event("offline"));
      });

      expect(result.current.isOnline).toBe(false);
      expect(result.current.wasOffline).toBe(true);
    });

    it("recovers when the browser comes back online", async () => {
      setOnline(true);
      const { result } = await renderAndSettle();

      await act(async () => {
        setOnline(false);
        window.dispatchEvent(new Event("offline"));
      });
      await act(async () => {
        setOnline(true);
        window.dispatchEvent(new Event("online"));
      });

      expect(result.current.isOnline).toBe(true);
      // wasOffline stays true so the UI can offer a "back online" notice.
      expect(result.current.wasOffline).toBe(true);
    });

    it("starts offline when the browser is already disconnected", async () => {
      setOnline(false);

      const { result } = await renderAndSettle();

      expect(result.current.isOnline).toBe(false);
      expect(result.current.wasOffline).toBe(true);
    });
  });

  // ─── network label ──────────────────────────────────────────────────────────

  describe("network label", () => {
    const original = process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE;

    afterEach(() => {
      if (original === undefined) {
        delete process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE;
      } else {
        process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE = original;
      }
    });

    it("detects testnet from the network passphrase", async () => {
      process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

      const { result } = await renderAndSettle();

      expect(result.current.health.network).toBe("testnet");
    });

    it("defaults to mainnet for a public passphrase", async () => {
      process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015";

      const { result } = await renderAndSettle();

      expect(result.current.health.network).toBe("mainnet");
    });
  });
});