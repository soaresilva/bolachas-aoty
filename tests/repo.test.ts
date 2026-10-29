import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { importSchema } from "@/lib/contract";
import {
  addEntry,
  ensureList,
  getListWithEntries,
  importCandidates,
  importedOrder,
  Invalid,
  listYears,
  NotFound,
  placeEntry,
  reorder,
  updateEntry,
  updateList,
} from "@/lib/repo";
import { album, fixture, fixtureV2, testDb } from "./helpers";

let t: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  t = await testDb();
});
afterAll(() => t.close());
beforeEach(() => t.reset());

async function rankedNames() {
  const list = await getListWithEntries(t.db, 2026);
  return list!.ranked.map((e) => [e.position, e.album]);
}

async function seedRanked(count: number) {
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    const e = await addEntry(t.db, 2026, album({ album: `R${i + 1}` }));
    await placeEntry(t.db, e.id, i + 1);
    ids.push(e.id);
  }
  return ids;
}

describe("lists", () => {
  it("creates a list on first use with a default title", async () => {
    const list = await ensureList(t.db, 2026);
    expect(list).toMatchObject({ year: 2026, title: "Favorite albums of 2026", published: false });
    expect((await ensureList(t.db, 2026)).id).toBe(list.id);
  });

  it("updates only the fields given", async () => {
    await updateList(t.db, 2026, { title: "Best of 2026", intro: "Hello" });
    const list = await updateList(t.db, 2026, { published: true });
    expect(list).toMatchObject({ title: "Best of 2026", intro: "Hello", published: true });
  });

});

describe("placing entries", () => {
  it("new albums start on the shortlist", async () => {
    await addEntry(t.db, 2026, album());
    const list = await getListWithEntries(t.db, 2026);
    expect(list!.shortlist).toHaveLength(1);
    expect(list!.ranked).toHaveLength(0);
  });

  it("promoting into the middle shifts the rest down", async () => {
    await seedRanked(3);
    const e = await addEntry(t.db, 2026, album({ album: "New" }));
    await placeEntry(t.db, e.id, 2);
    expect(await rankedNames()).toEqual([[1, "R1"], [2, "New"], [3, "R2"], [4, "R3"]]);
  });

  it("moving within the list keeps positions 1..N", async () => {
    const [a] = await seedRanked(4);
    await placeEntry(t.db, a, 3);
    expect(await rankedNames()).toEqual([[1, "R2"], [2, "R3"], [3, "R1"], [4, "R4"]]);
  });

  it("back to shortlist closes the gap", async () => {
    const [, b] = await seedRanked(3);
    await placeEntry(t.db, b, "shortlist");
    expect(await rankedNames()).toEqual([[1, "R1"], [2, "R3"]]);
    const list = await getListWithEntries(t.db, 2026);
    expect(list!.shortlist.map((e) => [e.album, e.position])).toEqual([["R2", null]]);
  });

  it("dismissing a ranked album removes it from the list", async () => {
    const [a] = await seedRanked(2);
    await placeEntry(t.db, a, "dismissed");
    const list = await getListWithEntries(t.db, 2026);
    expect(list!.ranked.map((e) => [e.position, e.album])).toEqual([[1, "R2"]]);
    expect(list!.dismissed.map((e) => e.album)).toEqual(["R1"]);
  });

  it("returns the year for revalidation", async () => {
    const e = await addEntry(t.db, 2026, album());
    expect(await placeEntry(t.db, e.id, 1)).toBe(2026);
  });

  it("refuses an unknown entry", async () => {
    await expect(placeEntry(t.db, 999, 1)).rejects.toBeInstanceOf(NotFound);
  });
});

describe("reorder", () => {
  it("applies a full permutation", async () => {
    const [a, b, c] = await seedRanked(3);
    await reorder(t.db, 2026, [c, a, b]);
    expect(await rankedNames()).toEqual([[1, "R3"], [2, "R1"], [3, "R2"]]);
  });

  it("refuses a stale order and leaves the list untouched", async () => {
    const [a, b] = await seedRanked(3);
    await expect(reorder(t.db, 2026, [b, a])).rejects.toBeInstanceOf(Invalid);
    await expect(reorder(t.db, 2026, [a, a, b])).rejects.toBeInstanceOf(Invalid);
    expect(await rankedNames()).toEqual([[1, "R1"], [2, "R2"], [3, "R3"]]);
  });

  it("refuses shortlist ids", async () => {
    const [a] = await seedRanked(1);
    const s = await addEntry(t.db, 2026, album());
    await expect(reorder(t.db, 2026, [s.id])).rejects.toBeInstanceOf(Invalid);
    await expect(reorder(t.db, 2026, [a, s.id])).rejects.toBeInstanceOf(Invalid);
  });
});

describe("editing", () => {
  it("saves blurb, label and up to two picks from the album", async () => {
    const e = await addEntry(t.db, 2026, album());
    await updateEntry(t.db, e.id, { blurb: "So good.\n\nReally.", label: "Own Label", picks: [e.tracks[2].id, e.tracks[0].id] });
    const [got] = (await getListWithEntries(t.db, 2026))!.shortlist;
    expect(got).toMatchObject({ blurb: "So good.\n\nReally.", label: "Own Label", picks: [e.tracks[2].id, e.tracks[0].id] });
  });

  it("a partial edit keeps the other fields", async () => {
    const e = await addEntry(t.db, 2026, album());
    await updateEntry(t.db, e.id, { blurb: "x", picks: [e.tracks[0].id] });
    await updateEntry(t.db, e.id, { label: "y" });
    const [got] = (await getListWithEntries(t.db, 2026))!.shortlist;
    expect(got).toMatchObject({ blurb: "x", label: "y", picks: [e.tracks[0].id] });
  });

  it("refuses picks that aren't on the album, or the same track twice", async () => {
    const e = await addEntry(t.db, 2026, album());
    await expect(updateEntry(t.db, e.id, { picks: ["nope"] })).rejects.toBeInstanceOf(Invalid);
    await expect(updateEntry(t.db, e.id, { picks: [e.tracks[0].id, e.tracks[0].id] })).rejects.toBeInstanceOf(Invalid);
  });

  it("the schema itself refuses three picks", async () => {
    const e = await addEntry(t.db, 2026, album());
    await expect(
      t.db.query("UPDATE entries SET picks = '[\"a\",\"b\",\"c\"]' WHERE id = $1", [e.id]),
    ).rejects.toThrow();
  });
});

describe("adding by hand", () => {
  it("adding an album already on the list leaves it in place", async () => {
    const a = album();
    const e = await addEntry(t.db, 2026, a);
    await placeEntry(t.db, e.id, 1);
    const again = await addEntry(t.db, 2026, a);
    expect(again).toMatchObject({ id: e.id, status: "ranked", position: 1 });
  });

  it("re-adding a dismissed album brings it back to the shortlist", async () => {
    const a = album();
    const e = await addEntry(t.db, 2026, a);
    await placeEntry(t.db, e.id, "dismissed");
    expect(await addEntry(t.db, 2026, a)).toMatchObject({ id: e.id, status: "shortlist" });
  });
});

describe("import", () => {
  it("parses the shared contract fixture", () => {
    expect(importSchema.parse(fixture).candidates).toHaveLength(2);
  });

  it("rejects a payload from a future contract version", () => {
    expect(importSchema.safeParse({ ...fixture, version: 3 }).success).toBe(false);
  });

  it("a v1 payload can't carry ranks or null play counts", () => {
    const ranked = structuredClone(fixture);
    ranked.candidates[0].rank = 1;
    expect(importSchema.safeParse(ranked).success).toBe(false);
    const noCounts = structuredClone(fixture);
    noCounts.candidates[0].scrobbles = null;
    expect(importSchema.safeParse(noCounts).success).toBe(false);
  });

  it("creates shortlist entries ordered by listens", async () => {
    expect(await importCandidates(t.db, importSchema.parse(fixture))).toEqual({ created: 2, updated: 0, ranked: 0 });
    const list = await getListWithEntries(t.db, 2026);
    expect(list!.shortlist.map((e) => [e.album, e.scrobbles, e.listens])).toEqual([
      ["Thanks, Sorry!", 30, 15],
      ["Singin' to an Empty Chair", 9, 9],
    ]);
  });

  it("a re-import refreshes play counts but never your edits", async () => {
    const payload = importSchema.parse(fixture);
    await importCandidates(t.db, payload);
    const list = await getListWithEntries(t.db, 2026);
    const [jeff, ratboys] = list!.shortlist;
    await placeEntry(t.db, jeff.id, 1);
    await updateEntry(t.db, jeff.id, { blurb: "mine", label: "my label", picks: ["t2"] });
    await placeEntry(t.db, ratboys.id, "dismissed");

    const again = structuredClone(payload);
    again.candidates[0].scrobbles = 50;
    again.candidates[0].listens = 25;
    again.candidates[0].label = "Polyvinyl";
    expect(await importCandidates(t.db, again)).toEqual({ created: 0, updated: 2, ranked: 0 });

    const after = await getListWithEntries(t.db, 2026);
    expect(after!.ranked[0]).toMatchObject({
      position: 1, blurb: "mine", label: "my label", picks: ["t2"], scrobbles: 50, listens: 25,
    });
    expect(after!.dismissed.map((e) => e.album)).toEqual(["Singin' to an Empty Chair"]);
    expect(after!.shortlist).toHaveLength(0);
  });

  it("is all-or-nothing", async () => {
    const payload = importSchema.parse(fixture);
    payload.candidates[1].artist = null as never; // violates NOT NULL in the second insert
    await expect(importCandidates(t.db, payload)).rejects.toThrow();
    expect(await t.db.query("SELECT 1 FROM entries")).toHaveLength(0);
  });
});

describe("ranked import (v2)", () => {
  const v2 = () => importSchema.parse(structuredClone(fixtureV2));
  const rankedOf = async (year: number) =>
    (await getListWithEntries(t.db, year))!.ranked.map((e) => [e.position, e.artist]);

  it("parses the shared v2 fixture, including the album that isn't on Spotify", () => {
    const p = v2();
    expect(p.candidates.map((c) => c.rank)).toEqual([1, 2]);
    expect(p.candidates[1]).toMatchObject({ spotify_album_id: expect.stringMatching(/^ext:/), tracks: [], scrobbles: null });
  });

  it("puts the albums straight onto the list in rank order", async () => {
    expect(await importCandidates(t.db, v2())).toEqual({ created: 2, updated: 0, ranked: 2 });
    expect(await rankedOf(2025)).toEqual([[1, "Ryan Davis & the Roadhouse Band"], [2, "Frog Eyes"]]);
    const list = await getListWithEntries(t.db, 2025);
    expect(list!.shortlist).toHaveLength(0);
    expect(list!.ranked[1]).toMatchObject({ spotify_url: "https://frogeyes.bandcamp.com/album/the-open-up", scrobbles: null });
  });

  it("a re-import with new ranks reorders but keeps picks, text and label", async () => {
    await importCandidates(t.db, v2());
    const [ryan] = (await getListWithEntries(t.db, 2025))!.ranked;
    await updateEntry(t.db, ryan.id, { blurb: "mine", label: "my label", picks: ["t25a2"] });
    const swapped = v2();
    swapped.candidates[0].rank = 2;
    swapped.candidates[1].rank = 1;
    expect(await importCandidates(t.db, swapped)).toEqual({ created: 0, updated: 2, ranked: 2 });
    expect(await rankedOf(2025)).toEqual([[1, "Frog Eyes"], [2, "Ryan Davis & the Roadhouse Band"]]);
    expect((await getListWithEntries(t.db, 2025))!.ranked[1]).toMatchObject({ blurb: "mine", label: "my label", picks: ["t25a2"] });
  });

  it("albums ranked before but missing from the import go back to the shortlist", async () => {
    const extra = await addEntry(t.db, 2025, album({ album: "Dropped" }));
    await placeEntry(t.db, extra.id, 1);
    await importCandidates(t.db, v2());
    const list = await getListWithEntries(t.db, 2025);
    expect(list!.ranked.map((e) => e.position)).toEqual([1, 2]);
    expect(list!.shortlist.map((e) => e.album)).toEqual(["Dropped"]);
  });

  it("a ranked album you had dismissed comes back onto the list", async () => {
    await importCandidates(t.db, v2());
    const frog = (await getListWithEntries(t.db, 2025))!.ranked[1];
    await placeEntry(t.db, frog.id, "dismissed");
    await importCandidates(t.db, v2());
    expect(await rankedOf(2025)).toEqual([[1, "Ryan Davis & the Roadhouse Band"], [2, "Frog Eyes"]]);
  });

  it("null play counts keep the ones already there", async () => {
    const seeded = importSchema.parse({ ...structuredClone(fixture), year: 2025 });
    seeded.candidates[0].spotify_album_id = "alb25a";
    await importCandidates(t.db, seeded);
    await importCandidates(t.db, v2());
    expect((await getListWithEntries(t.db, 2025))!.ranked[0]).toMatchObject({ scrobbles: 30, listens: 15 });
  });

  it("unranked v2 candidates still go to the shortlist", async () => {
    const p = v2();
    delete p.candidates[1].rank;
    expect(await importCandidates(t.db, p)).toEqual({ created: 2, updated: 0, ranked: 1 });
    expect((await getListWithEntries(t.db, 2025))!.shortlist.map((e) => e.artist)).toEqual(["Frog Eyes"]);
  });

  it.each([
    ["a gap", [1, 3]],
    ["a repeat", [1, 1]],
    ["not starting at 1", [2, 3]],
  ])("refuses ranks with %s and writes nothing", async (_name, ranks) => {
    const p = v2();
    p.candidates.forEach((c, i) => (c.rank = ranks[i]));
    await expect(importCandidates(t.db, p)).rejects.toThrow(Invalid);
    expect(await t.db.query("SELECT 1 FROM entries")).toHaveLength(0);
  });

  it("refuses the same album twice in one import", () => {
    const p = v2();
    p.candidates[1].spotify_album_id = p.candidates[0].spotify_album_id;
    expect(() => importedOrder(p)).toThrow("in the import twice");
  });

  it("lists years newest first, optionally only published ones", async () => {
    await importCandidates(t.db, v2());
    await ensureList(t.db, 2026);
    await updateList(t.db, 2025, { published: true });
    expect(await listYears(t.db)).toEqual([2026, 2025]);
    expect(await listYears(t.db, { published: true })).toEqual([2025]);
  });
});
