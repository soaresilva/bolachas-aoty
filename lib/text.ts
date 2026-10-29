/** Plain text to paragraphs: blank lines separate paragraphs, single line
 * breaks stay line breaks. No markup is interpreted, so nothing typed in
 * the admin can inject HTML into the page. */
export function paragraphs(text: string): string[][] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0);
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const trackUrl = (id: string) => `https://open.spotify.com/track/${id}`;

/** The picked tracks in pick order, skipping any no longer on the album. */
export function pickedTracks<T extends { id: string }>(tracks: T[], picks: string[]): T[] {
  return picks.map((p) => tracks.find((t) => t.id === p)).filter((t): t is T => !!t);
}

/** Where an album link goes, for labels: "Spotify", "Bandcamp", or the
 * bare host for anything else (albums not on Spotify are imported with
 * their Bandcamp page instead). */
export function linkSite(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "the web";
  }
  if (host === "open.spotify.com" || host.endsWith(".spotify.com")) return "Spotify";
  if (host === "bandcamp.com" || host.endsWith(".bandcamp.com")) return "Bandcamp";
  return host;
}
