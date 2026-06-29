import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Pagination } from './pagination';

const meta: Meta<typeof Pagination> = {
  title: 'UI/Pagination',
  component: Pagination,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-full max-w-[900px] px-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Interactive wrapper so page state updates visually in Storybook
function PaginationDemo({
  totalItems,
  initialPage = 1,
  pageSize: initialPageSize = 10,
  showPageSizeControl = true,
}: {
  totalItems: number;
  initialPage?: number;
  pageSize?: number;
  showPageSizeControl?: boolean;
}) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  return (
    <Pagination
      totalItems={totalItems}
      pageSize={pageSize}
      currentPage={page}
      onPageChange={setPage}
      onPageSizeChange={showPageSizeControl ? setPageSize : undefined}
      syncToUrl={false}
    />
  );
}

export const Default: Story = {
  render: () => <PaginationDemo totalItems={120} />,
};

export const FirstPage: Story = {
  render: () => <PaginationDemo totalItems={120} initialPage={1} />,
};

export const MiddlePage: Story = {
  render: () => <PaginationDemo totalItems={120} initialPage={6} />,
};

export const LastPage: Story = {
  render: () => <PaginationDemo totalItems={120} initialPage={12} />,
};

export const FewItems: Story = {
  render: () => <PaginationDemo totalItems={15} initialPage={1} pageSize={10} />,
};

export const SinglePage: Story = {
  render: () => <PaginationDemo totalItems={8} initialPage={1} pageSize={10} />,
};

export const NoPageSizeControl: Story = {
  render: () => <PaginationDemo totalItems={80} initialPage={2} showPageSizeControl={false} />,
};

export const LargDataset: Story = {
  render: () => <PaginationDemo totalItems={5000} initialPage={1} pageSize={25} />,
};
