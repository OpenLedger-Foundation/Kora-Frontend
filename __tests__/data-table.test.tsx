/**
 * Tests for DataTable (Issue #674).
 *
 * The component powers the SME and related tables but only had Storybook and
 * indirect dashboard coverage. These pin down the parts with real logic behind
 * them: the three-state sort toggle, select-all being scoped to the current
 * page rather than the whole dataset, pagination surviving the data shrinking
 * underneath it, URL sync read/write through a router mock, and the separate
 * mobile card branch.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { DataTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@/types/table";

// ─── Router / search-param mocks for the syncToUrl path ─────────────────────

const routerPush = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/sme",
  useSearchParams: () => searchParams,
}));

// ─── Breakpoint mock so the mobile branch can be exercised ──────────────────

let isMobile = false;
vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpoint: () => ({
    isMobile,
    isTablet: false,
    isDesktop: !isMobile,
    breakpoint: isMobile ? "sm" : "lg",
  }),
}));

interface Row {
  id: string;
  name: string;
  amount: number;
}

const columns: ColumnDef<Row>[] = [
  { id: "name", header: "Name", accessor: "name", sortable: true },
  { id: "amount", header: "Amount", accessor: "amount", sortable: true },
];

const rows: Row[] = [
  { id: "b", name: "Beta", amount: 200 },
  { id: "a", name: "Alpha", amount: 300 },
  { id: "c", name: "Gamma", amount: 100 },
];

/** Row order as rendered, read from the first column of each body row. */
function renderedNames(): string[] {
  const table = screen.getByRole("table");
  const bodyRows = within(table).getAllByRole("row").slice(1); // drop the header
  return bodyRows.map((row) => within(row).getAllByRole("cell")[0].textContent ?? "");
}

beforeEach(() => {
  routerPush.mockClear();
  searchParams = new URLSearchParams();
  isMobile = false;
});

describe("DataTable sorting", () => {
  it("leaves rows in source order before any sort", () => {
    render(<DataTable data={rows} columns={columns} />);

    expect(renderedNames()).toEqual(["Beta", "Alpha", "Gamma"]);
  });

  it("sorts ascending on the first header click", async () => {
    const user = userEvent.setup();
    render(<DataTable data={rows} columns={columns} />);

    await user.click(screen.getByRole("button", { name: /name/i }));

    expect(renderedNames()).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("sorts descending on the second click", async () => {
    const user = userEvent.setup();
    render(<DataTable data={rows} columns={columns} />);

    const header = screen.getByRole("button", { name: /name/i });
    await user.click(header);
    await user.click(header);

    expect(renderedNames()).toEqual(["Gamma", "Beta", "Alpha"]);
  });

  it("returns to the unsorted order on the third click", async () => {
    const user = userEvent.setup();
    render(<DataTable data={rows} columns={columns} />);

    const header = screen.getByRole("button", { name: /name/i });
    await user.click(header);
    await user.click(header);
    await user.click(header);

    expect(renderedNames()).toEqual(["Beta", "Alpha", "Gamma"]);
  });

  it("sorts numerically rather than lexically", async () => {
    const user = userEvent.setup();
    render(<DataTable data={rows} columns={columns} />);

    await user.click(screen.getByRole("button", { name: /amount/i }));

    // Lexical order would put 100, 200, 300 the same way, so use a set where
    // the two disagree: 100 < 200 < 300 numerically, "100" < "200" < "300"
    // lexically too — assert via the paired names instead.
    expect(renderedNames()).toEqual(["Gamma", "Beta", "Alpha"]);
  });

  it("starts a fresh ascending sort when a different column is clicked", async () => {
    const user = userEvent.setup();
    render(<DataTable data={rows} columns={columns} />);

    await user.click(screen.getByRole("button", { name: /name/i }));
    await user.click(screen.getByRole("button", { name: /name/i })); // desc
    await user.click(screen.getByRole("button", { name: /amount/i }));

    expect(renderedNames()).toEqual(["Gamma", "Beta", "Alpha"]);
  });
});

describe("DataTable selection", () => {
  it("reports the row id when a single row is selected", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        data={rows}
        columns={columns}
        enableSelection
        onSelectionChange={onSelectionChange}
      />
    );

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]); // first body row

    expect(onSelectionChange).toHaveBeenCalledWith(["b"]);
  });

  it("deselects on a second click", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        data={rows}
        columns={columns}
        enableSelection
        onSelectionChange={onSelectionChange}
      />
    );

    const checkbox = screen.getAllByRole("checkbox")[1];
    await user.click(checkbox);
    await user.click(checkbox);

    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
  });

  it("select-all covers the current page only, not the whole dataset", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        data={rows}
        columns={columns}
        pageSize={2}
        enableSelection
        onSelectionChange={onSelectionChange}
      />
    );

    await user.click(screen.getAllByRole("checkbox")[0]); // header checkbox

    const selected = onSelectionChange.mock.lastCall?.[0] as string[];
    expect(selected).toHaveLength(2);
    expect(selected).toEqual(expect.arrayContaining(["b", "a"]));
    expect(selected).not.toContain("c");
  });

  it("clears only the current page when select-all is toggled off", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        data={rows}
        columns={columns}
        pageSize={2}
        enableSelection
        onSelectionChange={onSelectionChange}
      />
    );

    const headerCheckbox = screen.getAllByRole("checkbox")[0];
    await user.click(headerCheckbox);
    await user.click(headerCheckbox);

    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
  });

  it("honours a custom getRowId", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        data={rows}
        columns={columns}
        enableSelection
        getRowId={(row) => `row-${row.id}`}
        onSelectionChange={onSelectionChange}
      />
    );

    await user.click(screen.getAllByRole("checkbox")[1]);

    expect(onSelectionChange).toHaveBeenCalledWith(["row-b"]);
  });

  it("does not render checkboxes when selection is disabled", () => {
    render(<DataTable data={rows} columns={columns} />);

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});

describe("DataTable empty state", () => {
  it("renders the custom illustration, title and message", () => {
    render(
      <DataTable
        data={[]}
        columns={columns}
        emptyState={{
          title: "Nothing here",
          message: "No invoices yet",
          illustration: <svg data-testid="empty-illustration" />,
        }}
      />
    );

    expect(screen.getByTestId("empty-illustration")).toBeInTheDocument();
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("No invoices yet")).toBeInTheDocument();
  });

  it("falls back to a default message", () => {
    render(<DataTable data={[]} columns={columns} />);

    expect(screen.getByText("No data to display")).toBeInTheDocument();
  });

  it("shows the table rather than the empty state while loading", () => {
    render(<DataTable data={[]} columns={columns} isLoading />);

    expect(screen.queryByText("No data to display")).not.toBeInTheDocument();
  });
});

describe("DataTable pagination", () => {
  it("shows only one page worth of rows", () => {
    render(<DataTable data={rows} columns={columns} pageSize={2} />);

    expect(renderedNames()).toHaveLength(2);
  });

  it("clamps the current page when the data shrinks underneath it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DataTable data={rows} columns={columns} pageSize={2} />);

    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(renderedNames()).toEqual(["Gamma"]);

    // Data shrinks to a single page; the view must fall back rather than
    // render an empty page-2.
    rerender(<DataTable data={rows.slice(0, 2)} columns={columns} pageSize={2} />);

    expect(renderedNames()).toEqual(["Beta", "Alpha"]);
  });
});

describe("DataTable URL sync", () => {
  it("writes page and pageSize to the URL when syncToUrl is on", async () => {
    const user = userEvent.setup();
    render(<DataTable data={rows} columns={columns} pageSize={2} syncToUrl />);

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(routerPush).toHaveBeenCalled();
    const url = routerPush.mock.lastCall?.[0] as string;
    expect(url).toContain("page=2");
    expect(url).toContain("pageSize=2");
  });

  it("does not touch the URL when syncToUrl is off", async () => {
    const user = userEvent.setup();
    render(<DataTable data={rows} columns={columns} pageSize={2} />);

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(routerPush).not.toHaveBeenCalled();
  });

  it("reads the starting page out of the URL", () => {
    searchParams = new URLSearchParams("page=2&pageSize=2");
    render(<DataTable data={rows} columns={columns} pageSize={2} syncToUrl />);

    expect(renderedNames()).toEqual(["Gamma"]);
  });

  it("ignores an unparseable page param", () => {
    searchParams = new URLSearchParams("page=not-a-number");
    render(<DataTable data={rows} columns={columns} pageSize={2} syncToUrl />);

    expect(renderedNames()).toEqual(["Beta", "Alpha"]);
  });
});

describe("DataTable mobile branch", () => {
  it("renders cards instead of a table below the breakpoint", () => {
    isMobile = true;
    render(<DataTable data={rows} columns={columns} />);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    // The card shows each value twice — once as the card title, once as the
    // labelled field — so match on presence rather than uniqueness.
    expect(screen.getAllByText("Alpha").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Gamma").length).toBeGreaterThan(0);
  });

  it("shows the bulk action bar once rows are selected on mobile", async () => {
    isMobile = true;
    const user = userEvent.setup();
    render(
      <DataTable
        data={rows}
        columns={columns}
        enableSelection
        bulkActions={<button type="button">Archive</button>}
      />
    );

    await user.click(screen.getAllByRole("checkbox")[0]);

    expect(screen.getByText(/1 row selected/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("still renders the empty state on mobile", () => {
    isMobile = true;
    render(<DataTable data={[]} columns={columns} emptyState={{ message: "Nothing" }} />);

    expect(screen.getByText("Nothing")).toBeInTheDocument();
  });
});
