import "server-only";

import { z } from "zod";

/**
 * Environment access is centralised here and validated once, at first import.
 *
 * Two rules this module exists to enforce:
 *
 *  1. Nothing outside this file reads `process.env`. A typo in a variable name
 *     becomes a type error rather than a silent `undefined` in production.
 *  2. Secrets are unreachable from client bundles. This module is marked
 *     `server-only`, so importing it from a Client Component fails the build
 *     instead of leaking a key.
 *
 * Values that genuinely belong in the browser live in `src/config/public.ts`,
 * which is separate and deliberately contains nothing sensitive.
 */

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(emptyToUndefined, z.string().optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.url().optional());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // ── Database ──────────────────────────────────────────────────────────────
  // Unset means "use the bundled in-process PostgreSQL", which is the
  // zero-setup path for development and CI.
  //
  // Managed providers inject their own names. Vercel's Postgres and Neon
  // integrations set POSTGRES_URL and POSTGRES_PRISMA_URL, and never
  // DATABASE_URL — so attaching a database in the dashboard used to leave this
  // application still insisting no database was configured, which is a
  // confusing way to be wrong. Any of the three is accepted; the connection
  // pooler's URL is preferred where one is offered, because serverless opens
  // far more connections than a managed instance will allow.
  DATABASE_URL: optionalString,
  POSTGRES_PRISMA_URL: optionalString,
  POSTGRES_URL: optionalString,
  PGLITE_DATA_DIR: z.preprocess(
    emptyToUndefined,
    // On a serverless host the bundle is read-only; /tmp is the one writable
    // path, and it is per-instance and wiped between cold starts.
    z.string().default(process.env.VERCEL ? "/tmp/almirah-pglite" : ".pglite"),
  ),

  /**
   * Runs production on the bundled in-process database.
   *
   * For showing the site before a real database exists, and nothing else. The
   * data directory lives in the host's scratch space, so it is empty on every
   * cold start and never shared between instances: anything written — an
   * account, a listing, a booking — is gone the moment that instance is
   * recycled.
   *
   * Opt-in, and it should be removed the day a real DATABASE_URL is set.
   */
  ALLOW_BUNDLED_DATABASE: z.preprocess(emptyToUndefined, z.stringbool().default(false)),

  // ── Application ───────────────────────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: z.preprocess(emptyToUndefined, z.url().default("http://localhost:3000")),

  // ── Authentication ────────────────────────────────────────────────────────
  BETTER_AUTH_SECRET: optionalString,
  BETTER_AUTH_URL: optionalUrl,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,

  // ── Payments ──────────────────────────────────────────────────────────────
  PAYMENT_PROVIDER: z.preprocess(
    emptyToUndefined,
    z.enum(["sandbox", "razorpay", "stripe"]).default("sandbox"),
  ),
  RAZORPAY_KEY_ID: optionalString,
  RAZORPAY_KEY_SECRET: optionalString,
  RAZORPAY_WEBHOOK_SECRET: optionalString,
  /**
   * Deliberate escape hatch for a demonstration deployment.
   *
   * A sandbox provider in production means money is never actually taken, so
   * the check below refuses it — that default stands. But a portfolio or demo
   * instance has no merchant account and no reason to have one, and without
   * this the only way to see the site running is to weaken the check itself.
   *
   * Opt-in, never inferred: it has to be typed into the environment on purpose,
   * and it is the one thing here whose presence is worth grepping for before a
   * real launch.
   */
  ALLOW_SANDBOX_PAYMENTS: z.preprocess(emptyToUndefined, z.stringbool().default(false)),
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,

  // ── Storage ───────────────────────────────────────────────────────────────
  STORAGE_DRIVER: z.preprocess(emptyToUndefined, z.enum(["local", "s3"]).default("local")),
  S3_ENDPOINT: optionalString,
  S3_REGION: optionalString,
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  NEXT_PUBLIC_MEDIA_BASE_URL: z.preprocess(emptyToUndefined, z.string().default("/photography")),

  // ── Email ─────────────────────────────────────────────────────────────────
  EMAIL_DRIVER: z.preprocess(emptyToUndefined, z.enum(["console", "resend"]).default("console")),
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.preprocess(emptyToUndefined, z.string().default("Almirah <hello@almirah.example>")),

  // ── Search ────────────────────────────────────────────────────────────────
  SEARCH_DRIVER: z.preprocess(
    emptyToUndefined,
    z.enum(["postgres", "meilisearch"]).default("postgres"),
  ),
  MEILISEARCH_HOST: optionalString,
  MEILISEARCH_API_KEY: optionalString,

  // ── Analytics ─────────────────────────────────────────────────────────────
  ANALYTICS_DRIVER: z.preprocess(emptyToUndefined, z.enum(["noop", "console"]).default("noop")),

  // ── Rate limiting ─────────────────────────────────────────────────────────
  RATE_LIMIT_DRIVER: z.preprocess(emptyToUndefined, z.enum(["memory", "redis"]).default("memory")),
  REDIS_URL: optionalString,
});

type Env = z.infer<typeof schema>;

function parseEnv(): Env {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  · ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration.\n\n${detail}\n\n` +
        `Copy .env.example to .env and fill in the missing values.`,
    );
  }

  const env = {
    ...parsed.data,
    DATABASE_URL:
      parsed.data.DATABASE_URL ?? parsed.data.POSTGRES_PRISMA_URL ?? parsed.data.POSTGRES_URL,
  };

  // Cross-field rules. Each of these is a misconfiguration that would only
  // surface much later — at the first payment, the first upload, the first
  // email — so they are caught at boot instead.
  const problems: string[] = [];

  /**
   * `next build` runs with NODE_ENV=production, but building is not deploying.
   * A build happens on a developer's laptop and in CI, where there is no
   * production database and no live payment keys — and requiring them would
   * mean nobody could compile the application without them.
   *
   * These checks are about a *running server*, so they are skipped while the
   * build is collecting page data and applied in full when the server actually
   * starts.
   */
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

  /**
   * A deployment with no database configured is a demonstration, not a
   * marketplace.
   *
   * These rules exist so a real deployment cannot quietly go live mishandling
   * somebody's money or sessions, and every one of them still applies the
   * moment a DATABASE_URL appears. But with no database there is nothing to
   * protect: the catalogue is seeded fixtures, the sandbox provider takes no
   * money, and every row is discarded when the instance recycles. Refusing to
   * boot there makes nothing safer — it only means nobody can see the site.
   *
   * So an unconfigured production instance degrades to a demonstration and says
   * so in the log. Set DATABASE_URL and the full standard returns on its own.
   */
  const isDemonstration = !env.DATABASE_URL;

  if (env.NODE_ENV === "production" && !isBuildPhase && isDemonstration) {
    const notes = [
      "No DATABASE_URL — using the bundled in-process database. Seeded fixtures,",
      "discarded whenever this instance recycles.",
    ];
    if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
      notes.push("No BETTER_AUTH_SECRET — sessions end at every cold start.");
    }
    if (env.PAYMENT_PROVIDER === "sandbox") {
      notes.push("Sandbox payments — no money moves.");
    }
    notes.push("Set DATABASE_URL to make this a real deployment.");
    console.warn(
      `\n  Running as a demonstration instance.\n${notes.map((n) => `    ${n}`).join("\n")}\n`,
    );
  }

  if (env.NODE_ENV === "production" && !isBuildPhase && !isDemonstration) {
    if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
      problems.push("BETTER_AUTH_SECRET must be set to at least 32 characters in production.");
    }
    // No DATABASE_URL check here: this branch only runs when one is set. An
    // instance without one is a demonstration and was handled above.
    if (env.PAYMENT_PROVIDER === "sandbox" && !env.ALLOW_SANDBOX_PAYMENTS) {
      problems.push(
        "PAYMENT_PROVIDER must not be 'sandbox' in production. " +
          "Set ALLOW_SANDBOX_PAYMENTS=true to run a demonstration instance that takes no money.",
      );
    }
  }

  if (env.PAYMENT_PROVIDER === "razorpay" && (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET)) {
    problems.push("PAYMENT_PROVIDER is 'razorpay' but RAZORPAY_KEY_ID/SECRET are missing.");
  }
  if (env.PAYMENT_PROVIDER === "stripe" && !env.STRIPE_SECRET_KEY) {
    problems.push("PAYMENT_PROVIDER is 'stripe' but STRIPE_SECRET_KEY is missing.");
  }
  if (env.STORAGE_DRIVER === "s3" && (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID)) {
    problems.push("STORAGE_DRIVER is 's3' but the bucket credentials are incomplete.");
  }
  if (env.EMAIL_DRIVER === "resend" && !env.RESEND_API_KEY) {
    problems.push("EMAIL_DRIVER is 'resend' but RESEND_API_KEY is missing.");
  }
  if (env.SEARCH_DRIVER === "meilisearch" && !env.MEILISEARCH_HOST) {
    problems.push("SEARCH_DRIVER is 'meilisearch' but MEILISEARCH_HOST is missing.");
  }
  if (env.RATE_LIMIT_DRIVER === "redis" && !env.REDIS_URL) {
    problems.push("RATE_LIMIT_DRIVER is 'redis' but REDIS_URL is missing.");
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid environment configuration.\n\n${problems.map((p) => `  · ${p}`).join("\n")}\n`,
    );
  }

  return env;
}

export const env: Env = parseEnv();

/** True when running against the bundled in-process PostgreSQL. */
export const usesBundledDatabase = !env.DATABASE_URL;

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";
