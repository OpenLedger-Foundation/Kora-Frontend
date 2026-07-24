import type { Meta, StoryObj } from "@storybook/react";
import {
  InvestorDashboardSkeleton,
  PortfolioDonutSkeleton,
  StatCardSkeleton,
  TableSkeleton,
} from "./skeleton";

const meta: Meta = {
  title: "Dashboard/InvestorLoading",
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

/** Full investor dashboard loading state (stats + donut + table). */
export const LoadingState: Story = {
  render: () => <InvestorDashboardSkeleton />,
};

/** Individual skeleton primitives used by the investor dashboard. */
export const SkeletonPrimitives: Story = {
  render: () => (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">StatCard</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">PortfolioDonut</h3>
        <PortfolioDonutSkeleton />
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Positions table</h3>
        <TableSkeleton rows={5} cols={8} />
      </div>
    </div>
  ),
};
