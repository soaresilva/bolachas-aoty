import { beforeEach, describe, expect, it, vi } from "vitest";
import { albumIdFromLink, getAlbum, resetSpotifyToken, searchAlbums } from "@/lib/spotify";

const ID = "6x7GcRVsLVx6nZ6fLJbVvc";

function fakeFetch(routes: Record<string, unknown>) {
  const calls: string[] = [];
  const fn = vi.fn(async (url: string | URL) => {
    const u = String(url);
    calls.push(u);
    if (u.includes("accounts.spotify.com")) return Response.json({ access_token: "tok", expires_in: 3600 });
    const key = Object.keys(routes).find((k) => u.includes(k));
    if (!key) return new Response("nope", { status: 404 });
    return Response.json(routes[key]);
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

beforeEach(() => {
  resetSpotifyToken();
  vi.stubEnv("SPOTIFY_CLIENT_ID", "id");
  vi.stubEnv("SPOTIFY_CLIENT_SECRET", "secret");
});

const album = {
  id: ID, name: "Getting Killed", album_type: "album", release_date: "2026-09-26", label: "Partisan",
  images: [{ url: "big", width: 640 }, { url: "small", width: 64 }],
  artists: [{ name: "Geese" }], external_urls: { spotify: `https://open.spotify.com/album/${ID}` },
  tracks: { items: [{ id: "t1", name: "Trinidad", track_number: 1, duration_ms: 1 }], next: "https://api.spotify.com/v1/next-page" },
};

describe("albumIdFromLink", () => {
  it("finds album ids in links and URIs", () => {
    expect(albumIdFromLink(`https://open.spotify.com/album/${ID}?si=abc`)).toBe(ID);
    expect(albumIdFromLink(`https://open.spotify.com/intl-pt/album/${ID}`)).toBe(ID);
    expect(albumIdFromLink(`spotify:album:${ID}`)).toBe(ID);
    expect(albumIdFromLink("geese getting killed")).toBeNull();
    expect(albumIdFromLink(`https://open.spotify.com/track/${ID}`)).toBeNull();
  });
});

describe("getAlbum", () => {
  it("returns entry fields with every page of tracks, skipping unplayable ones", async () => {
    const { fn } = fakeFetch({
      [`/albums/${ID}`]: album,
      "next-page": { items: [{ id: "t2", name: "Taxes", track_number: 2, duration_ms: 2 }, { id: null, name: "x", track_number: 3, duration_ms: 1 }], next: null },
    });
    const got = await getAlbum(ID, fn);
    expect(got).toMatchObject({ spotify_album_id: ID, artist: "Geese", album: "Getting Killed", label: "Partisan", cover_url: "big" });
    expect(got.tracks.map((t) => t.id)).toEqual(["t1", "t2"]);
  });
});

describe("searchAlbums", () => {
  it("maps hits with the smallest cover, reusing one token", async () => {
    const { fn, calls } = fakeFetch({ "/search": { albums: { items: [album, null] } } });
    expect(await searchAlbums("geese", fn)).toEqual([
      { id: ID, name: "Getting Killed", artist: "Geese", release_date: "2026-09-26", album_type: "album", image: "small" },
    ]);
    await searchAlbums("geese", fn);
    expect(calls.filter((c) => c.includes("accounts.spotify.com"))).toHaveLength(1);
  });
  it("a pasted album link looks that album up directly", async () => {
    const { fn, calls } = fakeFetch({ [`/albums/${ID}`]: album });
    const hits = await searchAlbums(`https://open.spotify.com/album/${ID}`, fn);
    expect(hits.map((h) => h.id)).toEqual([ID]);
    expect(calls.some((c) => c.includes("/search"))).toBe(false);
  });
  it("fails loudly without credentials", async () => {
    vi.stubEnv("SPOTIFY_CLIENT_ID", "");
    await expect(searchAlbums("x", fakeFetch({}).fn)).rejects.toThrow(/SPOTIFY_CLIENT_ID/);
  });
});
