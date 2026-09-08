import { defineConfig } from "prisma/config";

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
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL || PLACEHOLDER_URL,
  },
});
