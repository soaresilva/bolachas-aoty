import { describe, expect, it } from "vitest";
import { renderWordPressHtml } from "@/lib/export";
import { paragraphs, pickedTracks } from "@/lib/text";
import type { Entry, ListWithEntries } from "@/lib/types";

const entry = (over: Partial<Entry>): Entry => ({
  id: 1, status: "ranked", position: 1, spotify_album_id: "a", artist: "Geese", album: "Getting Killed",
  label: "Partisan", release_date: "2026-09-26", cover_url: "https://i.scdn.co/image/x",
  spotify_url: "https://open.spotify.com/album/a",
  tracks: [{ id: "t1", name: "Taxes", track_number: 1, duration_ms: 1 }, { id: "t2", name: "Trinidad", track_number: 2, duration_ms: 1 }],
  picks: [], blurb: "", scrobbles: null, listens: null, ...over,
});

const list = (ranked: Entry[], intro = "", links: ListWithEntries["links"] = []): ListWithEntries => ({
  id: 1, year: 2026, title: "Favorite albums of 2026", intro, published: true, links, ranked, shortlist: [], dismissed: [],
});

describe("paragraphs", () => {
  it("splits on blank lines and keeps single line breaks", () => {
    expect(paragraphs("a\nb\n\n\n  c  \r\n\r\nd")).toEqual([["a", "b"], ["c"], ["d"]]);
    expect(paragraphs("   \n\n ")).toEqual([]);
  });
});

describe("pickedTracks", () => {
  it("keeps pick order and skips tracks no longer on the album", () => {
    expect(pickedTracks(entry({}).tracks, ["t2", "gone", "t1"]).map((t) => t.name)).toEqual(["Trinidad", "Taxes"]);
  });
});

describe("renderWordPressHtml", () => {
  it("renders each ranked entry in order with position, names, label, picks and text", () => {
    const html = renderWordPressHtml(
      list(
        [entry({ blurb: "One.\n\nTwo", picks: ["t2"] }), entry({ id: 2, position: 2, artist: "Ratboys", album: "Singin'", label: "" })],
        "Intro here.",
      ),
    );
    expect(html.indexOf("Geese")).toBeLessThan(html.indexOf("Ratboys"));
    expect(html).toContain("<p>Intro here.</p>");
    expect(html).toContain(">1</p>");
    expect(html).toContain("<em>Getting Killed</em>");
    expect(html).toContain("Partisan");
    expect(html).toContain('Key tracks: <a href="https://open.spotify.com/track/t2">Trinidad</a>');
    expect(html).toContain("<p>One.</p>\n<p>Two</p>");
    expect(html.match(/Key tracks/g)).toHaveLength(1);
  });

  it("escapes everything typed in the admin", () => {
    const html = renderWordPressHtml(list([entry({ artist: "<script>x</script>", blurb: 'a "b" & <i>c</i>' })]));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a &quot;b&quot; &amp; &lt;i&gt;c&lt;/i&gt;");
  });
});

describe("export links", () => {
  it("puts the list's links under the intro, escaped", () => {
    const html = renderWordPressHtml(list([entry({})], "Intro.", [
      { label: "Top 50 & more", url: "https://open.spotify.com/playlist/p1" },
      { label: "Now Playing", url: "https://open.spotify.com/playlist/p2" },
    ]));
    expect(html).toContain('<p><a href="https://open.spotify.com/playlist/p1">Top 50 &amp; more</a> · <a href="https://open.spotify.com/playlist/p2">Now Playing</a></p>');
    expect(html.indexOf("Intro.")).toBeLessThan(html.indexOf("Top 50"));
  });
});
