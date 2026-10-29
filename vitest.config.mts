import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  // One file at a time: each DB suite starts its own PGlite (a whole Postgres
  // in WASM), and several at once got OOM-killed on the Pi this is developed
  // on, failing the pre-commit hook at random. Serial is ~11s.
  test: { include: ["tests/**/*.test.ts"], environment: "node", fileParallelism: false },
});
