import { adminRoute } from "@/lib/api";
import { searchAlbums } from "@/lib/spotify";

export const GET = adminRoute(async (request) => {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return Response.json({ hits: [] });
  return Response.json({ hits: await searchAlbums(q) });
});
