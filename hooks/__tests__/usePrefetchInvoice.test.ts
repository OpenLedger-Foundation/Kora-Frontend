import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  MAX_CONCURRENT_PREFETCHES,
  PREFETCH_DELAY_MS,
  usePrefetchInvoice,
} from "../useInvoices";
import { queryKeys } from "@/lib/queryKeys";

const mockFetchInvoiceById = vi.fn(async (id: string) => ({ id, metadata: {}, terms: {}, funding: {} }));

vi.mock("@/services/invoiceService", () => ({
  fetchInvoiceById: (id: string) => mockFetchInvoiceById(id),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("usePrefetchInvoice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetchInvoiceById.mockClear();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
        media: "(pointer: fine)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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
    vi.mocked(window.matchMedia).mockImplementation(() => ({
      matches: false,
      media: "(pointer: fine)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as MediaQueryList));

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
    queryClient.setQueryData(queryKeys.invoices.detail("inv_cached"), { id: "inv_cached" });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => usePrefetchInvoice(), { wrapper });

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
});
