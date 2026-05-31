"use client";

import { useTranslations } from "next-intl";
import { useNetworkStatus, type NetworkStatus } from "@/hooks/useNetworkStatus";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLOR: Record<NetworkStatus, string> = {
  operational: "bg-green-500",
  degraded: "bg-amber-500",
  down: "bg-red-500",
};

export function NetworkStatusIndicator() {
  const t = useTranslations("network");
  const { health } = useNetworkStatus();

  const color = STATUS_COLOR[health.overall];
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

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted/50">
            <div className={cn("h-2 w-2 rounded-full", color)} />
            <span className="font-medium text-muted-foreground">{networkLabel}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={cn("h-2 w-2 rounded-full", color)} />
              <span className="font-semibold">{statusLabel[health.overall]}</span>
            </div>
            <p className="text-xs text-muted-foreground">{statusDesc[health.overall]}</p>

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
      </Tooltip>
    </TooltipProvider>
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
