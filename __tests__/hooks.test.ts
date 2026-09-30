import { renderHook, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useDebounce } from "../hooks/useDebounce";
import { useThrottle } from "../hooks/useThrottle";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";
import { useResizeObserver } from "../hooks/useResizeObserver";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useTxSimulation } from "../hooks/useTxSimulation";
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
    const baseline = vi.getTimerCount();

    const { rerender, unmount } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: "a" },
    });

    rerender({ v: "b" }); // arms a pending update

    unmount();

    // The effect cleanup must clear the pending timer, so the timer count
    // returns to its pre-render baseline.
    expect(vi.getTimerCount()).toBe(baseline);
    expect(() => act(() => vi.advanceTimersByTime(300))).not.toThrow();
  });

  it("re-arms the timer using the new delay when the delay changes", () => {
    const { result, rerender } = renderHook(({ v, d }) => useDebounce(v, d), {
      initialProps: { v: "a", d: 300 },
    });

    rerender({ v: "b", d: 500 });

    // 300ms is the *old* delay; the pending timer now runs for 500ms from the
    // rerender, so the value must still be pending after 300ms.
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("b");
  });

  it("honours a shortened delay", () => {
    const { result, rerender } = renderHook(({ v, d }) => useDebounce(v, d), {
      initialProps: { v: "a", d: 1000 },
    });

    rerender({ v: "b", d: 100 });

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("b");
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

  it("defers the first change to the trailing edge, because mounting opens the window", () => {
    const { result, rerender } = renderHook(({ v }) => useThrottle(v, 200), {
      initialProps: { v: "a" },
    });

    // Mount already consumed the leading slot, so this change must wait.
    rerender({ v: "b" });
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("b");
  });

  it("does not emit before the interval elapses", () => {
    const { result, rerender } = renderHook(({ v }) => useThrottle(v, 200), {
      initialProps: { v: "a" },
    });

    rerender({ v: "b" });
    act(() => vi.advanceTimersByTime(199));
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("b");
  });

  it("coalesces rapid changes and emits only the final value", () => {
    const { result, rerender } = renderHook(({ v }) => useThrottle(v, 200), {
      initialProps: { v: "a" },
    });

    rerender({ v: "b" });
    act(() => vi.advanceTimersByTime(50));
    rerender({ v: "c" });
    act(() => vi.advanceTimersByTime(50));
    rerender({ v: "d" });

    // Every change inside the window is deferred; nothing has landed yet.
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("d");
  });

  it("emits immediately once the interval has fully elapsed", () => {
    const { result, rerender } = renderHook(({ v }) => useThrottle(v, 200), {
      initialProps: { v: "a" },
    });

    act(() => vi.advanceTimersByTime(250)); // window is wide open

    rerender({ v: "b" });
    expect(result.current).toBe("b");
  });

  it("reopens the window after an immediate emit", () => {
    const { result, rerender } = renderHook(({ v }) => useThrottle(v, 200), {
      initialProps: { v: "a" },
    });

    act(() => vi.advanceTimersByTime(250));
    rerender({ v: "b" }); // immediate
    expect(result.current).toBe("b");

    rerender({ v: "c" }); // window reopened, so this is deferred
    expect(result.current).toBe("b");

    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("c");
  });

  it("clears the pending trailing update on unmount", () => {
    const baseline = vi.getTimerCount();

    const { result, rerender, unmount } = renderHook(({ v }) => useThrottle(v, 200), {
      initialProps: { v: "a" },
    });

    rerender({ v: "b" }); // arms a trailing update
    expect(result.current).toBe("a");

    unmount();

    // Unmounting must clear the trailing timer, returning to the baseline.
    expect(vi.getTimerCount()).toBe(baseline);
    expect(() => act(() => vi.advanceTimersByTime(500))).not.toThrow();
    expect(result.current).toBe("a");
  });

  it("re-arms the trailing edge when the value changes again", () => {
    const { result, rerender } = renderHook(({ v }) => useThrottle(v, 200), {
      initialProps: { v: "a" },
    });

    // First change at t=0 arms a trailing emit for t=200.
    rerender({ v: "b" });
    act(() => vi.advanceTimersByTime(150));

    // At t=150 the pending timer is cleared and re-armed for t=150+50=200.
    rerender({ v: "c" });
    act(() => vi.advanceTimersByTime(100)); // now t=250
    expect(result.current).toBe("c");

    // That emit reopened the window, so "d" is deferred rather than immediate.
    rerender({ v: "d" });
    expect(result.current).toBe("c");

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
      class {
        constructor(cb: ResizeObserverCallback) {
          observerCallback = cb;
        }
        observe = observeMock;
        disconnect = disconnectMock;
        unobserve = vi.fn();
      }
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

// ─── useTxSimulation ──────────────────────────────────────────────────────────

describe("useTxSimulation", () => {
  it("resolves the dialog gate with true when the user proceeds", async () => {
    const { result } = renderHook(() => useTxSimulation());

    let gate: Promise<boolean> | undefined;
    act(() => {
      gate = result.current.requestConfirmation();
    });

    expect(result.current.isDialogOpen).toBe(true);

    act(() => {
      result.current.proceed();
    });

    await expect(gate).resolves.toBe(true);
    expect(result.current.isDialogOpen).toBe(false);
  });

  it("resolves the dialog gate with false when the user cancels", async () => {
    const { result } = renderHook(() => useTxSimulation());

    let gate: Promise<boolean> | undefined;
    act(() => {
      gate = result.current.requestConfirmation();
    });

    expect(result.current.isDialogOpen).toBe(true);

    act(() => {
      result.current.cancel();
    });

    await expect(gate).resolves.toBe(false);
    expect(result.current.isDialogOpen).toBe(false);
  });
});

// ─── useKeyboardShortcuts ─────────────────────────────────────────────────────

describe("useKeyboardShortcuts", () => {
  const fireKey = (init: KeyboardEventInit) => {
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
    });
  };

  const focusElement = (el: HTMLElement) => {
    document.body.appendChild(el);
    el.focus();
    return el;
  };

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("invokes the handler for a matching single-key shortcut", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ "k": handler }));
    fireKey({ key: "k" });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("ignores shortcuts when focus is in an input", () => {
    const handler = vi.fn();
    const input = focusElement(document.createElement("input"));
    renderHook(() => useKeyboardShortcuts({ "k": handler }));
    fireKey({ key: "k" });
    expect(handler).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
  });
});
