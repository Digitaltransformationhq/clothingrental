import { NextResponse } from "next/server";

import { requireUserOrThrow } from "@/server/auth/session";
import { toClientError } from "@/server/errors";
import { checkRateLimit } from "@/server/rate-limit";
import { MAX_UPLOAD_BYTES, storeImage, UploadError } from "@/server/storage";

/**
 * Image upload.
 *
 * A route handler rather than a server action, because uploads want streaming
 * multipart and real progress, neither of which actions give you.
 *
 * Everything an uploader tells us is treated as a claim: the filename, the
 * content type and the size are all re-derived server-side. See
 * `src/server/storage/index.ts` for the validation and re-encoding.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUserOrThrow();

    // Image processing is CPU-bound; without a limit one member can occupy
    // every worker the server has.
    await checkRateLimit({
      key: `upload:${user.id}`,
      limit: 40,
      windowSeconds: 300,
      message: "That is a lot of photographs at once. Give it a minute.",
    });

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_UPLOAD_BYTES + 1024) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION", message: "That image is too large." } },
        { status: 413 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION", message: "No image was sent." } },
        { status: 400 },
      );
    }

    // Namespaced per member, so one member's key can never collide with or
    // overwrite another's.
    const stored = await storeImage({ file, prefix: `listings/${user.id}` });

    return NextResponse.json({ ok: true, data: stored });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION", message: error.message } },
        { status: 422 },
      );
    }
    const client = toClientError(error);
    return NextResponse.json(
      { ok: false, error: client },
      { status: client.code === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}
