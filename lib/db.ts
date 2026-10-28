import { attachDatabasePool } from "@vercel/functions";
import { Pool, type PoolClient } from "pg";
import { findDatabaseUrl } from "./database-url.mjs";

/** The slice of a Postgres connection the app uses. Production runs it on
 * node-postgres against Neon; tests run it on PGlite (in-process Postgres),
 * so the same SQL is exercised by both. */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs fn in one transaction: committed if it resolves, rolled back if it throws. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
}

function clientDb(client: PoolClient): Db {
  const db: Db = {
    async query(text, params) {
      return (await client.query(text, params)).rows;
    },
    tx: (fn) => fn(db), // already inside one
  };
  return db;
}

export function poolDb(pool: Pool): Db {
  return {
    async query(text, params) {
      return (await pool.query(text, params)).rows;
    },
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(clientDb(client));
        await client.query("COMMIT");
        return result;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

let current: Db | null = null;

export function getDb(): Db {
  if (!current) {
    const pool = new Pool({ connectionString: findDatabaseUrl(), max: 5 });
    // Lets Vercel close idle connections before a function instance suspends.
    attachDatabasePool(pool);
    current = poolDb(pool);
  }
  return current;
}

/** Tests swap in a PGlite-backed Db. */
export function setDb(db: Db | null) {
  current = db;
}
