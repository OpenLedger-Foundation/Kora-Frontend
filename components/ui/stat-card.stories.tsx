import type { Meta, StoryObj } from '@storybook/react';
import { StatCard } from './stat-card';
import { TrendingUp, DollarSign, Users, Activity } from 'lucide-react';

const meta: Meta<typeof StatCard> = {
  title: 'UI/StatCard',
  component: StatCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Total Revenue',
    value: '$45,231.89',
    change: '+20.1% from last month',
    changePositive: true,
    icon: <DollarSign className="h-4 w-4" />,
  },
};

export const Negative: Story = {
  args: {
    label: 'Active Users',
    value: '2,350',
    change: '-4.3% from last month',
    changePositive: false,
    icon: <Users className="h-4 w-4" />,
  },
};

export const WithTrendIcon: Story = {
  args: {
    label: 'Growth Rate',
    value: '12.5%',
    change: '+2.1% from last week',
    changePositive: true,
    icon: <TrendingUp className="h-4 w-4" />,
  },
};

export const ActivityStat: Story = {
  args: {
    label: 'Active Sessions',
    value: '573',
    change: 'Real-time',
    changePositive: true,
    icon: <Activity className="h-4 w-4" />,
  },
};

export const NoIcon: Story = {
  args: {
    label: 'Conversion Rate',
    value: '3.2%',
    change: '+0.5% from yesterday',
    changePositive: true,
  },
};