import type { Meta, StoryObj } from '@storybook/react';
import { Progress, InvoiceFundingProgress } from './progress';

const meta: Meta<typeof Progress> = {
  title: 'UI/Progress',
  component: Progress,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 50,
    className: 'w-[300px]',
  },
};

export const Empty: Story = {
  args: {
    value: 0,
    className: 'w-[300px]',
  },
};

export const Full: Story = {
  args: {
    value: 100,
    className: 'w-[300px]',
  },
};

export const Loading: Story = {
  args: {
    value: 75,
    className: 'w-[300px]',
  },
};

export const Small: Story = {
  args: {
    value: 33,
    className: 'w-[200px] h-2',
  },
};

// ─── InvoiceFundingProgress Stories ───────────────────────────────────────────

const fundingMeta: Meta<typeof InvoiceFundingProgress> = {
  title: 'UI/InvoiceFundingProgress',
  component: InvoiceFundingProgress,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

type FundingStory = StoryObj<typeof InvoiceFundingProgress>;

export const FundingEmpty: FundingStory = {
  render: () => <InvoiceFundingProgress funded={0} target={100000} currency="USDC" />,
};

export const FundingPartial: FundingStory = {
  render: () => <InvoiceFundingProgress funded={60000} target={100000} currency="USDC" />,
};

export const FundingFull: FundingStory = {
  render: () => <InvoiceFundingProgress funded={100000} target={100000} currency="USDC" />,
};

export const FundingAnimated: FundingStory = {
  name: 'Animated (0 → current on mount)',
  render: () => <InvoiceFundingProgress funded={75000} target={100000} currency="USDC" />,
  parameters: {
    docs: {
      description: {
        story: 'Progress bar animates from 0 to 75% on mount using Framer Motion (600ms ease-out). Animation is skipped when prefers-reduced-motion is set.',
      },
    },
  },
};