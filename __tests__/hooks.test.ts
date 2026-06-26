import { renderHook, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useDebounce } from "../hooks/useDebounce";
import { useThrottle } from "../hooks/useThrottle";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";
import { useResizeObserver } from "../hooks/useResizeObserver";
import { createRef } from "react";

// ─── useDebounce ──────────────────────────────────────────────────────────────

describe("useDebounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 300));
    expect(result.current).toBe("hello");
  });

  it("does not update before delay elapses", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: "a" },
    });
    rerender({ v: "b" });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("a");
  });

  it("updates after delay elapses", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: "a" },
    });
    rerender({ v: "b" });
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe("b");
  });

  it("resets timer on rapid changes", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: "a" },
    });
    rerender({ v: "b" });
    act(() => vi.advanceTimersByTime(200));
    rerender({ v: "c" });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("a"); // still not updated
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("c");
  });

  it("cancels pending update on unmount", () => {
    const { result, rerender, unmount } = renderHook(
      ({ v }) => useDebounce(v, 300),
      { initialProps: { v: "a" } }
    );
    rerender({ v: "b" });
    unmount();
    act(() => vi.advanceTimersByTime(300));
    // No error thrown — timer was cleaned up
    expect(result.current).toBe("a");
  });
});

// ─── useThrottle ──────────────────────────────────────────────────────────────

describe("useThrottle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useThrottle("hello", 200));
    expect(result.current).toBe("hello");
  });

  it("emits updated value after interval elapses", () => {
    const { result, rerender } = renderHook(({ v }) => useThrottle(v, 200), {
      initialProps: { v: "a" },
    });
    rerender({ v: "b" });
    // Advance past the interval to trigger the trailing update
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("b");
  });

  it("emits only the last value when updated rapidly", () => {
    const { result, rerender } = renderHook(({ v }) => useThrottle(v, 200), {
      initialProps: { v: "a" },
    });
    rerender({ v: "b" });
    act(() => vi.advanceTimersByTime(50));
    rerender({ v: "c" });
    act(() => vi.advanceTimersByTime(50));
    rerender({ v: "d" });
    // Still within interval — not yet updated
    expect(result.current).toBe("a");
    // After interval, trailing edge fires with latest value
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("d");
  });
});

// ─── useDebouncedCallback ─────────────────────────────────────────────────────

describe("useDebouncedCallback", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not call fn before delay", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 300));
    act(() => result.current("x"));
    act(() => vi.advanceTimersByTime(200));
    expect(fn).not.toHaveBeenCalled();
  });

  it("calls fn after delay with correct args", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 300));
    act(() => result.current("hello"));
    act(() => vi.advanceTimersByTime(300));
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith("hello");
  });

  it("resets timer on rapid calls", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 300));
    act(() => result.current("a"));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current("b"));
    act(() => vi.advanceTimersByTime(300));
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith("b");
  });

  it("cancel() prevents the pending call", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 300));
    act(() => result.current("x"));
    act(() => result.current.cancel());
    act(() => vi.advanceTimersByTime(300));
    expect(fn).not.toHaveBeenCalled();
  });

  it("cancels on unmount", () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(fn, 300));
    act(() => result.current("x"));
    unmount();
    act(() => vi.advanceTimersByTime(300));
    expect(fn).not.toHaveBeenCalled();
  });
});

// ─── useResizeObserver ────────────────────────────────────────────────────────

describe("useResizeObserver", () => {
  let observeMock: ReturnType<typeof vi.fn>;
  let disconnectMock: ReturnType<typeof vi.fn>;
  let observerCallback: ResizeObserverCallback;

  beforeEach(() => {
    vi.useFakeTimers();
    observeMock = vi.fn();
    disconnectMock = vi.fn();

    vi.stubGlobal(
      "ResizeObserver",
      vi.fn((cb: ResizeObserverCallback) => {
        observerCallback = cb;
        return { observe: observeMock, disconnect: disconnectMock };
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns {0,0} initially", () => {
    const ref = createRef<HTMLDivElement>();
    const { result } = renderHook(() => useResizeObserver(ref));
    expect(result.current).toEqual({ width: 0, height: 0 });
  });

  it("does not observe when ref is null", () => {
    const ref = createRef<HTMLDivElement>();
    renderHook(() => useResizeObserver(ref));
    expect(observeMock).not.toHaveBeenCalled();
  });

  it("observes element and returns throttled size", () => {
    const el = document.createElement("div");
    const ref = { current: el };

    const { result } = renderHook(() => useResizeObserver(ref));
    expect(observeMock).toHaveBeenCalledWith(el);

    act(() => {
      observerCallback(
        [{ contentRect: { width: 400, height: 200 } } as ResizeObserverEntry],
        {} as ResizeObserver
      );
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toEqual({ width: 400, height: 200 });
  });

  it("disconnects observer on unmount", () => {
    const el = document.createElement("div");
    const ref = { current: el };
    const { unmount } = renderHook(() => useResizeObserver(ref));
    unmount();
    expect(disconnectMock).toHaveBeenCalled();
  });
});
