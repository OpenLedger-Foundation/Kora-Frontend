"use client";

/**
 * components/dev/DevPanel.tsx
 *
 * Floating developer panel — only rendered when NEXT_PUBLIC_ENABLE_DEVTOOLS=true.
 *
 * Tabs:
 *  1. Logs      — live structured log stream with level filter
 *  2. Network   — recent fetch calls with URL, method, status, duration
 *  3. Stores    — live Zustand store state inspector
 *  4. Wallet    — wallet connection state + RPC circuit breaker status
 *
 * Renders as a draggable panel anchored bottom-left.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { X, ChevronDown, ChevronUp, Wifi, WifiOff, Activity, Database, Globe, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  subscribeToLogs,
  getLogBuffer,
  clearLogBuffer,
  subscribeToNetworkLog,
  getNetworkLogBuffer,
  clearNetworkLogBuffer,
  installNetworkInterceptor,
  type LogEntry,
  type LogLevel,
  type NetworkLogEntry,
} from "@/lib/logger";
import { useWalletStore } from "@/store/walletStore";
import { useUIStore } from "@/store/uiStore";
import { useInvoiceStore } from "@/store/invoiceStore";
import { useTransactionStore } from "@/store/transactionStore";
import { rpc } from "@/lib/stellar/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "logs" | "network" | "stores" | "wallet";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "text-zinc-400",
  info:  "text-blue-400",
  warn:  "text-amber-400",
  error: "text-red-400",
};

const LEVEL_BG: Record<LogLevel, string> = {
  debug: "bg-zinc-800",
  info:  "bg-blue-950",
  warn:  "bg-amber-950",
  error: "bg-red-950",
};

function statusColor(status: number | null): string {
  if (status === null) return "text-zinc-400";
  if (status < 300) return "text-green-400";
  if (status < 400) return "text-blue-400";
  if (status < 500) return "text-amber-400";
  return "text-red-400";
}

function ts(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", { hour12: false });
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// ─── Sub-panels ───────────────────────────────────────────────────────────────

function LogsPanel() {
  const [entries, setEntries] = useState<LogEntry[]>(() => [...getLogBuffer()]);
  const [filter, setFilter] = useState<LogLevel | "all">("all");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToLogs((entry) => {
      setEntries((prev) => [...prev.slice(-199), entry]);
    });
    return unsub;
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  const visible = filter === "all" ? entries : entries.filter((e) => e.level === filter);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-700 shrink-0">
        {(["all", "debug", "info", "warn", "error"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setFilter(l)}
            className={cn(
              "px-2 py-0.5 rounded text-xs font-mono transition-colors",
              filter === l ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-white"
            )}
          >
            {l}
          </button>
        ))}
        <button
          onClick={() => { clearLogBuffer(); setEntries([]); }}
          className="ml-auto text-xs text-zinc-500 hover:text-white"
        >
          clear
        </button>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed">
        {visible.length === 0 && (
          <p className="text-zinc-600 text-center mt-8">No log entries</p>
        )}
        {visible.map((e) => (
          <div key={e.id} className={cn("px-3 py-1 border-b border-zinc-800/50", LEVEL_BG[e.level])}>
            <span className="text-zinc-600 mr-2">{ts(e.timestamp)}</span>
            <span className={cn("mr-2 uppercase font-bold", LEVEL_COLORS[e.level])}>{e.level.slice(0, 4)}</span>
            <span className="text-zinc-400 mr-2">[{e.namespace}]</span>
            <span className="text-zinc-200">{e.message}</span>
            {e.data !== undefined && (
              <pre className="text-zinc-500 mt-0.5 whitespace-pre-wrap break-all">
                {JSON.stringify(e.data, null, 2)}
              </pre>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function NetworkPanel() {
  const [entries, setEntries] = useState<NetworkLogEntry[]>(() => [...getNetworkLogBuffer()]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToNetworkLog((entry) => {
      setEntries((prev) => [...prev.slice(-99), entry]);
    });
    return unsub;
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-3 py-2 border-b border-zinc-700 shrink-0">
        <span className="text-xs text-zinc-400">{entries.length} requests</span>
        <button
          onClick={() => { clearNetworkLogBuffer(); setEntries([]); }}
          className="ml-auto text-xs text-zinc-500 hover:text-white"
        >
          clear
        </button>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-[11px]">
        {entries.length === 0 && (
          <p className="text-zinc-600 text-center mt-8">No network requests</p>
        )}
        {[...entries].reverse().map((e) => (
          <div key={e.id} className="px-3 py-1.5 border-b border-zinc-800/50 hover:bg-zinc-800/40">
            <div className="flex items-center gap-2">
              <span className="text-zinc-600">{ts(e.timestamp)}</span>
              <span className="text-zinc-300 font-bold">{e.method}</span>
              <span className={cn("font-bold", statusColor(e.status))}>
                {e.status ?? "ERR"}
              </span>
              {e.durationMs !== null && (
                <span className="text-zinc-500">{e.durationMs}ms</span>
              )}
            </div>
            <div className="text-zinc-400 truncate">{truncate(e.url, 80)}</div>
            {e.error && <div className="text-red-400">{e.error}</div>}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function StoresPanel() {
  const wallet = useWalletStore();
  const ui = useUIStore();
  const invoice = useInvoiceStore();
  const tx = useTransactionStore();

  const stores = [
    { name: "walletStore", value: { address: wallet.address, isConnected: wallet.isConnected, provider: wallet.provider, network: wallet.network, balance: wallet.balance, isVerified: wallet.isVerified } },
    { name: "uiStore", value: { theme: ui.theme, walletModalOpen: ui.walletModalOpen, sidebarOpen: ui.sidebarOpen, txState: ui.txState } },
    { name: "invoiceStore", value: { invoiceCount: invoice.invoices.length, filters: invoice.filters, sort: invoice.sort, searchQuery: invoice.searchQuery } },
    { name: "transactionStore", value: { txCount: tx.transactions.length, recent: tx.transactions.slice(0, 3) } },
  ];

  return (
    <div className="flex-1 overflow-y-auto font-mono text-[11px] p-2 space-y-2">
      {stores.map(({ name, value }) => (
        <details key={name} open className="bg-zinc-800/50 rounded border border-zinc-700">
          <summary className="px-3 py-1.5 cursor-pointer text-zinc-300 font-semibold hover:text-white select-none">
            {name}
          </summary>
          <pre className="px-3 pb-2 text-zinc-400 whitespace-pre-wrap break-all overflow-x-auto">
            {JSON.stringify(value, null, 2)}
          </pre>
        </details>
      ))}
    </div>
  );
}

function WalletPanel() {
  const wallet = useWalletStore();
  const [circuits, setCircuits] = useState(() => [...rpc.getCircuitStates().entries()]);

  // Refresh circuit state every 2s
  useEffect(() => {
    const id = setInterval(() => {
      setCircuits([...rpc.getCircuitStates().entries()]);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-4 font-mono text-[11px]">
      {/* Wallet state */}
      <section>
        <p className="text-zinc-400 font-semibold mb-2 uppercase tracking-wider">Wallet</p>
        <div className="space-y-1">
          <Row label="Connected" value={String(wallet.isConnected)} highlight={wallet.isConnected} />
          <Row label="Address" value={wallet.address ? `${wallet.address.slice(0, 8)}…${wallet.address.slice(-6)}` : "—"} />
          <Row label="Provider" value={wallet.provider ?? "—"} />
          <Row label="Network" value={wallet.network ?? "—"} />
          <Row label="Verified" value={String(wallet.isVerified)} highlight={wallet.isVerified} />
          {wallet.balance && (
            <>
              <Row label="XLM" value={wallet.balance.xlm} />
              <Row label="USDC" value={wallet.balance.usdc} />
            </>
          )}
        </div>
      </section>

      {/* RPC circuit breakers */}
      <section>
        <p className="text-zinc-400 font-semibold mb-2 uppercase tracking-wider">RPC Endpoints</p>
        <div className="space-y-2">
          {circuits.map(([url, c]) => (
            <div key={url} className="bg-zinc-800/50 rounded border border-zinc-700 px-3 py-2">
              <div className="flex items-center gap-2 mb-1">
                {c.state === "closed" ? (
                  <Wifi className="h-3 w-3 text-green-400" />
                ) : c.state === "open" ? (
                  <WifiOff className="h-3 w-3 text-red-400" />
                ) : (
                  <Activity className="h-3 w-3 text-amber-400" />
                )}
                <span className={cn("font-bold uppercase text-[10px]",
                  c.state === "closed" ? "text-green-400" :
                  c.state === "open" ? "text-red-400" : "text-amber-400"
                )}>
                  {c.state}
                </span>
              </div>
              <div className="text-zinc-400 truncate">{truncate(url, 50)}</div>
              <div className="text-zinc-600 mt-0.5">
                failures: {c.consecutiveFailures}
                {c.openedAt && ` · opened ${Math.round((Date.now() - c.openedAt) / 1000)}s ago`}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-zinc-500">{label}</span>
      <span className={cn("text-right", highlight ? "text-green-400" : "text-zinc-300")}>{value}</span>
    </div>
  );
}

// ─── Main DevPanel ────────────────────────────────────────────────────────────

const TAB_CONFIG: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "logs",    label: "Logs",    icon: Terminal },
  { id: "network", label: "Network", icon: Globe },
  { id: "stores",  label: "Stores",  icon: Database },
  { id: "wallet",  label: "Wallet",  icon: Activity },
];

export function DevPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("logs");

  // Install fetch interceptor once
  useEffect(() => {
    installNetworkInterceptor();
  }, []);

  return (
    <div
      className="fixed bottom-4 left-4 z-[99998] flex flex-col"
      style={{ width: open ? 480 : "auto" }}
      aria-label="Developer panel"
    >
      {/* Expanded panel */}
      {open && (
        <div className="mb-1 flex flex-col rounded-xl border border-zinc-700 bg-zinc-900/95 shadow-2xl backdrop-blur-sm overflow-hidden"
          style={{ height: 420 }}
        >
          {/* Tab bar */}
          <div className="flex items-center border-b border-zinc-700 shrink-0 bg-zinc-900">
            {TAB_CONFIG.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2",
                  tab === id
                    ? "border-blue-500 text-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                )}
              >
                <Icon className="h-3 w-3" aria-hidden />
                {label}
              </button>
            ))}
            <button
              onClick={() => setOpen(false)}
              className="ml-auto px-3 py-2 text-zinc-500 hover:text-white"
              aria-label="Close dev panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {tab === "logs"    && <LogsPanel />}
            {tab === "network" && <NetworkPanel />}
            {tab === "stores"  && <StoresPanel />}
            {tab === "wallet"  && <WalletPanel />}
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "self-start flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-mono font-semibold",
          "bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500",
          "shadow-lg transition-colors"
        )}
        aria-expanded={open}
        aria-label="Toggle developer panel"
      >
        <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" aria-hidden />
        DEV
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>
    </div>
  );
}
