import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNetworkStatus } from "../useNetworkStatus";

const { checkRpcHealth, call } = vi.hoisted(() => ({ checkRpcHealth: vi.fn(), call: vi.fn() }));
vi.mock("@/lib/stellar/client", () => ({
  checkRpcHealth,
  horizon: { ledgers: () => ({ limit: () => ({ call }) }) },
}));

function connectivity(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("network health", () => {
  it("shares probes, distinguishes outage from offline, and checks again on reconnect", async () => {
    checkRpcHealth.mockResolvedValue({ ok: true, latencyMs: 5 });
    call.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValue({});
    connectivity(true);
    const { result, unmount } = renderHook(() => [useNetworkStatus(), useNetworkStatus()]);
    expect(result.current[0].health.overall).toBe("checking");
    await act(async () => { await result.current[0].refresh(); });
    expect(result.current[0].isOnline).toBe(true);
    expect(result.current[0].health.horizon.status).toBe("down");
    expect(call).toHaveBeenCalledTimes(1);

    act(() => connectivity(false));
    await act(async () => { await result.current[1].refresh(); });
    expect(result.current[1].isOnline).toBe(false);
    expect(call).toHaveBeenCalledTimes(1);

    act(() => connectivity(true));
    expect(result.current[0].health.overall).toBe("checking");
    await act(async () => { await result.current[0].refresh(); });
    expect(result.current[0].health.overall).toBe("operational");
    unmount();
  });

  it.each([401, 429])("keeps the browser online when a probe returns %s", async (status) => {
    checkRpcHealth.mockResolvedValue({ ok: true, latencyMs: 5 });
    call.mockRejectedValue({ response: { status } });
    connectivity(true);
    const { result, unmount } = renderHook(useNetworkStatus);
    await act(async () => { await result.current.refresh(); });
    expect(result.current.isOnline).toBe(true);
    expect(result.current.health.overall).toBe("degraded");
    unmount();
  });

  it("times out a stalled health probe while keeping the browser online", async () => {
    vi.useFakeTimers();
    checkRpcHealth.mockResolvedValue({ ok: true, latencyMs: 5 });
    call.mockImplementation(() => new Promise(() => {}));
    connectivity(true);
    const { result, unmount } = renderHook(useNetworkStatus);
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(result.current.isOnline).toBe(true);
    expect(result.current.health.horizon.status).toBe("down");
    unmount();
  });
});
