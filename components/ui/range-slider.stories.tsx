import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { RangeSlider } from './range-slider';

const meta: Meta<typeof RangeSlider> = {
  title: 'UI/RangeSlider',
  component: RangeSlider,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    min: { control: { type: 'number' } },
    max: { control: { type: 'number' } },
    step: { control: { type: 'number' } },
    disabled: { control: { type: 'boolean' } },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = useState<[number, number]>([20, 80]);
    return (
      <div className="w-[400px]">
        <RangeSlider
          {...args}
          value={value}
          onChange={setValue}
        />
      </div>
    );
  },
  args: {
    min: 0,
    max: 100,
    step: 1,
  },
};

export const APRFilter: Story = {
  render: () => {
    const [value, setValue] = useState<[number, number]>([5, 25]);
    return (
      <div className="w-[400px]">
        <RangeSlider
          min={0}
          max={50}
          step={0.5}
          value={value}
          onChange={setValue}
          formatLabel={(v) => `${v}%`}
        />
      </div>
    );
  },
};

export const WithHistogram: Story = {
  render: () => {
    const [value, setValue] = useState<[number, number]>([10, 40]);
    const histogram = Array.from({ length: 20 }, (_, i) => ({
      value: i * 2.5,
      count: Math.floor(Math.random() * 100) + 10,
    }));
    
    return (
      <div className="w-[400px]">
        <RangeSlider
          min={0}
          max={50}
          step={0.5}
          value={value}
          onChange={setValue}
          formatLabel={(v) => `${v}%`}
          histogram={histogram}
        />
      </div>
    );
  },
};

export const Disabled: Story = {
  render: () => {
    const [value, setValue] = useState<[number, number]>([30, 70]);
    return (
      <div className="w-[400px]">
        <RangeSlider
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={setValue}
          disabled
        />
      </div>
    );
  },
};