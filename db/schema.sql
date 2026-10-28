-- Idempotent: `npm run migrate` applies this whole file on every deploy.

CREATE TABLE IF NOT EXISTS lists (
  id          serial PRIMARY KEY,
  year        integer NOT NULL UNIQUE,
  title       text NOT NULL DEFAULT '',
  intro       text NOT NULL DEFAULT '',
  published   boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entries (
  id                serial PRIMARY KEY,
  list_id           integer NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  -- 'ranked' entries are the list; 'shortlist' holds candidates (imported
  -- from listening history or added by hand) that aren't placed yet;
  -- 'dismissed' are candidates you said no to, kept so a re-import doesn't
  -- bring them back.
  status            text NOT NULL DEFAULT 'shortlist' CHECK (status IN ('ranked', 'shortlist', 'dismissed')),
  position          integer,
  spotify_album_id  text NOT NULL,
  artist            text NOT NULL,
  album             text NOT NULL,
  label             text NOT NULL DEFAULT '',
  release_date      text NOT NULL DEFAULT '',
  cover_url         text NOT NULL DEFAULT '',
  spotify_url       text NOT NULL DEFAULT '',
  tracks            jsonb NOT NULL DEFAULT '[]',
  picks             jsonb NOT NULL DEFAULT '[]',
  blurb             text NOT NULL DEFAULT '',
  scrobbles         integer,
  listens           real,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_id, spotify_album_id),
  -- Deferred so a reorder can rewrite every position in one transaction.
  CONSTRAINT entries_position_unique UNIQUE (list_id, position) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT entries_position_matches_status CHECK (
    (status = 'ranked' AND position >= 1) OR (status <> 'ranked' AND position IS NULL)
  ),
  CONSTRAINT entries_at_most_two_picks CHECK (jsonb_array_length(picks) <= 2)
);

CREATE INDEX IF NOT EXISTS entries_list_status ON entries (list_id, status, position);
