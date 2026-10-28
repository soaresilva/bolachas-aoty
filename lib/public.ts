import { connection } from "next/server";
import { getDb } from "./db";
import { getListWithEntries } from "./repo";
import type { ListWithEntries } from "./types";

/** The list as the public sees it: null unless published, candidates left out.
 *
 * Deliberately uncached: every visit reads Postgres (one small query). With
 * page caching (use cache + revalidateTag), Vercel's CDN kept serving the
 * pre-edit page for many requests after each admin change; for a low-traffic
 * list, an edit you can't see is worse than a few ms of database time.
 * connection() marks the read as request-time so nothing gets prerendered. */
export async function getPublishedList(year: number): Promise<ListWithEntries | null> {
  await connection();
  const list = await getListWithEntries(getDb(), year);
  return list?.published ? { ...list, shortlist: [], dismissed: [] } : null;
}
