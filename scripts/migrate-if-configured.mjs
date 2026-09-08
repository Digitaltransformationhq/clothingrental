import { spawnSync } from "node:child_process";

/**
 * Applies migrations during a deployment build, but only when there is a
 * database to apply them to.
 *
 * A deploy build has to migrate: nothing else in the pipeline does, so a fresh
 * PostgreSQL would connect and then fail on the first query.
 *
 * But `prisma migrate deploy` with no `DATABASE_URL` does not skip — it falls
 * back to the schema's default datasource and dies with `P1001: Can't reach
 * database server at 127.0.0.1:5432`, which fails the whole build in thirteen
 * seconds. That turns "deployed but misconfigured" into "nothing deploys at
 * all", and hides the actual problem behind a Prisma connection error.
 *
 * So the migration is conditional. Unconfigured, the build completes and the
 * server refuses to start with its own list of exactly which variables are
 * missing — which is the message worth reading. Configured, a failed migration
 * still fails the build, because deploying code against a database that did not
 * accept its migrations is the one outcome nobody wants.
 */

const url = process.env.DATABASE_URL?.trim();

if (!url) {
  console.log(
    "\n  DATABASE_URL is not set — skipping `prisma migrate deploy`.\n" +
      "  The build will finish. The server will refuse to start and name the\n" +
      "  variables it needs.\n",
  );
  process.exit(0);
}

console.log("\n  DATABASE_URL is set — applying migrations.\n");

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
