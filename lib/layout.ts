/** The first FULL_WIDTH_COUNT albums get a full-width row each; the rest sit
 * two to a row (21 and 22, 23 and 24, ...). */
export const FULL_WIDTH_COUNT = 20;

export function splitRanked<T>(ranked: T[], full = FULL_WIDTH_COUNT): { top: T[]; rest: T[] } {
  return { top: ranked.slice(0, full), rest: ranked.slice(full) };
}

/** Artist sort key: no accents, no case, no leading "The ". */
export function artistSortKey(artist: string): string {
  return artist
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^the\s+/, "");
}

/** A list whose positions past `after` aren't numbered: the first `after`
 * keep their order, the rest come back alphabetical by artist (then album).
 * `after` null numbers everything. */
export function splitNumbering<T extends { artist: string; album: string }>(
  ranked: T[],
  after: number | null,
): { numbered: T[]; alphabetical: T[] } {
  if (after === null) return { numbered: ranked, alphabetical: [] };
  const alphabetical = ranked.slice(after).sort(
    (a, b) =>
      artistSortKey(a.artist).localeCompare(artistSortKey(b.artist), "en") ||
      a.album.localeCompare(b.album, "en"),
  );
  return { numbered: ranked.slice(0, after), alphabetical };
}
