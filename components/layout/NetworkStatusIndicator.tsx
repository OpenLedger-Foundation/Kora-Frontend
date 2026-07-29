"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { WifiOff, Layers, RefreshCw } from "lucide-react";
import { useNetworkStatus, type NetworkStatus } from "@/hooks/useNetworkStatus";
import { TooltipRoot, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { listQueuedXdrDrafts, flushQueuedXdrDrafts } from "@/lib/xdrDraftQueue";

const STATUS_COLOR: Record<NetworkStatus, string> = {
  operational: "bg-green-500",
  degraded: "bg-amber-500",
  down: "bg-red-500",
};

export function NetworkStatusIndicator() {
  const t = useTranslations("network");
  const { health } = useNetworkStatus();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [queuedCount, setQueuedCount] = useState<number>(0);
  const [isFlushing, setIsFlushing] = useState<boolean>(false);

  const refreshQueueCount = async () => {
    try {
      const drafts = await listQueuedXdrDrafts();
      setQueuedCount(drafts.length);
    } catch {
      setQueuedCount(0);
    }
  };

  useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    void refreshQueueCount();

    const handleOnline = () => {
      setIsOnline(true);
      void refreshQueueCount();
    };

    const handleOffline = () => {
      setIsOnline(false);
      void refreshQueueCount();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const interval = setInterval(() => void refreshQueueCount(), 10000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  const color = !isOnline ? "bg-red-500" : STATUS_COLOR[health.overall];
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

  const rpcDegraded = health.soroban.status !== "operational";
  const badgeLabel = !isOnline
    ? "Offline"
    : rpcDegraded
    ? health.soroban.status === "down"
      ? "RPC Down"
      : "RPC Degraded"
    : networkLabel;

  return (
    <div className="flex items-center gap-2" data-testid="network-status-indicator">
      {/* Offline Banner & Mutation Queue Warning */}
      {(!isOnline || queuedCount > 0) && (
        <div
          role="alert"
          aria-live="polite"
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm transition-all",
            !isOnline
              ? "bg-red-500/10 text-red-500 border border-red-500/20"
              : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
          )}
          data-testid="offline-mutation-banner"
        >
          {!isOnline ? (
            <WifiOff className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
          ) : (
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>
            {!isOnline ? "Offline" : "Queued Actions"}
            {queuedCount > 0 && ` (${queuedCount} queued)`}
          </span>
        </div>
      )}

      {/* Main Status Tooltip */}
      <TooltipProvider>
        <TooltipRoot>
          <TooltipTrigger asChild>
            <div
              className="flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted/50"
              role="status"
              aria-live="polite"
              aria-label={`Network status: ${!isOnline ? "Offline" : statusLabel[health.overall]} on ${networkLabel}`}
            >
              <div className={cn("h-2 w-2 rounded-full", color)} aria-hidden="true" />
              <span
                className={cn(
                  "font-medium",
                  !isOnline ? "text-red-500 font-semibold" : rpcDegraded ? "text-amber-500" : "text-muted-foreground"
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
                <span className="font-semibold">{!isOnline ? "Offline" : statusLabel[health.overall]}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {!isOnline
                  ? "Network connection lost. Actions signed while offline will queue and sync when connected."
                  : statusDesc[health.overall]}
              </p>

              {queuedCount > 0 && (
                <div className="border-t pt-2 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-amber-500">Queued Offline Actions</span>
                    <span className="font-bold">{queuedCount}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Signed transactions awaiting connectivity flush.
                  </p>
                </div>
              )}

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
            </div>
          </TooltipContent>
        </TooltipRoot>
      </TooltipProvider>
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
