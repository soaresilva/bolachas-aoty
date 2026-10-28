import { ZodError } from "zod";
import { isAuthorized } from "./auth";
import { Invalid, NotFound } from "./repo";

type Handler<C> = (request: Request, context: C) => Promise<Response>;

/** Wraps an admin route handler: refuses unauthenticated requests and maps
 * the repository's errors to status codes. Every /api/admin handler goes
 * through this, so no route can forget the auth check. */
export function adminRoute<C>(handler: Handler<C>, { allowBearer = false } = {}): Handler<C> {
  return async (request, context) => {
    if (!(await isAuthorized(request, { allowBearer }))) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    try {
      return await handler(request, context);
    } catch (e) {
      if (e instanceof ZodError) return Response.json({ error: "invalid request", issues: e.issues }, { status: 400 });
      if (e instanceof SyntaxError) return Response.json({ error: "body is not JSON" }, { status: 400 });
      if (e instanceof Invalid) return Response.json({ error: e.message }, { status: 400 });
      if (e instanceof NotFound) return Response.json({ error: e.message }, { status: 404 });
      throw e;
    }
  };
}

export function parseYear(raw: string) {
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new NotFound(`no list for ${raw}`);
  return year;
}

export function parseId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new NotFound(`no entry ${raw}`);
  return id;
}
