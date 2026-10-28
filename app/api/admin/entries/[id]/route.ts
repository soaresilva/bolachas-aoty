import { adminRoute, parseId } from "@/lib/api";
import { revalidateList } from "@/lib/cache";
import { entryPatchSchema } from "@/lib/contract";
import { getDb } from "@/lib/db";
import { updateEntry } from "@/lib/repo";

export const PATCH = adminRoute(async (request, ctx: RouteContext<"/api/admin/entries/[id]">) => {
  const id = parseId((await ctx.params).id);
  const year = await updateEntry(getDb(), id, entryPatchSchema.parse(await request.json()));
  revalidateList(year);
  return Response.json({ ok: true });
});
