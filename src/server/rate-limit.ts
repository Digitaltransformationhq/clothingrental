import "server-only";

import { env } from "@/env";
import { errors } from "./errors";

/**
 * Rate limiting.
 *
 * A fixed-window counter behind a driver interface. The in-memory driver is
 * correct for a single instance and is what development and CI use; the Redis
 * driver is the one to reach for the moment the application runs on more than
 * one node, because an in-memory limit across four instances is four times the
 * limit you configured.
 *
 * Applied to anything that writes, costs money, or can be used to enumerate:
 * sign-in, sign-up, booking, messaging, uploads, password reset.
 */

export interface RateLimitDriver {
  hit(key: string, windowSeconds: number): Promise<number>;
}

/**
 * In-memory fixed window.
 *
 * Buckets are keyed by window so expiry is implicit — a stale bucket simply
 * stops being addressed. A periodic sweep keeps the map from growing without
 * bound on a long-running process.
 */
class MemoryRateLimitDriver implements RateLimitDriver {
  private readonly counts = new Map<string, { count: number; expiresAt: number }>();
  private lastSweep = Date.now();

  async hit(key: string, windowSeconds: number): Promise<number> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const bucket = `${key}:${Math.floor(now / windowMs)}`;

    if (now - this.lastSweep > 60_000) {
      for (const [entryKey, entry] of this.counts) {
        if (entry.expiresAt < now) this.counts.delete(entryKey);
      }
      this.lastSweep = now;
    }

    const existing = this.counts.get(bucket);
    const count = (existing?.count ?? 0) + 1;
    this.counts.set(bucket, { count, expiresAt: now + windowMs });
    return count;
  }
}

/**
 * Redis fixed window. `INCR` plus `EXPIRE` on first write is the standard
 * shape and is atomic enough for this purpose.
 *
 * `redis` is an optional dependency: the overwhelming majority of deployments
 * of this application run a single instance and want the in-memory driver. The
 * specifier is held in a variable so the bundler cannot resolve it statically
 * and try to trace a package that is deliberately not installed.
 */
class RedisRateLimitDriver implements RateLimitDriver {
  constructor(private readonly url: string) {}

  async hit(key: string, windowSeconds: number): Promise<number> {
    const specifier = "redis";
    let createClient: (options: { url: string }) => RedisLikeClient;
    try {
      ({ createClient } = (await import(/* webpackIgnore: true */ specifier)) as {
        createClient: (options: { url: string }) => RedisLikeClient;
      });
    } catch (cause) {
      throw new Error(
        "RATE_LIMIT_DRIVER is 'redis' but the `redis` package is not installed. " +
          "Run `npm install redis`, or set RATE_LIMIT_DRIVER=memory.",
        { cause },
      );
    }

    const client = createClient({ url: this.url });
    await client.connect();
    try {
      const bucket = `ratelimit:${key}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
      const count = await client.incr(bucket);
      if (count === 1) await client.expire(bucket, windowSeconds);
      return count;
    } finally {
      await client.quit();
    }
  }
}

/** The narrow slice of the Redis client this driver uses. */
interface RedisLikeClient {
  connect(): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  quit(): Promise<unknown>;
}

let driver: RateLimitDriver | undefined;

function getDriver(): RateLimitDriver {
  if (!driver) {
    driver =
      env.RATE_LIMIT_DRIVER === "redis" && env.REDIS_URL
        ? new RedisRateLimitDriver(env.REDIS_URL)
        : new MemoryRateLimitDriver();
  }
  return driver;
}

/**
 * Records an attempt and throws once the limit is exceeded.
 *
 * Throws rather than returning a boolean, because a caller that forgets to
 * check the return value has silently removed the limit.
 */
export async function checkRateLimit(input: {
  key: string;
  limit: number;
  windowSeconds: number;
  message?: string;
}): Promise<void> {
  const count = await getDriver().hit(input.key, input.windowSeconds);
  if (count > input.limit) {
    throw errors.rateLimited(input.message);
  }
}

/** Test seam. */
export function __setRateLimitDriver(next: RateLimitDriver | undefined): void {
  driver = next;
}
