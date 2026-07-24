import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  InvestorDashboardSkeleton,
  PortfolioDonutSkeleton,
  StatCardSkeleton,
} from "@/components/ui/skeleton";

describe("Investor dashboard skeleton loading", () => {
  it("renders InvestorDashboardSkeleton with aria-busy and role=status", () => {
    render(<InvestorDashboardSkeleton />);
    const root = screen.getByRole("status", { name: /loading investor dashboard/i });
    expect(root).toHaveAttribute("aria-busy", "true");
  });

  it("renders PortfolioDonutSkeleton with aria-busy", () => {
    const { container } = render(<PortfolioDonutSkeleton />);
    const busy = container.querySelector("[aria-busy='true']");
    expect(busy).toBeTruthy();
    expect(busy).toHaveAttribute("aria-label", "Loading portfolio composition");
  });

  it("renders StatCardSkeleton blocks matching card dimensions", () => {
    const { container } = render(<StatCardSkeleton />);
    expect(container.firstChild).toHaveClass("rounded-xl", "border", "p-5");
  });
});
