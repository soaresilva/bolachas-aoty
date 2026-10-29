import { describe, expect, it, vi } from "vitest";
import { formatLinks, linkSite, parseLinks } from "@/lib/text";

describe("linkSite", () => {
  it.each([
    ["https://open.spotify.com/album/abc", "Spotify"],
    ["https://frogeyes.bandcamp.com/album/the-open-up", "Bandcamp"],
    ["https://bandcamp.com/x", "Bandcamp"],
    ["https://www.thirdmanstore.com/raspberry-moon", "thirdmanstore.com"],
    ["not a url", "the web"],
  ])("%s -> %s", (url, site) => {
    expect(linkSite(url)).toBe(site);
  });
});

describe("admin year", () => {
  it("reads ?year, falls back to the featured year, and links every list year", async () => {
    vi.stubEnv("FEATURED_YEAR", "2026");
    vi.resetModules();
    const { adminYear, adminYears } = await import("@/lib/config");
    expect(adminYear("2025")).toBe(2025);
    expect(adminYear(["2024", "2025"])).toBe(2024);
    expect(adminYear(undefined)).toBe(2026);
    expect(adminYear("nope")).toBe(2026);
    expect(adminYear("1999")).toBe(2026);
    expect(adminYears([2025], 2024)).toEqual([2026, 2025, 2024]);
    expect(adminYears([2026, 2025], 2026)).toEqual([2026, 2025]);
    vi.unstubAllEnvs();
  });
});

describe("links box", () => {
  it("parses Label | URL lines, skipping blanks, and round-trips", () => {
    const links = parseLinks("Top 50 2025 | https://open.spotify.com/playlist/a\n\n  https://frogeyes.bandcamp.com/  \nA | B | https://x.org/");
    expect(links).toEqual([
      { label: "Top 50 2025", url: "https://open.spotify.com/playlist/a" },
      { label: "Bandcamp", url: "https://frogeyes.bandcamp.com/" },
      { label: "A | B", url: "https://x.org/" },
    ]);
    expect(parseLinks(formatLinks(links))).toEqual(links);
  });
});
