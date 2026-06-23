"use client";

/**
 * WebVitalsPanel — development-only collapsible overlay that displays live
 * Core Web Vitals readings with pass/fail colouring.
 *
 * Rendered only when process.env.NODE_ENV === "development".
 * Uses a global event bus (CustomEvent "kora:webvital") so it can receive
 * metrics from the reportWebVitals export in layout.tsx without prop-drilling.
 */

import React, { useEffect, useReducer, useState } from "react";
import { cn } from "@/lib/utils";
import { getVitalRating, VITAL_THRESHOLDS, type VitalRating } from "@/lib/webVitals";
import type { NextWebVitalsMetric } from "next/app";
import { ChevronDown, ChevronUp, Activity, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VitalEntry {
  name: string;
  value: number;
  rating: VitalRating;
  unit: string;
  displayValue: string;
  updatedAt: number;
}

type VitalsMap = Record<string, VitalEntry>;

// ─── Reducer ─────────────────────────────────────────────────────────────────

function vitalsReducer(state: VitalsMap, metric: NextWebVitalsMetric): VitalsMap {
  const { name, value } = metric;
  const threshold = VITAL_THRESHOLDS[name];
  const unit = threshold?.unit ?? "";
  const displayValue = name === "CLS" ? value.toFixed(4) : `${Math.round(value)}${unit}`;
  return {
    ...state,
    [name]: {
      name,
      value,
      rating: getVitalRating(name, value),
      unit,
      displayValue,
      updatedAt: Date.now(),
    },
  };
}

// ─── Styling helpers ──────────────────────────────────────────────────────────

const RATING_DOT: Record<VitalRating, string> = {
  "good":              "bg-emerald-500",
  "needs-improvement": "bg-amber-400",
  "poor":              "bg-red-500",
};

const RATING_TEXT: Record<VitalRating, string> = {
  "good":              "text-emerald-400",
  "needs-improvement": "text-amber-400",
  "poor":              "text-red-400",
};

const RATING_LABEL: Record<VitalRating, string> = {
  "good":              "PASS",
  "needs-improvement": "WARN",
  "poor":              "FAIL",
};

// Ordered display list
const VITAL_ORDER = ["LCP", "FID", "INP", "CLS", "TTFB"];

// ─── Component ────────────────────────────────────────────────────────────────

export function WebVitalsPanel() {
  const [vitals, dispatch] = useReducer(vitalsReducer, {} as VitalsMap);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function onVital(e: Event) {
      const metric = (e as CustomEvent<NextWebVitalsMetric>).detail;
      dispatch(metric);
    }
    window.addEventListener("kora:webvital", onVital);
    return () => window.removeEventListener("kora:webvital", onVital);
  }, []);

  if (dismissed) return null;

  const entries = VITAL_ORDER.map((name) => vitals[name]).filter(Boolean) as VitalEntry[];
  const hasAnyPoor = entries.some((e) => e.rating === "poor");
  const hasAnyWarn = entries.some((e) => e.rating === "needs-improvement");
  const overallBadge = hasAnyPoor ? "poor" : hasAnyWarn ? "needs-improvement" : "good";

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 z-[9999] w-64 rounded-xl border shadow-2xl",
        "bg-zinc-950/95 backdrop-blur-md border-zinc-800 text-zinc-100",
        "font-mono text-xs select-none"
      )}
      role="region"
      aria-label="Web Vitals Dev Panel"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer rounded-t-xl hover:bg-zinc-900/60 transition-colors"
        onClick={() => setCollapsed((c) => !c)}
        role="button"
        aria-expanded={!collapsed}
        aria-controls="web-vitals-body"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-teal-400" />
          <span className="font-semibold text-zinc-200 tracking-wide">Web Vitals</span>
          {entries.length > 0 && (
            <span
              className={cn(
                "rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                overallBadge === "good" && "bg-emerald-500/20 text-emerald-400",
                overallBadge === "needs-improvement" && "bg-amber-500/20 text-amber-400",
                overallBadge === "poor" && "bg-red-500/20 text-red-400"
              )}
            >
              {RATING_LABEL[overallBadge]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {collapsed ? (
            <ChevronUp className="h-3.5 w-3.5 text-zinc-500" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
          )}
          <button
            className="ml-1 rounded p-0.5 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
            aria-label="Dismiss Web Vitals panel"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div id="web-vitals-body" className="px-3 pb-3 pt-1 space-y-1.5">
          {entries.length === 0 ? (
            <p className="text-zinc-500 text-[10px] py-2 text-center">
              Waiting for metrics…
              <br />
              <span className="text-zinc-600">Navigate or interact with the page</span>
            </p>
          ) : (
            entries.map((entry) => {
              const threshold = VITAL_THRESHOLDS[entry.name];
              return (
                <div
                  key={entry.name}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 bg-zinc-900/60"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", RATING_DOT[entry.rating])} />
                    <span className="text-zinc-400 w-8 flex-shrink-0">{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("font-bold tabular-nums", RATING_TEXT[entry.rating])}>
                      {entry.displayValue}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] font-bold uppercase tracking-wider px-1 rounded",
                        entry.rating === "good" && "text-emerald-500/70",
                        entry.rating === "needs-improvement" && "text-amber-500/70",
                        entry.rating === "poor" && "text-red-500/70"
                      )}
                    >
                      {RATING_LABEL[entry.rating]}
                    </span>
                  </div>
                </div>
              );
            })
          )}

          {/* Legend */}
          {entries.length > 0 && (
            <div className="pt-1 border-t border-zinc-800 flex items-center justify-between text-[9px] text-zinc-600">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> good
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> warn
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> poor
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
