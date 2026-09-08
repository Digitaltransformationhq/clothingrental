import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { PGlite } from "@electric-sql/pglite";

/**
 * Applies Prisma's migration files to the bundled in-process PostgreSQL.
 *
 * Against a real server, migrations are applied by `prisma migrate deploy` as a
 * deliberate deployment step. The bundled database has no such step — it is
 * created inside the application process — so it tracks and applies the very
 * same `prisma/migrations/*​/migration.sql` files itself.
 *
 * The ledger table is named separately from Prisma's `_prisma_migrations` so
 * that a data directory can never be mistaken for one Prisma is managing.
 */

const LEDGER_TABLE = "_almirah_migrations";

async function ensureLedger(pglite: PGlite): Promise<void> {
  await pglite.exec(`
    CREATE TABLE IF NOT EXISTS "${LEDGER_TABLE}" (
      "name"       text PRIMARY KEY,
      "appliedAt"  timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function appliedMigrations(pglite: PGlite): Promise<Set<string>> {
  const result = await pglite.query<{ name: string }>(`SELECT "name" FROM "${LEDGER_TABLE}"`);
  return new Set(result.rows.map((row) => row.name));
}

function migrationsDirectory(): string {
  return path.join(process.cwd(), "prisma", "migrations");
}

/**
 * Reads the migration folders in lexicographic order, which is chronological
 * because Prisma prefixes every folder with a timestamp.
 */
async function readMigrations(): Promise<Array<{ name: string; sql: string }>> {
  const dir = migrationsDirectory();

  let entries: string[];
  try {
    const dirents = await readdir(dir, { withFileTypes: true });
    entries = dirents
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    throw new Error(`No migrations found at ${dir}. Run \`npm run db:migrate\` to create them.`);
  }

  const migrations: Array<{ name: string; sql: string }> = [];
  for (const name of entries) {
    const file = path.join(dir, name, "migration.sql");
    try {
      migrations.push({ name, sql: await readFile(file, "utf8") });
    } catch {
      // A directory without migration.sql is not a migration.
      continue;
    }
  }
  return migrations;
}

/**
 * Brings the bundled database up to date. Safe to call on every boot: already
 * applied migrations are skipped, and each pending one runs inside its own
 * transaction so a failure leaves no half-applied schema behind.
 */
export async function applyPendingMigrations(pglite: PGlite): Promise<string[]> {
  await ensureLedger(pglite);

  const [applied, all] = await Promise.all([appliedMigrations(pglite), readMigrations()]);
  const pending = all.filter((migration) => !applied.has(migration.name));

  if (pending.length === 0) return [];

  for (const migration of pending) {
    try {
      await pglite.exec("BEGIN");
      await pglite.exec(migration.sql);
      await pglite.query(`INSERT INTO "${LEDGER_TABLE}" ("name") VALUES ($1)`, [migration.name]);
      await pglite.exec("COMMIT");
    } catch (error) {
      await pglite.exec("ROLLBACK").catch(() => {
        /* the failure below is the one worth reporting */
      });
      throw new Error(
        `Migration "${migration.name}" failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
  }

  return pending.map((migration) => migration.name);
}

/**
 * Drops every application object and replays all migrations. Used by
 * `npm run db:reset`; never reachable from the running application.
 */
export async function resetBundledDatabase(pglite: PGlite): Promise<string[]> {
  await pglite.exec(`DROP SCHEMA IF EXISTS "public" CASCADE; CREATE SCHEMA "public";`);
  return applyPendingMigrations(pglite);
}
