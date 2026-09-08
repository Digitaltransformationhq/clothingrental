import { NextResponse } from "next/server";

import { env, usesBundledDatabase } from "@/env";
import { getDb } from "@/server/db/client";

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

    return NextResponse.json(
      {
        status: "ok",
        database: usesBundledDatabase ? "bundled" : "postgres",
        payments: env.PAYMENT_PROVIDER,
        search: env.SEARCH_DRIVER,
        storage: env.STORAGE_DRIVER,
        latencyMs: Date.now() - startedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[almirah] health check failed:", error);
    return NextResponse.json(
      { status: "degraded", database: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
