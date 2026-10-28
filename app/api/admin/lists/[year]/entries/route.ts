import { adminRoute, parseYear } from "@/lib/api";
import { addSchema } from "@/lib/contract";
import { getDb } from "@/lib/db";
import { addEntry } from "@/lib/repo";
import { getAlbum } from "@/lib/spotify";

// Adds a Spotify album to the shortlist (no revalidation: the shortlist
// isn't public).
export const POST = adminRoute(async (request, ctx: RouteContext<"/api/admin/lists/[year]/entries">) => {
  const year = parseYear((await ctx.params).year);
  const { spotify_album_id } = addSchema.parse(await request.json());
  const entry = await addEntry(getDb(), year, await getAlbum(spotify_album_id));
  return Response.json(entry);
});
