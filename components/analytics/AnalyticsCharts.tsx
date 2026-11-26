"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, useReducedMotion } from "framer-motion";
import { Download, TrendingUp, TrendingDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormatters } from "@/hooks/useFormatters";
import {
  buildTreemapModel,
  describeTreemap,
  largestConcentration,
  toTreemapSeries,
} from "@/lib/portfolioTreemap";
import type {
  AllocatablePosition,
  MonthlyReturnPoint,
  PortfolioValuePoint,
  YieldPoint,
} from "@/lib/portfolioAllocation";
import { BENCHMARK_DISCLOSURE, getBenchmarkConfig, type BenchmarkConfig } from "@/lib/benchmarks";
import { TOOLTIP_STYLE } from "@/components/analytics/chartPrimitives";

// ─── Code-splitting (Issue #1264) ────────────────────────────────────────────
//
// Recharts is one of the heaviest dependencies in the app and is only needed
// once a chart actually renders. The chart primitives live in a dedicated
// module (`chartPrimitives.tsx`) which is loaded lazily via next/dynamic with
// `ssr: false`, keeping recharts out of the main bundle and out of the
// server-rendered HTML. The loading fallback is a localized skeleton so the
// card keeps its layout while the chunk streams in.
const ChartPrimitives = dynamic(
  () => import("@/components/analytics/chartPrimitives"),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  }
);

interface AnalyticsChartsProps {
  portfolio: PortfolioValuePoint[];
  yieldData: YieldPoint[];
  risk: Array<{ name: string; value: number; color: string }>;
  monthly: MonthlyReturnPoint[];
  isLoading?: boolean;
  compact?: boolean;
  onExport?: (type: "portfolio" | "yield" | "risk" | "monthly") => void;
  /** Drill-down: open marketplace filtered by the selected risk tier. */
  onRiskSegmentClick?: (riskTier: string) => void;
  /**
   * Live positions for the allocation treemap (#600). Omit to hide the card —
   * the treemap needs per-position metadata the aggregated `risk` prop has
   * already collapsed away.
   */
  positions?: AllocatablePosition[];
  /**
   * Benchmark overlay config (#603). Defaults to the env-derived config;
   * injectable so stories and tests are not coupled to build-time env vars.
   */
  benchmarkConfig?: BenchmarkConfig;
}

function ChartSkeleton({ height = 220 }: { height?: number }) {
  const t = useTranslations("analytics");
  return (
    <div
      style={{ height }}
      className="flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Skeleton className="h-full w-full" />
      <span className="sr-only">{t("charts.loading")}</span>
    </div>
  );
}

// ─── Accessibility (Issue #439) ──────────────────────────────────────────────
//
// Recharts renders each chart as an unlabelled <svg>. To a screen reader that
// is an anonymous graphic: the visible CardTitle sits outside the SVG and is
// never associated with it, so axe reports the chart as content with no
// accessible name and a non-sighted user gets nothing at all from it.
//
// Each chart is therefore wrapped in a `role="img"` element carrying an
// aria-label that spells out the underlying numbers. `role="img"` collapses the
// SVG's internals — hundreds of <path>/<g> nodes that are meaningless read
// aloud — into a single labelled node, which is the WAI-ARIA recommended
// pattern for a data graphic with a text alternative.

/** Render a time series as a sentence: title, point count, then every value. */
function describeSeries<T extends object>(
  title: string,
  rows: T[],
  labelKey: keyof T,
  valueKey: keyof T,
  format: (value: number) => string,
  t: ReturnType<typeof useTranslations<"analytics">>,
  formatLabel: (value: string) => string = (value) => value
): string {
  if (rows.length === 0) return t("chartA11y.empty", { title });
  const points = rows
    .map((row) => `${formatLabel(String(row[labelKey]))}: ${format(Number(row[valueKey]))}`)
    .join(t("chartA11y.separator"));
  return t("chartA11y.series", { title, count: rows.length, points });
}

/** Render a proportional breakdown as a sentence. */
function describeDistribution(
  title: string,
  slices: Array<{ name: string; value: number }>,
  format: (value: number) => string,
  t: ReturnType<typeof useTranslations<"analytics">>
): string {
  if (slices.length === 0) return t("chartA11y.empty", { title });
  const segments = slices.map((s) => t("chartA11y.segment", { name: s.name, value: format(s.value) })).join(t("chartA11y.separator"));
  return t("chartA11y.distribution", { title, count: slices.length, segments });
}

/**
 * Wraps a chart in a single labelled node so assistive tech announces the
 * summary instead of walking the SVG's internals.
 */
function ChartFigure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="img" aria-label={label}>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
      <TrendingUp className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * Fallback shown when the lazily-loaded chart chunk fails to load (offline,
 * flaky network, stale deploy). Keeps the card usable instead of leaving a
 * blank skeleton spinning forever.
 */
function ChartLoadError({ message }: { message: string }) {
  return (
    <div
      className="flex h-56 flex-col items-center justify-center gap-2 text-center"
      role="alert"
    >
      <TrendingDown className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default function AnalyticsCharts({
  portfolio,
  yieldData,
  risk,
  monthly,
  isLoading = false,
  compact = false,
  onExport,
  onRiskSegmentClick,
  positions,
  benchmarkConfig,
}: AnalyticsChartsProps) {
  const chartHeight = compact ? 180 : 240;
  const reducedMotion = useReducedMotion();
  const t = useTranslations("analytics");
  const { formatCurrency, formatPercentage, formatMonth: formatMonthValue } = useFormatters();
  const formatMonth = (month: string) => {
    const parsed = new Date(`${month} 1`);
    return Number.isNaN(parsed.getTime()) ? month : formatMonthValue(parsed.toISOString());
  };

  // Recomputed only when the positions change: the nesting walks every
  // position twice and the analytics page re-renders on every filter tick.
  const treemap = React.useMemo(() => buildTreemapModel(positions ?? []), [positions]);
  const treemapSeries = React.useMemo(() => toTreemapSeries(treemap), [treemap]);
  const concentration = React.useMemo(() => largestConcentration(treemap), [treemap]);

  const benchmarks = React.useMemo(
    () => benchmarkConfig ?? getBenchmarkConfig(),
    [benchmarkConfig]
  );

  // Guard against a failed dynamic import (offline / degraded network). The
  // chart primitives are only fetched when a chart is actually rendered, so a
  // failure here must degrade gracefully rather than crash the page.
  const [chartsFailed, setChartsFailed] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    import("@/components/analytics/chartPrimitives").catch(() => {
      if (!cancelled) setChartsFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (chartsFailed) {
    return (
      <motion.div
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("charts.titles.portfolio")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartLoadError message={t("charts.loadError")} />
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.3 }}
    >
      {/* Portfolio Growth & Yield Row */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Portfolio Growth */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("charts.titles.portfolio")}</CardTitle>
            {onExport && (
              <button
                type="button"
                onClick={() => onExport("portfolio")}
                className="rounded-md p-2 transition-colors hover:bg-muted"
                aria-label={t("a11y.exportPortfolio")}
              >
                <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton height={chartHeight} />
            ) : portfolio.length === 0 ? (
              <EmptyState message={t("charts.empty.portfolio")} />
            ) : (
              <ChartFigure
                label={describeSeries(
                  t("charts.titles.portfolio"),
                  portfolio,
                  "month",
                  "value",
                  (v) => formatCurrency(v, "USDC"), t, formatMonth
                )}
              >
                <ChartPrimitives
                  kind="portfolio"
                  data={portfolio}
                  height={chartHeight}
                  reducedMotion={!!reducedMotion}
                  formatCurrency={(v) => formatCurrency(v, "USDC")}
                  formatMonth={formatMonth}
                  valueLabel={t("charts.series.value")}
                />
              </ChartFigure>
            )}
          </CardContent>
        </Card>

        {/* Yield */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("charts.titles.yield")}</CardTitle>
            {onExport && (
              <button
                type="button"
                onClick={() => onExport("yield")}
                className="rounded-md p-2 transition-colors hover:bg-muted"
                aria-label={t("a11y.exportYield")}
              >
                <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton height={chartHeight} />
            ) : yieldData.length === 0 ? (
              <EmptyState message={t("charts.empty.yield")} />
            ) : (
              <ChartFigure
                label={describeSeries(
                  t("charts.titles.yield"),
                  yieldData,
                  "month",
                  "yield",
                  (v) => formatPercentage(v), t, formatMonth
                )}
              >
                <ChartPrimitives
                  kind="yield"
                  data={yieldData}
                  height={chartHeight}
                  reducedMotion={!!reducedMotion}
                  formatPercentage={formatPercentage}
                  valueLabel={t("charts.series.yield")}
                />
              </ChartFigure>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Risk & Monthly Returns Row */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Risk Distribution */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("charts.titles.risk")}</CardTitle>
            {onExport && (
              <button
                type="button"
                onClick={() => onExport("risk")}
                className="rounded-md p-2 transition-colors hover:bg-muted"
                aria-label={t("a11y.exportRisk")}
              >
                <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton height={chartHeight} />
            ) : risk.length === 0 ? (
              <EmptyState message={t("charts.empty.risk")} />
            ) : (
              <ChartFigure label={describeDistribution(t("charts.titles.risk"), risk, formatPercentage, t)}>
                <ChartPrimitives
                  kind="risk"
                  data={risk}
                  height={chartHeight}
                  reducedMotion={!!reducedMotion}
                  formatPercentage={formatPercentage}
                  onRiskSegmentClick={onRiskSegmentClick}
                  segmentLabel={(name, value) => t("chartA11y.segment", { name, value })}
                  allocationLabel={t("charts.series.allocation")}
                />
              </ChartFigure>
            )}
          </CardContent>
        </Card>

        {/* Monthly Returns */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("charts.titles.monthly")}</CardTitle>
            {onExport && (
              <button
                type="button"
                onClick={() => onExport("monthly")}
                className="rounded-md p-2 transition-colors hover:bg-muted"
                aria-label={t("a11y.exportMonthly")}
              >
                <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton height={chartHeight} />
            ) : monthly.length === 0 ? (
              <EmptyState message={t("charts.empty.monthly")} />
            ) : (
              <ChartFigure
                label={describeSeries(
                  t("charts.titles.monthly"),
                  monthly,
                  "month",
                  "return",
                  (v) => formatPercentage(v), t, formatMonth
                )}
              >
                <ChartPrimitives
                  kind="monthly"
                  data={monthly}
                  height={chartHeight}
                  reducedMotion={!!reducedMotion}
                  formatPercentage={formatPercentage}
                  valueLabel={t("charts.series.return")}
                />
              </ChartFigure>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Allocation Treemap (#600) */}
      {positions && positions.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">{t("charts.titles.allocation")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton height={chartHeight} />
            ) : treemapSeries.length === 0 ? (
              <EmptyState message={t("charts.empty.allocation")} />
            ) : (
              <ChartFigure label={describeTreemap(
                treemap,
                (value) => formatCurrency(value, "USDC"),
                formatPercentage,
                (key, values) => (t as unknown as (key: string, values?: Record<string, string | number>) => string)(key, values)
              )}>
                <ChartPrimitives
                  kind="treemap"
                  data={treemapSeries}
                  height={chartHeight}
                  reducedMotion={!!reducedMotion}
                />
              </ChartFigure>
            )}
            {concentration !== null && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("treemap.concentration", { percent: formatPercentage(concentration) })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Benchmark Comparison (#603) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("charts.titles.benchmark")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ChartSkeleton height={chartHeight} />
          ) : portfolio.length === 0 ? (
            <EmptyState message={t("charts.empty.benchmark")} />
          ) : (
            <ChartFigure
              label={describeSeries(
                t("charts.titles.benchmark"),
                portfolio,
                "month",
                "value",
                (v) => formatCurrency(v, "USDC"), t, formatMonth
              )}
            >
              <ChartPrimitives
                kind="benchmark"
                data={portfolio}
                height={chartHeight}
                reducedMotion={!!reducedMotion}
                formatCurrency={(v) => formatCurrency(v, "USDC")}
                valueLabel={t("charts.series.value")}
                portfolioLabel={t("charts.series.portfolio")}
                benchmark={benchmarks.primary}
              />
            </ChartFigure>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{BENCHMARK_DISCLOSURE}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
