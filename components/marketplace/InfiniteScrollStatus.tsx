"use client";

/**
 * Accessible status region for the marketplace infinite scroll.
 *
 * Visually-appended lists are silent for screen-reader users: cards simply
 * appear. This component pairs the visible loading / end-of-list / retry copy
 * with a `role="status"` `aria-live="polite"` region so users hear:
 *  - how many new invoices just loaded, and
 *  - when the end of the list is reached.
 *
 * The announcement is derived from the *change* in `loadedCount` and always
 * includes the running total, so two consecutive batches of the same size still
 * produce different text (otherwise the live region would fall silent).
 */

import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface InfiniteScrollStatusProps {
  /** Total number of items currently rendered in the list. */
  loadedCount: number;
  /** Whether another page is available to load. */
  hasNextPage: boolean;
  /** True while the next page is in flight. */
  isFetchingNextPage: boolean;
  /** True when the last load-more attempt failed. */
  isError?: boolean;
  /** Retry handler for the error state. */
  onRetry?: () => void;
  /** Additional className for the wrapper. */
  className?: string;
}

export default function InfiniteScrollStatus({
  loadedCount,
  hasNextPage,
  isFetchingNextPage,
  isError = false,
  onRetry,
  className,
}: InfiniteScrollStatusProps) {
  const t = useTranslations("marketplace");
  const previousCount = useRef(loadedCount);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const delta = loadedCount - previousCount.current;
    previousCount.current = loadedCount;

    if (delta > 0) {
      const loaded = t("newInvoicesAnnouncement", {
        count: delta,
        total: loadedCount,
      });
      setAnnouncement(
        hasNextPage ? loaded : `${loaded} ${t("allLoadedAnnouncement")}`
      );
    } else if (!hasNextPage && loadedCount > 0) {
      setAnnouncement(t("allLoadedAnnouncement"));
    }
  }, [loadedCount, hasNextPage, t]);

  const message = isError
    ? t("loadMoreFailed")
    : isFetchingNextPage
      ? t("loadingMore")
      : announcement;

  return (
    <div className={cn("mt-4 flex flex-col items-center gap-2 text-center", className)}>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="marketplace-load-status"
      >
        {message}
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center">
          <p className="text-xs font-medium text-destructive">{t("loadMoreFailed")}</p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="gap-2 border-destructive/40 text-xs text-destructive hover:bg-destructive/20"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("retryLoading")}
            </Button>
          )}
        </div>
      ) : isFetchingNextPage ? (
        <div className="text-sm text-muted-foreground" data-testid="marketplace-loading-more">
          {t("loadingMore")}
        </div>
      ) : !hasNextPage && loadedCount > 0 ? (
        <div className="text-sm text-muted-foreground" data-testid="marketplace-end-of-list">
          {t("allLoaded")}
        </div>
      ) : null}
    </div>
  );
}
