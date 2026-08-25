import type { Meta, StoryObj } from '@storybook/react';
import { Textarea } from './textarea';

const meta: Meta<typeof Textarea> = {
  title: 'UI/Textarea',
  component: Textarea,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[480px]">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    disabled: { control: 'boolean' },
    showCharacterCount: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Invoice Description',
    placeholder: 'Describe the goods or services covered by this invoice...',
  },
};

export const WithValue: Story = {
  args: {
    label: 'Invoice Description',
    value: 'Enterprise software development services for Q4 2024, covering system integration and API delivery for Safaricom PLC.',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Invoice Description',
    placeholder: 'Not editable at this stage',
    value: 'Locked invoice description — read only.',
    disabled: true,
  },
};

export const Error: Story = {
  args: {
    label: 'Invoice Description',
    placeholder: 'Describe the invoice...',
    error: 'Description is required and must be at least 20 characters.',
  },
};

export const WithHint: Story = {
  args: {
    label: 'Additional Notes',
    placeholder: 'Any special repayment terms or conditions...',
    hint: 'This text will be visible to investors on the marketplace.',
  },
};

export const WithCharacterLimit: Story = {
  args: {
    label: 'Short Summary',
    placeholder: 'Brief summary of the invoice...',
    maxLength: 200,
    showCharacterCount: true,
    value: 'Software services invoice for Safaricom PLC.',
  },
};

export const Success: Story = {
  args: {
    label: 'Invoice Description',
    value: 'Logistics coordination and freight management services delivered to TechBridge Solutions for Q3 2024.',
    success: true,
  },
};
