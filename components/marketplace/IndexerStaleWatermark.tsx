"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useIndexerStaleness } from "@/hooks/useIndexerStaleness";
import { cn } from "@/lib/utils";

interface IndexerStaleWatermarkProps {
  className?: string;
}

/**
 * Freshness watermark for the live event indexer (#1244).
 *
 * Renders nothing in mock mode or before the first successful sync, so a
 * missing indexer never presents itself as healthy or as stale. Once synced,
 * the header shows how old the availability data is and turns amber when it
 * passes the stale threshold.
 */
export function IndexerStaleWatermark({ className }: IndexerStaleWatermarkProps) {
  const t = useTranslations("marketplace.indexerWatermark");
  const { lastSyncedAt, isStale } = useIndexerStaleness();

  if (!lastSyncedAt) return null;

  const relativeTime = formatDistanceToNow(lastSyncedAt, { addSuffix: true });
  const Icon = isStale ? AlertTriangle : Clock;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
        isStale
          ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
          : "border-zinc-700/60 bg-zinc-900/40 text-zinc-400",
        className
      )}
      role="status"
      aria-live="polite"
      data-testid="indexer-staleness"
      data-stale={isStale ? "true" : "false"}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      <span>
        {isStale ? t("stale", { time: relativeTime }) : t("fresh", { time: relativeTime })}
      </span>
    </div>
  );
}

export default IndexerStaleWatermark;
