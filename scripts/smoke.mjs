// End-to-end smoke check against a running server (local `next start` or
// production). Slower than `npm test` and needs a live database, so it's the
// pre-ship / post-deploy lane, not the commit hook.
//
//   SMOKE_URL=http://localhost:3100 ADMIN_PASSWORD=... AOTY_IMPORT_TOKEN=... npm run smoke
//
// Read-only checks always run. Write checks use a throwaway year (2099, left
// unpublished) and run on localhost, or anywhere with SMOKE_WRITE=1.
import { readFileSync } from "node:fs";

const base = (process.env.SMOKE_URL || "http://localhost:3000").replace(/\/$/, "");
const write = process.env.SMOKE_WRITE === "1" || /localhost|127\.0\.0\.1/.test(base);
const YEAR = 2099;
let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? `: ${detail}` : ""}`);
  if (!ok) failures++;
}

const get = (path, init = {}) => fetch(base + path, { redirect: "manual", ...init });

// --- read-only ---
const root = await get("/");
check("/ redirects to the featured year", root.status === 307 && /\/\d{4}$/.test(root.headers.get("location") ?? ""), String(root.status));
check("admin API refuses anonymous", (await get(`/api/admin/lists/${YEAR}`)).status === 401);
check(
  "import refuses a wrong token",
  (await get("/api/admin/import", { method: "POST", headers: { authorization: "Bearer wrong" }, body: "{}" })).status === 401,
);
check("login page renders", (await get("/admin/login")).status === 200);

if (!write) {
  console.log("(read-only run; set SMOKE_WRITE=1 to exercise edits)");
} else {
  const password = process.env.ADMIN_PASSWORD;
  const token = process.env.AOTY_IMPORT_TOKEN;
  if (!password || !token) throw new Error("write checks need ADMIN_PASSWORD and AOTY_IMPORT_TOKEN");

  const login = await get("/api/auth/login", { method: "POST", body: new URLSearchParams({ password }) });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  check("login sets a session", login.status === 303 && cookie.startsWith("aoty_session="));
  const admin = (path, method = "GET", body) =>
    get(path, { method, headers: { cookie, "content-type": "application/json" }, body: body && JSON.stringify(body) });

  const fixture = JSON.parse(readFileSync(new URL("../contracts/fixtures/aoty_import_v1.json", import.meta.url), "utf8"));
  const imported = await get("/api/admin/import", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ ...fixture, year: YEAR }),
  });
  check("bearer import accepted", imported.status === 200, await imported.clone().text());

  const list = await (await admin(`/api/admin/lists/${YEAR}`)).json();
  const ids = [...list.ranked, ...list.shortlist].map((e) => e.id);
  for (const [i, id] of ids.entries()) await admin(`/api/admin/entries/${id}/place`, "POST", { place: i + 1 });
  check("reorder accepted", (await admin(`/api/admin/lists/${YEAR}/order`, "POST", { ids: [...ids].reverse() })).status === 200);
  check("stale reorder refused", (await admin(`/api/admin/lists/${YEAR}/order`, "POST", { ids: ids.slice(1) })).status === 400);

  // Freshness: every edit must show on the very first public request after it.
  await admin(`/api/admin/lists/${YEAR}`, "PATCH", { published: true });
  for (const n of [1, 2, 3]) {
    const marker = `smoke-${Date.now()}-${n}`;
    await admin(`/api/admin/lists/${YEAR}`, "PATCH", { intro: marker });
    const html = await (await get(`/${YEAR}`)).text();
    check(`edit ${n} visible on the first request`, html.includes(marker));
  }
  await admin(`/api/admin/lists/${YEAR}`, "PATCH", { published: false });
  const hidden = await (await get(`/${YEAR}`)).text();
  check("unpublished list hides its albums", !hidden.includes(fixture.candidates[0].album) && hidden.includes("No list here"));

  const exported = await admin(`/api/admin/lists/${YEAR}/export`);
  check("WordPress export downloads", exported.status === 200 && /attachment/.test(exported.headers.get("content-disposition") ?? ""));
}

console.log(failures ? `${failures} check(s) failed` : "all checks passed");
process.exit(failures ? 1 : 0);
