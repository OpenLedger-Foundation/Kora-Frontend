/**
 * Unit tests for virus-scan rejection parsing
 *
 * Covers parseUploadRejection() handling of:
 * - Scan-flagged files (VirusTotal JSON stats)
 * - Generic upload errors (non-scan failures)
 * - Edge cases (malformed JSON, missing fields, etc.)
 */

import { describe, it, expect } from "vitest";
import { parseUploadRejection, type UploadRejection } from "../uploadScanResult";

describe("parseUploadRejection", () => {
  describe("Scan rejection — flagged files", () => {
    it("parses malicious + suspicious vendor count from VirusTotal JSON", () => {
      const body = {
        error: 'Virus scan failed: {"malicious":2,"suspicious":1}',
      };
      const result = parseUploadRejection(body);

      expect(result.rejected).toBe(true);
      expect(result.reason).toContain("3 security vendor(s)");
      expect(result.stats).toEqual({ malicious: 2, suspicious: 1 });
    });

    it("handles zero malicious but nonzero suspicious vendors", () => {
      const body = {
        error: 'Virus scan failed: {"malicious":0,"suspicious":2}',
      };
      const result = parseUploadRejection(body);

      expect(result.rejected).toBe(true);
      expect(result.reason).toContain("2 security vendor(s)");
      expect(result.stats).toEqual({ malicious: 0, suspicious: 2 });
    });

    it("handles all threat counts in stats object", () => {
      const body = {
        error: 'Virus scan failed: {"malicious":5,"suspicious":3,"undetected":100}',
      };
      const result = parseUploadRejection(body);

      expect(result.rejected).toBe(true);
      expect(result.reason).toContain("8 security vendor(s)");
      expect(result.stats).toEqual({ malicious: 5, suspicious: 3, undetected: 100 });
    });

    it("falls back to raw detail string when JSON parsing fails", () => {
      const body = {
        error: "Virus scan failed: malware detected by Kaspersky",
      };
      const result = parseUploadRejection(body);

      expect(result.rejected).toBe(true);
      expect(result.reason).toBe("malware detected by Kaspersky");
      expect(result.stats).toBeUndefined();
    });

    it("uses default message when detail string is empty", () => {
      const body = {
        error: "Virus scan failed: ",
      };
      const result = parseUploadRejection(body);

      expect(result.rejected).toBe(true);
      expect(result.reason).toBe("This file failed our security scan and cannot be uploaded.");
    });

    it("handles missing stats fields by treating as zero", () => {
      const body = {
        error: 'Virus scan failed: {"malicious":null,"suspicious":1}',
      };
      const result = parseUploadRejection(body);

      expect(result.rejected).toBe(true);
      expect(result.reason).toContain("1 security vendor(s)");
    });
  });

  describe("Generic errors — non-scan failures", () => {
    it("recognizes network errors (no scan prefix)", () => {
      const body = { error: "Network timeout" };
      const result = parseUploadRejection(body);

      expect(result.rejected).toBe(false);
      expect(result.reason).toBe("");
    });

    it("recognizes server errors (no scan prefix)", () => {
      const body = { error: "Pinata upload failed: 502 Bad Gateway" };
      const result = parseUploadRejection(body);

      expect(result.rejected).toBe(false);
      expect(result.reason).toBe("");
    });

    it("recognizes invalid PDF errors (no scan prefix)", () => {
      const body = { error: "Invalid PDF file" };
      const result = parseUploadRejection(body);

      expect(result.rejected).toBe(false);
      expect(result.reason).toBe("");
    });

    it("returns not-rejected for null body", () => {
      const result = parseUploadRejection(null);

      expect(result.rejected).toBe(false);
      expect(result.reason).toBe("");
    });

    it("returns not-rejected for undefined body", () => {
      const result = parseUploadRejection(undefined);

      expect(result.rejected).toBe(false);
      expect(result.reason).toBe("");
    });

    it("returns not-rejected for empty object", () => {
      const result = parseUploadRejection({});

      expect(result.rejected).toBe(false);
      expect(result.reason).toBe("");
    });
  });

  describe("Edge cases", () => {
    it("handles very long vendor count string", () => {
      const body = {
        error: 'Virus scan failed: {"malicious":50,"suspicious":25}',
      };
      const result = parseUploadRejection(body);

      expect(result.rejected).toBe(true);
      expect(result.reason).toContain("75 security vendor(s)");
    });

    it("handles non-JSON object in error field", () => {
      const body = {
        error: "Virus scan failed: {malformed json}",
      };
      const result = parseUploadRejection(body);

      expect(result.rejected).toBe(true);
      // Falls back to raw detail string
      expect(result.reason).toContain("malformed json");
    });

    it("case-sensitive prefix matching (only 'Virus scan failed:' triggers rejection)", () => {
      const body = {
        error: "virus scan failed: important error",
      };
      const result = parseUploadRejection(body);

      // Lowercase prefix doesn't match
      expect(result.rejected).toBe(false);
    });

    it("prefix must be at start of error string", () => {
      const body = {
        error: "Some prefix Virus scan failed: malware",
      };
      const result = parseUploadRejection(body);

      // Prefix in middle doesn't trigger rejection parsing
      expect(result.rejected).toBe(false);
    });

    it("handles stats with string values (coerced to numbers)", () => {
      const body = {
        error: 'Virus scan failed: {"malicious":"3","suspicious":"2"}',
      };
      const result = parseUploadRejection(body);

      expect(result.rejected).toBe(true);
      // Values should be parsed and counted
      expect(result.reason).toContain("security vendor");
    });

    it("parses empty stats object", () => {
      const body = {
        error: 'Virus scan failed: {}',
      };
      const result = parseUploadRejection(body);

      expect(result.rejected).toBe(true);
      expect(result.reason).toContain("0 security vendor(s)");
    });
  });

  describe("Return type correctness", () => {
    it("always returns UploadRejection interface", () => {
      const body = { error: "Virus scan failed: test" };
      const result = parseUploadRejection(body);

      expect(result).toHaveProperty("rejected");
      expect(result).toHaveProperty("reason");
      expect(typeof result.rejected).toBe("boolean");
      expect(typeof result.reason).toBe("string");
    });

    it("includes stats only when scan-rejected", () => {
      const scanReject = parseUploadRejection({
        error: 'Virus scan failed: {"malicious":1}',
      });
      expect(scanReject.stats).toBeDefined();

      const noReject = parseUploadRejection({ error: "Generic error" });
      expect(noReject.stats).toBeUndefined();
    });
  });
});
