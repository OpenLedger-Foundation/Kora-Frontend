import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Pagination } from "../pagination";

// Minimal next-intl mock — returns the key's interpolated template so we can
// assert on the translated output without a real message provider.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const templates: Record<string, string> = {
      navAria: "Pagination",
      pageSizeAria: "Page size options",
      previousPage: "Previous page",
      nextPage: "Next page",
      goToPage: "Go to page {page}",
      showingRange: "Showing {start}–{end} of {total} results",
      showLabel: "Show",
    };
    let str = templates[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, String(v));
      }
    }
    return str;
  },
}));

// next/navigation stubs
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => ({ toString: () => "", get: () => null }),
}));

describe("Pagination — i18n range / show label (#864)", () => {
  const baseProps = {
    totalItems: 100,
    pageSize: 10,
    currentPage: 2,
    onPageChange: vi.fn(),
    syncToUrl: false,
  };

  it("renders the localized showingRange string with correct interpolated values", () => {
    render(<Pagination {...baseProps} />);
    expect(screen.getByText("Showing 11–20 of 100 results")).toBeInTheDocument();
  });

  it("renders the localized showLabel string next to the page-size select", () => {
    render(
      <Pagination
        {...baseProps}
        onPageSizeChange={vi.fn()}
        pageSizeOptions={[10, 25, 50]}
      />,
    );
    expect(screen.getByText("Show")).toBeInTheDocument();
  });

  it("shows 0–0 of 0 results when there are no items", () => {
    render(<Pagination {...baseProps} totalItems={0} currentPage={1} />);
    expect(screen.getByText("Showing 0–0 of 0 results")).toBeInTheDocument();
  });

  it("caps the end item at totalItems on the last page", () => {
    render(<Pagination {...baseProps} totalItems={15} pageSize={10} currentPage={2} />);
    expect(screen.getByText("Showing 11–15 of 15 results")).toBeInTheDocument();
  });
});
