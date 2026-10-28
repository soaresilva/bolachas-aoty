import { describe, expect, it } from "vitest";
import { findDatabaseUrl } from "@/lib/database-url.mjs";

describe("findDatabaseUrl", () => {
  it("prefers DATABASE_URL, then POSTGRES_URL", () => {
    expect(findDatabaseUrl({ DATABASE_URL: "a", POSTGRES_URL: "b" })).toBe("a");
    expect(findDatabaseUrl({ POSTGRES_URL: "b" })).toBe("b");
  });
  it("finds a prefixed name from the Vercel connect dialog", () => {
    expect(findDatabaseUrl({ STORAGE_DATABASE_URL: "c", STORAGE_DATABASE_URL_UNPOOLED: "d" })).toBe("c");
  });
  it("names what it saw, never the values", () => {
    expect(() => findDatabaseUrl({ PGHOST: "secret-host", OTHER: "x" })).toThrow(/present: PGHOST\./);
    expect(() => findDatabaseUrl({ PGHOST: "secret-host" })).not.toThrow(/secret-host/);
    expect(() => findDatabaseUrl({})).toThrow(/present: none/);
  });
});
