import { cacheLife, cacheTag } from "next/cache";
import { listTag } from "./cache";
import { getDb } from "./db";
import { getListWithEntries } from "./repo";
import type { ListWithEntries } from "./types";

// Cached reads for the public pages. Kept until an admin change revalidates
// the tag (lib/cache.ts), so visitors never wait on the database.

export async function getPublishedList(year: number): Promise<ListWithEntries | null> {
  "use cache";
  cacheLife("max");
  cacheTag(listTag(year));
  const list = await getListWithEntries(getDb(), year);
  return list?.published ? { ...list, shortlist: [], dismissed: [] } : null;
}
