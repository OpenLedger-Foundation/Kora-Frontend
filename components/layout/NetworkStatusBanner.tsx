"use client";

import { useTranslations } from "next-intl";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export function NetworkStatusBanner() {
  const t = useTranslations("network");
  const { health, isOnline } = useNetworkStatus();
  const warning = !isOnline ? t("offlineDesc") : health.overall === "down" ? t("serviceUnavailable") : null;

  return (
    <div role="status" aria-atomic="true">
      {warning && (
        <p className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-foreground">
          {warning}
        </p>
      )}
    </div>
  );
}
