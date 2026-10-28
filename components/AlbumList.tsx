import { paragraphs, pickedTracks, trackUrl } from "@/lib/text";
import type { ListWithEntries } from "@/lib/types";

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
    <main className="mx-auto w-full max-w-4xl px-4 pb-24 sm:px-6">
      <header className="pt-12 pb-10 sm:pt-20">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          <a href="https://bolachas.org" className="hover:text-zinc-300">Bolachas</a> · {list.year}
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-balance sm:text-6xl">{list.title}</h1>
        {list.intro && (
          <Text text={list.intro} className="mt-6 max-w-prose space-y-4 text-lg leading-relaxed text-zinc-300" />
        )}
      </header>

      <ol className="divide-y divide-zinc-800 border-t border-zinc-800">
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
                  className="aspect-square w-full rounded-sm bg-zinc-900 object-cover shadow-2xl shadow-black/50"
                />
              </a>
              <div className="min-w-0">
                <p className="font-mono text-5xl font-bold tabular-nums text-zinc-600 sm:text-6xl" aria-label={`Number ${e.position}`}>
                  {e.position}
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">{e.artist}</h2>
                <p className="text-xl italic text-zinc-300">{e.album}</p>
                {e.label && <p className="mt-2 text-sm uppercase tracking-wider text-zinc-500">{e.label}</p>}
                {picks.length > 0 && (
                  <ul className="mt-5 flex flex-wrap gap-2" aria-label="Key tracks">
                    {picks.map((t) => (
                      <li key={t.id}>
                        <a
                          href={trackUrl(t.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-1 text-sm text-zinc-200 hover:border-zinc-400 hover:text-white"
                        >
                          <span aria-hidden className="text-[0.6rem] text-zinc-500">▶</span>
                          {t.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {e.blurb && <Text text={e.blurb} className="mt-5 max-w-prose space-y-4 leading-relaxed text-zinc-300" />}
              </div>
            </li>
          );
        })}
      </ol>

      <footer className="border-t border-zinc-800 pt-8 text-sm text-zinc-500">
        <a href="https://bolachas.org" className="hover:text-zinc-300">bolachas.org</a>
      </footer>
    </main>
  );
}
