import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AlbumList } from "@/components/AlbumList";
import { getPublishedList } from "@/lib/public";

// Cache Components needs at least one param here, but the real years are
// deliberately left out: data captured into a build-time prerender came back
// for the first request after every admin edit (tested with next start). A
// year rendered on its first visit is a plain ISR entry that the list tag
// invalidates cleanly. "0" renders the not-found page.
export async function generateStaticParams() {
  return [{ year: "0" }];
}

function yearOf(raw: string) {
  const year = Number(raw);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
}

export async function generateMetadata({ params }: PageProps<"/[year]">): Promise<Metadata> {
  const year = yearOf((await params).year);
  const list = year ? await getPublishedList(year) : null;
  if (!list) return {};
  const top = list.ranked.slice(0, 3).map((e) => `${e.artist} - ${e.album}`).join(", ");
  return {
    title: list.title,
    description: top ? `${list.ranked.length} albums. Top 3: ${top}.` : undefined,
  };
}

async function YearList({ params }: { params: PageProps<"/[year]">["params"] }) {
  const year = yearOf((await params).year);
  const list = year ? await getPublishedList(year) : null;
  if (!list) notFound();
  return <AlbumList list={list} />;
}

export default function Page({ params }: PageProps<"/[year]">) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-4xl px-4 pt-20 text-zinc-500">Loading…</main>}>
      <YearList params={params} />
    </Suspense>
  );
}
