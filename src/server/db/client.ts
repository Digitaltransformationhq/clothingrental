import "server-only";

import { PrismaClient } from "@/generated/prisma/client";
import { env, isProduction, usesBundledDatabase } from "@/env";

/**
 * The single database entry point for the entire application.
 *
 * Almirah speaks PostgreSQL and nothing else. Which PostgreSQL it speaks to is
 * decided here, once:
 *
 *  · `DATABASE_URL` set   → a real server, over a pooled TCP connection.
 *  · `DATABASE_URL` unset → the bundled in-process PostgreSQL (PGlite), so the
 *    project clones and runs with no database server, no Docker and no
 *    container runtime.
 *
 * Both paths execute the *same* migrations, the same SQL and the same
 * constraints. The bundled database is not a mock or a fixture layer — it is
 * PostgreSQL, compiled to WebAssembly. Nothing above this file knows or cares
 * which one is in use.
 */

type PrismaAdapter = ConstructorParameters<typeof PrismaClient>[0] extends
  { adapter?: infer A } | undefined
  ? A
  : never;

async function createServerAdapter(databaseUrl: string): Promise<PrismaAdapter> {
  const { PrismaPg } = await import("@prisma/adapter-pg");
  return new PrismaPg({
    connectionString: databaseUrl,
    // Conservative pool: Next.js may run several server instances, and managed
    // PostgreSQL connection limits are usually the first thing to break under
    // load.
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  }) as PrismaAdapter;
}

async function createBundledAdapter(): Promise<PrismaAdapter> {
  const [{ PGlite }, { PrismaPGlite }, { applyPendingMigrations }, { acquireBundledLock }] =
    await Promise.all([
      import("@electric-sql/pglite"),
      import("pglite-prisma-adapter"),
      import("./migrate"),
      import("./bundled-lock"),
    ]);

  // Claims the data directory. Refuses if another live process holds it, and
  // clears the lock if the process that wrote it has gone. See bundled-lock.ts
  // for why PostgreSQL's own pid file cannot be used for this.
  //
  // During a production build the exception is a sibling build worker, which
  // only ever reads. Those get a private copy so the build can fan out without
  // several processes opening one single-writer database.
  let dataDir = env.PGLITE_DATA_DIR;

  // A demonstration instance ships a pre-seeded template, because seeding takes
  // longer than a serverless function is allowed to live. The bundle is
  // read-only, so the template is copied into scratch space and opened there.
  // Every cold start gets the same catalogue and loses whatever the last one
  // was doing — which is the deal ALLOW_BUNDLED_DATABASE makes explicit.
  if (env.ALLOW_BUNDLED_DATABASE) {
    const { existsSync, cpSync } = await import("node:fs");
    const template = ".pglite-demo";
    if (!existsSync(dataDir) && existsSync(template)) {
      cpSync(template, dataDir, { recursive: true });
    }
  }

  try {
    await acquireBundledLock(dataDir);
  } catch (error) {
    const { BuildWorkerContention, cloneForBuildWorker } = await import("./bundled-lock");
    if (!(error instanceof BuildWorkerContention)) throw error;
    dataDir = await cloneForBuildWorker(env.PGLITE_DATA_DIR);
  }

  let pglite: Awaited<ReturnType<typeof PGlite.create>>;
  try {
    pglite = await PGlite.create({ dataDir });
  } catch (cause) {
    // The engine aborts rather than throwing a legible error, so this is the
    // one place that can turn it into an instruction.
    throw new Error(
      `The bundled database at "${env.PGLITE_DATA_DIR}" could not be opened.\n\n` +
        `This usually means the data directory is from a different schema version, ` +
        `or was damaged by two processes writing to it at once — only one process ` +
        `may use it at a time, so stop the dev server before running migrations, ` +
        `seeds or tests.\n\n` +
        `To start again: delete the "${env.PGLITE_DATA_DIR}" directory and run \`npm run db:seed\`.`,
      { cause },
    );
  }

  // The bundled database has no external migration tool driving it, so it
  // brings itself up to date on first connection. Against a real server this
  // never runs: there, `prisma migrate deploy` is the contract, and silently
  // mutating a production schema at boot would be indefensible.
  await applyPendingMigrations(pglite);

  return new PrismaPGlite(pglite) as PrismaAdapter;
}

async function createPrismaClient(): Promise<PrismaClient> {
  const adapter = env.DATABASE_URL
    ? await createServerAdapter(env.DATABASE_URL)
    : await createBundledAdapter();

  return new PrismaClient({
    adapter,
    log: isProduction ? ["error"] : ["error", "warn"],
  });
}

/**
 * Next.js discards module state on every hot reload in development. Without a
 * global cache each edit would open another database handle — and PGlite
 * permits exactly one writer per data directory, so the second one would fail.
 */
const globalForPrisma = globalThis as unknown as {
  __almirahPrisma?: Promise<PrismaClient>;
};

/**
 * Resolves the shared Prisma client.
 *
 * Connection is deferred to the first call rather than performed when this
 * module is imported. Importing a module must not open a database: during
 * `next build`, page-data collection loads every route across several worker
 * processes, and a connection at import time would have all of them contend
 * for a database none of them was going to query.
 *
 * Asynchronous because the bundled database has to boot its WebAssembly engine
 * and settle its migrations before the first query. In server components and
 * server actions this is a single `await` at the top of a data function.
 */
export function getDb(): Promise<PrismaClient> {
  globalForPrisma.__almirahPrisma ??= createPrismaClient();
  return globalForPrisma.__almirahPrisma;
}

export type Db = PrismaClient;

/**
 * A transaction handle. Domain services accept this so that the same function
 * works standalone or as one step inside a larger atomic operation.
 */
export type DbTransaction = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** Either a client or an open transaction — whatever the caller has to hand. */
export type DbExecutor = Db | DbTransaction;

export { usesBundledDatabase };
