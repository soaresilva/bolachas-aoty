import { adminRoute } from "@/lib/api";
import { importSchema } from "@/lib/contract";
import { getDb } from "@/lib/db";
import { importCandidates } from "@/lib/repo";

// spotify-curator's `aoty_seed.py --push` lands here (bearer token).
export const POST = adminRoute(
  async (request) => {
    const payload = importSchema.parse(await request.json());
    const result = await importCandidates(getDb(), payload);
    return Response.json({ ...result, year: payload.year });
  },
  { allowBearer: true },
);
