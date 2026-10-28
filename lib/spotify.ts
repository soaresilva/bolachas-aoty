import type { Track } from "./types";

// App-only Spotify access (client credentials): search and album lookups
// need no user login, so the admin can add any album without OAuth.

const API = "https://api.spotify.com/v1";
const market = () => process.env.SPOTIFY_MARKET || "NL";

let token: { value: string; expires: number } | null = null;

async function accessToken(fetchFn = fetch) {
  if (token && token.expires > Date.now() + 30_000) return token.value;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set");
  const res = await fetchFn("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify token request failed: ${res.status}`);
  const data = await res.json();
  token = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return token.value;
}

export function resetSpotifyToken() {
  token = null;
}

async function get(pathOrUrl: string, fetchFn = fetch) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${API}${pathOrUrl}`;
  const res = await fetchFn(url, { headers: { Authorization: `Bearer ${await accessToken(fetchFn)}` } });
  if (!res.ok) throw new Error(`Spotify ${res.status} on ${url}`);
  return res.json();
}

type SpotifyImage = { url: string; width?: number };
type SpotifyAlbum = {
  id: string;
  name: string;
  album_type: string;
  release_date: string;
  label?: string;
  images?: SpotifyImage[];
  artists: { name: string }[];
  external_urls?: { spotify?: string };
  tracks?: { items: SpotifyTrack[]; next: string | null };
};
type SpotifyTrack = { id: string | null; name: string; track_number: number; duration_ms: number };

export type SearchHit = {
  id: string;
  name: string;
  artist: string;
  release_date: string;
  album_type: string;
  image: string;
};

const smallestImage = (images: SpotifyImage[] = []) =>
  [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0]?.url ?? "";

/** The album id in a pasted Spotify link or URI, if there is one. */
export function albumIdFromLink(text: string) {
  return /(?:open\.spotify\.com\/(?:intl-[a-z]+\/)?album\/|spotify:album:)([A-Za-z0-9]{22})/.exec(text)?.[1] ?? null;
}

export async function searchAlbums(query: string, fetchFn = fetch): Promise<SearchHit[]> {
  const linked = albumIdFromLink(query);
  if (linked) {
    const a: SpotifyAlbum = await get(`/albums/${linked}?market=${market()}`, fetchFn);
    return [toHit(a)];
  }
  const params = new URLSearchParams({ q: query, type: "album", limit: "10", market: market() });
  const data = await get(`/search?${params}`, fetchFn);
  return (data.albums?.items ?? []).filter(Boolean).map(toHit);
}

function toHit(a: SpotifyAlbum): SearchHit {
  return {
    id: a.id,
    name: a.name,
    artist: a.artists.map((x) => x.name).join(", "),
    release_date: a.release_date,
    album_type: a.album_type,
    image: smallestImage(a.images),
  };
}

/** Everything an entry stores about an album: same shape as an imported
 * candidate, minus the play counts. */
export async function getAlbum(id: string, fetchFn = fetch) {
  const album: SpotifyAlbum = await get(`/albums/${id}?market=${market()}`, fetchFn);
  const items: SpotifyTrack[] = [...(album.tracks?.items ?? [])];
  let next = album.tracks?.next ?? null;
  while (next) {
    const page = await get(next, fetchFn);
    items.push(...page.items);
    next = page.next;
  }
  const tracks: Track[] = items
    .filter((t): t is SpotifyTrack & { id: string } => !!t.id)
    .map((t) => ({ id: t.id, name: t.name, track_number: t.track_number, duration_ms: t.duration_ms }));
  return {
    spotify_album_id: album.id,
    artist: album.artists.map((a) => a.name).join(", "),
    album: album.name,
    label: album.label ?? "",
    release_date: album.release_date,
    cover_url: album.images?.[0]?.url ?? "",
    spotify_url: album.external_urls?.spotify ?? `https://open.spotify.com/album/${album.id}`,
    tracks,
  };
}
