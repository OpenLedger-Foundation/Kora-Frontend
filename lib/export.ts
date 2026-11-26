/**
 * exportPdf — captures a DOM element and downloads it as a PDF.
 *
 * Uses html2canvas + jsPDF (loaded dynamically to avoid SSR issues).
 * Falls back to window.print() if the libraries fail to load.
 *
 * @param elementId  - id of the DOM element to capture
 * @param filename   - output filename (without extension)
 */
export async function exportPdf(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`[exportPdf] Element #${elementId} not found`);
    window.print();
    return;
  }

  try {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#09090b", // zinc-950
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${filename}.pdf`);
  } catch (err) {
    console.error("[exportPdf] Failed, falling back to print:", err);
    window.print();
  }
}

/**
 * Field delimiter for a locale's CSV (#1179). Locales whose decimal separator
 * is "," (es, pt-BR, …) use ";" — the convention spreadsheet apps apply for
 * those locales — so localized amounts like "1.234,56" stay in one column.
 */
export function csvDelimiterForLocale(locale?: string): "," | ";" {
  if (!locale) return ",";
  try {
    const decimal = new Intl.NumberFormat(locale)
      .formatToParts(1.5)
      .find((part) => part.type === "decimal")?.value;
    return decimal === "," ? ";" : ",";
  } catch {
    return ",";
  }
}

/**
 * Locale-aware number for CSV cells. Non-numeric input is returned unchanged
 * (trimmed) instead of becoming "NaN", so a malformed amount never corrupts
 * the export.
 */
export function formatCsvNumber(value: unknown, locale?: string): string {
  if (value == null || value === "") return "";
  const num = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(num)) return String(value).trim();
  try {
    return new Intl.NumberFormat(locale, {
      useGrouping: false,
      maximumFractionDigits: 7, // Stellar amounts have 7 decimal places
    }).format(num);
  } catch {
    return String(num);
  }
}

/**
 * Locale-aware date/time for CSV cells. Invalid dates yield "" rather than
 * "Invalid Date".
 */
export function formatCsvDate(value: string | number | Date, locale?: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export interface CsvOptions {
  /** Field delimiter. Defaults to "," (or the locale's, via `locale`). */
  delimiter?: "," | ";";
  /** Picks the delimiter via {@link csvDelimiterForLocale} when `delimiter` is unset. */
  locale?: string;
  /** Header labels to display, keyed by column; defaults to the column key. */
  headerLabels?: Record<string, string>;
}

/** Serializes rows to CSV text (RFC 4180 quoting). Pure; used by `exportCsv`. */
export function buildCsv<T extends Record<string, unknown>>(
  data: T[],
  headers?: string[],
  options: CsvOptions = {}
): string {
  const cols = headers ?? (data.length ? Object.keys(data[0]) : []);
  if (!cols.length) return "";
  const delimiter = options.delimiter ?? csvDelimiterForLocale(options.locale);

  const escape = (val: unknown): string => {
    const str = val == null ? "" : String(val);
    return str.includes(delimiter) || str.includes('"') || str.includes("\n") || str.includes("\r")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const headerRow = cols.map((c) => escape(options.headerLabels?.[c] ?? c)).join(delimiter);
  const rows = data.map((row) => cols.map((h) => escape(row[h])).join(delimiter));
  return [headerRow, ...rows].join("\n");
}

/**
 * exportCsv — converts an array of objects to a CSV file and triggers download.
 *
 * @param data      - array of plain objects
 * @param filename  - output filename (with or without .csv extension)
 * @param headers   - column keys/order (defaults to the first row's keys)
 * @param options   - delimiter/locale/header labels (see {@link CsvOptions})
 */
export function exportCsv<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  headers?: string[],
  options: CsvOptions = {}
): void {
  const csv = buildCsv(data, headers, options);
  if (!csv) return;

  // A UTF-8 BOM makes spreadsheet apps decode accented headers (es, pt-BR)
  // correctly instead of guessing a legacy codepage.
  const bom = options.locale ? "﻿" : "";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * exportInvoiceCalendarIcs — exports an invoice repayment/maturity date as an ICS calendar file.
 *
 * Generates RFC 5545 compliant iCalendar event file with zero PII beyond invoice number and amount.
 */
export function exportInvoiceCalendarIcs(invoice: {
  id: string;
  metadata: { invoiceNumber: string; debtorName?: string; amount: number; currency: string };
  terms: { repaymentDate: string; apr: number };
}): void {
  const dtStart = new Date(invoice.terms.repaymentDate);
  if (isNaN(dtStart.getTime())) {
    console.warn("[exportInvoiceCalendarIcs] Invalid repayment date:", invoice.terms.repaymentDate);
    return;
  }

  // 1-hour event duration
  const dtEnd = new Date(dtStart.getTime() + 60 * 60 * 1000);

  const formatDateUtc = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const nowStr = formatDateUtc(new Date());
  const startStr = formatDateUtc(dtStart);
  const endStr = formatDateUtc(dtEnd);

  const summary = `Invoice Repayment Due: ${invoice.metadata.invoiceNumber}`;
  const debtorText = invoice.metadata.debtorName ? ` (${invoice.metadata.debtorName})` : "";
  const description = `Repayment due for invoice ${invoice.metadata.invoiceNumber}${debtorText}. Amount: ${invoice.metadata.amount} ${invoice.metadata.currency}, APR: ${invoice.terms.apr}%.`;

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kora Protocol//Invoice Maturity Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:invoice-${invoice.id}@kora.finance`,
    `DTSTAMP:${nowStr}`,
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const blob = new Blob([icsLines.join("\r\n")], {
    type: "text/calendar;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `invoice-${invoice.metadata.invoiceNumber || invoice.id}-maturity.ics`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

