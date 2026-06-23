"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  cta?: { label: string; onClick: () => void } | null;
  variant?: "marketplace" | "sme" | "investor" | "transactions" | "analytics";
  className?: string;
};

function Illustration({ variant }: { variant: Props["variant"] }) {
  const color = "#0ea5a4"; // teal brand
  const dark = "#0f1720";
  const size = 160;
  if (variant === "marketplace") {
    return (
      <svg width={size} height={size} viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <rect x="8" y="30" width="104" height="86" rx="10" fill="#071014" stroke="#083033" />
        <rect x="22" y="44" width="36" height="18" rx="4" fill={color} />
        <rect x="22" y="70" width="72" height="10" rx="3" fill="#0b2b2a" />
        <circle cx="132" cy="46" r="18" fill="#072727" stroke={color} />
      </svg>
    );
  }
  if (variant === "sme") {
    return (
      <svg width={size} height={size} viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <rect x="22" y="36" width="116" height="88" rx="8" fill="#071014" stroke="#083033" />
        <path d="M36 56h88v8H36z" fill={color} />
        <rect x="36" y="76" width="60" height="10" rx="3" fill="#092e2d" />
        <rect x="36" y="92" width="40" height="10" rx="3" fill="#063534" />
      </svg>
    );
  }
  if (variant === "investor") {
    return (
      <svg width={size} height={size} viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <rect x="18" y="28" width="124" height="100" rx="12" fill="#071014" stroke="#083033" />
        <g fill={color}>
          <rect x="34" y="46" width="28" height="28" rx="4" />
          <rect x="70" y="46" width="28" height="18" rx="4" />
          <rect x="106" y="46" width="10" height="10" rx="3" />
        </g>
      </svg>
    );
  }
  if (variant === "transactions") {
    return (
      <svg width={size} height={size} viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <rect x="12" y="24" width="136" height="112" rx="14" fill="#071014" stroke="#083033" />
        <path d="M34 56h92v8H34z" fill={color} />
        <path d="M34 80h72v8H34z" fill="#072f2f" />
        <path d="M34 104h48v8H34z" fill="#052b2b" />
      </svg>
    );
  }
  // analytics default
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="20" y="40" width="120" height="80" rx="10" fill="#071014" stroke="#083033" />
      <g fill={color}>
        <rect x="36" y="70" width="12" height="20" rx="2" />
        <rect x="56" y="60" width="12" height="30" rx="2" />
        <rect x="76" y="50" width="12" height="40" rx="2" />
      </g>
    </svg>
  );
}

export function EmptyState({ title, description, cta = null, variant = "marketplace", className = "" }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center ${className}`}>
      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity }}>
        <div className="mx-auto w-[180px] sm:w-[220px]">
          <Illustration variant={variant} />
        </div>
      </motion.div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-xl">{description}</p>}
      {cta && (
        <div className="mt-2">
          <Button onClick={cta.onClick}>{cta.label}</Button>
        </div>
      )}
    </div>
  );
}

export default EmptyState;
