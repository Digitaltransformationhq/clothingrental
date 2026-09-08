import { NextResponse } from "next/server";

import { env, usesBundledDatabase } from "@/env";
import { bundledLoadReport, getDb } from "@/server/db/client";

/**
 * Health check.
 *
 * For load balancers and uptime monitoring. It actually queries the database
 * rather than merely returning 200 — a process that is running but cannot reach
 * its database is not healthy, and reporting otherwise keeps a broken instance
 * in rotation.
 *
 * Deliberately reveals nothing beyond liveness: which drivers are configured,
 * not their credentials, versions or topology.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    const db = await getDb();
    await db.$queryRaw`SELECT 1`;

    // On a demonstration instance, whether the seeded archive was found. An
    // empty catalogue and a missing archive look identical from outside, and
    // the difference decides whether the problem is the dump or the pages.
    let archive: Record<string, unknown> | undefined;
    if (usesBundledDatabase) {
      const { existsSync, readdirSync, statSync } = await import("node:fs");
      const cwd = process.cwd();
      const found = existsSync("demo-database.tar.gz");
      archive = {
        cwd,
        found,
        // Size separates the two ways this fails: an archive of a few megabytes
        // that yields no rows is a loading problem, and a tiny one is a build
        // that dumped before it seeded.
        bytes: found ? statSync("demo-database.tar.gz").size : 0,
        listings: Number(
          (
            (await db.$queryRaw`SELECT count(*)::int AS count FROM "Listing"`) as Array<{
              count: number;
            }>
          )[0]?.count ?? 0,
        ),
        load: bundledLoadReport,
        rootEntries: readdirSync(cwd)
          .filter((f) => !f.startsWith("."))
          .slice(0, 25),
      };
    }

    return NextResponse.json(
      {
        status: "ok",
        database: usesBundledDatabase ? "bundled" : "postgres",
        ...(archive ? { archive } : {}),
        payments: env.PAYMENT_PROVIDER,
        search: env.SEARCH_DRIVER,
        storage: env.STORAGE_DRIVER,
        latencyMs: Date.now() - startedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[almirah] health check failed:", error);

    // On a demonstration instance the reason is included. "Unreachable" with no
    // cause is unactionable when the logs are somewhere you cannot read, and
    // there is nothing here worth withholding: no configured database, no
    // credentials, no topology. A configured deployment still says nothing.
    return NextResponse.json(
      {
        status: "degraded",
        database: "unreachable",
        ...(usesBundledDatabase
          ? {
              reason: error instanceof Error ? error.message : String(error),
              cause:
                error instanceof Error && error.cause instanceof Error
                  ? error.cause.message
                  : undefined,
              dataDir: env.PGLITE_DATA_DIR,
            }
          : {}),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
