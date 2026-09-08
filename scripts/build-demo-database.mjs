import { existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

/**
 * Builds a pre-seeded copy of the bundled database, for a deployment that has
 * no PostgreSQL server yet.
 *
 * Only runs when there is no DATABASE_URL — that is, on a demonstration
 * instance and nowhere else. With a real database configured it does nothing.
 *
 * Why at build rather than at boot: seeding takes about fifteen seconds, which
 * is longer than a serverless function is allowed to live. The template is
 * built once here and copied into the host's scratch space on each cold start,
 * which takes a second or two.
 *
 * It costs almost nothing to ship. An empty PGlite directory is already ~41MB
 * of PostgreSQL compiled to WebAssembly; seeded it is ~43MB. The catalogue is
 * the cheap part.
 *
 * The seed refuses to run with NODE_ENV=production, because it creates accounts
 * with a password published in this repository. That refusal is right for a
 * real database and wrong for a throwaway template that is rebuilt on every
 * deploy and holds nothing but demonstration rows — so it is run as
 * development, deliberately and only here.
 */

const TEMPLATE = ".pglite-demo";
const DUMP = "demo-database.tar.gz";

if (process.env.DATABASE_URL?.trim()) {
  console.log("\n  DATABASE_URL is set — no demonstration database needed.\n");
  process.exit(0);
}

console.log(`\n  Building a seeded demonstration database in ${TEMPLATE}…\n`);

if (existsSync(TEMPLATE)) rmSync(TEMPLATE, { recursive: true, force: true });
if (existsSync(DUMP)) rmSync(DUMP, { force: true });

const result = spawnSync("npx", ["tsx", "--conditions=react-server", "prisma/seed.ts"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: "development",
    PGLITE_DATA_DIR: TEMPLATE,
    DATABASE_URL: "",
  },
});

if (result.status !== 0) {
  console.error("\n  The demonstration database could not be built.\n");
  process.exit(result.status ?? 1);
}

/**
 * The seeded directory is then dumped to a compressed archive.
 *
 * A serverless instance runs the database in memory — opening a data directory
 * under /tmp fails there — so the directory itself is no use at runtime. PGlite
 * can load a dump straight into memory instead, which takes a moment rather
 * than the fifteen seconds seeding takes, and the archive is a few megabytes
 * against the directory's forty-three.
 */
const { PGlite } = await import("@electric-sql/pglite");
const { writeFile } = await import("node:fs/promises");

const db = await PGlite.create({ dataDir: TEMPLATE });
const dump = await db.dumpDataDir("gzip");
await writeFile(DUMP, Buffer.from(await dump.arrayBuffer()));
await db.close();

rmSync(TEMPLATE, { recursive: true, force: true });

const { statSync } = await import("node:fs");
console.log(`\n  Wrote ${DUMP} (${(statSync(DUMP).size / 1024 / 1024).toFixed(1)}MB).`);
console.log("  It is loaded into memory on each cold start.\n");
