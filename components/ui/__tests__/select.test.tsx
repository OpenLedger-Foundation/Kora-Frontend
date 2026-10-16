import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Select } from "../select";

// Mock next-intl translations
vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => {
    if (ns === "ui.select" && key === "loading") return "Loading options...";
    if (ns === "common" && key === "selectOption") return "Select option...";
    if (ns === "common" && key === "searchOptions") return "Search options...";
    return key;
  },
}));

describe("Select - Async Loading and Accessibility (Issue #963)", () => {
  const defaultOptions = [
    { value: "usdc", label: "USDC" },
    { value: "eurc", label: "EURC" },
    { value: "xlm", label: "XLM" },
  ];

  it("renders idle select without aria-busy on the trigger", () => {
    render(<Select options={defaultOptions} placeholder="Choose currency" />);

    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeInTheDocument();
    expect(trigger).not.toHaveAttribute("aria-busy");
    expect(screen.queryByTestId("select-loading-spinner")).not.toBeInTheDocument();

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent("");
  });

  it("sets aria-busy=true and announces polite loading message when loading prop is true", () => {
    render(
      <Select
        options={defaultOptions}
        placeholder="Choose currency"
        loading={true}
      />
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("select-loading-spinner")).toBeInTheDocument();

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
    expect(liveRegion).toHaveTextContent("Loading options...");
  });

  it("supports custom loadingText when provided", () => {
    render(
      <Select
        options={defaultOptions}
        loading={true}
        loadingText="Fetching secondary market tokens..."
      />
    );

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveTextContent("Fetching secondary market tokens...");
  });

  it("dynamically sets and clears aria-busy and live region with loadOptions promise", async () => {
    let resolvePromise: (opts: Array<{ value: string; label: string }>) => void;
    const deferredLoad = vi.fn(
      () =>
        new Promise<Array<{ value: string; label: string }>>((resolve) => {
          resolvePromise = resolve;
        })
    );

    const { rerender } = render(
      <Select
        loadOptions={deferredLoad}
        placeholder="Search async invoices..."
      />
    );

    // Wait for debounce to fire and loadOptions to be invoked
    await waitFor(() => {
      expect(deferredLoad).toHaveBeenCalled();
    });

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-busy", "true");

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveTextContent("Loading options...");

    // Resolve deferred promise
    resolvePromise!([{ value: "inv-1", label: "Invoice #1" }]);

    await waitFor(() => {
      const activeTrigger = screen.getByRole("combobox");
      expect(activeTrigger).not.toHaveAttribute("aria-busy");
      expect(screen.queryByTestId("select-loading-spinner")).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("");
    });
  });

  it("clears busy state if loadOptions rejects", async () => {
    let rejectPromise: (err: any) => void;
    const failingLoad = vi.fn(
      () =>
        new Promise<Array<{ value: string; label: string }>>((_, reject) => {
          rejectPromise = reject;
        })
    );

    render(
      <Select loadOptions={failingLoad} placeholder="Search..." onChange={() => {}} />
    );

    // Wait for debounce to fire and loadOptions to be invoked
    await waitFor(() => {
      expect(failingLoad).toHaveBeenCalled();
    });

    expect(screen.getByRole("combobox")).toHaveAttribute("aria-busy", "true");

    // Reject deferred promise
    rejectPromise!(new Error("Network timeout"));

    await waitFor(() => {
      const trigger = screen.getByRole("combobox");
      expect(trigger).not.toHaveAttribute("aria-busy");
      expect(screen.getByRole("status")).toHaveTextContent("");
    });
  });
});
