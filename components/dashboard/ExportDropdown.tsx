"use client";

import { useRef, useState, type RefObject } from "react";
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { exportToCSV, exportDashboardToPDF, type CsvColumn } from "@/lib/export";
import { toast } from "sonner";

interface ExportDropdownProps<T> {
  /** Label shown on the button */
  label?: string;
  /** Data rows for CSV export */
  csvData: T[];
  /** Column definitions for CSV export */
  csvColumns: CsvColumn<T>[];
  /** Base filename without extension, e.g. "kora-sme-report-2025-01-15" */
  baseFilename: string;
  /** Ref to the DOM element to capture for PDF export */
  pdfRef: RefObject<HTMLElement>;
  className?: string;
}

/**
 * Dropdown button that offers CSV and PDF export for a dashboard.
 * Renders as a single "Export" button with a dropdown menu.
 */
export function ExportDropdown<T>({
  label = "Export",
  csvData,
  csvColumns,
  baseFilename,
  pdfRef,
  className,
}: ExportDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleCSV = () => {
    setOpen(false);
    try {
      exportToCSV(csvData, csvColumns, `${baseFilename}.csv`);
      toast.success(`Exported ${csvData.length} rows to CSV`);
    } catch {
      toast.error("CSV export failed");
    }
  };

  const handlePDF = async () => {
    setOpen(false);
    setPdfLoading(true);
    try {
      await exportDashboardToPDF(pdfRef, `${baseFilename}.pdf`, {
        orientation: "portrait",
        scale: 2,
        backgroundColor: document.documentElement.classList.contains("dark")
          ? "#0a0a0a"
          : "#ffffff",
      });
      toast.success("PDF report downloaded");
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("PDF export failed — try again");
    } finally {
      setPdfLoading(false);
    }
  };

  // Close on outside click
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block", className)}
      onBlur={handleBlur}
    >
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={pdfLoading}
      >
        {pdfLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Download className="h-4 w-4" aria-hidden />
        )}
        {pdfLoading ? "Generating PDF…" : label}
      </Button>

      {open && (
        <div
          role="menu"
          aria-label="Export options"
          className={cn(
            "absolute right-0 z-50 mt-1 w-48 rounded-lg border border-border bg-popover shadow-token-lg",
            "animate-in fade-in-0 zoom-in-95"
          )}
        >
          <button
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-t-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted focus:bg-muted focus:outline-none"
            onClick={handleCSV}
          >
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" aria-hidden />
            Export as CSV
          </button>
          <button
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-b-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted focus:bg-muted focus:outline-none"
            onClick={handlePDF}
          >
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
            Export as PDF
          </button>
        </div>
      )}
    </div>
  );
}
