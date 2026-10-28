import { describe, expect, it } from "vitest";
import { checkPermutation, placeAt, without } from "@/lib/order";

describe("placeAt", () => {
  it("inserts a new id at a 1-based position", () => {
    expect(placeAt([1, 2, 3], 9, 2)).toEqual([1, 9, 2, 3]);
  });
  it("moves an existing id up and down", () => {
    expect(placeAt([1, 2, 3, 4], 4, 1)).toEqual([4, 1, 2, 3]);
    expect(placeAt([1, 2, 3, 4], 1, 3)).toEqual([2, 3, 1, 4]);
  });
  it("clamps positions past either end", () => {
    expect(placeAt([1, 2], 9, 99)).toEqual([1, 2, 9]);
    expect(placeAt([1, 2], 9, 0)).toEqual([9, 1, 2]);
    expect(placeAt([1, 2, 3], 1, 99)).toEqual([2, 3, 1]);
  });
  it("works on an empty list", () => {
    expect(placeAt([], 5, 3)).toEqual([5]);
  });
});

describe("without", () => {
  it("removes the id and keeps the rest in order", () => {
    expect(without([3, 1, 2], 1)).toEqual([3, 2]);
  });
});

describe("checkPermutation", () => {
  it("accepts any reordering of the same ids", () => {
    expect(checkPermutation([1, 2, 3], [3, 1, 2])).toBeNull();
    expect(checkPermutation([], [])).toBeNull();
  });
  it("rejects duplicates", () => {
    expect(checkPermutation([1, 2], [1, 1])).toMatch(/duplicate/);
  });
  it("rejects missing or foreign ids (a stale tab)", () => {
    expect(checkPermutation([1, 2, 3], [1, 2])).toMatch(/don't match/);
    expect(checkPermutation([1, 2], [1, 7])).toMatch(/don't match/);
  });
});
