"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useNetworkStatus, type NetworkStatus } from "@/hooks/useNetworkStatus";
import { StaleDataBadge } from "@/components/layout/StaleDataBadge";
import { TooltipRoot, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getLatestMarketplaceDataUpdatedAt } from "@/lib/queryPersistence";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLOR: Record<NetworkStatus, string> = {
  operational: "bg-green-500",
  degraded: "bg-amber-500",
  down: "bg-red-500",
};

export function NetworkStatusIndicator() {
  const t = useTranslations("network");
  const queryClient = useQueryClient();
  const { health, isOnline } = useNetworkStatus();
  const [latestMarketplaceUpdatedAt, setLatestMarketplaceUpdatedAt] = useState<number | null>(() =>
    getLatestMarketplaceDataUpdatedAt(queryClient),
  );

  useEffect(() => {
    setLatestMarketplaceUpdatedAt(getLatestMarketplaceDataUpdatedAt(queryClient));

    return queryClient.getQueryCache().subscribe(() => {
      setLatestMarketplaceUpdatedAt(getLatestMarketplaceDataUpdatedAt(queryClient));
    });
  }, [queryClient]);

  const color = isOnline ? STATUS_COLOR[health.overall] : "bg-amber-500";
  const networkLabel = health.network === "testnet" ? t("testnet") : t("mainnet");

  const statusLabel: Record<NetworkStatus, string> = {
    operational: t("operational"),
    degraded: t("degraded"),
    down: t("down"),
  };

  const statusDesc: Record<NetworkStatus, string> = {
    operational: t("operationalDesc"),
    degraded: t("degradedDesc"),
    down: t("downDesc"),
  };

  // Show "RPC Degraded" inline label when Soroban RPC is not operational
  const rpcDegraded = health.soroban.status !== "operational";
  const badgeLabel = !isOnline
    ? t("offline")
    : rpcDegraded
      ? health.soroban.status === "down"
        ? t("rpcDown")
        : t("rpcDegraded")
      : networkLabel;

  return (
    <div
      className="flex items-center gap-2"
      data-testid="network-status-indicator"
    >
      <TooltipProvider>
        <TooltipRoot>
          <TooltipTrigger asChild>
            <div
              className="flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted/50"
              role="status"
              aria-live="polite"
              aria-label={t("statusAriaLabel", {
                status: isOnline ? statusLabel[health.overall] : t("offline"),
                network: networkLabel,
              })}
            >
              <div className={cn("h-2 w-2 rounded-full", color)} aria-hidden="true" />
              <span
                className={cn(
                  "font-medium",
                  !isOnline || rpcDegraded ? "text-amber-500" : "text-muted-foreground",
                )}
              >
                {badgeLabel}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={cn("h-2 w-2 rounded-full", color)} />
                <span className="font-semibold">
                  {isOnline ? statusLabel[health.overall] : t("offline")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {isOnline ? statusDesc[health.overall] : t("offlineDesc")}
              </p>

              <div className="space-y-1 border-t pt-2">
                <ServiceStatus
                  name={t("sorobanRpc")}
                  service={health.soroban}
                  errorLabel={t("error")}
                />
                <ServiceStatus
                  name={t("horizonApi")}
                  service={health.horizon}
                  errorLabel={t("error")}
                />
              </div>

              <div className="border-t pt-2 text-xs text-muted-foreground">
                {t("lastChecked", {
                  time: formatDistanceToNow(health.soroban.lastChecked, { addSuffix: true }),
                })}
              </div>

              {!isOnline && latestMarketplaceUpdatedAt ? (
                <div className="border-t pt-2">
                  <StaleDataBadge updatedAt={latestMarketplaceUpdatedAt} />
                </div>
              ) : null}
            </div>
          </TooltipContent>
        </TooltipRoot>
      </TooltipProvider>
      <StaleDataBadge updatedAt={latestMarketplaceUpdatedAt} compact />
    </div>
  );
}

function ServiceStatus({
  name,
  service,
  errorLabel,
}: {
  name: string;
  service: { status: NetworkStatus; responseTime: number; error?: string };
  errorLabel: string;
}) {
  const color = STATUS_COLOR[service.status];

  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-1.5">
        <div className={cn("h-1.5 w-1.5 rounded-full", color)} />
        <span>{name}</span>
      </div>
      <div className="text-muted-foreground">
        {service.status === "down" && service.error ? (
          <span className="text-red-400">{errorLabel}</span>
        ) : (
          <span>{service.responseTime}ms</span>
        )}
      </div>
    </div>
  );
}
