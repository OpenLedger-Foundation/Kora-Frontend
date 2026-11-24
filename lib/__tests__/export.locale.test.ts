/**
 * Locale-aware CSV export — Issue #1179.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildCsv,
  csvDelimiterForLocale,
  exportCsv,
  formatCsvDate,
  formatCsvNumber,
} from "@/lib/export";

describe("csvDelimiterForLocale", () => {
  it("uses ',' for dot-decimal locales and ';' for comma-decimal locales", () => {
    expect(csvDelimiterForLocale("en")).toBe(",");
    expect(csvDelimiterForLocale("es")).toBe(";");
    expect(csvDelimiterForLocale("pt-BR")).toBe(";");
  });

  it("falls back to ',' when the locale is missing or invalid", () => {
    expect(csvDelimiterForLocale(undefined)).toBe(",");
    expect(csvDelimiterForLocale("not a locale!!")).toBe(",");
  });
});

describe("formatCsvNumber", () => {
  it("formats with the locale decimal separator and no grouping", () => {
    expect(formatCsvNumber("1234.5", "en")).toBe("1234.5");
    expect(formatCsvNumber("1234.5", "pt-BR")).toBe("1234,5");
    expect(formatCsvNumber(0.0000001, "es")).toBe("0,0000001");
  });

  it("passes malformed and empty values through instead of producing NaN", () => {
    expect(formatCsvNumber("abc", "en")).toBe("abc");
    expect(formatCsvNumber(undefined, "en")).toBe("");
    expect(formatCsvNumber("", "en")).toBe("");
  });
});

describe("formatCsvDate", () => {
  it("returns a non-empty localized string for a valid date", () => {
    const value = formatCsvDate("2026-11-24T10:00:00Z", "pt-BR");
    expect(value).toContain("2026");
    expect(value).toMatch(/24\/11\/2026/);
  });

  it("returns '' for invalid dates", () => {
    expect(formatCsvDate("not-a-date", "en")).toBe("");
  });
});

describe("buildCsv", () => {
  it("uses the locale delimiter and localized header labels", () => {
    const csv = buildCsv([{ amount: "1234,5", asset: "USDC" }], ["amount", "asset"], {
      locale: "es",
      headerLabels: { amount: "Importe", asset: "Activo" },
    });
    expect(csv).toBe("Importe;Activo\n1234,5;USDC");
  });

  it("quotes cells containing the delimiter, quotes, or newlines", () => {
    const csv = buildCsv([{ d: 'a;b "c"\nd' }], ["d"], { delimiter: ";" });
    expect(csv).toBe('d\n"a;b ""c""\nd"');
  });

  it("returns '' for empty data without headers", () => {
    expect(buildCsv([], undefined)).toBe("");
  });
});

describe("exportCsv", () => {
  afterEach(() => vi.restoreAllMocks());

  it("does not create a download for empty data", () => {
    const createObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    exportCsv([], "empty");
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("prefixes a UTF-8 BOM when a locale is given", async () => {
    let blob: Blob | undefined;
    Object.assign(URL, {
      createObjectURL: vi.fn((b: Blob) => {
        blob = b;
        return "blob:x";
      }),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    exportCsv([{ a: "ç" }], "file", ["a"], { locale: "pt-BR" });
    // jsdom's Blob has no arrayBuffer(); FileReader is supported.
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob!);
    });
    const bytes = new Uint8Array(buffer);
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  });
});
