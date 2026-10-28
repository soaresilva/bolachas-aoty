import { paragraphs, pickedTracks, trackUrl } from "@/lib/text";
import type { ListWithEntries } from "@/lib/types";
import { SiteShell } from "./SiteShell";

function Text({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {paragraphs(text).map((lines, i) => (
        <p key={i}>
          {lines.map((line, j) => (
            <span key={j}>
              {j > 0 && <br />}
              {line}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

/** The list as visitors see it. Shared by the public page and the admin preview. */
export function AlbumList({ list }: { list: ListWithEntries }) {
  return (
    <SiteShell>
      <main className="mx-auto w-full max-w-4xl px-4 pb-20 sm:px-6">
        <header className="pt-12 pb-12 text-center sm:pt-16">
          <p className="text-sm font-bold uppercase tracking-wider text-ink">
            <span className="border-b-2 border-navy">Albums of the year · {list.year}</span>
          </p>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">
            {list.title}
          </h1>
          {list.intro && (
            <Text text={list.intro} className="mx-auto mt-6 max-w-prose space-y-4 text-lg leading-relaxed text-ink" />
          )}
        </header>

        <ol className="divide-y divide-black/15 border-t border-black/15">
          {list.ranked.map((e) => {
            const picks = pickedTracks(e.tracks, e.picks);
            return (
              <li key={e.id} id={`n${e.position}`} className="grid gap-6 py-10 sm:grid-cols-[260px_1fr] sm:gap-8">
                <a href={e.spotify_url} className="block self-start" aria-label={`${e.artist}, ${e.album} on Spotify`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- Spotify's CDN serves sized covers already */}
                  <img
                    src={e.cover_url}
                    alt=""
                    width={640}
                    height={640}
                    loading={e.position! <= 3 ? "eager" : "lazy"}
                    className="aspect-square w-full bg-steel-deep object-cover shadow-xl shadow-navy/40"
                  />
                </a>
                <div className="min-w-0">
                  <p className="text-6xl font-extrabold leading-none tracking-tighter tabular-nums text-navy" aria-label={`Number ${e.position}`}>
                    {e.position}
                  </p>
                  <h2 className="mt-4 text-3xl font-extrabold tracking-tight">{e.artist}</h2>
                  <p className="mt-1 text-xl italic text-ink">{e.album}</p>
                  {e.label && <p className="mt-3 text-sm font-bold uppercase tracking-wider text-ink/80">{e.label}</p>}
                  {picks.length > 0 && (
                    <ul className="mt-5 flex flex-wrap gap-2" aria-label="Key tracks">
                      {picks.map((t) => (
                        <li key={t.id}>
                          {/* bolachas.org's button: black with the blue accent */}
                          <a
                            href={trackUrl(t.id)}
                            className="inline-flex items-center gap-2 bg-black px-3.5 py-1.5 text-sm font-medium text-sky hover:bg-navy hover:text-white"
                          >
                            <span aria-hidden className="text-[0.6rem]">▶</span>
                            {t.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  {e.blurb && <Text text={e.blurb} className="mt-5 max-w-prose space-y-4 text-lg leading-relaxed" />}
                </div>
              </li>
            );
          })}
        </ol>
      </main>
    </SiteShell>
  );
}
