// Finds the Postgres connection string in the environment. Vercel's Neon
// integration names it DATABASE_URL, but also sets POSTGRES_URL, and adds
// a prefix when one is chosen in the connect dialog (STORAGE_DATABASE_URL).
// Plain JS so both the app and scripts/migrate.mts (run by bare node) use it.

const NAMES = ["DATABASE_URL", "POSTGRES_URL"];

/** @param {Record<string, string | undefined>} env */
export function findDatabaseUrl(env = process.env) {
  for (const name of NAMES) if (env[name]) return env[name];
  for (const name of NAMES) {
    const prefixed = Object.keys(env).find((k) => k.endsWith(`_${name}`) && env[k]);
    if (prefixed) return env[prefixed];
  }
  const seen = Object.keys(env).filter((k) => /DATABASE|POSTGRES|^PG|NEON/.test(k)).sort();
  throw new Error(
    `No Postgres connection string found (looked for ${NAMES.join(", ")}, also with a prefix). ` +
      `Database-looking variables present: ${seen.length ? seen.join(", ") : "none"}. ` +
      "Connect the Neon store to this project and environment, then redeploy.",
  );
}
