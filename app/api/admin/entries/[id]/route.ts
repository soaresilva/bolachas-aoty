import { adminRoute, parseId } from "@/lib/api";
import { entryPatchSchema } from "@/lib/contract";
import { getDb } from "@/lib/db";
import { updateEntry } from "@/lib/repo";

export const PATCH = adminRoute(async (request, ctx: RouteContext<"/api/admin/entries/[id]">) => {
  const id = parseId((await ctx.params).id);
  await updateEntry(getDb(), id, entryPatchSchema.parse(await request.json()));
  return Response.json({ ok: true });
});
