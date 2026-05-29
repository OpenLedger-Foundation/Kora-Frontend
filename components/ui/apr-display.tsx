"use client";

import React, { useState } from "react";
import { Info } from "lucide-react";
import {
  calculateAPR,
  calculateRiskAdjustedReturn,
  getAPRColor,
  formatApr,
} from "@/lib/utils";
import { cn } from "@/lib/utils";

interface APRDisplayProps {
  discountRate: number; // As decimal, e.g., 0.05 for 5%
  daysToMaturity: number;
  riskTier?: string;
  showRiskAdjusted?: boolean;
  size?: "sm" | "md" | "lg";
  compact?: boolean;
}

interface TooltipState {
  show: boolean;
  x: number;
  y: number;
}

/**
 * APRDisplay component shows effective APR with color coding and optional tooltip.
 * Used in InvoiceCard, marketplace detail, and dashboards.
 */
export function APRDisplay({
  discountRate,
  daysToMaturity,
  riskTier,
  showRiskAdjusted = false,
  size = "md",
  compact = false,
}: APRDisplayProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({ show: false, x: 0, y: 0 });

  const apr = calculateAPR(discountRate, daysToMaturity);
  const riskAdjustedApr = riskTier ? calculateRiskAdjustedReturn(apr, riskTier) : apr;
  const displayApr = showRiskAdjusted ? riskAdjustedApr : apr;

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      show: true,
      x: rect.left,
      y: rect.bottom + 8,
    });
  };

  const handleMouseLeave = () => {
    setTooltip({ ...tooltip, show: false });
  };

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const aprColor = getAPRColor(displayApr);

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-center gap-1">
        <span className={cn("font-semibold", sizeClasses[size], aprColor)}>
          {formatApr(displayApr)}
        </span>
        <Info className="w-4 h-4 text-muted-foreground cursor-help" />
      </div>

      {/* Tooltip */}
      {tooltip.show && (
        <div
          className="fixed z-50 bg-slate-900 text-slate-50 px-3 py-2 rounded-md text-sm whitespace-nowrap shadow-lg border border-slate-700"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
          }}
        >
          <div className="font-semibold">APR Calculation Breakdown</div>
          <div className="text-xs text-slate-300 mt-1">
            <div>Discount Rate: {(discountRate * 100).toFixed(2)}%</div>
            <div>Days to Maturity: {daysToMaturity}</div>
            <div className="mt-1 border-t border-slate-700 pt-1">
              <div>Base APR: {formatApr(apr)}</div>
              {riskTier && showRiskAdjusted && (
                <div>Risk Tier ({riskTier}): {formatApr(riskAdjustedApr)}</div>
              )}
            </div>
          </div>
          {/* Tooltip arrow */}
          <div
            className="absolute w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900"
            style={{
              left: "20px",
              top: "-4px",
            }}
          />
        </div>
      )}
    </div>
  );
}
