import { describe, expect, it } from "vitest";
import { evaluateVitalsRegression, getVitalRating } from "../webVitals";

describe("getVitalRating", () => {
    it.each([
        ["LCP", 2500, 4000, 1],
        ["FID", 100, 300, 1],
        ["CLS", 0.1, 0.25, 0.001],
        ["TTFB", 800, 1800, 1],
        ["INP", 200, 500, 1],
    ])(
        "%s classifies values at and around both thresholds",
        (name, good, needsImprovement, increment) => {
            expect(getVitalRating(name, good)).toBe("good");
            expect(getVitalRating(name, good + increment)).toBe("needs-improvement");
            expect(getVitalRating(name, needsImprovement)).toBe("needs-improvement");
            expect(getVitalRating(name, needsImprovement + increment)).toBe("poor");
        },
    );

    it("treats an unknown vital as good", () => {
        expect(getVitalRating("UNKNOWN", 100000)).toBe("good");
    });
});

describe("evaluateVitalsRegression", () => {
    it("flags growth only when both the relative limit and minimum delta are met", () => {
        const report = evaluateVitalsRegression(
            { LCP: 1150, CLS: 0.125, TTFB: 111 },
            { LCP: 1000, CLS: 0.1, TTFB: 100 },
            ["LCP", "CLS", "TTFB"],
        );

        expect(report.regressions.map(({ name }) => name)).toEqual(["LCP", "CLS"]);
        expect(report.regressions[0]).toMatchObject({
            current: 1150,
            baseline: 1000,
            limit: 1100,
        });
        expect(report.regressions[0].changePct).toBeCloseTo(0.15);
        expect(report.regressions[1]).toMatchObject({ current: 0.125, baseline: 0.1 });
        expect(report.regressions[1].changePct).toBeCloseTo(0.25);
        expect(report.regressions[1].limit).toBeCloseTo(0.11);
        expect(report.passed.map(({ name }) => name)).toEqual(["TTFB"]);
        expect(report.skipped).toEqual([]);
    });

    it("passes a metric at the relative limit or below its minimum absolute delta", () => {
        const report = evaluateVitalsRegression(
            { LCP: 1100, FCP: 111 },
            { LCP: 1000, FCP: 100 },
            ["LCP", "FCP"],
        );

        expect(report.regressions).toEqual([]);
        expect(report.passed.map(({ name }) => name)).toEqual(["LCP", "FCP"]);
    });

    it("uses the CLS-specific minimum delta", () => {
        const report = evaluateVitalsRegression(
            { CLS: 0.115 },
            { CLS: 0.1 },
            ["CLS"],
        );

        expect(report.regressions).toEqual([]);
        expect(report.passed.map(({ name }) => name)).toEqual(["CLS"]);
    });

    it("uses the gated vitals by default", () => {
        const report = evaluateVitalsRegression(
            { INP: 1000 },
            { INP: 100 },
        );

        expect(report).toEqual({ regressions: [], passed: [], skipped: [] });
    });

    it("skips missing and non-finite measurements", () => {
        const report = evaluateVitalsRegression(
            { LCP: 1000, CLS: Number.NaN, TTFB: 900, FCP: 1200 },
            { CLS: 0.1, TTFB: Number.POSITIVE_INFINITY, FCP: 1000 },
        );

        expect(report.regressions).toEqual([]);
        expect(report.passed.map(({ name }) => name)).toEqual(["FCP"]);
        expect(report.skipped).toEqual(["LCP", "CLS", "TTFB"]);
    });
});