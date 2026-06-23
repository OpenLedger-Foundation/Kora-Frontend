"use client";

import React from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { CopyButton } from "@/components/ui/CopyButton";
import { truncateAddress } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface StellarAddressProps {
  address: string;
  chars?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  showCopy?: boolean;
}

const sizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export function StellarAddress({
  address,
  chars = 4,
  size = "md",
  className,
  showCopy = true,
}: StellarAddressProps) {
  if (!address) return null;

  const truncated = truncateAddress(address, chars);

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <div className={cn("inline-flex items-center gap-1.5", sizeClasses[size], className)}>
          <Tooltip.Trigger asChild>
            <span className="font-mono text-zinc-300 cursor-help hover:text-zinc-100 transition-colors">
              {truncated}
            </span>
          </Tooltip.Trigger>
          {showCopy && (
            <CopyButton 
              text={address} 
              className={cn(size === "sm" && "h-5 w-5 p-1", size === "lg" && "h-7 w-7 p-1.5")} 
            />
          )}
        </div>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={5}
            className="z-50 rounded-md bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 shadow-md font-mono select-all break-all max-w-[300px]"
          >
            {address}
            <Tooltip.Arrow className="fill-zinc-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
