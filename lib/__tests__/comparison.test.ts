import { describe, expect, it } from "vitest";
import {
  MAX_COMPARISON,
  buildRangeSelection,
  normalizeComparisonList,
  toggleComparisonId,
} from "../comparison";

describe("comparison helpers", () => {
  it("normalizes duplicate ids and enforces the max limit", () => {
    expect(normalizeComparisonList(["a", "b", "a", "c", "d"])).toEqual([
      "b",
      "c",
      "d",
    ]);
  });

  it("toggles invoice ids in and out of the list", () => {
    expect(toggleComparisonId(["a", "b"], "b")).toEqual(["a"]);
    expect(toggleComparisonId(["a", "b"], "c")).toEqual(["a", "b", "c"]);
  });

  it("builds a contiguous range selection within the max comparison size", () => {
    const ids = ["a", "b", "c", "d"];
    const range = buildRangeSelection(ids, 0, 3, []);
    expect(range).toHaveLength(MAX_COMPARISON);
    expect(range).toEqual(["b", "c", "d"]);
  });
});
