import { adminRoute, parseId } from "@/lib/api";
import { revalidateList } from "@/lib/cache";
import { placeSchema } from "@/lib/contract";
import { getDb } from "@/lib/db";
import { placeEntry } from "@/lib/repo";

// {place: 3} ranks the entry #3 (shifting the rest), {place: "shortlist"}
// unranks it, {place: "dismissed"} hides it from the shortlist too.
export const POST = adminRoute(async (request, ctx: RouteContext<"/api/admin/entries/[id]/place">) => {
  const id = parseId((await ctx.params).id);
  const year = await placeEntry(getDb(), id, placeSchema.parse(await request.json()).place);
  revalidateList(year);
  return Response.json({ ok: true });
});
