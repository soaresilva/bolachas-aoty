import { describe, expect, it } from "vitest";
import { FULL_WIDTH_COUNT, splitRanked } from "@/lib/layout";

const nums = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("splitRanked", () => {
  it("keeps the first 20 full width and pairs up the rest in order", () => {
    const { top, rest } = splitRanked(nums(25));
    expect(FULL_WIDTH_COUNT).toBe(20);
    expect(top).toEqual(nums(20));
    expect(rest).toEqual([21, 22, 23, 24, 25]);
  });

  it("handles lists at or under the cutoff", () => {
    expect(splitRanked(nums(20)).rest).toEqual([]);
    expect(splitRanked(nums(3))).toEqual({ top: [1, 2, 3], rest: [] });
    expect(splitRanked([])).toEqual({ top: [], rest: [] });
  });
});
