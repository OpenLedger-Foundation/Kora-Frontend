import { describe, it, expect } from "vitest";
import { parseUploadRejection } from "@/lib/uploadScanResult";

describe("parseUploadRejection", () => {
  describe("non-scan errors and empty inputs", () => {
    it("returns rejected: false when body is null or undefined", () => {
      expect(parseUploadRejection(null)).toEqual({ rejected: false, reason: "" });
      expect(parseUploadRejection(undefined)).toEqual({ rejected: false, reason: "" });
    });

    it("returns rejected: false when body has no error property", () => {
      expect(parseUploadRejection({})).toEqual({ rejected: false, reason: "" });
    });

    it("returns rejected: false for unrelated error messages", () => {
      expect(parseUploadRejection({ error: "File size exceeds limit" })).toEqual({
        rejected: false,
        reason: "",
      });
      expect(parseUploadRejection({ error: "Unauthorized access" })).toEqual({
        rejected: false,
        reason: "",
      });
    });
  });

  describe("JSON stats payload parsing", () => {
    it("parses valid stats with malicious and suspicious flags", () => {
      const result = parseUploadRejection({
        error: 'Virus scan failed: {"malicious":2,"suspicious":1,"harmless":70}',
      });

      expect(result.rejected).toBe(true);
      expect(result.stats).toEqual({ malicious: 2, suspicious: 1, harmless: 70 });
      expect(result.reason).toMatchInlineSnapshot(
        `"This file was flagged by 3 security vendor(s) and cannot be uploaded."`
      );
    });

    it("handles stats with only malicious vendors", () => {
      const result = parseUploadRejection({
        error: 'Virus scan failed: {"malicious":1}',
      });

      expect(result.rejected).toBe(true);
      expect(result.stats).toEqual({ malicious: 1 });
      expect(result.reason).toMatchInlineSnapshot(
        `"This file was flagged by 1 security vendor(s) and cannot be uploaded."`
      );
    });

    it("handles stats with zero detections", () => {
      const result = parseUploadRejection({
        error: 'Virus scan failed: {"malicious":0,"suspicious":0}',
      });

      expect(result.rejected).toBe(true);
      expect(result.stats).toEqual({ malicious: 0, suspicious: 0 });
      expect(result.reason).toMatchInlineSnapshot(
        `"This file was flagged by 0 security vendor(s) and cannot be uploaded."`
      );
    });
  });

  describe("plain-text error fallback", () => {
    it("falls back to plain-text detail message", () => {
      const result = parseUploadRejection({
        error: "Virus scan failed: Service temporarily unavailable",
      });

      expect(result.rejected).toBe(true);
      expect(result.stats).toBeUndefined();
      expect(result.reason).toMatchInlineSnapshot(
        `"Service temporarily unavailable"`
      );
    });

    it("uses default fallback reason when detail is empty or whitespace", () => {
      const emptyResult = parseUploadRejection({
        error: "Virus scan failed:",
      });
      expect(emptyResult.rejected).toBe(true);
      expect(emptyResult.reason).toMatchInlineSnapshot(
        `"This file failed our security scan and cannot be uploaded."`
      );

      const whitespaceResult = parseUploadRejection({
        error: "Virus scan failed:    ",
      });
      expect(whitespaceResult.rejected).toBe(true);
      expect(whitespaceResult.reason).toMatchInlineSnapshot(
        `"This file failed our security scan and cannot be uploaded."`
      );
    });
  });

  describe("malformed bodies and non-object JSON", () => {
    it("falls back to raw string when detail is malformed JSON", () => {
      const result = parseUploadRejection({
        error: "Virus scan failed: {malformed: json",
      });

      expect(result.rejected).toBe(true);
      expect(result.stats).toBeUndefined();
      expect(result.reason).toMatchInlineSnapshot(`"{malformed: json"`);
    });

    it("falls back to raw string when JSON is a primitive number or null", () => {
      const numResult = parseUploadRejection({
        error: "Virus scan failed: 500",
      });
      expect(numResult.rejected).toBe(true);
      expect(numResult.stats).toBeUndefined();
      expect(numResult.reason).toMatchInlineSnapshot(`"500"`);

      const nullResult = parseUploadRejection({
        error: "Virus scan failed: null",
      });
      expect(nullResult.rejected).toBe(true);
      expect(nullResult.stats).toBeUndefined();
      expect(nullResult.reason).toMatchInlineSnapshot(`"null"`);
    });
  });
});
