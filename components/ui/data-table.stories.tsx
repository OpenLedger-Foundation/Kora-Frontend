import type { Meta, StoryObj } from '@storybook/react';
import { DataTable } from './data-table';
import type { ColumnDef } from '@/types/table';

// ─── Fixture data ──────────────────────────────────────────────────────────────
interface InvoiceRow {
  id: string;
  debtor: string;
  amount: number;
  apr: number;
  jurisdiction: string;
  riskTier: string;
  status: string;
}

const INVOICE_ROWS: InvoiceRow[] = [
  { id: 'inv_001', debtor: 'Safaricom PLC', amount: 250000, apr: 24.5, jurisdiction: 'KE', riskTier: 'A', status: 'Listed' },
  { id: 'inv_002', debtor: 'MTN Nigeria Ltd', amount: 180000, apr: 31.2, jurisdiction: 'NG', riskTier: 'BBB', status: 'Partially Funded' },
  { id: 'inv_003', debtor: 'Ecobank Ghana', amount: 95000, apr: 18.0, jurisdiction: 'GH', riskTier: 'AA', status: 'Fully Funded' },
  { id: 'inv_004', debtor: 'Standard Bank ZA', amount: 430000, apr: 14.5, jurisdiction: 'ZA', riskTier: 'AAA', status: 'Listed' },
  { id: 'inv_005', debtor: 'Kenya Power Corp', amount: 62000, apr: 38.9, jurisdiction: 'KE', riskTier: 'BB', status: 'Listed' },
  { id: 'inv_006', debtor: 'TechBridge Solutions', amount: 115000, apr: 22.1, jurisdiction: 'EU', riskTier: 'A', status: 'Partially Funded' },
];

const COLUMNS: ColumnDef<InvoiceRow>[] = [
  { id: 'debtor', header: 'Debtor', accessor: 'debtor', sortable: true },
  {
    id: 'amount',
    header: 'Amount (USDC)',
    accessor: 'amount',
    sortable: true,
    cell: (row) => row.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
  },
  { id: 'apr', header: 'APR %', accessor: 'apr', sortable: true, cell: (row) => `${row.apr.toFixed(1)}%` },
  { id: 'jurisdiction', header: 'Jurisdiction', accessor: 'jurisdiction', sortable: false },
  { id: 'riskTier', header: 'Risk Tier', accessor: 'riskTier', sortable: true },
  { id: 'status', header: 'Status', accessor: 'status', sortable: false },
];

// ─── Meta ──────────────────────────────────────────────────────────────────────
const meta: Meta<typeof DataTable> = {
  title: 'UI/DataTable',
  component: DataTable,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    data: INVOICE_ROWS,
    columns: COLUMNS,
    pageSize: 5,
    syncToUrl: false,
  },
};

export const Loading: Story = {
  args: {
    data: [],
    columns: COLUMNS,
    isLoading: true,
    pageSize: 5,
    syncToUrl: false,
  },
};

export const Empty: Story = {
  args: {
    data: [],
    columns: COLUMNS,
    isLoading: false,
    syncToUrl: false,
    emptyState: {
      title: 'No invoices found',
      message: 'Try adjusting your filters or check back later for new listings.',
    },
  },
};

export const WithSelection: Story = {
  args: {
    data: INVOICE_ROWS,
    columns: COLUMNS,
    pageSize: 5,
    enableSelection: true,
    syncToUrl: false,
    bulkActions: (
      <button className="rounded px-3 py-1 text-xs bg-destructive text-white">
        Cancel Selected
      </button>
    ),
  },
};

export const SmallPageSize: Story = {
  args: {
    data: INVOICE_ROWS,
    columns: COLUMNS,
    pageSize: 2,
    pageSizeOptions: [2, 4, 6],
    syncToUrl: false,
  },
};
