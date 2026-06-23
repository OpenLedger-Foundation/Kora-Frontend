"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, Tooltip } from "recharts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RiskFactor {
  key: string;
  label: string;
  score: number;
}

interface RiskScoreGaugeProps {
  score: number;
  tier: string;
  factors: RiskFactor[];
  trend: number[];
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function tierVariant(tier: string): "success" | "warning" | "danger" {
  if (tier === "AAA" || tier === "AA" || tier === "A") return "success";
  if (tier === "BBB" || tier === "BB") return "warning";
  return "danger";
}

function scoreColor(score: number) {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

export function RiskScoreGauge({ score, tier, factors, trend }: RiskScoreGaugeProps) {
  const [expanded, setExpanded] = useState(false);

  const boundedScore = clamp(score);
  const radius = 62;
  const circumference = Math.PI * radius;
  const dashOffset = circumference * (1 - boundedScore / 100);

  const trendData = useMemo(
    () =>
      trend.slice(-5).map((value, idx) => ({
        index: idx + 1,
        score: clamp(value),
      })),
    [trend]
  );

  return (
    <div className="space-y-4">
      <div className="relative mx-auto w-full max-w-[230px] pt-4">
        <svg viewBox="0 0 160 100" className="h-36 w-full" role="img" aria-label={`Risk score ${boundedScore} out of 100`}>
          <defs>
            <linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <path
            d="M 18 82 A 62 62 0 0 1 142 82"
            fill="none"
            stroke="rgba(148, 163, 184, 0.2)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <motion.path
            d="M 18 82 A 62 62 0 0 1 142 82"
            fill="none"
            stroke="url(#riskGradient)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ type: "spring", damping: 22, stiffness: 90 }}
          />
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-5">
          <span className="text-4xl font-bold" style={{ color: scoreColor(boundedScore) }}>
            {boundedScore}
          </span>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Risk score</span>
          <Badge variant={tierVariant(tier)} className="mt-2 px-2 py-0.5 text-[11px] font-semibold">
            Tier {tier}
          </Badge>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-controls="risk-score-breakdown"
        className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
      >
        <span>Score Breakdown</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
      </button>

      {expanded && (
        <div id="risk-score-breakdown" className="space-y-2 rounded-lg border border-border bg-card p-3">
          {factors.map((factor) => (
            <div key={factor.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{factor.label}</span>
                <span className="font-medium text-foreground">{factor.score}/100</span>
              </div>
              <div className="h-1.5 w-full rounded bg-muted">
                <div
                  className="h-1.5 rounded"
                  style={{ width: `${clamp(factor.score)}%`, backgroundColor: scoreColor(factor.score) }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-3">
        <p className="mb-2 text-xs text-muted-foreground">Historical risk trend (last 5 invoices)</p>
        <div className="h-16 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <Tooltip
                cursor={false}
                formatter={(value: number) => [`${value}/100`, "Score"]}
                labelFormatter={(label) => `Invoice ${label}`}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={{ r: 2, fill: "#38bdf8" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
