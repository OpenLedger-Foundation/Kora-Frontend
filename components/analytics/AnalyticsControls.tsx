"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Filter, Download, FileText, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRovingTabIndex } from "@/hooks/useRovingTabIndex";

type DateRange = "7d" | "30d" | "90d" | "all";

interface AnalyticsControlsProps {
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  isLoading?: boolean;
  onExportPortfolio?: () => void;
  onExportYield?: () => void;
  onExportRisk?: () => void;
  onExportMonthly?: () => void;
  onReset?: () => void;
  /**
   * Download the branded PDF portfolio digest (#602).
   *
   * Given its own labelled button rather than another icon in the export row:
   * the digest is a different artefact from the per-chart CSVs — one document
   * covering the whole filtered portfolio — and burying it behind a fifth
   * identical download glyph would make it undiscoverable.
   */
  onDownloadDigest?: () => void;
  /** True while the PDF is being generated, to disable the button. */
  isGeneratingDigest?: boolean;
}

export function AnalyticsControls({
  range,
  onRangeChange,
  isLoading,
  onExportPortfolio,
  onExportYield,
  onExportRisk,
  onExportMonthly,
  onReset,
  onDownloadDigest,
  isGeneratingDigest = false,
}: AnalyticsControlsProps) {
  const t = useTranslations("analytics");
  const shouldReduceMotion = useReducedMotion();
  const hoverScale = shouldReduceMotion ? undefined : { scale: 1.05 };
  const tapScale = shouldReduceMotion ? undefined : { scale: 0.95 };
  const ranges: Array<{ value: DateRange; label: string; description: string }> = [
    { value: "7d", label: t("range.7d.label"), description: t("range.7d.description") },
    { value: "30d", label: t("range.30d.label"), description: t("range.30d.description") },
    { value: "90d", label: t("range.90d.label"), description: t("range.90d.description") },
    { value: "all", label: t("range.all.label"), description: t("range.all.description") },
  ];
  const { getTabIndex, onKeyDown: onRangeKeyDown } = useRovingTabIndex({
    count: ranges.length,
    orientation: "horizontal",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      {/* Date Range Filter */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span id="analytics-period-label" className="text-sm font-medium text-muted-foreground">
          {t("periodLabel")}
        </span>
        <div
          role="group"
          aria-labelledby="analytics-period-label"
          className="flex gap-1.5"
          onKeyDown={onRangeKeyDown}
        >
          {ranges.map((r, index) => {
            const isSelected = range === r.value;
            return (
              <motion.button
                key={r.value}
                type="button"
                onClick={() => onRangeChange(r.value)}
                disabled={isLoading}
                whileHover={hoverScale}
                whileTap={tapScale}
                title={r.description}
                tabIndex={getTabIndex(index)}
                aria-pressed={isSelected}
                aria-label={t("a11y.rangeFilter", { label: r.label, description: r.description })}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                {r.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Export & Reset Controls */}
      <div className="flex items-center gap-2">
        {onDownloadDigest && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDownloadDigest}
            disabled={isLoading || isGeneratingDigest}
            className="gap-1.5"
            aria-label={t("a11y.downloadDigest")}
            title={t("a11y.downloadDigestTitle")}
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-xs">
              {isGeneratingDigest ? t("digest.generating") : t("digest.label")}
            </span>
          </Button>
        )}

        {onReset && (
          <motion.button
            type="button"
            onClick={onReset}
            disabled={isLoading}
            whileHover={hoverScale}
            whileTap={tapScale}
            className="rounded-lg p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t("a11y.resetFilters")}
            title={t("a11y.resetFiltersTitle")}
          >
            <RotateCcw className="h-4 w-4 text-muted-foreground hover:text-foreground" aria-hidden="true" />
          </motion.button>
        )}

        {/* Export Menu */}
        <div className="hidden gap-1 border-l border-border/50 pl-2 sm:flex">
          {[
            { onClick: onExportPortfolio, key: "portfolio" },
            { onClick: onExportYield, key: "yield" },
            { onClick: onExportRisk, key: "risk" },
            { onClick: onExportMonthly, key: "returns" },
          ].map(
            (item) =>
              item.onClick && (
                <motion.button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  disabled={isLoading}
                  whileHover={hoverScale}
                  whileTap={tapScale}
                  className="rounded-lg p-2 text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={t("a11y.exportData", { label: t(`export.${item.key}`) })}
                  title={t("a11y.exportDataTitle", { label: t(`export.${item.key}`) })}
                >
                  <Download className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" aria-hidden="true" />
                </motion.button>
              )
          )}
        </div>
      </div>
    </motion.div>
  );
}
