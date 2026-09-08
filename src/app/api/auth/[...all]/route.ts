import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/server/auth/config";

/**
 * The authentication endpoint.
 *
 * Every credential and OAuth flow terminates here. The auth instance resolves
 * asynchronously because the database it is bound to may still be starting, so
 * the handlers are resolved per request rather than at module load — the cost
 * is one already-settled promise.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { GET: handler } = toNextJsHandler(await getAuth());
  return handler(request);
}

export async function POST(request: Request) {
  const { POST: handler } = toNextJsHandler(await getAuth());
  return handler(request);
}
