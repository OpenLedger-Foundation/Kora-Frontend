"use client";

/**
 * ComparisonBar — fixed bottom bar showing invoices selected for comparison.
 *
 * Appears when 1+ invoices are in the comparison list. Shows invoice chips
 * with remove buttons and a "Compare" CTA that opens the ComparisonTable.
 * Supports shareable URLs with comparison invoice IDs.
 */

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, GitCompareArrows, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInvoiceStore } from "@/store/invoiceStore";
import { cn } from "@/lib/utils";
import { ComparisonTable } from "./ComparisonTable";

const MAX_COMPARISON = 3;

export function ComparisonBar() {
  const { comparisonList, invoices, removeFromComparison, clearComparison } =
    useInvoiceStore();
  const [tableOpen, setTableOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const selectedInvoices = comparisonList
    .map((id) => invoices.find((inv) => inv.id === id))
    .filter(Boolean) as NonNullable<ReturnType<typeof invoices.find>>[];

  // Sync comparison list from URL on mount (shareable links)
  const searchParams = useSearchParams();
  useEffect(() => {
    const compareParam = searchParams.get("compare");
    if (compareParam) {
      const ids = compareParam.split(",").filter(Boolean).slice(0, MAX_COMPARISON);
      const { toggleComparison, comparisonList: current } = useInvoiceStore.getState();
      ids.forEach((id) => {
        if (!current.includes(id)) toggleComparison(id);
      });
      // Auto-open the table when arriving via a share link
      if (ids.length >= 2) setTableOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleShare = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("compare", comparisonList.join(","));
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: update URL without clipboard
      router.replace(`${url.pathname}?${url.searchParams.toString()}`, {
        scroll: false,
      });
    }
  };

  if (comparisonList.length === 0) return null;

  return (
    <>
      {/* Comparison Table Modal */}
      <AnimatePresence>
        {tableOpen && (
          <ComparisonTable
            invoices={selectedInvoices}
            onClose={() => setTableOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Fixed Bottom Bar */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md shadow-2xl"
        role="region"
        aria-label="Invoice comparison bar"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          {/* Label */}
          <div className="hidden shrink-0 sm:flex items-center gap-2">
            <GitCompareArrows className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Compare
            </span>
            <span className="text-xs text-muted-foreground">
              ({comparisonList.length}/{MAX_COMPARISON})
            </span>
          </div>

          {/* Invoice chips */}
          <div className="flex flex-1 items-center gap-2 overflow-x-auto">
            {selectedInvoices.map((invoice) => (
              <motion.div
                key={invoice.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-foreground"
              >
                <span className="max-w-[120px] truncate">
                  {invoice.metadata.debtorName}
                </span>
                <span className="text-primary font-semibold">
                  {invoice.terms.apr.toFixed(1)}%
                </span>
                <button
                  onClick={() => removeFromComparison(invoice.id)}
                  className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label={`Remove ${invoice.metadata.debtorName} from comparison`}
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: MAX_COMPARISON - comparisonList.length }).map(
              (_, i) => (
                <div
                  key={`empty-${i}`}
                  className="flex shrink-0 items-center justify-center rounded-lg border border-dashed border-border/50 px-4 py-1.5 text-xs text-muted-foreground/50"
                >
                  + Add
                </div>
              )
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Copy shareable comparison link"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {copied ? "Copied!" : "Share"}
              </span>
            </button>

            <button
              onClick={clearComparison}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Clear all comparisons"
            >
              Clear
            </button>

            <Button
              size="sm"
              onClick={() => setTableOpen(true)}
              disabled={comparisonList.length < 2}
              className={cn(
                "gap-1.5",
                comparisonList.length < 2 && "opacity-50 cursor-not-allowed"
              )}
              aria-label={
                comparisonList.length < 2
                  ? "Select at least 2 invoices to compare"
                  : "Open comparison table"
              }
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
              Compare
              {comparisonList.length >= 2 && (
                <span className="ml-0.5 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-bold">
                  {comparisonList.length}
                </span>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
