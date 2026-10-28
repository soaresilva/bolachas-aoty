export type Track = { id: string; name: string; track_number: number; duration_ms: number };

export type Status = "ranked" | "shortlist" | "dismissed";

export type Entry = {
  id: number;
  status: Status;
  position: number | null;
  spotify_album_id: string;
  artist: string;
  album: string;
  label: string;
  release_date: string;
  cover_url: string;
  spotify_url: string;
  tracks: Track[];
  picks: string[];
  blurb: string;
  scrobbles: number | null;
  listens: number | null;
};

export type List = {
  id: number;
  year: number;
  title: string;
  intro: string;
  published: boolean;
};

export type ListWithEntries = List & { ranked: Entry[]; shortlist: Entry[]; dismissed: Entry[] };
