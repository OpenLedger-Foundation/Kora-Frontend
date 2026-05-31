"use client";

import { useNetworkStatus, type NetworkStatus } from "@/hooks/useNetworkStatus";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const statusConfig = {
  operational: {
    color: "bg-green-500",
    label: "Operational",
    description: "All services running normally",
  },
  degraded: {
    color: "bg-amber-500",
    label: "Degraded",
    description: "Some services experiencing delays",
  },
  down: {
    color: "bg-red-500",
    label: "Down",
    description: "Services unavailable",
  },
} as const;

export function NetworkStatusIndicator() {
  const { health } = useNetworkStatus();

  const config = statusConfig[health.overall];
  const networkLabel = health.network === "testnet" ? "Testnet" : "Mainnet";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted/50">
            <div className={cn("h-2 w-2 rounded-full", config.color)} />
            <span className="font-medium text-muted-foreground">
              {networkLabel}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={cn("h-2 w-2 rounded-full", config.color)} />
              <span className="font-semibold">{config.label}</span>
            </div>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            
            <div className="space-y-1 border-t pt-2">
              <ServiceStatus
                name="Soroban RPC"
                service={health.soroban}
              />
              <ServiceStatus
                name="Horizon API"
                service={health.horizon}
              />
            </div>
            
            <div className="border-t pt-2 text-xs text-muted-foreground">
              Last checked: {formatDistanceToNow(health.soroban.lastChecked, { addSuffix: true })}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ServiceStatus({ 
  name, 
  service 
}: { 
  name: string; 
  service: { status: NetworkStatus; responseTime: number; error?: string } 
}) {
  const config = statusConfig[service.status];
  
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-1.5">
        <div className={cn("h-1.5 w-1.5 rounded-full", config.color)} />
        <span>{name}</span>
      </div>
      <div className="text-muted-foreground">
        {service.status === "down" && service.error ? (
          <span className="text-red-400">Error</span>
        ) : (
          <span>{service.responseTime}ms</span>
        )}
      </div>
    </div>
  );
}