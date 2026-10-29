import type { Candidate, ImportPayload } from "./contract";
import type { Db } from "./db";
import { checkPermutation, placeAt, without } from "./order";
import type { Entry, List, ListWithEntries } from "./types";

export class NotFound extends Error {}
export class Invalid extends Error {}

const ENTRY_FIELDS = [
  "id", "status", "position", "spotify_album_id", "artist", "album", "label", "release_date",
  "cover_url", "spotify_url", "tracks", "picks", "blurb", "scrobbles", "listens",
];
const ENTRY_COLUMNS = ENTRY_FIELDS.join(", ");

export function defaultTitle(year: number) {
  return `Favorite albums of ${year}`;
}

export async function getList(db: Db, year: number): Promise<List | null> {
  const [row] = await db.query<List>(
    "SELECT id, year, title, intro, published, links FROM lists WHERE year = $1",
    [year],
  );
  return row ?? null;
}

export async function ensureList(db: Db, year: number): Promise<List> {
  await db.query(
    "INSERT INTO lists (year, title) VALUES ($1, $2) ON CONFLICT (year) DO NOTHING",
    [year, defaultTitle(year)],
  );
  return (await getList(db, year))!;
}

export async function getListWithEntries(db: Db, year: number): Promise<ListWithEntries | null> {
  const list = await getList(db, year);
  if (!list) return null;
  const rows = await db.query<Entry>(
    `SELECT ${ENTRY_COLUMNS} FROM entries WHERE list_id = $1
     ORDER BY position NULLS LAST, listens DESC NULLS LAST, artist, album`,
    [list.id],
  );
  return {
    ...list,
    ranked: rows.filter((e) => e.status === "ranked"),
    shortlist: rows.filter((e) => e.status === "shortlist"),
    dismissed: rows.filter((e) => e.status === "dismissed"),
  };
}

export async function updateList(
  db: Db,
  year: number,
  patch: Partial<Pick<List, "title" | "intro" | "published" | "links">>,
): Promise<List> {
  const list = await ensureList(db, year);
  const next = { ...list, ...patch };
  await db.query(
    "UPDATE lists SET title = $2, intro = $3, published = $4, links = $5::jsonb, updated_at = now() WHERE id = $1",
    [list.id, next.title, next.intro, next.published, JSON.stringify(next.links)],
  );
  return (await getList(db, year))!;
}

async function rankedOrder(db: Db, listId: number): Promise<number[]> {
  const rows = await db.query<{ id: number }>(
    "SELECT id FROM entries WHERE list_id = $1 AND status = 'ranked' ORDER BY position",
    [listId],
  );
  return rows.map((r) => r.id);
}

/** Makes `order` the ranked list, #1 first: one statement, so the deferred
 * unique(list_id, position) constraint only sees the final positions. */
async function writeOrder(db: Db, listId: number, order: number[]) {
  if (order.length === 0) return;
  await db.query(
    `UPDATE entries e SET status = 'ranked', position = v.ord, updated_at = now()
     FROM unnest($2::int[]) WITH ORDINALITY AS v(id, ord)
     WHERE e.id = v.id AND e.list_id = $1`,
    [listId, order],
  );
}

export async function reorder(db: Db, year: number, ids: number[]) {
  return db.tx(async (tx) => {
    const list = await getList(tx, year);
    if (!list) throw new NotFound(`no list for ${year}`);
    const problem = checkPermutation(await rankedOrder(tx, list.id), ids);
    if (problem) throw new Invalid(problem);
    await writeOrder(tx, list.id, ids);
  });
}

async function entryWithList(db: Db, id: number) {
  const [row] = await db.query<Entry & { list_id: number; year: number }>(
    `SELECT ${ENTRY_FIELDS.map((f) => `e.${f}`).join(", ")}, e.list_id, l.year
     FROM entries e JOIN lists l ON l.id = e.list_id WHERE e.id = $1`,
    [id],
  );
  if (!row) throw new NotFound(`no entry ${id}`);
  return row;
}

/** Puts an entry at a rank (shifting the others), back on the shortlist,
 * or dismissed. Returns the list's year.  */
export async function placeEntry(db: Db, id: number, place: number | "shortlist" | "dismissed") {
  return db.tx(async (tx) => {
    const entry = await entryWithList(tx, id);
    const order = await rankedOrder(tx, entry.list_id);
    if (typeof place === "number") {
      await writeOrder(tx, entry.list_id, placeAt(order, id, place));
    } else {
      await tx.query(
        "UPDATE entries SET status = $2, position = NULL, updated_at = now() WHERE id = $1",
        [id, place],
      );
      await writeOrder(tx, entry.list_id, without(order, id));
    }
    return entry.year;
  });
}

export async function updateEntry(
  db: Db,
  id: number,
  patch: { blurb?: string; label?: string; picks?: string[] },
) {
  const entry = await entryWithList(db, id);
  if (patch.picks) {
    const ids = new Set(entry.tracks.map((t) => t.id));
    if (new Set(patch.picks).size !== patch.picks.length) throw new Invalid("the same track twice");
    if (patch.picks.some((p) => !ids.has(p))) throw new Invalid("pick is not a track on this album");
  }
  await db.query(
    "UPDATE entries SET blurb = $2, label = $3, picks = $4::jsonb, updated_at = now() WHERE id = $1",
    [id, patch.blurb ?? entry.blurb, patch.label ?? entry.label, JSON.stringify(patch.picks ?? entry.picks)],
  );
  return entry.year;
}

type NewEntry = Omit<Candidate, "total_tracks" | "scrobbles" | "listens"> & {
  scrobbles?: number | null;
  listens?: number | null;
};

/** Adds an album to the shortlist. An album already on the list is left
 * where it is, except a dismissed one, which comes back to the shortlist
 * (adding it by hand means you changed your mind). */
export async function addEntry(db: Db, year: number, album: NewEntry): Promise<Entry> {
  const list = await ensureList(db, year);
  await db.query(
    `INSERT INTO entries (list_id, spotify_album_id, artist, album, label, release_date,
       cover_url, spotify_url, tracks, scrobbles, listens)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
     ON CONFLICT (list_id, spotify_album_id) DO UPDATE
       SET status = CASE WHEN entries.status = 'dismissed' THEN 'shortlist' ELSE entries.status END`,
    [
      list.id, album.spotify_album_id, album.artist, album.album, album.label, album.release_date,
      album.cover_url, album.spotify_url, JSON.stringify(album.tracks),
      album.scrobbles ?? null, album.listens ?? null,
    ],
  );
  const [row] = await db.query<Entry>(
    `SELECT ${ENTRY_COLUMNS} FROM entries WHERE list_id = $1 AND spotify_album_id = $2`,
    [list.id, album.spotify_album_id],
  );
  return row;
}

/** The ranks of a v2 import, checked: null if no candidate has one, else
 * the album ids in rank order. Ranks must be exactly 1..N and an album may
 * appear only once in the payload. */
export function importedOrder(payload: ImportPayload): string[] | null {
  const ids = payload.candidates.map((c) => c.spotify_album_id);
  const dupe = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dupe) throw new Invalid(`album ${dupe} is in the import twice`);
  const ranked = payload.candidates.filter((c) => c.rank !== undefined);
  if (ranked.length === 0) return null;
  const sorted = [...ranked].sort((a, b) => a.rank! - b.rank!);
  sorted.forEach((c, i) => {
    if (c.rank !== i + 1) throw new Invalid(`ranks must be 1..${ranked.length} with no gaps or repeats`);
  });
  return sorted.map((c) => c.spotify_album_id);
}

/** Applies an import. New albums land on the shortlist; albums already
 * there (in any status) only get their play counts and tracklist
 * refreshed (a null play count keeps the old one). Rank, picks, text,
 * label and dismissals are yours and never touched, so re-running the
 * seed is always safe.
 *
 * A v2 import with ranks is a finished list: those ranks become the
 * list's order, and albums ranked before but not in it go back to the
 * shortlist. Re-running it is safe too: picks, text and labels stay.
 *
 * A v2 import's picks, blurbs and links only fill what's still empty:
 * the first import sets them, later ones never overwrite an edit. */
export async function importCandidates(db: Db, payload: ImportPayload) {
  const order = importedOrder(payload);
  return db.tx(async (tx) => {
    const list = await ensureList(tx, payload.year);
    let created = 0;
    let updated = 0;
    let filledPicks = 0;
    let filledBlurbs = 0;
    const entryIds = new Map<string, number>();
    for (const c of payload.candidates) {
      const [row] = await tx.query<{ id: number; inserted: boolean }>(
        `INSERT INTO entries (list_id, spotify_album_id, artist, album, label, release_date,
           cover_url, spotify_url, tracks, scrobbles, listens)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
         ON CONFLICT (list_id, spotify_album_id) DO UPDATE
           SET scrobbles = COALESCE(EXCLUDED.scrobbles, entries.scrobbles),
               listens = COALESCE(EXCLUDED.listens, entries.listens),
               tracks = EXCLUDED.tracks, updated_at = now()
         RETURNING id, (xmax = 0) AS inserted`,
        [
          list.id, c.spotify_album_id, c.artist, c.album, c.label, c.release_date,
          c.cover_url, c.spotify_url, JSON.stringify(c.tracks), c.scrobbles, c.listens,
        ],
      );
      entryIds.set(c.spotify_album_id, row.id);
      if (row.inserted) created++;
      else updated++;
      if (c.picks?.length) {
        filledPicks += (await tx.query(
          "UPDATE entries SET picks = $2::jsonb WHERE id = $1 AND picks = '[]'::jsonb RETURNING id",
          [row.id, JSON.stringify(c.picks)],
        )).length;
      }
      if (c.blurb) {
        filledBlurbs += (await tx.query(
          "UPDATE entries SET blurb = $2 WHERE id = $1 AND blurb = '' RETURNING id",
          [row.id, c.blurb],
        )).length;
      }
    }
    const filledLinks = payload.links?.length
      ? (await tx.query(
          "UPDATE lists SET links = $2::jsonb WHERE id = $1 AND links = '[]'::jsonb RETURNING id",
          [list.id, JSON.stringify(payload.links)],
        )).length > 0
      : false;
    if (order) {
      const ids = order.map((albumId) => entryIds.get(albumId)!);
      await tx.query(
        `UPDATE entries SET status = 'shortlist', position = NULL, updated_at = now()
         WHERE list_id = $1 AND status = 'ranked' AND NOT (id = ANY($2::int[]))`,
        [list.id, ids],
      );
      await writeOrder(tx, list.id, ids);
    }
    return {
      created, updated, ranked: order?.length ?? 0,
      filled: { picks: filledPicks, blurbs: filledBlurbs, links: filledLinks },
    };
  });
}

/** Every year that has a list, newest first; `published` limits it to the public ones. */
export async function listYears(db: Db, { published = false } = {}): Promise<number[]> {
  const rows = await db.query<{ year: number }>(
    `SELECT year FROM lists ${published ? "WHERE published" : ""} ORDER BY year DESC`,
  );
  return rows.map((r) => r.year);
}
