@AGENTS.md

# bolachas-aoty

Favorite-albums-of-the-year site (Next.js 16 with Cache Components, Postgres). Read README.md first.

- All SQL lives in `lib/repo.ts`; ordering logic is pure in `lib/order.ts`. Keep ranked positions exactly 1..N.
- Every `/api/admin/*` handler goes through `adminRoute()` (`lib/api.ts`); every mutation calls `revalidateList(year)`.
- The import contract (`lib/contract.ts`, fixture in `contracts/fixtures/`) is shared with spotify-curator's `aoty_seed.py`. Changing it means bumping `version` and updating both repos.
- Tests: `npm test` (PGlite, no services). The pre-commit hook runs tests, typecheck and lint; never skip it.
- After a change: commit, push. Vercel deploys `main` automatically; nothing runs on the Pi.
