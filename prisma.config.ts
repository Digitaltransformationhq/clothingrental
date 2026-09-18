import { existsSync } from "node:fs";

import { defineConfig } from "prisma/config";

/**
 * Prisma 7 no longer reads `.env` on its own.
 *
 * Next.js still does, so the application picks up `DATABASE_URL` and talks to
 * the configured database while the CLI, in the very same checkout, falls back
 * to the placeholder below and reports `Can't reach database server at
 * 127.0.0.1:5432`. Worse than the error is the case where something *is*
 * listening there: `prisma migrate deploy` would then apply migrations to the
 * wrong database and say it succeeded.
 *
 * Loading it here restores the behaviour the scripts in `package.json` assume.
 * Real environment variables win — `loadEnvFile` does not overwrite what is
 * already set — so a deployment that injects its own configuration is
 * unaffected, and CI without a `.env` is left alone.
 */
if (existsSync(".env") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env");
}

/**
 * Prisma 7 moves connection configuration out of `schema.prisma` and into this
 * file. The runtime client never reads it — the application constructs its own
 * driver adapter in `src/server/db/client.ts` — so this exists purely for the
 * schema engine (`migrate`, `studio`, `db pull`).
 *
 * When `DATABASE_URL` is unset the project runs against the bundled in-process
 * PostgreSQL, which the schema engine cannot address over a socket. The
 * placeholder below keeps `prisma migrate diff` (which needs no connection)
 * working in that situation; commands that genuinely require a live server
 * will fail loudly rather than silently targeting the wrong database.
 */
const PLACEHOLDER_URL = "postgresql://almirah:almirah@127.0.0.1:5432/almirah?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Same invocation as `npm run db:seed`. Without --conditions=react-server
    // the seed resolves the client build of modules marked `server-only` and
    // dies on its import guard; without the env file it would open the bundled
    // database while DATABASE_URL names a real one.
    seed: "tsx --env-file-if-exists=.env --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL || PLACEHOLDER_URL,
  },
});
