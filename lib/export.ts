import { escapeHtml, paragraphs, pickedTracks, trackUrl } from "./text";
import type { ListWithEntries } from "./types";

// A self-contained HTML version of the list for a WordPress post: paste the
// file's contents into a Custom HTML block. Inline styles only, because the
// theme's stylesheet doesn't know these classes; plain markup otherwise, so
// the theme's fonts and colors still apply.

const p = (text: string) =>
  paragraphs(text)
    .map((lines) => `<p>${lines.map(escapeHtml).join("<br>")}</p>`)
    .join("\n");

export function renderWordPressHtml(list: ListWithEntries): string {
  const items = list.ranked.map((e) => {
    const picks = pickedTracks(e.tracks, e.picks)
      .map((t) => `<a href="${trackUrl(t.id)}">${escapeHtml(t.name)}</a>`)
      .join(" · ");
    const alt = escapeHtml(`${e.artist} - ${e.album} cover`);
    return [
      `<div style="display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start;margin:0 0 40px">`,
      `<a href="${escapeHtml(e.spotify_url)}"><img src="${escapeHtml(e.cover_url)}" alt="${alt}" width="240" height="240" style="width:240px;height:240px;object-fit:cover;border-radius:4px" loading="lazy"></a>`,
      `<div style="flex:1;min-width:240px">`,
      `<p style="font-size:2.5em;font-weight:800;line-height:1;margin:0 0 8px">${e.position}</p>`,
      `<h3 style="margin:0">${escapeHtml(e.artist)}</h3>`,
      `<p style="margin:0;font-size:1.25em"><em>${escapeHtml(e.album)}</em></p>`,
      e.label ? `<p style="margin:4px 0 0;opacity:.7">${escapeHtml(e.label)}</p>` : "",
      picks ? `<p style="margin:12px 0 0">Key tracks: ${picks}</p>` : "",
      e.blurb ? p(e.blurb) : "",
      `</div>`,
      `</div>`,
    ]
      .filter(Boolean)
      .join("\n");
  });
  return [`<!-- ${escapeHtml(list.title)} -->`, list.intro ? p(list.intro) : "", ...items].filter(Boolean).join("\n\n") + "\n";
}
