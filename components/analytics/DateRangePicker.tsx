"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type PresetRange = "7d" | "30d" | "90d" | "1y" | "ytd" | "all";

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface DateRangePickerProps {
  value: PresetRange | "custom";
  customRange?: DateRange;
  onChange: (preset: PresetRange | "custom", range?: DateRange) => void;
  className?: string;
}

const PRESETS: { labelKey: string; value: PresetRange }[] = [
  { labelKey: "presets.days7", value: "7d" },
  { labelKey: "presets.days30", value: "30d" },
  { labelKey: "presets.days90", value: "90d" },
  { labelKey: "presets.year", value: "1y" },
  { labelKey: "presets.ytd", value: "ytd" },
  { labelKey: "presets.all", value: "all" },
];

/**
 * DateRangePicker — preset range chips + optional custom date inputs.
 * Shows a validation error when "from" is after "to" in custom mode.
 */
export function DateRangePicker({ value, customRange, onChange, className }: DateRangePickerProps) {
  const t = useTranslations("analytics");
  const translate = t as unknown as (key: string) => string;
  const [showCustom, setShowCustom] = React.useState(value === "custom");
  const [from, setFrom] = React.useState(customRange?.from ?? null);
  const [to, setTo] = React.useState(customRange?.to ?? null);

  const rangeError =
    showCustom && from && to && from > to
      ? t("validation.invalidRange")
      : null;

  const handlePreset = (preset: PresetRange) => {
    setShowCustom(false);
    onChange(preset);
  };

  const handleCustomApply = () => {
    if (from && to && from <= to) {
      onChange("custom", { from, to });
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {PRESETS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => handlePreset(p.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === p.value
              ? "bg-primary text-primary-foreground"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          )}
        >
          {translate(p.labelKey)}
        </button>
      ))}

      <button
        type="button"
        onClick={() => setShowCustom((v) => !v)}
        className={cn(
          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
          value === "custom"
            ? "bg-primary text-primary-foreground"
            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
        )}
      >
        {t("presets.custom")}
      </button>

      {showCustom && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={from ? from.toISOString().split("T")[0] : ""}
              onChange={(e) => setFrom(e.target.value ? new Date(e.target.value) : null)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
              aria-label={t("a11y.fromDate")}
            />
            <span className="text-xs text-zinc-500">–</span>
            <input
              type="date"
              value={to ? to.toISOString().split("T")[0] : ""}
              onChange={(e) => setTo(e.target.value ? new Date(e.target.value) : null)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
              aria-label={t("a11y.toDate")}
            />
            <button
              type="button"
              onClick={handleCustomApply}
              disabled={!from || !to || !!rangeError}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40"
            >
              {t("presets.apply")}
            </button>
          </div>
          {rangeError && (
            <p className="text-xs text-destructive" role="alert">
              {rangeError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
