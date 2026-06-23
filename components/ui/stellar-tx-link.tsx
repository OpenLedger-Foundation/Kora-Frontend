"use client";

import React from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ExternalLink } from "lucide-react";
import { truncateAddress } from "@/lib/utils";
import { safeStellarTxUrl } from "@/lib/security";
import { cn } from "@/lib/utils";

interface StellarTxLinkProps {
  hash: string;
  chars?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  showIcon?: boolean;
}

const sizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export function StellarTxLink({
  hash,
  chars = 6,
  size = "md",
  className,
  showIcon = true,
}: StellarTxLinkProps) {
  if (!hash) return null;

  const truncated = truncateAddress(hash, chars);
  const href = safeStellarTxUrl(hash);

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1 font-mono text-kora-400 hover:text-kora-300 transition-colors",
              sizeClasses[size],
              className
            )}
          >
            {truncated}
            {showIcon && <ExternalLink className="h-[1em] w-[1em] opacity-70" />}
          </a>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={5}
            className="z-50 rounded-md bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 shadow-md font-mono max-w-[300px] break-all"
          >
            {hash}
            <Tooltip.Arrow className="fill-zinc-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
