"use client";

/**
 * PortfolioDonut — interactive portfolio composition visualization.
 *
 * Three donut charts:
 *   1. By Risk Tier
 *   2. By Jurisdiction
 *   3. By Category
 *
 * Clicking a segment filters the positions table below via the `onSegmentClick`
 * callback.  The active segment is highlighted and matching rows are indicated
 * by the `activeFilter` prop.
 *
 * Responsive: charts resize correctly; legend moves below on mobile.
 * Empty state: placeholder illustration when no positions exist.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Sector,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import { PieChart as PieChartIcon } from "lucide-react";
import type { InvoicePosition } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DonutDimension = "riskTier" | "jurisdiction" | "category";

export interface DonutFilter {
  dimension: DonutDimension;
  value: string;
}

export interface PortfolioDonutProps {
  /** Investor positions to visualise */
  positions: InvoicePosition[];
  /** Currently active drill-down filter (controlled from parent) */
  activeFilter: DonutFilter | null;
  /** Called when the user clicks a segment */
  onSegmentClick: (filter: DonutFilter | null) => void;
}

interface DonutSlice {
  name: string;
  value: number;   // USDC amount
  percent: number; // 0–100
  color: string;
}

// ─── Colour palettes ──────────────────────────────────────────────────────────

const RISK_TIER_PALETTE: Record<string, string> = {
  AAA: "#10b981", // emerald-500
  AA:  "#14b8a6", // teal-500
  A:   "#06b6d4", // cyan-500
  BBB: "#f59e0b", // amber-500
  BB:  "#f97316", // orange-500
  B:   "#ef4444", // red-500
  CCC: "#dc2626", // red-600
};

const JURISDICTION_PALETTE: Record<string, string> = {
  US:    "#818cf8", // indigo-400
  EU:    "#a78bfa", // violet-400
  UK:    "#c084fc", // purple-400
  NG:    "#34d399", // emerald-400
  KE:    "#2dd4bf", // teal-400
  GH:    "#22d3ee", // cyan-400
  ZA:    "#60a5fa", // blue-400
  OTHER: "#94a3b8", // slate-400
};

const CATEGORY_PALETTE: string[] = [
  "#14b8a6", "#818cf8", "#f59e0b", "#ef4444", "#10b981",
  "#06b6d4", "#f97316", "#a78bfa", "#34d399", "#60a5fa",
];

function getCategoryColor(index: number): string {
  return CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
}

// ─── Data builders ────────────────────────────────────────────────────────────

function buildSlices(
  positions: InvoicePosition[],
  dimension: DonutDimension
): DonutSlice[] {
  const totals: Record<string, number> = {};

  for (const pos of positions) {
    let key: string;
    switch (dimension) {
      case "riskTier":
        key = pos.invoice.riskTier;
        break;
      case "jurisdiction":
        key = pos.invoice.metadata.jurisdiction;
        break;
      case "category":
        key = pos.invoice.metadata.category;
        break;
    }
    totals[key] = (totals[key] ?? 0) + pos.investedAmount;
  }

  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);
  if (grandTotal === 0) return [];

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  return entries.map(([name, value], idx) => {
    let color: string;
    if (dimension === "riskTier") color = RISK_TIER_PALETTE[name] ?? "#94a3b8";
    else if (dimension === "jurisdiction") color = JURISDICTION_PALETTE[name] ?? "#94a3b8";
    else color = getCategoryColor(idx);

    return {
      name,
      value,
      percent: (value / grandTotal) * 100,
      color,
    };
  });
}

// ─── Custom active shape (highlighted segment) ───────────────────────────────

function ActiveShape(props: any) {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, percent,
  } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={1}
      />
      {/* Centre label */}
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#e4e4e7" fontSize={13} fontWeight={700}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#14b8a6" fontSize={12} fontWeight={600}>
        {percent.toFixed(1)}%
      </text>
    </g>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value, percent } = payload[0].payload as DonutSlice;
  return (
    <div
      style={{
        background: "rgba(24,24,27,0.95)",
        border: "1px solid #27272a",
        borderRadius: 8,
        padding: "8px 12px",
        color: "#e4e4e7",
        fontSize: 12,
        minWidth: 160,
      }}
    >
      <p style={{ fontWeight: 700, marginBottom: 4, color: "#f4f4f5" }}>{name}</p>
      <p style={{ color: "#14b8a6", fontWeight: 600 }}>{formatCurrency(value, "USDC", true)}</p>
      <p style={{ color: "#71717a" }}>{percent.toFixed(1)}% of portfolio</p>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

interface LegendProps {
  slices: DonutSlice[];
  dimension: DonutDimension;
  activeValue: string | null;
  onItemClick: (value: string) => void;
}

function DonutLegend({ slices, dimension, activeValue, onItemClick }: LegendProps) {
  if (slices.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1.5 w-full" role="list" aria-label={`${dimension} legend`}>
      {slices.map((slice) => {
        const isActive = activeValue === slice.name;
        return (
          <li key={slice.name}>
            <button
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-xs transition-colors",
                "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isActive ? "bg-muted/80 ring-1 ring-ring" : "bg-transparent"
              )}
              onClick={() => onItemClick(slice.name)}
              aria-pressed={isActive}
              aria-label={`Filter by ${slice.name}: ${slice.percent.toFixed(1)}%`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <span className={cn("truncate", isActive ? "text-foreground font-semibold" : "text-muted-foreground")}>
                  {slice.name}
                </span>
              </span>
              <span className="flex items-center gap-2 flex-shrink-0 tabular-nums">
                <span className="text-muted-foreground">{formatCurrency(slice.value, "USDC", true)}</span>
                <span
                  className={cn(
                    "font-semibold",
                    isActive ? "text-primary" : "text-foreground"
                  )}
                >
                  {slice.percent.toFixed(1)}%
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Single donut panel ───────────────────────────────────────────────────────

interface DonutPanelProps {
  title: string;
  slices: DonutSlice[];
  dimension: DonutDimension;
  activeFilter: DonutFilter | null;
  onSegmentClick: (filter: DonutFilter | null) => void;
}

function DonutPanel({ title, slices, dimension, activeFilter, onSegmentClick }: DonutPanelProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const activeValue =
    activeFilter?.dimension === dimension ? activeFilter.value : null;

  const handleClick = useCallback(
    (data: DonutSlice) => {
      // Toggle off if already active
      if (activeFilter?.dimension === dimension && activeFilter.value === data.name) {
        onSegmentClick(null);
      } else {
        onSegmentClick({ dimension, value: data.name });
      }
    },
    [activeFilter, dimension, onSegmentClick]
  );

  const handleLegendClick = useCallback(
    (value: string) => {
      if (activeFilter?.dimension === dimension && activeFilter.value === value) {
        onSegmentClick(null);
      } else {
        onSegmentClick({ dimension, value });
      }
    },
    [activeFilter, dimension, onSegmentClick]
  );

  // Dim non-active slices when a filter is active for this dimension
  const cellOpacity = (name: string) => {
    if (!activeValue) return 1;
    return name === activeValue ? 1 : 0.3;
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-0 pt-0 flex-1">
        {slices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <PieChartIcon className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No data</p>
          </div>
        ) : (
          <>
            {/* Chart */}
            <div className="w-full" style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={72}
                    paddingAngle={2}
                    dataKey="value"
                    activeIndex={hoverIndex ?? undefined}
                    activeShape={<ActiveShape />}
                    onMouseEnter={(_, index) => setHoverIndex(index)}
                    onMouseLeave={() => setHoverIndex(null)}
                    onClick={(data: DonutSlice) => handleClick(data)}
                    style={{ cursor: "pointer" }}
                    aria-label={`${title} donut chart`}
                  >
                    {slices.map((slice) => (
                      <Cell
                        key={slice.name}
                        fill={slice.color}
                        opacity={cellOpacity(slice.name)}
                        stroke={activeValue === slice.name ? slice.color : "transparent"}
                        strokeWidth={activeValue === slice.name ? 2 : 0}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <DonutLegend
              slices={slices}
              dimension={dimension}
              activeValue={activeValue}
              onItemClick={handleLegendClick}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <PieChartIcon className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">No portfolio data yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Fund invoices on the marketplace to see your portfolio composition.
        </p>
      </div>
    </div>
  );
}

// ─── Active filter badge ──────────────────────────────────────────────────────

interface FilterBadgeProps {
  filter: DonutFilter;
  onClear: () => void;
}

function ActiveFilterBadge({ filter, onClear }: FilterBadgeProps) {
  const labels: Record<DonutDimension, string> = {
    riskTier: "Risk Tier",
    jurisdiction: "Jurisdiction",
    category: "Category",
  };
  return (
    <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
      <span>
        Filtering by <strong>{labels[filter.dimension]}</strong>: {filter.value}
      </span>
      <button
        onClick={onClear}
        className="ml-1 rounded-full hover:bg-primary/20 p-0.5 transition-colors"
        aria-label="Clear filter"
      >
        ×
      </button>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function PortfolioDonut({ positions, activeFilter, onSegmentClick }: PortfolioDonutProps) {
  const riskSlices = useMemo(() => buildSlices(positions, "riskTier"), [positions]);
  const jurisdictionSlices = useMemo(() => buildSlices(positions, "jurisdiction"), [positions]);
  const categorySlices = useMemo(() => buildSlices(positions, "category"), [positions]);

  const hasPositions = positions.length > 0;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Portfolio Composition</h2>
          <p className="text-xs text-muted-foreground">
            Click a segment or legend item to filter positions below
          </p>
        </div>
        {activeFilter && (
          <ActiveFilterBadge filter={activeFilter} onClear={() => onSegmentClick(null)} />
        )}
      </div>

      {/* Charts grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {hasPositions ? (
          <>
            <DonutPanel
              title="By Risk Tier"
              slices={riskSlices}
              dimension="riskTier"
              activeFilter={activeFilter}
              onSegmentClick={onSegmentClick}
            />
            <DonutPanel
              title="By Jurisdiction"
              slices={jurisdictionSlices}
              dimension="jurisdiction"
              activeFilter={activeFilter}
              onSegmentClick={onSegmentClick}
            />
            <DonutPanel
              title="By Category"
              slices={categorySlices}
              dimension="category"
              activeFilter={activeFilter}
              onSegmentClick={onSegmentClick}
            />
          </>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}
