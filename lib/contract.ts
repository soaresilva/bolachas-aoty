import { z } from "zod";

// Import contract v1: what spotify-curator's aoty_seed.py --push sends.
// The shared fixture contracts/fixtures/aoty_import_v1.json is checked by
// both repos' tests (built by the Python side, parsed here).

export const trackSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  track_number: z.number().int(),
  duration_ms: z.number().int(),
});

export const candidateSchema = z.object({
  spotify_album_id: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().min(1),
  label: z.string(),
  release_date: z.string(),
  cover_url: z.string(),
  spotify_url: z.string(),
  total_tracks: z.number().int().nonnegative(),
  scrobbles: z.number().int().nonnegative(),
  listens: z.number().nonnegative(),
  tracks: z.array(trackSchema),
});

export const importSchema = z.object({
  version: z.literal(1),
  year: z.number().int().min(2000).max(2100),
  generated_at: z.string(),
  candidates: z.array(candidateSchema).max(500),
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
  })
  .partial()
  .strict();

export const orderSchema = z.object({ ids: z.array(z.number().int()) });

export const addSchema = z.object({ spotify_album_id: z.string().regex(/^[A-Za-z0-9]{10,40}$/) });
