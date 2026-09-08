import { existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

/**
 * Builds a pre-seeded copy of the bundled database, for a deployment that has
 * no PostgreSQL server yet.
 *
 * Only runs when there is no DATABASE_URL and ALLOW_BUNDLED_DATABASE is set —
 * that is, on a demonstration instance and nowhere else. With a real database
 * configured this does nothing at all.
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

if (process.env.DATABASE_URL?.trim()) {
  console.log("\n  DATABASE_URL is set — no demonstration database needed.\n");
  process.exit(0);
}

if (process.env.ALLOW_BUNDLED_DATABASE !== "true") {
  console.log(
    "\n  ALLOW_BUNDLED_DATABASE is not set — skipping the demonstration database.\n" +
      "  The server will refuse to start and name what it needs.\n",
  );
  process.exit(0);
}

console.log(`\n  Building a seeded demonstration database in ${TEMPLATE}…\n`);

if (existsSync(TEMPLATE)) rmSync(TEMPLATE, { recursive: true, force: true });

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

console.log(`\n  Seeded ${TEMPLATE}. It is copied into scratch space on each cold start.\n`);
