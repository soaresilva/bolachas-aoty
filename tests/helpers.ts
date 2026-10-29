import { readFileSync } from "node:fs";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import type { Db } from "@/lib/db";

const SCHEMA = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

function wrap(pg: PGlite | Transaction): Db {
  const db: Db = {
    async query(text, params) {
      return (await pg.query(text, params)).rows as never[];
    },
    tx: (fn) => ("transaction" in pg ? pg.transaction((t) => fn(wrap(t))) : fn(db)),
  };
  return db;
}

/** A real Postgres (PGlite, in-process) with the production schema. One per
 * test file; reset() empties it between tests. */
export async function testDb() {
  const pg = new PGlite();
  await pg.exec(SCHEMA);
  return {
    db: wrap(pg),
    reset: () => pg.exec("TRUNCATE entries, lists RESTART IDENTITY CASCADE"),
    close: () => pg.close(),
  };
}

export const fixture = JSON.parse(
  readFileSync(new URL("../contracts/fixtures/aoty_import_v1.json", import.meta.url), "utf8"),
);

/** v2: a finished ranked list (aoty_list.py), one album not on Spotify. */
export const fixtureV2 = JSON.parse(
  readFileSync(new URL("../contracts/fixtures/aoty_import_v2.json", import.meta.url), "utf8"),
);

let n = 0;
export function album(over: Record<string, unknown> = {}) {
  n++;
  return {
    spotify_album_id: `album${n}`,
    artist: `Artist ${n}`,
    album: `Album ${n}`,
    label: `Label ${n}`,
    release_date: "2026-05-01",
    cover_url: `https://i.scdn.co/image/${n}`,
    spotify_url: `https://open.spotify.com/album/album${n}`,
    tracks: [
      { id: `t${n}a`, name: "First", track_number: 1, duration_ms: 1000 },
      { id: `t${n}b`, name: "Second", track_number: 2, duration_ms: 1000 },
      { id: `t${n}c`, name: "Third", track_number: 3, duration_ms: 1000 },
    ],
    ...over,
  };
}
