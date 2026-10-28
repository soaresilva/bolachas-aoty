import { createHash, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

// Single-user admin. The password and the import token live in Vercel env
// vars; a login trades the password for a signed, httpOnly session cookie.

export const SESSION_COOKIE = "aoty_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function secretKey() {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters");
  return new TextEncoder().encode(secret);
}

/** Constant-time string comparison (hashing first evens out the lengths). */
export function safeEqual(a: string, b: string) {
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(a), digest(b));
}

export function checkPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  return expected.length > 0 && safeEqual(password, expected);
}

export async function createSession(now = Date.now()) {
  return new SignJWT({ sub: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(now / 1000))
    .setExpirationTime(Math.floor(now / 1000) + SESSION_MAX_AGE)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.sub === "admin";
  } catch {
    return false;
  }
}

export function readCookie(header: string | null, name: string) {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function bearerOk(header: string | null) {
  const token = process.env.AOTY_IMPORT_TOKEN ?? "";
  const match = /^Bearer (.+)$/.exec(header ?? "");
  return token.length > 0 && !!match && safeEqual(match[1], token);
}

/** True for a request from a logged-in admin, or (when allowBearer) one
 * carrying the import token. */
export async function isAuthorized(request: Request, { allowBearer = false } = {}) {
  if (allowBearer && bearerOk(request.headers.get("authorization"))) return true;
  return verifySession(readCookie(request.headers.get("cookie"), SESSION_COOKIE));
}

export function sessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`;
}

export const clearedSessionCookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
