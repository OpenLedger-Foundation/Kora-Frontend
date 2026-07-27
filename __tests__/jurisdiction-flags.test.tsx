/**
 * Tests for JurisdictionFilter component (Issue #460)
 *
 * Tests:
 * - Search filters the country list
 * - Counts reflect the current dataset
 * - Multi-select works (including Select all / Deselect all)
 * - Keyboard navigation (ArrowDown, ArrowUp, Space, Enter, Escape)
 * - URL persistence of selections
 * - Clear-all functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { createTestQueryClient } from "./setup";
import { createMockInvoices } from "./fixtures";
import {
  JurisdictionFilter,
  JURISDICTION_OPTIONS,
} from "@/components/marketplace/JurisdictionFilter";

// ─── Store mock state ─────────────────────────────────────────────────────────

const mockInvoices = createMockInvoices(10);

// Mutable state that tests can update
let mockFiltersState = {
  categories: [] as string[],
  jurisdictions: [] as string[],
  riskTiers: [] as string[],
  aprRange: [0, 50] as [number, number],
  activeOnly: false,
};

const setFiltersMock = vi.fn((partial: Partial<typeof mockFiltersState>) => {
  mockFiltersState = { ...mockFiltersState, ...partial };
});

vi.mock("@/store/invoiceStore", () => ({
  useInvoiceStore: vi.fn(() => ({
    invoices: mockInvoices,
    get filters() { return mockFiltersState; },
    setFilters: setFiltersMock,
  })),
  DEFAULT_FILTERS: {
    categories: [],
    jurisdictions: [],
    riskTiers: [],
    aprRange: [0, 50],
    activeOnly: false,
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

function renderFilter(props: Partial<React.ComponentProps<typeof JurisdictionFilter>> = {}) {
  return render(
    <JurisdictionFilter defaultExpanded={true} {...props} />,
    { wrapper: Wrapper }
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("JurisdictionFilter", () => {
  beforeEach(() => {
    mockFiltersState = {
      categories: [],
      jurisdictions: [],
      riskTiers: [],
      aprRange: [0, 50],
      activeOnly: false,
    };
    setFiltersMock.mockClear();

    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/marketplace");
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it("renders all jurisdiction options when expanded", () => {
    renderFilter();
    const list = screen.getByRole("listbox");
    for (const opt of JURISDICTION_OPTIONS) {
      expect(within(list).getByText(opt.name)).toBeInTheDocument();
    }
  });

  it("renders a search input", () => {
    renderFilter();
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("renders the Select all button", () => {
    renderFilter();
    expect(screen.getByRole("button", { name: /select all/i })).toBeInTheDocument();
  });

  it("hides list when defaultExpanded is false", () => {
    renderFilter({ defaultExpanded: false });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("toggles expanded state when header button is clicked", async () => {
    const user = userEvent.setup();
    renderFilter({ defaultExpanded: true });

    // Use aria-expanded attribute to uniquely identify the header toggle button
    const toggle = screen.getByRole("button", { expanded: true });
    await user.click(toggle);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  // ── Search ─────────────────────────────────────────────────────────────────

  it("filters the list as the user types", async () => {
    const user = userEvent.setup();
    renderFilter();

    await user.type(screen.getByRole("searchbox"), "Kenya");

    const list = screen.getByRole("listbox");
    expect(within(list).getByText("Kenya")).toBeInTheDocument();
    expect(within(list).queryByText("Nigeria")).not.toBeInTheDocument();
  });

  it("is case-insensitive in search", async () => {
    const user = userEvent.setup();
    renderFilter();

    await user.type(screen.getByRole("searchbox"), "kenya");
    expect(screen.getByRole("listbox").textContent).toContain("Kenya");
  });

  it("matches on country code", async () => {
    const user = userEvent.setup();
    renderFilter();

    await user.type(screen.getByRole("searchbox"), "KE");
    expect(within(screen.getByRole("listbox")).getByText("Kenya")).toBeInTheDocument();
  });

  it("shows an empty-state message when no countries match", async () => {
    const user = userEvent.setup();
    renderFilter();

    await user.type(screen.getByRole("searchbox"), "ZZZZZZ");
    expect(screen.getByText(/no jurisdictions match/i)).toBeInTheDocument();
  });

  it("clears search when the X button is clicked", async () => {
    const user = userEvent.setup();
    renderFilter();

    const input = screen.getByRole("searchbox") as HTMLInputElement;
    await user.type(input, "Kenya");

    await user.click(screen.getByRole("button", { name: /clear search/i }));

    expect(input.value).toBe("");
    expect(screen.getByRole("listbox").textContent).toContain("Nigeria");
  });

  // ── Multi-select ───────────────────────────────────────────────────────────

  it("calls setFilters with the selected jurisdiction on click", async () => {
    const user = userEvent.setup();
    renderFilter();

    await user.click(screen.getByRole("option", { name: /kenya/i }));

    expect(setFiltersMock).toHaveBeenCalledWith(
      expect.objectContaining({ jurisdictions: expect.arrayContaining(["KE"]) })
    );
  });

  it("deselects a jurisdiction that is already selected", async () => {
    mockFiltersState = { ...mockFiltersState, jurisdictions: ["KE"] };
    const user = userEvent.setup();
    renderFilter();

    await user.click(screen.getByRole("option", { name: /kenya/i }));

    const lastCall = setFiltersMock.mock.calls[setFiltersMock.mock.calls.length - 1][0];
    expect((lastCall as any).jurisdictions).not.toContain("KE");
  });

  it("supports selecting multiple jurisdictions", async () => {
    const user = userEvent.setup();
    renderFilter();

    await user.click(screen.getByRole("option", { name: /kenya/i }));
    await user.click(screen.getByRole("option", { name: /nigeria/i }));

    const allJurisdictions = setFiltersMock.mock.calls
      .flatMap(([arg]: [any]) => arg.jurisdictions ?? []);
    expect(allJurisdictions).toContain("KE");
    expect(allJurisdictions).toContain("NG");
  });

  it("marks selected options with aria-selected=true", () => {
    mockFiltersState = { ...mockFiltersState, jurisdictions: ["KE"] };
    renderFilter();

    expect(screen.getByRole("option", { name: /kenya/i }))
      .toHaveAttribute("aria-selected", "true");
  });

  it("marks unselected options with aria-selected=false", () => {
    mockFiltersState = { ...mockFiltersState, jurisdictions: [] };
    renderFilter();

    expect(screen.getByRole("option", { name: /nigeria/i }))
      .toHaveAttribute("aria-selected", "false");
  });

  // ── Select all / Clear all ─────────────────────────────────────────────────

  it("selects all visible options when 'Select all' is clicked", async () => {
    const user = userEvent.setup();
    renderFilter();

    await user.click(screen.getByRole("button", { name: /select all/i }));

    const allCodes = JURISDICTION_OPTIONS.map((o) => o.code);
    expect(setFiltersMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jurisdictions: expect.arrayContaining(allCodes),
      })
    );
  });

  it("shows 'Deselect all' when all visible options are selected", () => {
    mockFiltersState = {
      ...mockFiltersState,
      jurisdictions: JURISDICTION_OPTIONS.map((o) => o.code),
    };
    renderFilter();

    expect(screen.getByRole("button", { name: /deselect all/i })).toBeInTheDocument();
  });

  it("deselects all visible options when 'Deselect all' is clicked", async () => {
    mockFiltersState = {
      ...mockFiltersState,
      jurisdictions: JURISDICTION_OPTIONS.map((o) => o.code),
    };
    const user = userEvent.setup();
    renderFilter();

    await user.click(screen.getByRole("button", { name: /deselect all/i }));

    const lastCall = setFiltersMock.mock.calls[setFiltersMock.mock.calls.length - 1][0];
    expect((lastCall as any).jurisdictions).toHaveLength(0);
  });

  it("shows a Clear button when jurisdictions are selected", () => {
    mockFiltersState = { ...mockFiltersState, jurisdictions: ["KE"] };
    renderFilter();

    expect(
      screen.getByRole("button", { name: /clear all jurisdiction filters/i })
    ).toBeInTheDocument();
  });

  it("clears all selections when Clear button is clicked", async () => {
    mockFiltersState = { ...mockFiltersState, jurisdictions: ["KE", "NG"] };
    const user = userEvent.setup();
    renderFilter();

    await user.click(
      screen.getByRole("button", { name: /clear all jurisdiction filters/i })
    );

    expect(setFiltersMock).toHaveBeenCalledWith(
      expect.objectContaining({ jurisdictions: [] })
    );
  });

  // ── Counts ─────────────────────────────────────────────────────────────────

  it("displays invoice counts per jurisdiction", () => {
    renderFilter();

    // The mock invoices (10 items) cycle through 5 jurisdictions → 2 each
    // At least some badge labels should be present
    const countBadges = screen.queryAllByLabelText(/invoice/i);
    expect(countBadges.length).toBeGreaterThan(0);
  });

  it("does not show a count badge for jurisdictions with zero invoices", () => {
    renderFilter();

    // "OTHER" is never in mock invoices — its option row should have no count badge
    const otherOption = screen.getByRole("option", { name: /other/i });
    expect(within(otherOption).queryByLabelText(/invoice/i)).not.toBeInTheDocument();
  });

  // ── Keyboard navigation ────────────────────────────────────────────────────

  it("moves focus to the next item with ArrowDown", async () => {
    const user = userEvent.setup();
    renderFilter();

    const items = within(screen.getByRole("listbox")).getAllByRole("option");
    items[0].focus();
    await user.keyboard("{ArrowDown}");

    expect(document.activeElement).toBe(items[1]);
  });

  it("moves focus to the previous item with ArrowUp", async () => {
    const user = userEvent.setup();
    renderFilter();

    const items = within(screen.getByRole("listbox")).getAllByRole("option");
    items[2].focus();
    await user.keyboard("{ArrowUp}");

    expect(document.activeElement).toBe(items[1]);
  });

  it("moves focus back to search input when ArrowUp on first item", async () => {
    const user = userEvent.setup();
    renderFilter();

    const items = within(screen.getByRole("listbox")).getAllByRole("option");
    const searchInput = screen.getByRole("searchbox");

    items[0].focus();
    await user.keyboard("{ArrowUp}");

    expect(document.activeElement).toBe(searchInput);
  });

  it("selects an item with Space key", async () => {
    const user = userEvent.setup();
    renderFilter();

    const items = within(screen.getByRole("listbox")).getAllByRole("option");
    items[0].focus();
    await user.keyboard(" ");

    expect(setFiltersMock).toHaveBeenCalled();
  });

  it("selects an item with Enter key", async () => {
    const user = userEvent.setup();
    renderFilter();

    const items = within(screen.getByRole("listbox")).getAllByRole("option");
    items[0].focus();
    await user.keyboard("{Enter}");

    expect(setFiltersMock).toHaveBeenCalled();
  });

  it("clears search and returns focus to search input on Escape", async () => {
    const user = userEvent.setup();
    renderFilter();

    const input = screen.getByRole("searchbox") as HTMLInputElement;
    await user.type(input, "Ke");

    const items = within(screen.getByRole("listbox")).getAllByRole("option");
    items[0].focus();
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(input.value).toBe("");
    });
  });

  // ── URL persistence ────────────────────────────────────────────────────────

  it("syncs selected jurisdictions into the URL query string", async () => {
    mockFiltersState = { ...mockFiltersState, jurisdictions: ["KE", "NG"] };

    // The useEffect in the component writes to URL on mount
    renderFilter();

    await waitFor(() => {
      expect(window.location.search).toContain("jurisdictions");
    });
  });

  it("removes jurisdictions param from URL when selection is cleared", async () => {
    window.history.replaceState({}, "", "/marketplace?jurisdictions=KE,NG");
    mockFiltersState = { ...mockFiltersState, jurisdictions: ["KE", "NG"] };

    const user = userEvent.setup();
    renderFilter();

    await user.click(
      screen.getByRole("button", { name: /clear all jurisdiction filters/i })
    );
    // Update mock state to reflect cleared selection
    mockFiltersState = { ...mockFiltersState, jurisdictions: [] };

    // Re-render to trigger the URL-sync effect
    renderFilter();

    await waitFor(() => {
      expect(window.location.search).not.toContain("jurisdictions=KE");
    });
  });
});
