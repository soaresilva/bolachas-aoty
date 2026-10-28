import Link from "next/link";
import { Suspense } from "react";
import { AlbumList } from "@/components/AlbumList";
import { FEATURED_YEAR } from "@/lib/config";
import { getDb } from "@/lib/db";
import { ensureList, getListWithEntries } from "@/lib/repo";
import { requireAdminPage } from "../gate";

// The page as it will look once published, read straight from the database.
async function Preview() {
  await requireAdminPage();
  await ensureList(getDb(), FEATURED_YEAR);
  const list = (await getListWithEntries(getDb(), FEATURED_YEAR))!;
  return (
    <>
      <div className="sticky top-0 z-10 bg-amber-400 px-4 py-2 text-center text-sm font-medium text-black">
        Preview{list.published ? " (published)" : " (draft, not public)"} · <Link href="/admin" className="underline">back to admin</Link>
      </div>
      <AlbumList list={list} />
    </>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={<p className="p-6 text-zinc-500">Loading…</p>}>
      <Preview />
    </Suspense>
  );
}
