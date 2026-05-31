/**
 * lib/export.ts
 *
 * Utilities for CSV and PDF export used by both dashboards.
 *
 * CSV:  Pure browser-side, no dependencies beyond the DOM.
 * PDF:  Uses html2canvas + jsPDF to capture a live DOM element.
 */

import type { RefObject } from "react";

// ─── CSV ──────────────────────────────────────────────────────────────────────

export interface CsvColumn<T> {
  /** Column header label */
  header: string;
  /** Extract the cell value from a row */
  accessor: (row: T) => string | number | null | undefined;
}

/**
 * Convert an array of typed rows to a CSV string and trigger a browser download.
 *
 * @param rows     Data rows
 * @param columns  Column definitions (header + accessor)
 * @param filename Desired filename including `.csv` extension
 */
export function exportToCSV<T>(
  rows: T[],
  columns: CsvColumn<T>[],
  filename = "export.csv"
): void {
  if (!rows.length) return;

  const escape = (v: string | number | null | undefined): string => {
    const str = String(v ?? "");
    // Wrap in quotes if the value contains commas, quotes, or newlines
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map((c) => escape(c.header)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escape(c.accessor(row))).join(","))
    .join("\n");

  const csv = `${header}\n${body}`;
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export interface PdfExportOptions {
  /** Page orientation. Default: "portrait" */
  orientation?: "portrait" | "landscape";
  /** Page format. Default: "a4" */
  format?: string;
  /** Scale factor for html2canvas. Higher = sharper but slower. Default: 2 */
  scale?: number;
  /** Background colour for the captured element. Default: "#ffffff" */
  backgroundColor?: string;
}

/**
 * Capture a DOM element as a PDF and trigger a browser download.
 *
 * Dynamically imports html2canvas and jsPDF so they are only loaded when
 * the user actually requests a PDF export (code-split).
 *
 * @param elementRef  React ref pointing to the element to capture
 * @param filename    Desired filename including `.pdf` extension
 * @param options     Optional rendering options
 */
export async function exportDashboardToPDF(
  elementRef: RefObject<HTMLElement>,
  filename = "export.pdf",
  options: PdfExportOptions = {}
): Promise<void> {
  const el = elementRef.current;
  if (!el) throw new Error("exportDashboardToPDF: elementRef.current is null");

  const {
    orientation = "portrait",
    format = "a4",
    scale = 2,
    backgroundColor = "#ffffff",
  } = options;

  // Dynamic imports — only pulled in when this function is called
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(el, {
    scale,
    backgroundColor,
    useCORS: true,
    logging: false,
    // Ignore elements that should not appear in the PDF (e.g. action buttons)
    ignoreElements: (node) =>
      node instanceof HTMLElement && node.dataset.pdfIgnore === "true",
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation, format, unit: "mm" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // If the content is taller than one page, split across multiple pages
  let yOffset = 0;
  let remainingHeight = imgHeight;

  while (remainingHeight > 0) {
    pdf.addImage(imgData, "PNG", 0, yOffset > 0 ? -(imgHeight - remainingHeight) : 0, imgWidth, imgHeight);
    remainingHeight -= pageHeight;
    if (remainingHeight > 0) {
      pdf.addPage();
      yOffset += pageHeight;
    }
  }

  pdf.save(filename);
}

// ─── Filename helpers ─────────────────────────────────────────────────────────

/** Returns today's date as YYYY-MM-DD for use in filenames */
export function todaySlug(): string {
  return new Date().toISOString().split("T")[0];
}
