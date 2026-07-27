/**
 * Storybook stories for AnalyticsCharts.
 *
 * These stories act as screenshot baselines for the four Recharts-heavy
 * chart types (PortfolioGrowth, MonthlyYield, RiskDistribution, ReturnRate).
 *
 * Visual regression strategy
 * ──────────────────────────
 * • Each story isolates a single chart configuration so regressions are
 *   pin-pointed rather than obscured inside a full-page render.
 * • The `WithAllData` story mirrors what the analytics page renders so a
 *   single screenshot catches the complete composed layout.
 * • `IsLoading` and `EmptyState` variants guard skeleton / empty-state
 *   rendering drift independently.
 *
 * Snapshot baseline
 * ─────────────────
 * The companion __tests__/analytics-charts.snapshot.test.tsx consumes these
 * stories and asserts toMatchSnapshot() in jsdom. Run with -u to update.
 *
 * For Chromatic / Playwright visual regression: each story maps to one
 * screenshot. Add `chromatic: { viewports: [375, 1280] }` per story to
 * capture mobile + desktop breakpoints.
 */

import type { Meta, StoryObj } from "@storybook/react";
import AnalyticsCharts from "./AnalyticsCharts";

// ─── Shared fixture data ───────────────────────────────────────────────────────

const PORTFOLIO = [
  { month: "Jan", value: 10000 },
  { month: "Feb", value: 28000 },
  { month: "Mar", value: 45000 },
  { month: "Apr", value: 72000 },
  { month: "May", value: 95000 },
  { month: "Jun", value: 130000 },
];

const YIELD_DATA = [
  { month: "Jan", yield: 150 },
  { month: "Feb", yield: 420 },
  { month: "Mar", yield: 680 },
  { month: "Apr", yield: 1100 },
  { month: "May", yield: 1600 },
  { month: "Jun", yield: 2200 },
];

const RISK = [
  { name: "A", value: 45, color: "#22c55e" },
  { name: "B", value: 30, color: "#eab308" },
  { name: "C", value: 15, color: "#f97316" },
  { name: "D", value: 10, color: "#ef4444" },
];

const MONTHLY = [
  { month: "Jan", return: 1.5 },
  { month: "Feb", return: 1.8 },
  { month: "Mar", return: 2.1 },
  { month: "Apr", return: 1.9 },
  { month: "May", return: 2.4 },
  { month: "Jun", return: 2.6 },
];

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof AnalyticsCharts> = {
  title: "Analytics/AnalyticsCharts",
  component: AnalyticsCharts,
  parameters: {
    layout: "padded",
    // Disable animations in Storybook snapshots for deterministic screenshots
    chromatic: { pauseAnimationAtEnd: true },
  },
  args: {
    portfolio: PORTFOLIO,
    yieldData: YIELD_DATA,
    risk: RISK,
    monthly: MONTHLY,
    isLoading: false,
    compact: false,
  },
};

export default meta;
type Story = StoryObj<typeof AnalyticsCharts>;

// ─── Stories ──────────────────────────────────────────────────────────────────

/** Full data set — primary screenshot baseline for all four charts. */
export const WithAllData: Story = {};

/** Compact layout used inside dashboard widgets. */
export const Compact: Story = {
  args: { compact: true },
};

/** Loading state — all charts should show skeleton placeholders. */
export const IsLoading: Story = {
  args: { isLoading: true },
};

/** No data — all charts should show the empty-state illustration. */
export const EmptyState: Story = {
  args: {
    portfolio: [],
    yieldData: [],
    risk: [],
    monthly: [],
  },
};

/** Export buttons visible when onExport handler is provided. */
export const WithExportButtons: Story = {
  args: {
    onExport: (type) => console.log("export", type),
  },
};

/** Risk segment click handler — pie slices should appear interactive. */
export const WithRiskDrillDown: Story = {
  args: {
    onRiskSegmentClick: (tier) => console.log("risk tier clicked:", tier),
  },
};

/** Single-month data edge case — charts should still render without errors. */
export const SingleDataPoint: Story = {
  args: {
    portfolio: [{ month: "Jun", value: 5000 }],
    yieldData: [{ month: "Jun", yield: 80 }],
    risk: [{ name: "A", value: 100, color: "#22c55e" }],
    monthly: [{ month: "Jun", return: 2.0 }],
  },
};

/** Partial data — some charts have data, others are empty. */
export const PartialData: Story = {
  args: {
    portfolio: PORTFOLIO,
    yieldData: [],
    risk: RISK,
    monthly: [],
  },
};
