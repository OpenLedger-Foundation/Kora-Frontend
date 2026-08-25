import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EmptyState } from "../components/ui/EmptyState";

describe("EmptyState", () => {
  it("renders no-invoices variant with default heading", () => {
    render(<EmptyState variant="no-invoices" title="" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("No invoices yet")).toBeInTheDocument();
  });

  it("renders no-positions variant with default heading", () => {
    render(<EmptyState variant="no-positions" title="" />);
    expect(screen.getByText("No positions yet")).toBeInTheDocument();
  });

  it("renders no-transactions variant with default heading", () => {
    render(<EmptyState variant="no-transactions" title="" />);
    expect(screen.getByText("No transactions yet")).toBeInTheDocument();
  });

  it("renders no-results variant with default heading", () => {
    render(<EmptyState variant="no-results" title="" />);
    expect(screen.getByText("No results found")).toBeInTheDocument();
  });

  it("uses custom title when provided", () => {
    render(<EmptyState variant="no-invoices" title="My custom heading" />);
    expect(screen.getByText("My custom heading")).toBeInTheDocument();
  });

  it("renders optional action button when cta is provided", () => {
    const onClick = vi.fn();
    render(
      <EmptyState variant="no-invoices" title="" cta={{ label: "Create Invoice", onClick }} />
    );
    const btn = screen.getByRole("button", { name: "Create Invoice" });
    expect(btn).toBeInTheDocument();
    btn.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not render button when cta is null", () => {
    render(<EmptyState variant="no-invoices" title="" cta={null} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("container has role=status for accessibility", () => {
    render(<EmptyState variant="no-results" title="Empty" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(
      <EmptyState variant="no-invoices" title="" description="Custom description" />
    );
    expect(screen.getByText("Custom description")).toBeInTheDocument();
  });
});
