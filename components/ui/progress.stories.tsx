import type { Meta, StoryObj } from '@storybook/react';
import { Progress } from './progress';

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