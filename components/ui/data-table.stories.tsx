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

// ─── Reduced-motion helper ─────────────────────────────────────────────────────
/**
 * Decorator that emulates `prefers-reduced-motion: reduce` by stubbing
 * `window.matchMedia` for the duration of the story. Storybook's built-in
 * `parameters.prefersReducedMotion` only affects Storybook's own UI, so we
 * mock the media query directly to exercise the DataTable's sticky-header
 * motion logic (see `hooks/usePrefersReducedMotion.ts`).
 */
const withReducedMotion = (Story: () => JSX.Element) => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => {
    const matches = query.includes('prefers-reduced-motion');
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList;
  }) as typeof window.matchMedia;

  // Restore on unmount so other stories are unaffected.
  if (typeof window !== 'undefined') {
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, { childList: true });
    // Best-effort restore; Storybook remounts decorators per story.
    setTimeout(() => {
      window.matchMedia = originalMatchMedia;
      observer.disconnect();
    }, 0);
  }

  return <Story />;
};

// ─── Meta ──────────────────────────────────────────────────────────────────────
const meta: Meta<typeof DataTable> = {
  title: 'UI/DataTable',
  component: DataTable,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Data table with an optional sticky header. When the user prefers reduced motion ' +
          '(`prefers-reduced-motion: reduce`), the sticky header renders without animated ' +
          'transitions (no shadow/elevation tween) while remaining sticky. Use the ' +
          '`StickyHeader` and `StickyHeaderReducedMotion` stories to capture screenshots ' +
          'for both modes.',
      },
    },
  },
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

/**
 * Sticky header with motion enabled (default). Scroll the table body to see the
 * header stay pinned with its animated elevation/shadow transition.
 */
export const StickyHeader: Story = {
  args: {
    data: INVOICE_ROWS,
    columns: COLUMNS,
    pageSize: 5,
    stickyHeader: true,
    syncToUrl: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Sticky header with motion enabled. The header remains pinned while the body ' +
          'scrolls and animates its elevation. Capture a screenshot at desktop and mobile ' +
          'viewports for the default (motion) mode.',
      },
    },
  },
};

/**
 * Sticky header with `prefers-reduced-motion: reduce` emulated. The header stays
 * pinned but renders without animated transitions. Capture a screenshot to
 * verify the reduced-motion path.
 */
export const StickyHeaderReducedMotion: Story = {
  args: {
    data: INVOICE_ROWS,
    columns: COLUMNS,
    pageSize: 5,
    stickyHeader: true,
    syncToUrl: false,
  },
  decorators: [withReducedMotion],
  parameters: {
    prefersReducedMotion: 'reduce',
    docs: {
      description: {
        story:
          'Sticky header with `prefers-reduced-motion: reduce` emulated via a mocked ' +
          '`matchMedia`. The header remains sticky but skips animated transitions. ' +
          'Capture a screenshot at desktop and mobile viewports to verify the ' +
          'reduced-motion path.',
      },
    },
  },
};
