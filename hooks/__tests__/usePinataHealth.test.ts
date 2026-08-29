/**
 * Tests for usePinataHealth — Pinata health degradation UX (#394).
 *
 * Covers:
 *  - initial probe on mount (down / up)
 *  - down → up recovery via manual recheck
 *  - recheck bypasses the health cache (invalidates before probing)
 *  - exponential-backoff auto-retry when unhealthy
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePinataHealth } from "../usePinataHealth";
import { checkPinataHealth, invalidatePinataHealthCache } from "@/lib/ipfs";

vi.mock("@/lib/ipfs", () => ({
  checkPinataHealth: vi.fn(),
  invalidatePinataHealthCache: vi.fn(),
}));

const mockCheck = vi.mocked(checkPinataHealth);
const mockInvalidate = vi.mocked(invalidatePinataHealthCache);

describe("usePinataHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports healthy when the initial probe succeeds", async () => {
    mockCheck.mockResolvedValue(true);

    const { result } = renderHook(() => usePinataHealth({ autoRetry: false }));

    await waitFor(() => expect(result.current.status).toBe("healthy"));
    expect(result.current.isHealthy).toBe(true);
    expect(result.current.lastCheckedAt).not.toBeNull();
  });

  it("reports unhealthy when the initial probe fails", async () => {
    mockCheck.mockResolvedValue(false);

    const { result } = renderHook(() => usePinataHealth({ autoRetry: false }));

    await waitFor(() => expect(result.current.status).toBe("unhealthy"));
    expect(result.current.isHealthy).toBe(false);
  });

  it("recovers from down → up on manual recheck and bypasses the cache", async () => {
    mockCheck.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const { result } = renderHook(() => usePinataHealth({ autoRetry: false }));

    await waitFor(() => expect(result.current.status).toBe("unhealthy"));

    await act(async () => {
      result.current.recheck();
    });

    await waitFor(() => expect(result.current.status).toBe("healthy"));
    // recheck must force a fresh probe rather than returning the cached result.
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it("auto-retries with exponential backoff while unhealthy, then recovers", async () => {
    vi.useFakeTimers();
    // First two probes fail, third succeeds.
    mockCheck
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const { result } = renderHook(() =>
      usePinataHealth({ autoRetry: true, baseDelayMs: 1000, maxRetries: 4 })
    );

    // Initial probe resolves → unhealthy, schedules retry #1.
    await vi.waitFor(() => expect(result.current.status).toBe("unhealthy"));
    expect(result.current.retryCount).toBe(1);

    // Advance past the first backoff (1000ms) → retry probe fails, schedules #2.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await vi.waitFor(() => expect(result.current.retryCount).toBe(2));

    // Advance past the second backoff (2000ms) → retry probe succeeds.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await vi.waitFor(() => expect(result.current.status).toBe("healthy"));
    expect(result.current.retryCount).toBe(0);
    expect(mockCheck).toHaveBeenCalledTimes(3);
  });

  it("stops auto-retrying after maxRetries", async () => {
    vi.useFakeTimers();
    mockCheck.mockResolvedValue(false);

    const { result } = renderHook(() =>
      usePinataHealth({ autoRetry: true, baseDelayMs: 100, maxRetries: 2 })
    );

    await vi.waitFor(() => expect(result.current.retryCount).toBe(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100); // retry #2
    });
    await vi.waitFor(() => expect(result.current.retryCount).toBe(2));

    // Exhaust remaining time — no further retries should be scheduled.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    // 1 initial + 2 retries = 3 total probes.
    expect(mockCheck).toHaveBeenCalledTimes(3);
  });
});
