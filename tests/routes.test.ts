import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as login } from "@/app/api/auth/login/route";
import { PATCH as patchEntry } from "@/app/api/admin/entries/[id]/route";
import { POST as place } from "@/app/api/admin/entries/[id]/place/route";
import { POST as importRoute } from "@/app/api/admin/import/route";
import { GET as exportRoute } from "@/app/api/admin/lists/[year]/export/route";
import { POST as order } from "@/app/api/admin/lists/[year]/order/route";
import { GET as getList, PATCH as patchList } from "@/app/api/admin/lists/[year]/route";
import { SESSION_COOKIE, createSession } from "@/lib/auth";
import { setDb } from "@/lib/db";
import { fixture, fixtureV2, testDb } from "./helpers";

let t: Awaited<ReturnType<typeof testDb>>;
let cookie: string;

beforeAll(async () => {
  vi.stubEnv("SESSION_SECRET", "s".repeat(32));
  vi.stubEnv("ADMIN_PASSWORD", "pw-for-tests");
  vi.stubEnv("AOTY_IMPORT_TOKEN", "tok");
  t = await testDb();
  setDb(t.db);
  cookie = `${SESSION_COOKIE}=${await createSession()}`;
});
afterAll(async () => {
  setDb(null);
  vi.unstubAllEnvs();
  await t.close();
});
beforeEach(async () => {
  await t.reset();
});

const year = { params: Promise.resolve({ year: "2026" }) };
const entry = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });

function req(body?: unknown, headers: Record<string, string> = { cookie }) {
  return new Request("http://test/api", {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function seed() {
  const res = await importRoute(req(fixture, { authorization: "Bearer tok" }), {});
  expect(res.status).toBe(200);
  const list = await (await getList(req(), year)).json();
  return list.shortlist.map((e: { id: number }) => e.id) as number[];
}

describe("auth on every admin route", () => {
  it("401s without a session", async () => {
    const anon = { cookie: "" };
    expect((await getList(req(undefined, anon), year)).status).toBe(401);
    expect((await patchList(req({ published: true }, anon), year)).status).toBe(401);
    expect((await order(req({ ids: [] }, anon), year)).status).toBe(401);
    expect((await place(req({ place: 1 }, anon), entry(1))).status).toBe(401);
    expect((await patchEntry(req({ blurb: "x" }, anon), entry(1))).status).toBe(401);
    expect((await exportRoute(req(undefined, anon), year)).status).toBe(401);
    expect((await importRoute(req(fixture, anon), {})).status).toBe(401);
  });

  it("the import token opens only the import route", async () => {
    const bearer = { authorization: "Bearer tok" };
    expect((await getList(req(undefined, bearer), year)).status).toBe(401);
    expect((await importRoute(req(fixture, bearer), {})).status).toBe(200);
    expect((await importRoute(req(fixture, { authorization: "Bearer nope" }), {})).status).toBe(401);
  });
});

describe("login", () => {
  const form = (password: string) =>
    new Request("http://test/api/auth/login", { method: "POST", body: new URLSearchParams({ password }) });

  it("sets the session cookie on the right password", async () => {
    const res = await login(form("pw-for-tests"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/admin");
    expect(res.headers.get("set-cookie")).toMatch(/^aoty_session=.+HttpOnly/);
  });

  it("sends a wrong password back to the form without a cookie", async () => {
    const res = await login(form("nope"));
    expect(res.headers.get("location")).toBe("/admin/login?error=1");
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

describe("admin flow", () => {
  it("import, rank, reorder, edit, publish, export", async () => {
    const [jeff, ratboys] = await seed();

    expect((await place(req({ place: 1 }), entry(jeff))).status).toBe(200);
    expect((await place(req({ place: 1 }), entry(ratboys))).status).toBe(200);
    expect((await order(req({ ids: [jeff, ratboys] }), year)).status).toBe(200);
    expect((await patchEntry(req({ blurb: "Yes.", picks: ["t1"] }), entry(jeff))).status).toBe(200);
    expect((await patchList(req({ title: "My 2026", published: true }), year)).status).toBe(200);

    const list = await (await getList(req(), year)).json();
    expect(list).toMatchObject({ title: "My 2026", published: true });
    expect(list.ranked.map((e: { id: number; position: number }) => [e.id, e.position])).toEqual([[jeff, 1], [ratboys, 2]]);
    expect(list.ranked[0]).toMatchObject({ blurb: "Yes.", picks: ["t1"] });

    const exported = await exportRoute(req(), year);
    expect(exported.headers.get("content-disposition")).toBe('attachment; filename="aoty-2026.html"');
    expect(await exported.text()).toContain("Thanks, Sorry!");
  });

  it("returns 400 for bad input, 404 for unknown ids", async () => {
    const [jeff] = await seed();
    expect((await place(req({ place: 0 }), entry(jeff))).status).toBe(400);
    expect((await place(req({ place: "top" }), entry(jeff))).status).toBe(400);
    expect((await patchEntry(req({ picks: ["a", "b", "c"] }), entry(jeff))).status).toBe(400);
    expect((await patchEntry(req({ unknown_field: 1 }), entry(jeff))).status).toBe(400);
    expect((await patchEntry(req("{not json"), entry(jeff))).status).toBe(400);
    expect((await order(req({ ids: [jeff, jeff] }), year)).status).toBe(400);
    expect((await importRoute(req({ ...fixture, version: 3 }, { authorization: "Bearer tok" }), {})).status).toBe(400);
    expect((await place(req({ place: 1 }), entry(9999))).status).toBe(404);
    expect((await getList(req(), { params: Promise.resolve({ year: "nope" }) })).status).toBe(404);
  });
});

describe("ranked import", () => {
  it("the import token lands a finished list in rank order", async () => {
    const res = await importRoute(req(fixtureV2, { authorization: "Bearer tok" }), {});
    expect(await res.json()).toEqual({ created: 2, updated: 0, ranked: 2, filled: { picks: 1, blurbs: 1, links: true }, year: 2025 });
    const list = await (await getList(req(), { params: Promise.resolve({ year: "2025" }) })).json();
    expect(list.ranked.map((e: { album: string }) => e.album)).toEqual(["New Threats From the Soul", "The Open Up"]);
  });

  it("bad ranks are a 400", async () => {
    const bad = structuredClone(fixtureV2);
    bad.candidates[1].rank = 5;
    expect((await importRoute(req(bad, { authorization: "Bearer tok" }), {})).status).toBe(400);
  });
});
