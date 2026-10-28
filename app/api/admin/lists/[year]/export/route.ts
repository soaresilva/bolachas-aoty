import { adminRoute, parseYear } from "@/lib/api";
import { getDb } from "@/lib/db";
import { renderWordPressHtml } from "@/lib/export";
import { NotFound, getListWithEntries } from "@/lib/repo";

export const GET = adminRoute(async (_request, ctx: RouteContext<"/api/admin/lists/[year]/export">) => {
  const year = parseYear((await ctx.params).year);
  const list = await getListWithEntries(getDb(), year);
  if (!list) throw new NotFound(`no list for ${year}`);
  return new Response(renderWordPressHtml(list), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="aoty-${year}.html"`,
    },
  });
});
