"use client";

/**
 * TxSimulationPreview
 *
 * Shown before every wallet-signing step. Displays:
 *  - Estimated fee in stroops → XLM → USD equivalent
 *  - Resource usage: CPU instructions, memory, read/write bytes
 *  - Simulation errors (blocks the Proceed button)
 *  - 10-second timeout error
 *
 * The dialog is controlled externally via `open` / `onProceed` / `onCancel`.
 * `onProceed` is only callable when simulation succeeded (no error).
 */

import { AlertTriangle, CheckCircle2, Cpu, HardDrive, Loader2, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SimulationPreview } from "@/hooks/useTransaction";

// ─── XLM price (static fallback; replace with live feed if desired) ───────────
const XLM_USD_PRICE = 0.11; // ~$0.11 per XLM as of mid-2025

function stroopsToXlm(stroops: number): number {
  return stroops / 10_000_000;
}

function xlmToUsd(xlm: number): number {
  return xlm * XLM_USD_PRICE;
}

function formatXlm(xlm: number): string {
  if (xlm === 0) return "0 XLM";
  if (xlm < 0.0001) return `${(xlm * 10_000_000).toFixed(0)} stroops`;
  return `${xlm.toFixed(7)} XLM`;
}

function formatUsd(usd: number): string {
  if (usd < 0.000001) return "< $0.000001";
  return `$${usd.toFixed(6)}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatInstructions(n: number): string {
  if (n === 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// ─── Resource row ─────────────────────────────────────────────────────────────

function ResourceRow({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{label}</span>
      </div>
      <span className={cn("font-mono text-sm font-medium", className ?? "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TxSimulationPreviewProps {
  open: boolean;
  /** null = still simulating */
  preview: SimulationPreview | null;
  onProceed: () => void;
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TxSimulationPreview({
  open,
  preview,
  onProceed,
  onCancel,
}: TxSimulationPreviewProps) {
  const t = useTranslations("txSimulation");

  const isSimulating = preview === null;
  const hasError = Boolean(preview?.error);
  const canProceed = !isSimulating && !hasError;

  const feeXlm = preview ? stroopsToXlm(preview.feeStroops) : 0;
  const feeUsd = xlmToUsd(feeXlm);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md" aria-busy={isSimulating}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSimulating ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
            ) : hasError ? (
              <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden />
            )}
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ── Simulating spinner ─────────────────────────────────────── */}
          {isSimulating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-3 py-8"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
              <p className="text-sm text-muted-foreground">{t("simulating")}</p>
            </motion.div>
          )}

          {/* ── Simulation error ───────────────────────────────────────── */}
          {preview?.error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 space-y-2"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden />
                <p className="text-sm font-semibold text-destructive">{t("simulationError")}</p>
              </div>
              <p className="text-xs text-muted-foreground">{t("simulationErrorDesc")}</p>
              <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-zinc-900 p-3 font-mono text-xs text-red-400 whitespace-pre-wrap break-all">
                {preview.error}
              </pre>
            </motion.div>
          )}

          {/* ── Successful simulation results ──────────────────────────── */}
          {preview && !preview.error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Fee card */}
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("estimatedFee")}
                </p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {formatXlm(feeXlm)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("feeUsd", { usd: formatUsd(feeUsd) })}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{preview.feeStroops.toLocaleString()} stroops</p>
                  </div>
                </div>
              </div>

              {/* Resource usage */}
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("resourceUsage")}
                </p>
                <div className="divide-y divide-border/50">
                  <ResourceRow
                    icon={Cpu}
                    label={t("cpuInstructions")}
                    value={formatInstructions(preview.cpuInstructions)}
                    className={preview.cpuInstructions > 50_000_000 ? "text-amber-400" : undefined}
                  />
                  <ResourceRow
                    icon={HardDrive}
                    label={t("readBytes")}
                    value={formatBytes(preview.readBytes)}
                  />
                  <ResourceRow
                    icon={Zap}
                    label={t("writeBytes")}
                    value={formatBytes(preview.writeBytes)}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={isSimulating}
          >
            {t("cancel")}
          </Button>
          <Button
            className="flex-1"
            onClick={onProceed}
            disabled={!canProceed}
          >
            {isSimulating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {t("simulating")}
              </>
            ) : (
              t("proceed")
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
