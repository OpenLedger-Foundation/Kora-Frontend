import { cn } from "@/lib/utils";

// ─── Base ─────────────────────────────────────────────────────────────────────

/**
 * Base skeleton block. Uses shimmer animation by default; falls back to
 * animate-pulse when the shimmer gradient isn't available.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-zinc-800/60",
        "bg-[length:200%_100%] bg-gradient-to-r from-zinc-800/60 via-zinc-700/40 to-zinc-800/60",
        "animate-shimmer",
        className
      )}
      {...props}
    />
  );
}

// ─── StatCardSkeleton ─────────────────────────────────────────────────────────
// Matches StatCard: rounded-xl border p-5, label row + value

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded-sm" />
      </div>
      <Skeleton className="mt-2 h-8 w-32" />
    </div>
  );
}

// ─── TableRowSkeleton ─────────────────────────────────────────────────────────
// Matches DataTable row: 5 cells of varying widths

function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  const widths = ["w-28", "w-24", "w-20", "w-16", "w-12"];
  return (
    <div className="flex items-center gap-4 border-b border-border px-4 py-3">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4 flex-1", widths[i % widths.length])} />
      ))}
    </div>
  );
}

// ─── TableSkeleton ────────────────────────────────────────────────────────────

function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border bg-muted/30 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1 max-w-[80px]" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} cols={cols} />
      ))}
    </div>
  );
}

// ─── ChartSkeleton ────────────────────────────────────────────────────────────
// Matches the recharts area/bar chart containers used in analytics

function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-5">
      {/* Title row */}
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-16" />
      </div>
      {/* Chart area */}
      <div className="relative overflow-hidden rounded-lg" style={{ height }}>
        <Skeleton className="h-full w-full rounded-lg" />
        {/* Fake y-axis lines */}
        <div className="absolute inset-0 flex flex-col justify-between px-2 py-3 pointer-events-none">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-px w-full bg-zinc-700/30" />
          ))}
        </div>
      </div>
      {/* X-axis labels */}
      <div className="mt-3 flex justify-between">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  );
}

// ─── InvoiceDetailSkeleton ────────────────────────────────────────────────────
// Matches the 2/3 + 1/3 grid layout of the invoice detail page

function InvoiceDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Back link */}
      <Skeleton className="mb-6 h-4 w-32" />

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left col — 3 cards */}
        <div className="space-y-6 lg:col-span-2">
          {/* Header card */}
          <div className="rounded-xl border border-border bg-card/60 p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
              <div className="flex gap-2 shrink-0">
                <Skeleton className="h-6 w-14 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
            <Skeleton className="h-4 w-40 mt-2" />
          </div>

          {/* Financing terms card */}
          <div className="rounded-xl border border-border bg-card/60 p-6 space-y-4">
            <Skeleton className="h-5 w-36" />
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="rounded-lg bg-zinc-800/50 p-3 space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>

          {/* Funding progress card */}
          <div className="rounded-xl border border-border bg-card/60 p-6 space-y-4">
            <Skeleton className="h-5 w-40" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="grid grid-cols-3 gap-4 pt-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right col — fund panel */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card/60 p-6 space-y-4">
            <Skeleton className="h-5 w-28" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
            <div className="space-y-2 pt-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
            <Skeleton className="h-10 w-full rounded-lg mt-2" />
          </div>
          <div className="rounded-xl border border-border bg-card/60 p-6 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DashboardSkeleton ────────────────────────────────────────────────────────
// Matches the 4-stat grid + table layout used in both dashboards

function DashboardSkeleton({ statCount = 4, tableRows = 5, tableCols = 6 }: {
  statCount?: number;
  tableRows?: number;
  tableCols?: number;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      {/* Stat cards */}
      <div className={`mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-${statCount}`}>
        {Array.from({ length: statCount }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Table card */}
      <div className="rounded-xl border border-border bg-card/60">
        <div className="border-b border-border px-6 py-4">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="p-4 sm:p-6">
          <TableSkeleton rows={tableRows} cols={tableCols} />
        </div>
      </div>
    </div>
  );
}

// ─── AnalyticsSkeleton ────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Range + export controls */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-10 rounded-md" />
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-36 rounded-md" />
          <Skeleton className="h-7 w-32 rounded-md" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Charts */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <ChartSkeleton height={240} />
        <ChartSkeleton height={240} />
      </div>
      <ChartSkeleton height={200} />
    </div>
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  Skeleton,
  StatCardSkeleton,
  TableRowSkeleton,
  TableSkeleton,
  ChartSkeleton,
  InvoiceDetailSkeleton,
  DashboardSkeleton,
  AnalyticsSkeleton,
  // legacy aliases
  StatCardSkeleton as CardSkeleton,
  StatCardSkeleton as SkeletonCard,
};
