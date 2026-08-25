import type { Meta, StoryObj } from "@storybook/react";
import { EmptyState } from "./EmptyState";

const meta: Meta<typeof EmptyState> = {
  title: "UI/EmptyState",
  component: EmptyState,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: { type: "select" },
      options: [
        "no-invoices",
        "no-positions",
        "no-transactions",
        "no-results",
        "marketplace",
        "sme",
        "investor",
        "transactions",
        "analytics",
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const NoInvoices: Story = {
  args: {
    variant: "no-invoices",
    title: "",
    cta: { label: "Create Invoice", onClick: () => {} },
  },
};

export const NoPositions: Story = {
  args: {
    variant: "no-positions",
    title: "",
    cta: { label: "Browse Marketplace", onClick: () => {} },
  },
};

export const NoTransactions: Story = {
  args: {
    variant: "no-transactions",
    title: "",
  },
};

export const NoResults: Story = {
  args: {
    variant: "no-results",
    title: "",
    cta: { label: "Clear Filters", onClick: () => {} },
  },
};

export const WithCustomTitle: Story = {
  args: {
    variant: "no-invoices",
    title: "Your invoice list is empty",
    description: "Upload or create invoices to get started.",
    cta: { label: "New Invoice", onClick: () => {} },
  },
};

export const WithoutCTA: Story = {
  args: {
    variant: "no-transactions",
    title: "",
  },
};
