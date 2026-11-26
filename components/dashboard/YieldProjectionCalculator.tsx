"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { 
  calculateYieldProjection, 
  RISK_TIER_APR,
  YIELD_BENCHMARKS
} from "@/lib/utils";
import { Download, Info } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useFormatters } from "@/hooks/useFormatters";
import { useLocale } from "@/i18n/LocaleProvider";

const RISK_TIERS = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC"];

const ChartSkeleton = () => (
  <div
    className="h-[350px] w-full animate-pulse rounded-lg bg-muted/40"
    role="status"
    aria-busy="true"
    data-testid="yield-projection-chart-skeleton"
  />
);

const YieldProjectionChart = dynamic(
  () => import("./YieldProjectionChart").then((mod) => mod.YieldProjectionChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  }
);

export interface YieldProjectionCalculatorProps {
  defaultTier?: string;
}

export function YieldProjectionCalculator({ defaultTier = "A" }: YieldProjectionCalculatorProps = {}) {
  const t = useTranslations("yieldProjection");
  const [amount, setAmount] = useState<number>(10000);
  const [tier, setTier] = useState<string>(defaultTier);
  const [horizon, setHorizon] = useState<number>(12);

  useEffect(() => {
    setTier(defaultTier);
  }, [defaultTier]);
  const chartRef = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const { formatCurrency, formatPercentage, formatNumber } = useFormatters();

  const projection = useMemo(() => {
    return calculateYieldProjection(amount, tier, horizon, locale);
  }, [amount, tier, horizon, locale]);

  const handleExport = async () => {
    if (!chartRef.current) return;

    try {
      const svg = chartRef.current.querySelector("svg");
      if (!svg) throw new Error("SVG not found");

      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      const svgSize = svg.getBoundingClientRect();
      // Increase resolution for better quality
      const scale = 2;
      canvas.width = svgSize.width * scale;
      canvas.height = svgSize.height * scale;

      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        if (ctx) {
          // Fill background
          ctx.fillStyle = "#09090b"; // slate-950
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw image
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const pngUrl = canvas.toDataURL("image/png");
          const downloadLink = document.createElement("a");
          downloadLink.href = pngUrl;
          downloadLink.download = `yield-projection-${tier}-${horizon}m.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          URL.revokeObjectURL(url);
          toast.success(t("exportSuccess"));
        }
      };
      img.src = url;
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(t("exportError"));
    }
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl font-bold">Yield Projection Calculator</CardTitle>
            <CardDescription>Model hypothetical returns and compare with benchmarks</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} className="w-fit gap-2">
            <Download className="h-4 w-4" />
            Save Projection
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-8 lg:grid-cols-4">
          {/* Inputs */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Investment Amount (USDC)</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="e.g. 10000"
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Select
                label="Risk Tier Preference"
                value={tier}
                onChange={setTier}
                options={RISK_TIERS.map((t) => ({
                  value: t,
                  label: `Tier ${t} (${RISK_TIER_APR[t]}% APR)`,
                }))}
              />
            </div>
            <div className="space-y-2">
              <Select
                label="Horizon (Months)"
                value={horizon.toString()}
                onChange={(v) => setHorizon(Number(v))}
                options={[3, 6, 12, 18, 24, 36].map((m) => ({
                  value: m.toString(),
                  label: `${m} Months`,
                }))}
              />
            </div>

            <div className="rounded-lg bg-muted/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="h-3 w-3" />
                <span>Assumptions</span>
              </div>
              <p className="text-[10px] leading-relaxed text-muted-foreground/80">
                Calculations based on historical average APR for {tier} tier ({RISK_TIER_APR[tier]}%). 
                Benchmarks: Savings ({YIELD_BENCHMARKS.SAVINGS_APY}% APY), T-Bills ({YIELD_BENCHMARKS.T_BILLS_APY}% APY).
                Compound interest applied monthly.
              </p>
            </div>
          </div>

          {/* Chart & Stats */}
          <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">Projected Total Yield</p>
                <p className="text-lg font-bold text-teal-500">
                  +{formatCurrency(projection.totalYield, "USDC")}
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">Annualized Return</p>
                <p className="text-lg font-bold text-primary">
                  {formatPercentage(projection.annualizedReturn)}
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">Invoices Needed</p>
                <p className="text-lg font-bold text-foreground">
                  ~{projection.invoicesNeeded}
                </p>
              </div>
            </div>

            <div className="h-[350px] w-full" ref={chartRef}>
              {projection.data.length > 0 ? (
                <YieldProjectionChart
                  data={projection.data}
                  locale={locale}
                  formatCurrency={formatCurrency}
                  formatNumber={formatNumber}
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground"
                  role="status"
                  data-testid="yield-projection-chart-empty"
                >
                  {t("noData")}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
