"use client";

import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ChartTooltip from "@/components/analytics/ChartTooltip";

  const TOOLTIP_STYLE = {
    contentStyle: {
      backgroundColor: "#18181b",
      border: "1px solid #27272a",
      borderRadius: "8px",
      color: "#e4e4e7",
      fontSize: "12px",
    },
  };
  import ChartTooltip from "@/components/analytics/ChartTooltip";

export default function Charts({
  portfolio,
  yieldData,
  risk,
  monthly,
  compact = false,
}: any) {
  const { isMobile, isTablet } = useBreakpoint();
  
  // Responsive configuration
  const chartHeight = compact ? 180 : isMobile ? 200 : isTablet ? 220 : 240;
  const fontSize = isMobile ? 10 : 11;
  const tickCount = isMobile ? 3 : isTablet ? 4 : 6;
  
  return (
    <>
      <div className={`mb-6 grid gap-6 ${isMobile ? 'grid-cols-1' : 'lg:grid-cols-2'}`}>
        <div>
          <Card>
            <CardHeader>
              <CardTitle className={isMobile ? "text-sm" : "text-base"}>Portfolio Growth (USDC)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <AreaChart data={portfolio}>
                  <defs>
                    <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip {...TOOLTIP_STYLE} content={<ChartTooltip unit="USDC" />} formatter={(v: number) => [`$${v.toLocaleString()}`, "Portfolio"]} />
                  <Area type="monotone" dataKey="value" stroke="#14b8a6" strokeWidth={2} fill="url(#portfolioGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className={isMobile ? "text-sm" : "text-base"}>Monthly Yield Earned (USDC)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={yieldData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                  <Tooltip {...TOOLTIP_STYLE} content={<ChartTooltip unit="USDC" />} formatter={(v: number) => [`$${v.toLocaleString()}`, "Yield"]} />
                  <Bar dataKey="yield" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'lg:grid-cols-3'}`}>
        <div>
          <Card>
            <CardHeader>
              <CardTitle className={isMobile ? "text-sm" : "text-base"}>Risk Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={compact ? 140 : isMobile ? 160 : 180}>
                <PieChart>
                  <Pie 
                    data={risk} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={isMobile ? 40 : 50} 
                    outerRadius={compact ? 60 : isMobile ? 65 : 75} 
                    paddingAngle={3} 
                    dataKey="value"
                  >
                    {risk.map((entry: any) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} content={<ChartTooltip unit="" />} formatter={(v: number) => [`${v}%`, "Allocation"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className={`mt-2 grid gap-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {risk.map((d: any) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-zinc-400">{d.name}</span>
                    <span className="ml-auto text-zinc-300">{d.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className={isMobile ? "text-sm" : "text-base"}>Monthly Return Rate (%)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <AreaChart data={monthly}>
                  <defs>
                    <linearGradient id="returnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip {...TOOLTIP_STYLE} content={<ChartTooltip unit="" />} formatter={(v: number) => [`${v}%`, "Return"]} />
                  <Area type="monotone" dataKey="return" stroke="#818cf8" strokeWidth={2} fill="url(#returnGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}