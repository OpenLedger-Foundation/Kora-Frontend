import type { Meta, StoryObj } from "@storybook/react";
import { PositionDetailDrawer } from "@/components/invoice/PositionDetailDrawer";
import type { Invoice, InvoicePosition } from "@/types";

// ─── Shared mock data ─────────────────────────────────────────────────────────

const baseInvoice: Invoice = {
  id: "inv-001",
  tokenId: "tok-001",
  contractAddress: "GABC1234CONTRACTADDRESS",
  ipfsCid: "QmExampleCid",
  metadata: {
    invoiceNumber: "INV-2024-001",
    issuerName: "Acme Corp Ltd",
    issuerAddress: "GISSUER1234",
    debtorName: "Global Buyers Inc",
    debtorAddress: "GDEBTOR5678",
    amount: 50000,
    currency: "USDC",
    issueDate: "2024-01-15T00:00:00Z",
    dueDate: "2024-07-15T00:00:00Z",
    description: "Technology services invoice Q1 2024",
    jurisdiction: "US",
    category: "technology",
    documentHash: "QmDocHash",
    documentUrl: "https://ipfs.io/ipfs/QmDocHash",
  },
  terms: {
    discountRate: 0.06,
    apr: 12.5,
    financingAmount: 47000,
    minInvestment: 1000,
    maxInvestment: 10000,
    tenor: 180,
    repaymentDate: "2024-07-15T00:00:00Z",
  },
  funding: {
    totalRaised: 47000,
    targetAmount: 47000,
    fundingProgress: 1,
    investorCount: 8,
    remainingCapacity: 0,
  },
  riskTier: "A",
  riskScore: 78,
  debtorPrivacy: "partial",
  status: "active",
  createdAt: "2024-01-10T00:00:00Z",
  updatedAt: "2024-01-16T00:00:00Z",
  ownerAddress: "GOWNER1234",
};

// ─── Active position ──────────────────────────────────────────────────────────

/** Invoice with a future maturity date (~120 days from a fixed "now") */
const activeInvoice: Invoice = {
  ...baseInvoice,
  status: "active",
  terms: {
    ...baseInvoice.terms,
    // ~4 months from today (stable enough for stories)
    repaymentDate: "2025-07-13T12:00:00.000Z",
  },
};

const activePosition: InvoicePosition = {
  invoiceId: "inv-001",
  invoice: activeInvoice,
  investedAmount: 5000,
  expectedReturn: 300,
  yieldEarned: 0,
  investedAt: "2025-01-14T12:00:00.000Z", // 60 days ago
  status: "active",
};

// ─── Repaid position ──────────────────────────────────────────────────────────

const repaidInvoice: Invoice = {
  ...baseInvoice,
  status: "repaid",
  terms: {
    ...baseInvoice.terms,
    repaymentDate: "2024-04-15T00:00:00Z",
  },
  updatedAt: "2024-04-14T10:30:00Z", // repaid one day early
};

const repaidPosition: InvoicePosition = {
  invoiceId: "inv-001",
  invoice: repaidInvoice,
  investedAmount: 5000,
  expectedReturn: 300,
  yieldEarned: 312.5, // slightly above expected (early repayment bonus)
  investedAt: "2024-01-15T00:00:00Z",
  status: "repaid",
};

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof PositionDetailDrawer> = {
  title: "Invoice/PositionDetailDrawer",
  component: PositionDetailDrawer,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Slide-in drawer showing full position details for an investor, including a horizontal repayment timeline with a current-date marker.",
      },
    },
  },
  argTypes: {
    open: { control: "boolean" },
    loading: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof PositionDetailDrawer>;

// ─── Stories ──────────────────────────────────────────────────────────────────

/**
 * Active position — the repayment timeline shows the today marker part-way
 * along the Funded → Maturity bar, with the Repaid milestone as a future
 * placeholder.
 */
export const ActivePosition: Story = {
  name: "Active position (in-progress timeline)",
  args: {
    open: true,
    loading: false,
    position: activePosition,
    invoice: activeInvoice,
    onOpenChange: () => {},
  },
};

/**
 * Repaid position — all three milestones are filled, the full progress bar is
 * shown in emerald, and the actual repayment date plus yield received are
 * displayed inside the Repaid milestone.
 */
export const RepaidPosition: Story = {
  name: "Repaid position (completed timeline)",
  args: {
    open: true,
    loading: false,
    position: repaidPosition,
    invoice: repaidInvoice,
    onOpenChange: () => {},
  },
};

/**
 * Loading / skeleton state — shown while data is being fetched.
 */
export const LoadingState: Story = {
  name: "Loading / skeleton state",
  args: {
    open: true,
    loading: true,
    position: null,
    invoice: null,
    onOpenChange: () => {},
  },
};

/**
 * Defaulted position — status badge shows "Active — in progress" with
 * a past maturity date, flipping the badge to "Awaiting repayment".
 */
export const OverduePosition: Story = {
  name: "Overdue position (past maturity, not yet repaid)",
  args: {
    open: true,
    loading: false,
    position: {
      ...activePosition,
      status: "active",
    } as InvoicePosition,
    invoice: {
      ...activeInvoice,
      status: "active",
      terms: {
        ...activeInvoice.terms,
        // 30 days in the past → "Awaiting repayment" badge on timeline
        repaymentDate: "2025-02-13T12:00:00.000Z",
      },
    } as Invoice,
    onOpenChange: () => {},
  },
};
