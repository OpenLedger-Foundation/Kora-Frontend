import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, notifyManager } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MARKETPLACE_PAGE_SIZE, useInfiniteInvoices } from "@/hooks/useInvoices";
import { useInvoiceStore } from "@/store/invoiceStore";
import type { PaginatedResponse, Invoice } from "@/types";

vi.mock("@/services/invoiceService", () => ({
  fetchInvoices: vi.fn(),
}));

import { fetchInvoices } from "@/services/invoiceService";

// Flush React Query notifications synchronously so renderHook observers update in act()/waitFor.
notifyManager.setScheduler((cb) => cb());

function makePage(page: number, pageSize: number, total: number): PaginatedResponse<Invoice> {
  const start = (page - 1) * pageSize;
  const count = Math.max(0, Math.min(pageSize, total - start));
  const data = Array.from({ length: count }, (_, i) => {
    const n = start + i + 1;
    return {
      id: `inv_${n}`,
      tokenId: String(n),
      metadata: { debtorName: `Debtor ${n}`, invoiceNumber: `INV-${n}`, category: "technology", issuerName: `SME ${n}` },
    } as unknown as Invoice;
  });
  return {
    data,
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  };
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });
  function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, wrapper: W };
}

describe("useInfiniteInvoices", () => {
  beforeEach(() => {
    vi.mocked(fetchInvoices).mockReset();
    useInvoiceStore.setState({
      filters: {
        categories: [],
        jurisdictions: [],
        riskTiers: [],
        aprRange: [0, 50],
        activeOnly: false,
        showExpired: false,
      },
      sortBy: "apr_desc",
    });
  });

  it("exports marketplace page size for first-page-only loads", () => {
    expect(MARKETPLACE_PAGE_SIZE).toBe(12);
  });

  it("fetches the first page only on initial load", async () => {
    vi.mocked(fetchInvoices).mockImplementation((_f, _s, page = 1, pageSize = 12) =>
      Promise.resolve(makePage(page, pageSize, 100))
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useInfiniteInvoices({ pageSize: 12 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchInvoices).toHaveBeenCalledTimes(1);
    expect(fetchInvoices).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ key: "apr", direction: "desc" }),
      1,
      12
    );
    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.hasNextPage).toBe(true);
  });

  it("loads the next page via fetchNextPage", async () => {
    vi.mocked(fetchInvoices).mockImplementation((_f, _s, page = 1, pageSize = 12) =>
      Promise.resolve(makePage(page, pageSize, 100))
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInfiniteInvoices({ pageSize: 12 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    const fetchResult = await act(async () => result.current.fetchNextPage());

    expect(fetchResult.isError).toBe(false);
    expect(fetchResult.data?.pages).toHaveLength(2);
    expect(fetchInvoices).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetchInvoices).mock.calls[1][2]).toBe(2);
  });

  it("resets pagination when filters change (new query key)", async () => {
    vi.mocked(fetchInvoices).mockImplementation((_f, _s, page = 1, pageSize = 12) =>
      Promise.resolve(makePage(page, pageSize, 100))
    );
    const { wrapper } = createWrapper();

    const { result, rerender } = renderHook(() => useInfiniteInvoices({ pageSize: 12 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchInvoices).toHaveBeenCalledTimes(1);

    await act(async () => {
      useInvoiceStore.setState({
        filters: {
          categories: ["technology"],
          jurisdictions: [],
          riskTiers: [],
          aprRange: [0, 50],
          activeOnly: false,
          showExpired: false,
        },
      });
      rerender();
    });

    await waitFor(() => {
      expect(fetchInvoices).toHaveBeenCalledTimes(2);
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.pages).toHaveLength(1);
    });
  });

  it("prefetches the next page with the next pageParam ahead of fetchNextPage", async () => {
    vi.mocked(fetchInvoices).mockImplementation((_f, _s, page = 1, pageSize = 12) =>
      Promise.resolve(makePage(page, pageSize, 100))
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInfiniteInvoices({ pageSize: 12 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchInvoices).toHaveBeenCalledTimes(1);

    // Call prefetchNextPage
    await act(async () => {
      await result.current.prefetchNextPage();
    });

    // fetchInvoices should be called for page 2
    expect(fetchInvoices).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetchInvoices).mock.calls[1][2]).toBe(2);
    expect(vi.mocked(fetchInvoices).mock.calls[1][3]).toBe(12);
  });

  it("skips prefetch when there is no next page (last page reached)", async () => {
    // Only 8 items total, so page 1 has hasMore: false
    vi.mocked(fetchInvoices).mockImplementation((_f, _s, page = 1, pageSize = 12) =>
      Promise.resolve(makePage(page, pageSize, 8))
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInfiniteInvoices({ pageSize: 12 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchInvoices).toHaveBeenCalledTimes(1);
    expect(result.current.hasNextPage).toBe(false);

    // Call prefetchNextPage
    await act(async () => {
      await result.current.prefetchNextPage();
    });

    // No extra calls should occur
    expect(fetchInvoices).toHaveBeenCalledTimes(1);
  });

  it("skips duplicate prefetch when prefetch is already in flight", async () => {
    let resolvePage2: ((value: any) => void) | undefined;
    vi.mocked(fetchInvoices).mockImplementation((_f, _s, page = 1, pageSize = 12) => {
      if (page === 1) return Promise.resolve(makePage(1, pageSize, 100));
      return new Promise((res) => {
        resolvePage2 = res;
      });
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInfiniteInvoices({ pageSize: 12 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchInvoices).toHaveBeenCalledTimes(1);

    // Trigger concurrent prefetch calls (simulating scroll bounce)
    await act(async () => {
      const p1 = result.current.prefetchNextPage();
      const p2 = result.current.prefetchNextPage();
      if (resolvePage2) resolvePage2(makePage(2, 12, 100));
      await Promise.all([p1, p2]);
    });

    // Only 1 prefetch call should have been initiated for page 2
    expect(fetchInvoices).toHaveBeenCalledTimes(2);
  });

  it("gracefully catches prefetch errors without interrupting scroll or throwing", async () => {
    vi.mocked(fetchInvoices).mockImplementation((_f, _s, page = 1, pageSize = 12) => {
      if (page === 1) return Promise.resolve(makePage(1, pageSize, 100));
      return Promise.reject(new Error("Transient network timeout"));
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInfiniteInvoices({ pageSize: 12 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Prefetch failure should not throw
    await expect(
      act(async () => {
        await result.current.prefetchNextPage();
      })
    ).resolves.not.toThrow();

    // Query state on page 1 remains successful
    expect(result.current.isSuccess).toBe(true);
  });
});
