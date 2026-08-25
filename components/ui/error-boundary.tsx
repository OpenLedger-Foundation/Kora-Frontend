"use client";

import React from "react";
import { AlertTriangle, WifiOff, FileWarning, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Error type detection ─────────────────────────────────────────────────────

type ErrorKind = "network" | "contract" | "unexpected";

function classifyError(error: Error): ErrorKind {
  const msg = error.message.toLowerCase();
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("timeout") || msg.includes("failed to fetch")) {
    return "network";
  }
  if (msg.includes("soroban") || msg.includes("contract") || msg.includes("simulation") || msg.includes("stellar") || msg.includes("xdr")) {
    return "contract";
  }
  return "unexpected";
}

const ERROR_CONFIG: Record<ErrorKind, { icon: React.ElementType; title: string; description: string }> = {
  network: {
    icon: WifiOff,
    title: "Connection error",
    description: "Unable to reach the network. Check your connection and try again.",
  },
  contract: {
    icon: FileWarning,
    title: "Contract error",
    description: "A smart contract call failed. The transaction may have been rejected or the contract is unavailable.",
  },
  unexpected: {
    icon: AlertTriangle,
    title: "Something went wrong",
    description: "An unexpected error occurred. Our team has been notified.",
  },
};

// ─── Fallback UI ──────────────────────────────────────────────────────────────

interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
  compact?: boolean;
}

export function ErrorFallback({ error, reset, compact = false }: ErrorFallbackProps) {
  const kind = classifyError(error);
  const { icon: Icon, title, description } = ERROR_CONFIG[kind];

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm">
        <Icon className="h-4 w-4 shrink-0 text-destructive" />
        <span className="text-destructive">{title}</span>
        <button onClick={reset} className="ml-auto text-xs text-muted-foreground underline hover:text-foreground">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800">
        <Icon className="h-7 w-7 text-zinc-400" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-zinc-100">{title}</p>
        <p className="max-w-sm text-sm text-zinc-400">{description}</p>
      </div>
      {process.env.NODE_ENV === "development" && (
        <p className="max-w-sm rounded bg-zinc-800 px-3 py-1.5 font-mono text-xs text-zinc-500">
          {error.message}
        </p>
      )}
      <Button size="sm" variant="outline" onClick={reset} className="gap-2">
        <RefreshCw className="h-3.5 w-3.5" /> Try Again
      </Button>
    </div>
  );
}

// ─── Error Boundary class component ──────────────────────────────────────────

interface Props {
  children: React.ReactNode;
  /** Override the fallback UI entirely */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  /** Compact inline variant */
  compact?: boolean;
  /** Called on error (e.g. send to monitoring) */
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return <ErrorFallback error={error} reset={this.reset} compact={this.props.compact} />;
  }
}
