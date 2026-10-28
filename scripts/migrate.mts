// Applies db/schema.sql (idempotent) to the database (see lib/database-url.mjs). Runs before every
// Vercel build (see package.json "vercel-build"), and by hand for local dev.
import { readFileSync } from "node:fs";
import pg from "pg";
import { findDatabaseUrl } from "../lib/database-url.mjs";

let url: string;
try {
  url = findDatabaseUrl();
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  const { rows } = await client.query("SELECT count(*)::int AS lists FROM lists");
  console.log(`schema applied (${rows[0].lists} lists)`);
} finally {
  await client.end();
}
