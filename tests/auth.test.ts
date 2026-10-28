import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_COOKIE,
  bearerOk,
  checkPassword,
  createSession,
  isAuthorized,
  readCookie,
  sessionCookie,
  verifySession,
} from "@/lib/auth";

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "x".repeat(32));
  vi.stubEnv("ADMIN_PASSWORD", "hunter2-but-longer");
  vi.stubEnv("AOTY_IMPORT_TOKEN", "import-token");
});
afterEach(() => vi.unstubAllEnvs());

describe("password", () => {
  it("accepts only the exact password", () => {
    expect(checkPassword("hunter2-but-longer")).toBe(true);
    expect(checkPassword("hunter2")).toBe(false);
    expect(checkPassword("")).toBe(false);
  });
  it("refuses every password when none is configured", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(checkPassword("")).toBe(false);
  });
});

describe("sessions", () => {
  it("round-trips a signed session", async () => {
    expect(await verifySession(await createSession())).toBe(true);
  });
  it("rejects tampered, foreign-key, expired and missing tokens", async () => {
    const token = await createSession();
    expect(await verifySession(token.slice(0, -2) + "xx")).toBe(false);
    expect(await verifySession(undefined)).toBe(false);
    const old = await createSession(Date.now() - 31 * 24 * 3600 * 1000);
    expect(await verifySession(old)).toBe(false);
    vi.stubEnv("SESSION_SECRET", "y".repeat(32));
    expect(await verifySession(token)).toBe(false);
  });
  it("refuses to sign with a short secret", async () => {
    vi.stubEnv("SESSION_SECRET", "short");
    await expect(createSession()).rejects.toThrow(/SESSION_SECRET/);
  });
  it("sets an httpOnly, SameSite cookie", () => {
    expect(sessionCookie("abc")).toMatch(/^aoty_session=abc; Path=\/; HttpOnly; SameSite=Lax; Max-Age=\d+/);
  });
});

describe("request auth", () => {
  it("reads the session cookie among others", async () => {
    const token = await createSession();
    const req = new Request("http://x", { headers: { cookie: `a=1; ${SESSION_COOKIE}=${token}; b=2` } });
    expect(readCookie(req.headers.get("cookie"), SESSION_COOKIE)).toBe(token);
    expect(await isAuthorized(req)).toBe(true);
  });
  it("accepts the import token only where allowed", async () => {
    const req = new Request("http://x", { headers: { authorization: "Bearer import-token" } });
    expect(await isAuthorized(req)).toBe(false);
    expect(await isAuthorized(req, { allowBearer: true })).toBe(true);
  });
  it("bearer check needs the exact token and a configured one", () => {
    expect(bearerOk("Bearer import-token")).toBe(true);
    expect(bearerOk("Bearer import-toke")).toBe(false);
    expect(bearerOk("import-token")).toBe(false);
    expect(bearerOk(null)).toBe(false);
    vi.stubEnv("AOTY_IMPORT_TOKEN", "");
    expect(bearerOk("Bearer ")).toBe(false);
  });
});
