"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Database } from "lucide-react";
import { useTranslations } from "next-intl";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { useIndexerWatermark } from "@/hooks/useIndexerWatermark";

/**
 * Shows when the live indexer last synced, and warns when the data is stale
 * so investors don't fund against outdated availability.
 */
export function IndexerWatermark({ className }: { className?: string }) {
  const t = useTranslations("marketplace.indexer");
  const { ledger, syncedAt, isStale } = useIndexerWatermark();

  if (env.NEXT_PUBLIC_ENABLE_MOCK_DATA || syncedAt === null) return null;

  const time = formatDistanceToNow(syncedAt, { addSuffix: true });
  const Icon = isStale ? AlertTriangle : Database;

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        isStale ? "text-amber-400" : "text-zinc-500",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {isStale ? t("stale", { time }) : t("synced", { time, ledger })}
    </p>
  );
}
