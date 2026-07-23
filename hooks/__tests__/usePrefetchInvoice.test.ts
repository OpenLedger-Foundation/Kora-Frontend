import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  MAX_CONCURRENT_PREFETCHES,
  PREFETCH_DELAY_MS,
  usePrefetchInvoice,
  __resetPrefetchStateForTests,
} from "../usePrefetchInvoice";
import { getInvoiceDataSource, queryKeys } from "@/lib/queryKeys";

const mockFetchInvoiceById = vi.fn(async (id: string) => ({
  id,
  metadata: {},
  terms: {},
  funding: {},
}));

vi.mock("@/services/invoiceService", () => ({
  fetchInvoiceById: (id: string) => mockFetchInvoiceById(id),
}));

function createWrapper(client?: QueryClient) {
  const queryClient =
    client ??
    new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function mockFinePointer(matches = true) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: "(pointer: fine)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

describe("usePrefetchInvoice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetchInvoiceById.mockClear();
    __resetPrefetchStateForTests();
    mockFinePointer(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetPrefetchStateForTests();
  });

  it("prefetches after 200ms hover on fine-pointer devices", async () => {
    const { result } = renderHook(() => usePrefetchInvoice(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.prefetch("inv_001");
    });

    expect(mockFetchInvoiceById).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(PREFETCH_DELAY_MS);
      await Promise.resolve();
    });

    expect(mockFetchInvoiceById).toHaveBeenCalledWith("inv_001");
  });

  it("does not prefetch on touch devices", async () => {
    mockFinePointer(false);

    const { result } = renderHook(() => usePrefetchInvoice(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.prefetch("inv_001");
      vi.advanceTimersByTime(PREFETCH_DELAY_MS);
    });

    expect(mockFetchInvoiceById).not.toHaveBeenCalled();
  });

  it("skips prefetch when data is already cached", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.invoices.detail("inv_cached"), {
      id: "inv_cached",
    });

    const { result } = renderHook(() => usePrefetchInvoice(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.prefetch("inv_cached");
      vi.advanceTimersByTime(PREFETCH_DELAY_MS);
    });

    expect(mockFetchInvoiceById).not.toHaveBeenCalled();
  });

  it("cancels scheduled prefetch on mouse leave", async () => {
    const { result } = renderHook(() => usePrefetchInvoice(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.prefetch("inv_001");
      vi.advanceTimersByTime(PREFETCH_DELAY_MS - 50);
      result.current.cancelPrefetch();
      vi.advanceTimersByTime(100);
    });

    expect(mockFetchInvoiceById).not.toHaveBeenCalled();
  });

  it(`limits concurrent prefetches to ${MAX_CONCURRENT_PREFETCHES}`, async () => {
    let resolveFetch: () => void;
    const fetchGate = new Promise<void>((resolve) => {
      resolveFetch = resolve;
    });
    mockFetchInvoiceById.mockImplementation(async () => {
      await fetchGate;
      return { id: "pending" };
    });

    const hooks = Array.from({ length: MAX_CONCURRENT_PREFETCHES + 2 }, () =>
      renderHook(() => usePrefetchInvoice(), { wrapper: createWrapper() })
    );

    act(() => {
      hooks.forEach((hook, index) => {
        hook.result.current.prefetch(`inv_${index + 1}`);
      });
      vi.advanceTimersByTime(PREFETCH_DELAY_MS);
    });

    expect(mockFetchInvoiceById).toHaveBeenCalledTimes(MAX_CONCURRENT_PREFETCHES);

    await act(async () => {
      resolveFetch!();
      await Promise.resolve();
    });
  });

  it("does not duplicate in-flight fetches for the same invoice id", async () => {
    let resolveFetch: () => void;
    const fetchGate = new Promise<void>((resolve) => {
      resolveFetch = resolve;
    });
    mockFetchInvoiceById.mockImplementation(async (id: string) => {
      await fetchGate;
      return { id };
    });

    const wrapper = createWrapper();
    const first = renderHook(() => usePrefetchInvoice(), { wrapper });
    const second = renderHook(() => usePrefetchInvoice(), { wrapper });

    act(() => {
      first.result.current.prefetch("inv_dup");
      vi.advanceTimersByTime(PREFETCH_DELAY_MS);
    });

    expect(mockFetchInvoiceById).toHaveBeenCalledTimes(1);

    act(() => {
      second.result.current.prefetch("inv_dup");
      vi.advanceTimersByTime(PREFETCH_DELAY_MS);
    });

    expect(mockFetchInvoiceById).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch!();
      await Promise.resolve();
    });
  });

  it("uses mock- and live-namespaced detail query keys", async () => {
    const original = process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA;

    process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA = "true";
    expect(getInvoiceDataSource()).toBe("mock");
    expect(queryKeys.invoices.detail("inv_001")).toEqual([
      "invoices",
      "detail",
      "mock",
      "inv_001",
    ]);

    process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA = "false";
    expect(getInvoiceDataSource()).toBe("live");
    expect(queryKeys.invoices.detail("inv_001")).toEqual([
      "invoices",
      "detail",
      "live",
      "inv_001",
    ]);

    const { result } = renderHook(() => usePrefetchInvoice(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.prefetch("inv_live");
    });

    await act(async () => {
      vi.advanceTimersByTime(PREFETCH_DELAY_MS);
      await Promise.resolve();
    });

    expect(mockFetchInvoiceById).toHaveBeenCalledWith("inv_live");

    process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA = original;
  });
});
