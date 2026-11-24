import React from "react";
import { render as rtlRender, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import en from "../messages/en.json";
import { DataTable } from "../components/ui/data-table";
import { useSearchParams, useRouter } from "next/navigation";

const mockRouter = { push: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/dashboard",
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

function render(ui: React.ReactElement) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="en" messages={en}>
        {children}
      </NextIntlClientProvider>
    ),
  });
}

// Mock useBreakpoint to control viewport width in tests
const mockUseBreakpoint = vi.fn();
vi.mock("../hooks/useBreakpoint", () => ({
  useBreakpoint: () => mockUseBreakpoint(),
}));

// Helper to mock window.matchMedia for reduced-motion queries
function mockMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mql = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({ ...mql, media: query })),
  });
  return mql;
}

function removeMatchMedia() {
  // Simulate environments (e.g. SSR / older browsers) without matchMedia
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: undefined,
  });
}

const MOTION_CLASS_PATTERN = /(^|\s)(transition|animate|motion|duration-|ease-)/;
=======

interface TestData {
  id: string;
  name: string;
  value: number;
}

const testData: TestData[] = [
  { id: "1", name: "Alpha", value: 100 },
  { id: "2", name: "Beta", value: 50 },
  { id: "3", name: "Gamma", value: 150 },
];

const testColumns = [
  { id: "name", header: "Name", accessor: (row: TestData) => row.name, sortable: true },
  { id: "value", header: "Value", accessor: (row: TestData) => row.value, sortable: true },
];

describe("DataTable syncToUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBreakpoint.mockReturnValue({ isMobile: false, width: 1024 });
  });

  it("should initialize sort states from searchParams on mount", () => {
    const searchParams = new URLSearchParams("sme_sort=value:desc&sme_page=2");
    vi.mocked(useSearchParams).mockReturnValue(searchParams);

    render(
      <DataTable
        data={testData}
        columns={testColumns}
        syncToUrl={true}
        pageParamName="sme_page"
        sortParamName="sme_sort"
        pageSizeParamName="sme_pageSize"
      />
    );
  });

  it("should push updated sort parameter to router on header click", () => {
    const searchParams = new URLSearchParams();
    vi.mocked(useSearchParams).mockReturnValue(searchParams);
    const mockRouter = useRouter();

    render(
      <DataTable
        data={testData}
        columns={testColumns}
        syncToUrl={true}
        pageParamName="sme_page"
        sortParamName="sme_sort"
        pageSizeParamName="sme_pageSize"
      />
    );

    const nameHeaderButton = screen.getByRole("button", { name: /Sort by Name/i });
    fireEvent.click(nameHeaderButton);

    expect(mockRouter.push).toHaveBeenCalled();
    const lastPush = vi.mocked(mockRouter.push).mock.calls[0][0];
    expect(lastPush).toContain("sme_sort=name%3Aasc");
  });

  it("should ignore invalid sort parameter configurations safely", () => {
    const searchParams = new URLSearchParams("sme_sort=invalid_column:asc");
    vi.mocked(useSearchParams).mockReturnValue(searchParams);

    // Should render successfully without throwing
    expect(() => {
      render(
        <DataTable
          data={testData}
          columns={testColumns}
          syncToUrl={true}
          pageParamName="sme_page"
          sortParamName="sme_sort"
          pageSizeParamName="sme_pageSize"
        />
      );
    }).not.toThrow();
  });
});

describe("DataTable mobile card view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render cards instead of tables when viewport is under 640px", () => {
    mockUseBreakpoint.mockReturnValue({ isMobile: true, width: 500 });
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams());

    render(
      <DataTable
        data={testData}
        columns={testColumns}
        enableSelection
        syncToUrl={false}
      />
    );

    // Should render mobile card check list
    expect(screen.getByText("Select all on page")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("should render normal table when viewport is 640px or higher", () => {
    mockUseBreakpoint.mockReturnValue({ isMobile: false, width: 700 });
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams());

    render(
      <DataTable
        data={testData}
        columns={testColumns}
        syncToUrl={false}
      />
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});

describe("DataTable & Pagination localized aria labels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBreakpoint.mockReturnValue({ isMobile: false, width: 1024 });
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams());
  });

  it("renders select-all, select-row and sort labels from messages", () => {
    render(<DataTable data={testData} columns={testColumns} enableSelection />);

    expect(screen.getByRole("checkbox", { name: "Select all rows on this page" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select row 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort by Value" })).toBeInTheDocument();
  });

  it("renders the visible select-all label and default empty message from messages", () => {
    mockUseBreakpoint.mockReturnValue({ isMobile: true, width: 375 });
    const { rerender } = render(<DataTable data={testData} columns={testColumns} enableSelection syncToUrl={false} />);

    expect(screen.getByText(en.dataTable.selectAllOnPage)).toBeInTheDocument();

    rerender(<DataTable data={[]} columns={testColumns} syncToUrl={false} />);
    expect(screen.getByText(en.dataTable.noData)).toBeInTheDocument();
  });

  it("renders the row details label from messages", () => {
    render(<DataTable data={testData} columns={testColumns} onRowClick={vi.fn()} />);

    expect(screen.getByRole("row", { name: "Open details for 2" })).toBeInTheDocument();
  });

  it("renders pagination labels from messages", () => {
    render(<DataTable data={testData} columns={testColumns} pageSize={1} />);

    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Page size options" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Go to page 2" })).toBeInTheDocument();
  });
});

describe("DataTable sticky header reduced motion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBreakpoint.mockReturnValue({ isMobile: false, width: 1024 });
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams());
  });

  function getHeaderCells() {
    const table = screen.getByRole("table");
    const headerRow = table.querySelector("thead tr");
    expect(headerRow).not.toBeNull();
    return Array.from(headerRow!.querySelectorAll("th"));
  }

  function expectNoMotionClasses(elements: Element[]) {
    for (const el of elements) {
      expect(el.className).not.toMatch(MOTION_CLASS_PATTERN);
    }
  }

  function expectMotionClasses(elements: Element[]) {
    const hasMotion = elements.some((el) => MOTION_CLASS_PATTERN.test(el.className));
    expect(hasMotion).toBe(true);
  }

  it("omits motion/transition classes on sticky headers when reduced motion is preferred", () => {
    mockMatchMedia(true);

    render(<DataTable data={testData} columns={testColumns} stickyHeader syncToUrl={false} />);

    const headerCells = getHeaderCells();
    expect(headerCells.length).toBeGreaterThan(0);
    expectNoMotionClasses(headerCells);
  });

  it("applies motion/transition classes on sticky headers when motion is allowed", () => {
    mockMatchMedia(false);

    render(<DataTable data={testData} columns={testColumns} stickyHeader syncToUrl={false} />);

    const headerCells = getHeaderCells();
    expect(headerCells.length).toBeGreaterThan(0);
    expectMotionClasses(headerCells);
  });

  it("falls back to the safe default when matchMedia is unavailable", () => {
    removeMatchMedia();

    expect(() => {
      render(<DataTable data={testData} columns={testColumns} stickyHeader syncToUrl={false} />);
    }).not.toThrow();

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(getHeaderCells().length).toBeGreaterThan(0);
  });

  it("renders the sticky header on mobile viewports with reduced motion", () => {
    mockMatchMedia(true);
    mockUseBreakpoint.mockReturnValue({ isMobile: true, width: 375 });

    render(<DataTable data={testData} columns={testColumns} stickyHeader enableSelection syncToUrl={false} />);

    expect(screen.getByText("Select all on page")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders the sticky header on desktop viewports with reduced motion", () => {
    mockMatchMedia(true);
    mockUseBreakpoint.mockReturnValue({ isMobile: false, width: 1280 });

    render(<DataTable data={testData} columns={testColumns} stickyHeader syncToUrl={false} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expectNoMotionClasses(getHeaderCells());
  });
});

describe("Select async options error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBreakpoint.mockReturnValue({ isMobile: false, width: 1024 });
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams());
  });

  it("surfaces an inline error and retry control when async options fail", async () => {
    const { Select } = await import("../components/ui/select");
    const loadOptions = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce([{ value: "a", label: "Alpha" }]);

    render(
      <Select
        aria-label="Async select"
        loadOptions={loadOptions}
        options={[]}
      />
    );

    const combobox = screen.getByRole("combobox", { name: "Async select" });
    fireEvent.focus(combobox);

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load options/i);

    const retry = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retry);

    expect(loadOptions).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("option", { name: "Alpha" })).toBeInTheDocument();
  });
});
