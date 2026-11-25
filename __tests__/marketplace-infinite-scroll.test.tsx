import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, notifyManager } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MARKETPLACE_PAGE_SIZE, useInfiniteInvoices } from "@/hooks/useInvoices";
import { useDebounce } from "@/hooks/useDebounce";
import { DEFAULT_FILTERS, useInvoiceStore } from "@/store/invoiceStore";
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
      sort: { sortBy: "apr", sortDir: "desc" },
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

  it("flattens pages into a stable ordered list for windowing", async () => {
    vi.mocked(fetchInvoices).mockImplementation((_f, _s, page = 1, pageSize = 12) =>
      Promise.resolve(makePage(page, pageSize, 100))
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInfiniteInvoices({ pageSize: 12 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const nextPage = await act(async () => result.current.fetchNextPage());
    const pages = nextPage.data?.pages ?? [];
    const flattened = pages.flatMap((p) => p.data);

    expect(flattened).toHaveLength(24);
    expect(flattened[0].id).toBe("inv_1");
    expect(flattened[23].id).toBe("inv_24");
    // Stable unique keys are required for virtualized windowing.
    const ids = flattened.map((inv) => inv.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("surfaces an error state when the API fails (degraded/offline)", async () => {
    vi.mocked(fetchInvoices).mockRejectedValue(new Error("network down"));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInfiniteInvoices({ pageSize: 12 }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(result.current.hasNextPage).toBe(false);
  });

  it("handles an empty result set without a next page", async () => {
    vi.mocked(fetchInvoices).mockImplementation((_f, _s, page = 1, pageSize = 12) =>
      Promise.resolve(makePage(page, pageSize, 0))
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInfiniteInvoices({ pageSize: 12 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0].data).toHaveLength(0);
    expect(result.current.hasNextPage).toBe(false);
  });
});

it("coalesces rapid APR edits and supersedes pending edits on reset", async () => {
  const fetch = vi.mocked(fetchInvoices);
  fetch.mockReset();
  fetch.mockResolvedValue(makePage(1, 12, 12));
  useInvoiceStore.setState({ filters: { ...DEFAULT_FILTERS } });
  const { wrapper } = createWrapper();

  function Filters() {
    const filters = useInvoiceStore((state) => state.filters);
    const setFilters = useInvoiceStore((state) => state.setFilters);
    const debounced = useDebounce(filters, 400);
    useInfiniteInvoices({ filters: debounced, enabled: filters === debounced });
    return (
      <>
        <input
          aria-label="Maximum APR"
          type="number"
          value={filters.aprRange?.[1] ?? 50}
          onChange={(event) => setFilters({ aprRange: [0, Number(event.currentTarget.value)] })}
        />
        <button onClick={() => setFilters(DEFAULT_FILTERS)}>Reset filters</button>
      </>
    );
  }

  vi.useFakeTimers();
  try {
    const { unmount } = render(<Filters />, { wrapper });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(fetch).toHaveBeenCalledTimes(1);

    const input = screen.getByRole("spinbutton", { name: "Maximum APR" });
    fireEvent.change(input, { target: { value: "21" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    fireEvent.change(input, { target: { value: "25" } });
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]?.aprRange).toEqual([0, 25]);

    fireEvent.change(input, { target: { value: "35" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(fetch.mock.calls.every(([filters]) => filters?.aprRange?.[1] !== 35)).toBe(true);

    fireEvent.change(input, { target: { value: "45" } });
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(fetch.mock.calls.every(([filters]) => filters?.aprRange?.[1] !== 45)).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});
