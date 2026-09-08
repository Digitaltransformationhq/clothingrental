import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "@/env";

/**
 * Object storage.
 *
 * Listings are photographs, so this is load-bearing. The port stores bytes
 * under an opaque key and returns that key; it never returns a URL, because
 * URLs are a rendering concern and belong in `src/lib/media.ts`. That
 * separation is what lets the same database rows be served from local disk in
 * development and from a CDN in production.
 */

export interface StoredObject {
  /** Opaque key. This is what goes in the database. */
  readonly key: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly contentType: string;
  readonly blurDataUrl: string;
}

export interface StorageDriver {
  put(input: { key: string; body: Buffer; contentType: string }): Promise<void>;
  delete(key: string): Promise<void>;
}

class LocalStorageDriver implements StorageDriver {
  private readonly root = path.join(process.cwd(), "public", "uploads");

  async put({ key, body }: { key: string; body: Buffer }): Promise<void> {
    const file = path.join(this.root, `${key}.webp`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }

  async delete(key: string): Promise<void> {
    await unlink(path.join(this.root, `${key}.webp`)).catch(() => {
      // Already gone. Deleting an absent object is a success, not an error.
    });
  }
}

/**
 * S3-compatible storage (AWS, R2, Backblaze, MinIO).
 *
 * Signed with SigV4 over `fetch` rather than pulling in the AWS SDK, which is
 * a large dependency for two operations.
 */
class S3StorageDriver implements StorageDriver {
  constructor(
    private readonly config: {
      endpoint: string;
      region: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
    },
  ) {}

  private async sign(
    method: "PUT" | "DELETE",
    key: string,
    body: Buffer | undefined,
    contentType: string | undefined,
  ) {
    const { createHash, createHmac } = await import("node:crypto");
    const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
    const hmac = (key: Buffer | string, value: string) =>
      createHmac("sha256", key).update(value).digest();

    const url = new URL(`${this.config.endpoint.replace(/\/$/, "")}/${this.config.bucket}/${key}`);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256(body ?? "");

    const headers: Record<string, string> = {
      host: url.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    if (contentType) headers["content-type"] = contentType;

    const signedHeaders = Object.keys(headers).sort().join(";");
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((name) => `${name}:${headers[name]}\n`)
      .join("");

    const canonicalRequest = [
      method,
      url.pathname,
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const scope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");

    const signingKey = hmac(
      hmac(hmac(hmac(`AWS4${this.config.secretAccessKey}`, dateStamp), this.config.region), "s3"),
      "aws4_request",
    );
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

    headers.authorization =
      `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return { url: url.toString(), headers };
  }

  async put({ key, body, contentType }: { key: string; body: Buffer; contentType: string }) {
    const objectKey = `${key}.webp`;
    const { url, headers } = await this.sign("PUT", objectKey, body, contentType);
    const response = await fetch(url, { method: "PUT", headers, body: new Uint8Array(body) });
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${await response.text()}`);
    }
  }

  async delete(key: string) {
    const objectKey = `${key}.webp`;
    const { url, headers } = await this.sign("DELETE", objectKey, undefined, undefined);
    await fetch(url, { method: "DELETE", headers });
  }
}

let driver: StorageDriver | undefined;

function getDriver(): StorageDriver {
  if (!driver) {
    driver =
      env.STORAGE_DRIVER === "s3"
        ? new S3StorageDriver({
            endpoint: env.S3_ENDPOINT as string,
            region: env.S3_REGION ?? "auto",
            bucket: env.S3_BUCKET as string,
            accessKeyId: env.S3_ACCESS_KEY_ID as string,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
          })
        : new LocalStorageDriver();
  }
  return driver;
}

// ── Validation and processing ───────────────────────────────────────────────

/** Formats a member may upload. */
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic"]);

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // 12 MB
export const MAX_IMAGES_PER_ITEM = 8;

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

/**
 * Reads the file's actual magic bytes.
 *
 * A `Content-Type` header and a `.jpg` extension are both supplied by whoever
 * is uploading, and neither is evidence of anything. Checking the leading bytes
 * is what stops a script being stored as an image.
 */
function sniffContentType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "image/png";
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  const brand = buffer.subarray(4, 12).toString("ascii");
  if (brand.startsWith("ftyp")) {
    if (brand.includes("avif")) return "image/avif";
    if (brand.includes("heic") || brand.includes("mif1")) return "image/heic";
  }
  return null;
}

/**
 * Validates, normalises and stores one uploaded photograph.
 *
 * Everything is re-encoded to WebP through sharp, which has a useful side
 * effect beyond file size: re-encoding discards any payload smuggled inside the
 * original container, and strips EXIF — which on a phone photograph routinely
 * contains the GPS coordinates of the member's home.
 */
export async function storeImage(input: {
  file: File;
  /** Namespaces the key, e.g. `listings/<itemId>`. */
  prefix: string;
}): Promise<StoredObject> {
  if (input.file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(
      `That image is ${(input.file.size / 1024 / 1024).toFixed(1)}MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`,
    );
  }
  if (input.file.size === 0) throw new UploadError("That file is empty.");

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const sniffed = sniffContentType(buffer);

  if (!sniffed || !ACCEPTED.has(sniffed)) {
    throw new UploadError("That doesn't look like a photograph. JPEG, PNG, WebP or HEIC, please.");
  }

  const sharp = (await import("sharp")).default;

  let pipeline = sharp(buffer, { failOn: "error" });
  const metadata = await pipeline.metadata();

  if (!metadata.width || !metadata.height) {
    throw new UploadError("That image could not be read.");
  }

  // `rotate()` with no argument applies the EXIF orientation and then drops it,
  // so a portrait photograph from a phone is not stored on its side.
  pipeline = pipeline.rotate();

  const processed = await pipeline
    .resize({ width: 1600, height: 2000, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  const blur = await sharp(processed.data)
    .resize(12, 15, { fit: "inside" })
    .webp({ quality: 55 })
    .toBuffer();

  const key = `${input.prefix}/${randomUUID()}`;

  await getDriver().put({ key, body: processed.data, contentType: "image/webp" });

  return {
    key,
    width: processed.info.width,
    height: processed.info.height,
    bytes: processed.info.size,
    contentType: "image/webp",
    blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
  };
}

export async function deleteImage(key: string): Promise<void> {
  await getDriver().delete(key);
}

/** Test seam. */
export function __setStorageDriver(next: StorageDriver | undefined): void {
  driver = next;
}
