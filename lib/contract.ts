import { z } from "zod";

// Import contract, shared with spotify-curator. The fixtures in
// contracts/fixtures/ are checked by both repos' tests (built by the Python
// side, parsed here).
// v1: aoty_seed.py --push, listening-history candidates for the shortlist.
// v2: aoty_list.py --push, a finished ranked list. Adds `rank` per candidate
//     and allows null scrobbles/listens (a list made by hand has no play
//     counts). spotify_album_id may be "ext:<url>" for an album that isn't
//     on Spotify; its spotify_url then points wherever it is (Bandcamp).
//     Optional `picks` and `blurb` per candidate and `links` for the list
//     only fill fields that are still empty on the site, never your edits.
//     Optional `unranked_after` (list-level): positions past it are shown
//     unnumbered, alphabetical by artist. Filled the same way, only while unset.

export const trackSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  track_number: z.number().int(),
  duration_ms: z.number().int(),
});

/** A link shown under the list's intro, e.g. the year's playlist. */
export const linkSchema = z.object({
  label: z.string().trim().min(1).max(80),
  url: z.url({ protocol: /^https$/ }).max(500),
});

/** Positions past this number are listed alphabetically without a number. */
export const unrankedAfterSchema = z.number().int().min(1).max(500).nullable();

export const candidateSchema = z.object({
  spotify_album_id: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().min(1),
  label: z.string(),
  release_date: z.string(),
  cover_url: z.string(),
  spotify_url: z.string(),
  total_tracks: z.number().int().nonnegative(),
  scrobbles: z.number().int().nonnegative().nullable(),
  listens: z.number().nonnegative().nullable(),
  tracks: z.array(trackSchema),
  rank: z.number().int().min(1).optional(),
  picks: z.array(z.string().min(1)).max(2).optional(),
  blurb: z.string().max(5000).optional(),
});

export const importSchema = z
  .object({
    version: z.union([z.literal(1), z.literal(2)]),
    year: z.number().int().min(2000).max(2100),
    generated_at: z.string(),
    candidates: z.array(candidateSchema).max(500),
    links: z.array(linkSchema).max(10).optional(),
    unranked_after: unrankedAfterSchema.optional(),
  })
  .superRefine((p, ctx) => {
    if (p.version === 1 && (p.links || p.unranked_after !== undefined)) {
      ctx.addIssue({ code: "custom", path: ["links"], message: "links and unranked_after need version 2" });
    }
    p.candidates.forEach((c, i) => {
      const v2Only = c.rank !== undefined || c.scrobbles === null || c.listens === null || c.picks || c.blurb !== undefined;
      if (p.version === 1 && v2Only) {
        ctx.addIssue({ code: "custom", path: ["candidates", i], message: "rank, picks, blurb and null play counts need version 2" });
      }
      const ids = new Set(c.tracks.map((t) => t.id));
      if (c.picks && (new Set(c.picks).size !== c.picks.length || c.picks.some((id) => !ids.has(id)))) {
        ctx.addIssue({ code: "custom", path: ["candidates", i, "picks"], message: "picks must be two different tracks of the album" });
      }
    });
  });

export type Candidate = z.infer<typeof candidateSchema>;
export type ImportPayload = z.infer<typeof importSchema>;

/** Admin edits. Every field optional; only the ones present change. */
export const entryPatchSchema = z
  .object({
    blurb: z.string().max(5000),
    label: z.string().max(200),
    picks: z.array(z.string().min(1)).max(2),
  })
  .partial()
  .strict();

/** Where to put an entry: a 1-based rank, back to the shortlist, or dismissed. */
export const placeSchema = z.object({
  place: z.union([z.number().int().min(1), z.literal("shortlist"), z.literal("dismissed")]),
});

export const listPatchSchema = z
  .object({
    title: z.string().max(200),
    intro: z.string().max(10000),
    published: z.boolean(),
    links: z.array(linkSchema).max(10),
    unranked_after: unrankedAfterSchema,
  })
  .partial()
  .strict();

export const orderSchema = z.object({ ids: z.array(z.number().int()) });

export const addSchema = z.object({ spotify_album_id: z.string().regex(/^[A-Za-z0-9]{10,40}$/) });
