import { describe, expect, it } from "vitest";
import { FULL_WIDTH_COUNT, artistSortKey, splitNumbering, splitRanked } from "@/lib/layout";

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

const rec = (artist: string, album = "x") => ({ artist, album });

describe("splitNumbering", () => {
  it("numbers everything when after is null", () => {
    const ranked = [rec("B"), rec("A")];
    expect(splitNumbering(ranked, null)).toEqual({ numbered: ranked, alphabetical: [] });
  });

  it("keeps the first N in order and sorts the rest by artist", () => {
    const ranked = [rec("Zed"), rec("Yo"), rec("Émile"), rec("The Beths"), rec("adam"), rec("Bob")];
    const { numbered, alphabetical } = splitNumbering(ranked, 2);
    expect(numbered.map((r) => r.artist)).toEqual(["Zed", "Yo"]);
    // accents and "The " don't count; case doesn't either
    expect(alphabetical.map((r) => r.artist)).toEqual(["adam", "The Beths", "Bob", "Émile"]);
  });

  it("breaks artist ties by album and copes with N past the end", () => {
    expect(splitNumbering([rec("A", "two"), rec("A", "one")], 0).alphabetical.map((r) => r.album)).toEqual(["one", "two"]);
    expect(splitNumbering([rec("A")], 5)).toEqual({ numbered: [rec("A")], alphabetical: [] });
  });

  it("builds the sort key", () => {
    expect(artistSortKey("The Weather Station")).toBe("weather station");
    expect(artistSortKey("Théo")).toBe("theo");
  });
});
