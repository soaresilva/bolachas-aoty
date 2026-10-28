import { revalidateTag } from "next/cache";

export const listTag = (year: number) => `list-${year}`;

/** Called after every admin change. expire: 0 so the next visit to the
 * public page renders fresh: the person editing is usually the one checking.
 * (This only works because the year pages aren't prerendered at build; see
 * generateStaticParams in app/[year]/page.tsx.) */
export function revalidateList(year: number) {
  revalidateTag(listTag(year), { expire: 0 });
}
