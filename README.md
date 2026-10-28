# bolachas-aoty

Bolachas' favorite albums of the year: a public, ranked list page plus a small
admin for building it. Next.js on Vercel, Postgres (Neon) for storage.

- **Public:** `/<year>` (e.g. `/2026`). Each album shows its position, cover, artist, album, label, up to two key tracks (linked to Spotify) and your text. `/` redirects to the featured year (`FEATURED_YEAR`), and each year has a share card at `/<year>/opengraph-image`.
- **Admin:** `/admin`, behind a single password. It has:
  - a drag-and-drop ranked list (with up/down buttons and "move to #N" too)
  - a shortlist of candidates sorted by how much you listened to them
  - Spotify search, to add any album
  - a per-album editor for label, key tracks and text
  - a draft preview and a publish toggle
  - an "Export for WordPress" HTML file

The shortlist is seeded from Last.fm listening history by
[spotify-curator](https://github.com/soaresilva/spotify-curator)'s
`aoty_seed.py --push`. See "Import contract" below.

## How it fits together

```
spotify-curator (Pi)                         bolachas-aoty (Vercel)
aoty_seed.py                                 POST /api/admin/import  (Bearer AOTY_IMPORT_TOKEN)
  last.fm scrobbles of the year     ──────▶    upsert into shortlist, never touches your edits
  -> albums -> Spotify -> filter                 │
  -> rank by full-album listens                  ▼
                                             Postgres: lists, entries
                                                 │  every admin change calls revalidateTag
                                                 ▼
                                             /<year>  cached page ('use cache', cacheLife max)
```

- `lib/repo.ts` has all the SQL. Positions are always exactly 1..N. Every move is computed in `lib/order.ts` and written back in one `UPDATE ... FROM unnest(...) WITH ORDINALITY` statement. The unique index on `(list_id, position)` is deferred, so a rewrite never trips on itself mid-statement.
- `lib/public.ts` holds the cached reads behind the public pages. Admin writes revalidate the `list-<year>` tag with `{ expire: 0 }`, so the next visit renders fresh.
- Year pages are deliberately **not** prerendered at build: `generateStaticParams` returns only a placeholder `"0"`. When `/2026` was prerendered, the first request after every edit served the build-time snapshot (seen with `next start`, Next 16.4). A year rendered on its first visit is a plain ISR entry that the tag invalidates cleanly. `tests/pages.test.ts` keeps it that way, and `npm run smoke` checks it against a running server.
- Entries have three statuses:
  - `ranked`: on the list.
  - `shortlist`: a candidate.
  - `dismissed`: a candidate you said no to. A re-import doesn't bring it back.
- A list is only visible once you tick **Published**. Before that, `/<year>` shows "No list here" with `noindex`, and **Preview** (logged in) shows the draft.

## Environment variables (Vercel project settings)

| Variable | What |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string, set by the Neon integration. `POSTGRES_URL` or a prefixed name (`STORAGE_DATABASE_URL`) also works; see `lib/database-url.mjs` |
| `ADMIN_PASSWORD` | the admin login password |
| `SESSION_SECRET` | at least 32 random characters; signs the session cookie (`openssl rand -hex 32`) |
| `AOTY_IMPORT_TOKEN` | bearer token for `/api/admin/import`; the same value goes in spotify-curator's `.env` |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | any Spotify app (client-credentials flow, no user login); used by "Add an album" |
| `SPOTIFY_MARKET` | optional, default `NL` |
| `FEATURED_YEAR` | optional, default `2026`; where `/` redirects, and the year `/admin` edits |
| `SITE_URL` | optional; absolute base URL for share cards (defaults to Vercel's production domain) |

Changing the password or the secret logs out every existing session.

## Deploy

1. Push this repo to GitHub (`soaresilva/bolachas-aoty`).
2. In Vercel, use Add New → Project → import the repo. `vercel.json` pins the framework to Next.js and the build command to `npm run vercel-build`. If Settings → Build and Deployment still shows Framework Preset "Other" or an Output Directory override (as on the first import), set it to Next.js and clear the override.
3. In the project, go to Storage → add **Neon** (Marketplace, free plan) and connect it to all environments. This sets `DATABASE_URL`.
4. Add the other env vars above, then redeploy. `npm run vercel-build` applies `db/schema.sql` (idempotent) before `next build`, so the tables exist on the first deploy.
5. Domain: in Settings → Domains add `aoty.bolachas.org`, then create the CNAME Vercel shows at the DNS host. It's a plain CNAME; nothing changes for the bolachas.org certificate.
6. Seed: in spotify-curator's `.env` set `AOTY_SITE_URL=https://aoty.bolachas.org` and `AOTY_IMPORT_TOKEN=<same token>`. Then run `docker compose run --rm spotify-curator python aoty_seed.py --year 2026 --push`.

## Local development

```sh
npm install
docker run -d --name aoty-pg-dev -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=aoty -p 127.0.0.1:55432:5432 postgres:17-alpine
cat > .env.local <<EOF
DATABASE_URL=postgres://postgres:dev@127.0.0.1:55432/aoty
ADMIN_PASSWORD=dev
SESSION_SECRET=$(openssl rand -hex 32)
AOTY_IMPORT_TOKEN=dev-token
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
EOF
set -a; . ./.env.local; set +a; npm run migrate
npm run dev      # http://localhost:3000/admin
```

`next build` doesn't touch the database (no year page is prerendered at build, see below), so it runs without `DATABASE_URL`.

## Tests

```sh
npm test         # vitest: SQL runs on PGlite (real Postgres in-process), no services needed
npm run typecheck
npm run lint
npm run smoke    # against a running server: SMOKE_URL, ADMIN_PASSWORD, AOTY_IMPORT_TOKEN
```

`.githooks/pre-commit` runs all three. Enable it once per clone with `git config core.hooksPath .githooks`.

What's covered:
- `tests/order.test.ts`: the pure ordering operations.
- `tests/repo.test.ts`: every repository operation against the real schema. Placement and reordering keep positions at 1..N, stale orders are refused, a re-import preserves your edits and dismissals, imports are all-or-nothing, and the schema enforces at most two picks.
- `tests/routes.test.ts`: every admin route refuses unauthenticated requests, the import token opens only the import route, the full admin flow works end to end, and bad input returns 400s and 404s.
- `tests/auth.test.ts`, `tests/spotify.test.ts`, `tests/export.test.ts`: sessions, the Spotify client, and HTML escaping in the WordPress export.
- `tests/pages.test.ts`: no real year is prerendered at build.

`scripts/smoke.mjs` is the slower end-to-end check, run before shipping and against production after a deploy. It exercises auth refusals, every edit, publish/unpublish, and that the public page shows each change on the very first request. On a non-local URL it only reads unless `SMOKE_WRITE=1`.

## Import contract (v1)

`POST /api/admin/import` with `Authorization: Bearer $AOTY_IMPORT_TOKEN`:

```json
{ "version": 1, "year": 2026, "generated_at": "2026-10-28T12:00:00+00:00",
  "candidates": [{ "spotify_album_id": "...", "artist": "...", "album": "...", "label": "...",
                   "release_date": "2026-03-13", "cover_url": "...", "spotify_url": "...",
                   "total_tracks": 10, "scrobbles": 120, "listens": 12.0,
                   "tracks": [{ "id": "...", "name": "...", "track_number": 1, "duration_ms": 180000 }] }] }
```

The reply is `{"created": N, "updated": N, "year": 2026}`.
- New albums go to the shortlist.
- For albums already present (any status), only `scrobbles`, `listens` and `tracks` are refreshed. Rank, label, picks, text and dismissals are never touched, so re-running the seed is always safe.

The schema is in `lib/contract.ts`. `contracts/fixtures/aoty_import_v1.json` is the shared fixture: spotify-curator's tests check that `aoty_seed.build_payload` produces it, and this repo's tests parse and import it. A breaking change needs `version: 2` on both sides.

## WordPress

**Export for WordPress** in the admin downloads `aoty-<year>.html`. Paste its contents into a Custom HTML block. It uses inline styles only, so the theme's fonts and colors still apply, and everything typed in the admin is HTML-escaped.
