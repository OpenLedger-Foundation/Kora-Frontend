import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MARKETPLACE_PAGE_SIZE, useInfiniteInvoices } from "@/hooks/useInvoices";
import { useInvoiceStore } from "@/store/invoiceStore";
import type { PaginatedResponse, Invoice } from "@/types";

vi.mock("@/services/invoiceService", () => ({
  fetchInvoices: vi.fn(),
}));

vi.mock("next-intl", () => {
  const translations: Record<string, string> = {
    loadingMore: "Loading more…",
    allLoaded: "All invoices loaded",
    newInvoicesAnnouncement: "{count} new invoices loaded — {total} shown",
    allLoadedAnnouncement: "All invoices loaded — end of list",
    loadMoreFailed: "Failed to load more invoices.",
    retryLoading: "Retry loading",
  };
  // Stable translator identity (as `next-intl` provides) so the component's
  // announcement effect is not re-run on every render.
  const t = (key: string, values?: Record<string, string | number>) => {
    const template = translations[key];
    if (template === undefined) return key;
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (_, token: string) =>
      token in values ? String(values[token]) : `{${token}}`
    );
  };
  return { useTranslations: () => t };
});

import { fetchInvoices } from "@/services/invoiceService";
import InfiniteScrollStatus from "@/components/marketplace/InfiniteScrollStatus";
import { useLoadMoreFocus } from "@/hooks/useLoadMoreFocus";

// React Query v5 only re-renders consumers for properties they have already
// read ("tracked props"). `renderHook`'s `result.current` is a lazy proxy, so
// the property a test asserts on must be read *before* the update is triggered,
// otherwise the notification is (correctly) suppressed and `result.current`
// looks stale. Real components read during render, so this only affects
// `renderHook`-based tests. Each test below reads `data` up-front for this
// reason.

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
    void result.current.data;

    const fetchResult = await act(async () => result.current.fetchNextPage());

    expect(fetchResult.isError).toBe(false);
    expect(fetchResult.data?.pages).toHaveLength(2);
    // The observer notification is scheduled as a macrotask, so yield before
    // asserting on the re-rendered hook result.
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
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
    void result.current.data;
    await act(async () => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));

    const pages = result.current.data?.pages ?? [];
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

// ─── Screen-reader announcements + visible states (#a11y) ────────────────────

function statusRegion() {
  return screen.getByTestId("marketplace-load-status");
}

describe("InfiniteScrollStatus — announcements", () => {
  it("exposes a polite, atomic live region", () => {
    render(
      <InfiniteScrollStatus loadedCount={12} hasNextPage isFetchingNextPage={false} />
    );

    const region = statusRegion();
    expect(region).toHaveAttribute("role", "status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
  });

  it("announces the number of newly loaded invoices and the running total", () => {
    const { rerender } = render(
      <InfiniteScrollStatus loadedCount={12} hasNextPage isFetchingNextPage={false} />
    );

    // First paint is the initial render, not a new batch — stay silent.
    expect(statusRegion().textContent).toBe("");

    rerender(
      <InfiniteScrollStatus loadedCount={24} hasNextPage isFetchingNextPage={false} />
    );

    expect(statusRegion().textContent).toContain("12");
    expect(statusRegion().textContent).toContain("24");
  });

  it("announces the end of the list when the final batch loads", () => {
    const { rerender } = render(
      <InfiniteScrollStatus loadedCount={12} hasNextPage isFetchingNextPage={false} />
    );

    rerender(
      <InfiniteScrollStatus loadedCount={36} hasNextPage={false} isFetchingNextPage={false} />
    );

    expect(statusRegion().textContent).toContain("24");
    expect(statusRegion().textContent).toContain("end of list");
  });

  it("announces the end of the list for an already-complete list", () => {
    render(
      <InfiniteScrollStatus
        loadedCount={12}
        hasNextPage={false}
        isFetchingNextPage={false}
      />
    );

    expect(statusRegion().textContent).toContain("end of list");
  });

  it("stays silent when the list is empty and complete", () => {
    render(
      <InfiniteScrollStatus loadedCount={0} hasNextPage={false} isFetchingNextPage={false} />
    );

    expect(statusRegion().textContent).toBe("");
    expect(screen.queryByTestId("marketplace-end-of-list")).not.toBeInTheDocument();
  });
});

describe("InfiniteScrollStatus — visible states", () => {
  it("shows a loading indicator while the next page is in flight", () => {
    render(
      <InfiniteScrollStatus loadedCount={12} hasNextPage isFetchingNextPage />
    );

    expect(screen.getByTestId("marketplace-loading-more")).toBeInTheDocument();
    expect(statusRegion().textContent).toContain("Loading more");
  });

  it("shows the end-of-list marker once there is no next page", () => {
    render(
      <InfiniteScrollStatus
        loadedCount={24}
        hasNextPage={false}
        isFetchingNextPage={false}
      />
    );

    expect(screen.getByTestId("marketplace-end-of-list")).toBeInTheDocument();
  });

  it("shows a retry affordance on error and invokes the handler", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <InfiniteScrollStatus
        loadedCount={12}
        hasNextPage
        isFetchingNextPage={false}
        isError
        onRetry={onRetry}
      />
    );

    expect(statusRegion().textContent).toContain("Failed to load more");
    await user.click(screen.getByRole("button", { name: /Retry loading/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

// ─── Focus management across load-more batches (#a11y) ───────────────────────

function FocusHarness({ itemCount }: { itemCount: number }) {
  useLoadMoreFocus(itemCount);
  return (
    <div>
      <button data-testid="card-1">Card 1</button>
      <button data-testid="card-2">Card 2</button>
    </div>
  );
}

describe("useLoadMoreFocus", () => {
  it("keeps focus on the same control when a new batch appends", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FocusHarness itemCount={12} />);

    await user.click(screen.getByTestId("card-2"));
    expect(screen.getByTestId("card-2")).toHaveFocus();

    rerender(<FocusHarness itemCount={24} />);

    expect(screen.getByTestId("card-2")).toHaveFocus();
  });

  it("restores focus when a re-render drops it to the document body", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FocusHarness itemCount={12} />);

    await user.click(screen.getByTestId("card-2"));
    act(() => (document.activeElement as HTMLElement).blur());
    expect(document.body).toHaveFocus();

    rerender(<FocusHarness itemCount={24} />);

    await waitFor(() => expect(screen.getByTestId("card-2")).toHaveFocus());
  });
});
