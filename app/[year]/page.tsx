import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AlbumList } from "@/components/AlbumList";
import { SiteShell } from "@/components/SiteShell";
import { getPublishedList } from "@/lib/public";

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
    <Suspense fallback={<SiteShell><main className="mx-auto max-w-4xl px-4 py-24 text-center text-ink">Loading…</main></SiteShell>}>
      <YearList params={params} />
    </Suspense>
  );
}
