"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { SearchHit } from "@/lib/spotify";
import type { Entry, ListWithEntries } from "@/lib/types";

type Place = number | "shortlist" | "dismissed";

async function api(path: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 401) {
    // Session expired mid-edit: a full load of the login page, dropping all client state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional hard navigation
    window.location.assign("/admin/login");
    throw new Error("logged out");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

const button =
  "rounded-md border border-zinc-700 px-2.5 py-1 text-sm text-zinc-200 hover:border-zinc-400 disabled:opacity-40";
const input =
  "w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-400";

export function AdminApp({ year }: { year: number }) {
  const [list, setList] = useState<ListWithEntries | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setList(await api(`/api/admin/lists/${year}`));
  }, [year]);

  useEffect(() => {
    let current = true;
    api(`/api/admin/lists/${year}`)
      .then((data) => current && setList(data))
      .catch((e) => current && setError(e.message));
    return () => {
      current = false;
    };
  }, [year]);

  /** Runs a change, then reloads the list from the server (the source of truth). */
  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        await load().catch((e) => setError(e.message));
        setBusy(false);
      }
    },
    [load],
  );

  const place = (id: number, to: Place) =>
    run(() => api(`/api/admin/entries/${id}/place`, { method: "POST", body: { place: to } }));

  if (!list) {
    return <p className="p-6 text-zinc-500">{error ?? "Loading…"}</p>;
  }

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-8 pb-32">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Bolachas · admin · {year}</p>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link className={button} href="/admin/preview">Preview</Link>
          {list.published && <Link className={button} href={`/${year}`}>Public page</Link>}
          <a className={button} href={`/api/admin/lists/${year}/export`}>Export for WordPress</a>
          <form method="post" action="/api/auth/logout">
            <button className={button}>Log out</button>
          </form>
        </nav>
      </header>

      {error && (
        <p role="alert" className="rounded-md border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <ListSettings list={list} busy={busy} run={run} />

      <section>
        <h2 className="text-lg font-semibold">
          The list <span className="text-zinc-500">({list.ranked.length})</span>
        </h2>
        <p className="mt-1 text-sm text-zinc-500">Drag to reorder (or focus the handle and use arrow keys), or type a position.</p>
        <RankedList list={list} busy={busy} run={run} place={place} setList={setList} />
      </section>

      <AddAlbum year={year} busy={busy} run={run} />

      <section>
        <h2 className="text-lg font-semibold">
          Shortlist <span className="text-zinc-500">({list.shortlist.length})</span>
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Candidates by full-album listens in {year} (scrobbles ÷ tracks). Imported with <code>aoty_seed.py --push</code>.
        </p>
        <ul className="mt-4 divide-y divide-zinc-800 border-y border-zinc-800">
          {list.shortlist.map((e) => (
            <li key={e.id}>
              <EntryRow entry={e} busy={busy} run={run}>
                <PlaceInput key={list.ranked.length} label="Add at #" defaultValue={list.ranked.length + 1} busy={busy} onPlace={(n) => place(e.id, n)} />
                <button className={button} disabled={busy} onClick={() => place(e.id, "dismissed")}>Dismiss</button>
              </EntryRow>
            </li>
          ))}
          {list.shortlist.length === 0 && <li className="py-4 text-sm text-zinc-500">Empty.</li>}
        </ul>
      </section>

      {list.dismissed.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-zinc-400">Dismissed ({list.dismissed.length})</summary>
          <ul className="mt-3 divide-y divide-zinc-800 border-y border-zinc-800">
            {list.dismissed.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-zinc-400">{e.artist} · {e.album}</span>
                <button className={button} disabled={busy} onClick={() => place(e.id, "shortlist")}>Restore</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}

type RunFn = (fn: () => Promise<unknown>) => Promise<void>;

function ListSettings({ list, busy, run }: { list: ListWithEntries; busy: boolean; run: RunFn }) {
  const [title, setTitle] = useState(list.title);
  const [intro, setIntro] = useState(list.intro);
  const dirty = title !== list.title || intro !== list.intro;
  const patch = (body: object) => run(() => api(`/api/admin/lists/${list.year}`, { method: "PATCH", body }));

  return (
    <section className="space-y-3 rounded-lg border border-zinc-800 p-4">
      <label className="block">
        <span className="text-sm text-zinc-400">Title</span>
        <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-sm text-zinc-400">Intro (blank line = new paragraph)</span>
        <textarea className={`${input} min-h-24`} value={intro} onChange={(e) => setIntro(e.target.value)} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button className={button} disabled={busy || !dirty} onClick={() => patch({ title, intro })}>Save</button>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={list.published}
            disabled={busy}
            onChange={(e) => patch({ published: e.target.checked })}
          />
          Published {list.published ? `(live at /${list.year})` : "(draft: only you can see it, via Preview)"}
        </label>
      </div>
    </section>
  );
}

function RankedList({
  list,
  busy,
  run,
  place,
  setList,
}: {
  list: ListWithEntries;
  busy: boolean;
  run: RunFn;
  place: (id: number, to: Place) => Promise<void>;
  setList: (l: ListWithEntries) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = list.ranked.map((e) => e.id);
    const next = arrayMove(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id)));
    // Show the new order right away; the reload after the save confirms it.
    const byId = new Map(list.ranked.map((e) => [e.id, e]));
    setList({ ...list, ranked: next.map((id, i) => ({ ...byId.get(id)!, position: i + 1 })) });
    run(() => api(`/api/admin/lists/${list.year}/order`, { method: "POST", body: { ids: next } }));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={list.ranked.map((e) => e.id)} strategy={verticalListSortingStrategy}>
        <ol className="mt-4 divide-y divide-zinc-800 border-y border-zinc-800">
          {list.ranked.map((e, i) => (
            <SortableRow key={e.id} entry={e} busy={busy} run={run}>
              <button className={button} disabled={busy || i === 0} onClick={() => place(e.id, i)} aria-label="Move up">↑</button>
              <button className={button} disabled={busy || i === list.ranked.length - 1} onClick={() => place(e.id, i + 2)} aria-label="Move down">↓</button>
              <PlaceInput key={e.position} label="Move to #" defaultValue={e.position!} busy={busy} onPlace={(n) => place(e.id, n)} />
              <button className={button} disabled={busy} onClick={() => place(e.id, "shortlist")}>To shortlist</button>
            </SortableRow>
          ))}
          {list.ranked.length === 0 && <li className="py-4 text-sm text-zinc-500">Nothing ranked yet. Add albums from the shortlist below.</li>}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ entry, busy, run, children }: { entry: Entry; busy: boolean; run: RunFn; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10 bg-zinc-900 shadow-xl" : undefined}
    >
      <EntryRow
        entry={entry}
        busy={busy}
        run={run}
        handle={
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none px-1 text-zinc-500 hover:text-zinc-200"
            aria-label={`Drag ${entry.album}`}
          >
            ⠿
          </button>
        }
      >
        {children}
      </EntryRow>
    </li>
  );
}

function PlaceInput({ label, defaultValue, busy, onPlace }: { label: string; defaultValue: number; busy: boolean; onPlace: (n: number) => void }) {
  // Callers key this on the entry's current position, so a move resets it.
  const [value, setValue] = useState(String(defaultValue));
  const submit = () => {
    const n = Number(value);
    if (Number.isInteger(n) && n >= 1 && n !== defaultValue) onPlace(n);
  };
  return (
    <form
      className="flex items-center gap-1 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <span className="text-zinc-500">{label}</span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-14 rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-zinc-100"
      />
      <button className={button} disabled={busy}>Go</button>
    </form>
  );
}

function EntryRow({
  entry,
  busy,
  run,
  handle,
  children,
}: {
  entry: Entry;
  busy: boolean;
  run: RunFn;
  handle?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const picks = entry.picks.map((id) => entry.tracks.find((t) => t.id === id)?.name).filter(Boolean);
  return (
    <div className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        {handle}
        {entry.position && <span className="w-8 text-right font-mono text-lg tabular-nums text-zinc-500">{entry.position}</span>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={entry.cover_url} alt="" width={56} height={56} className="size-14 rounded-sm bg-zinc-800 object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{entry.artist} · <span className="italic">{entry.album}</span></p>
          <p className="truncate text-sm text-zinc-500">
            {[entry.label, entry.release_date, entry.listens != null ? `${entry.listens.toFixed(1)} listens · ${entry.scrobbles} scrobbles` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="truncate text-xs text-zinc-500">
            {picks.length ? `▶ ${picks.join(" · ")}` : "no key tracks"}
            {entry.blurb ? " · has text" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {children}
          <button className={button} onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Close" : "Edit"}</button>
        </div>
      </div>
      {open && <EntryEditor entry={entry} busy={busy} run={run} onDone={() => setOpen(false)} />}
    </div>
  );
}

function EntryEditor({ entry, busy, run, onDone }: { entry: Entry; busy: boolean; run: RunFn; onDone: () => void }) {
  const [label, setLabel] = useState(entry.label);
  const [blurb, setBlurb] = useState(entry.blurb);
  const [pick1, setPick1] = useState(entry.picks[0] ?? "");
  const [pick2, setPick2] = useState(entry.picks[1] ?? "");
  const picks = [pick1, pick2].filter(Boolean);
  const duplicate = pick1 !== "" && pick1 === pick2;

  const save = () =>
    run(async () => {
      await api(`/api/admin/entries/${entry.id}`, { method: "PATCH", body: { label, blurb, picks } });
      onDone();
    });

  const trackSelect = (value: string, set: (v: string) => void, name: string) => (
    <label className="block">
      <span className="text-sm text-zinc-400">{name}</span>
      <select className={input} value={value} onChange={(e) => set(e.target.value)}>
        <option value="">(none)</option>
        {entry.tracks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.track_number}. {t.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="mt-3 grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="text-sm text-zinc-400">Label</span>
        <input className={input} value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      {trackSelect(pick1, setPick1, "Key track 1")}
      {trackSelect(pick2, setPick2, "Key track 2")}
      <label className="block sm:col-span-2">
        <span className="text-sm text-zinc-400">Text (blank line = new paragraph)</span>
        <textarea className={`${input} min-h-32`} value={blurb} onChange={(e) => setBlurb(e.target.value)} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className={button} disabled={busy || duplicate} onClick={save}>Save</button>
        {duplicate && <span className="text-sm text-amber-400">Pick two different tracks.</span>}
        <a className="text-sm text-zinc-500 underline" href={entry.spotify_url} target="_blank" rel="noreferrer">Open on Spotify</a>
      </div>
    </div>
  );
}

function AddAlbum({ year, busy, run }: { year: number; busy: boolean; run: RunFn }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError(null);
    try {
      setHits((await api(`/api/admin/spotify/search?q=${encodeURIComponent(q)}`)).hits);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold">Add an album</h2>
      <form onSubmit={search} className="mt-3 flex gap-2">
        <input className={input} placeholder="Artist and/or album, or a Spotify album link" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={button} disabled={searching || !q.trim()}>Search</button>
      </form>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {hits && (
        <ul className="mt-3 divide-y divide-zinc-800 border-y border-zinc-800">
          {hits.map((h) => (
            <li key={h.id} className="flex items-center gap-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={h.image} alt="" width={40} height={40} className="size-10 rounded-sm bg-zinc-800 object-cover" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate">{h.artist} · <span className="italic">{h.name}</span></p>
                <p className="text-zinc-500">{h.album_type} · {h.release_date}</p>
              </div>
              <button
                className={button}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api(`/api/admin/lists/${year}/entries`, { method: "POST", body: { spotify_album_id: h.id } });
                    setHits(null);
                    setQ("");
                  })
                }
              >
                Add to shortlist
              </button>
            </li>
          ))}
          {hits.length === 0 && <li className="py-3 text-sm text-zinc-500">No results.</li>}
        </ul>
      )}
    </section>
  );
}
