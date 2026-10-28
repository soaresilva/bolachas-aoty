import { adminRoute, parseYear } from "@/lib/api";
import { revalidateList } from "@/lib/cache";
import { listPatchSchema } from "@/lib/contract";
import { getDb } from "@/lib/db";
import { ensureList, getListWithEntries, updateList } from "@/lib/repo";

type Ctx = RouteContext<"/api/admin/lists/[year]">;

export const GET = adminRoute(async (_request, ctx: Ctx) => {
  const year = parseYear((await ctx.params).year);
  await ensureList(getDb(), year);
  return Response.json(await getListWithEntries(getDb(), year));
});

export const PATCH = adminRoute(async (request, ctx: Ctx) => {
  const year = parseYear((await ctx.params).year);
  const list = await updateList(getDb(), year, listPatchSchema.parse(await request.json()));
  revalidateList(year);
  return Response.json(list);
});
