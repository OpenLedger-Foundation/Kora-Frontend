import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EmptyState } from "../components/ui/EmptyState";

// Simulate the emptyState namespace so default variant copy comes from t().
vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => {
    if (ns !== "emptyState") return key;
    const messages: Record<string, string> = {
      "variants.no-invoices.heading": "No invoices yet",
      "variants.no-invoices.subtext": "Create your first invoice to start raising liquidity on-chain.",
      "variants.no-positions.heading": "No positions yet",
      "variants.no-positions.subtext": "Fund invoices on the marketplace to build your investment portfolio.",
      "variants.no-transactions.heading": "No transactions yet",
      "variants.no-transactions.subtext": "Your on-chain transaction history will appear here.",
      "variants.no-results.heading": "No results found",
      "variants.no-results.subtext": "We couldn't find anything matching your current filters. Try resetting.",
      "variants.marketplace.heading": "No invoices match your filters",
      "variants.marketplace.subtext": "Try adjusting your filters to explore more opportunities.",
      "variants.sme.heading": "No invoices yet",
      "variants.sme.subtext": "Create your first invoice to start raising liquidity.",
      "variants.investor.heading": "No positions yet",
      "variants.investor.subtext": "Fund invoices on the marketplace to build your portfolio.",
      "variants.transactions.heading": "No transactions yet",
      "variants.transactions.subtext": "Your transaction history will appear here.",
      "variants.analytics.heading": "No data yet",
      "variants.analytics.subtext": "Analytics will populate once you have activity.",
      suggestionsAria: "Recovery suggestions",
    };
    return messages[key] ?? key;
  },
}));

describe("EmptyState", () => {
  it("renders no-invoices variant with default heading from t()", () => {
    render(<EmptyState variant="no-invoices" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("No invoices yet")).toBeInTheDocument();
  });

  it("renders no-positions variant with default heading from t()", () => {
    render(<EmptyState variant="no-positions" />);
    expect(screen.getByText("No positions yet")).toBeInTheDocument();
  });

  it("renders no-transactions variant with default heading from t()", () => {
    render(<EmptyState variant="no-transactions" />);
    expect(screen.getByText("No transactions yet")).toBeInTheDocument();
  });

  it("renders no-results variant with default heading from t()", () => {
    render(<EmptyState variant="no-results" />);
    expect(screen.getByText("No results found")).toBeInTheDocument();
  });

  it("uses custom title prop over translated default", () => {
    render(<EmptyState variant="no-invoices" title="My custom heading" />);
    expect(screen.getByText("My custom heading")).toBeInTheDocument();
    expect(screen.queryByText("No invoices yet")).not.toBeInTheDocument();
  });

  it("renders optional action button when cta is provided", () => {
    const onClick = vi.fn();
    render(
      <EmptyState variant="no-invoices" cta={{ label: "Create Invoice", onClick }} />,
    );
    const btn = screen.getByRole("button", { name: "Create Invoice" });
    expect(btn).toBeInTheDocument();
    btn.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not render button when cta is null", () => {
    render(<EmptyState variant="no-invoices" cta={null} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("container has role=status for accessibility", () => {
    render(<EmptyState variant="no-results" title="Empty" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders explicit description prop over translated default", () => {
    render(
      <EmptyState variant="no-invoices" description="Custom description" />,
    );
    expect(screen.getByText("Custom description")).toBeInTheDocument();
  });

  it("renders translated default description when description is omitted", () => {
    render(<EmptyState variant="no-invoices" />);
    expect(
      screen.getByText("Create your first invoice to start raising liquidity on-chain."),
    ).toBeInTheDocument();
  });

  it("suggestions container uses translated aria-label", () => {
    render(
      <EmptyState
        variant="no-results"
        suggestions={[{ label: "Clear filters", onClick: vi.fn() }]}
      />,
    );
    expect(screen.getByTestId("empty-state-suggestions")).toHaveAttribute(
      "aria-label",
      "Recovery suggestions",
    );
  });
});
