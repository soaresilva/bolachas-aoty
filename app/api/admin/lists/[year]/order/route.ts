import { adminRoute, parseYear } from "@/lib/api";
import { revalidateList } from "@/lib/cache";
import { orderSchema } from "@/lib/contract";
import { getDb } from "@/lib/db";
import { reorder } from "@/lib/repo";

// Drag-and-drop sends the whole ranked order; anything but an exact
// permutation of the current ranked ids is refused (400).
export const POST = adminRoute(async (request, ctx: RouteContext<"/api/admin/lists/[year]/order">) => {
  const year = parseYear((await ctx.params).year);
  await reorder(getDb(), year, orderSchema.parse(await request.json()).ids);
  revalidateList(year);
  return Response.json({ ok: true });
});
