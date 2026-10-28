// Applies db/schema.sql (idempotent) to DATABASE_URL. Runs before every
// Vercel build (see package.json "vercel-build"), and by hand for local dev.
import { readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
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
