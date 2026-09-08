import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { env, isProduction } from "@/env";
import { getDb } from "@/server/db/client";

/**
 * Authentication.
 *
 * Sessions are opaque, server-stored and carried in an httpOnly cookie — not a
 * JWT in localStorage. A marketplace holding payment methods and postal
 * addresses needs revocation that takes effect immediately, which a stateless
 * token cannot give you.
 *
 * The `User` table is the same one the domain uses, extended with `role` and
 * `status`. Those are declared here so the auth layer knows they exist, but
 * they are never writable from the client: a member cannot make themselves an
 * administrator by posting a `role` field at sign-up.
 */

function slugifyHandle(name: string, id: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  // The id suffix guarantees uniqueness without a retry loop on collision.
  return `${base || "member"}-${id.slice(-6).toLowerCase()}`;
}

async function createAuth() {
  const db = await getDb();

  return betterAuth({
    appName: "Almirah",
    baseURL: env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL,
    secret: env.BETTER_AUTH_SECRET,

    database: prismaAdapter(db, { provider: "postgresql" }),

    emailAndPassword: {
      enabled: true,
      // Long enough to resist offline guessing, short enough that people will
      // actually use a passphrase rather than reusing a six-character password.
      minPasswordLength: 10,
      maxPasswordLength: 128,
      // Members can browse and even wishlist before confirming their address;
      // verification is required before money moves, which is enforced in the
      // booking service rather than here.
      requireEmailVerification: false,
      autoSignIn: true,
    },

    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : undefined,

    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // slide the expiry at most once a day
      cookieCache: {
        // Avoids a database read on every request while keeping revocation
        // effective within a minute.
        enabled: true,
        maxAge: 60,
      },
    },

    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "MEMBER",
          required: false,
          // The decisive line: without this, a crafted sign-up body could set
          // its own role.
          input: false,
        },
        status: {
          type: "string",
          defaultValue: "ACTIVE",
          required: false,
          input: false,
        },
      },
    },

    advanced: {
      cookiePrefix: "almirah",
      useSecureCookies: isProduction,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        path: "/",
      },
    },

    rateLimit: {
      enabled: true,
      window: 60,
      max: 30,
      customRules: {
        // Credential endpoints are the ones worth guessing at.
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 300, max: 5 },
        "/forget-password": { window: 300, max: 3 },
      },
    },

    databaseHooks: {
      user: {
        create: {
          /**
           * A member is not usable until they have a public profile and a
           * wishlist. Creating them here rather than lazily means no page has
           * to cope with a half-built account.
           */
          after: async (user) => {
            await db.$transaction(async (tx) => {
              await tx.profile.upsert({
                where: { userId: user.id },
                create: {
                  userId: user.id,
                  handle: slugifyHandle(user.name ?? "member", user.id),
                  country: "IN",
                },
                update: {},
              });
              await tx.wishlist.upsert({
                where: { userId: user.id },
                create: {
                  userId: user.id,
                  shareToken: crypto.randomUUID().replaceAll("-", ""),
                },
                update: {},
              });
            });
          },
        },
      },
    },

    // Must be last: it lets better-auth set cookies from server actions.
    plugins: [nextCookies()],
  });
}

export type Auth = Awaited<ReturnType<typeof createAuth>>;

const globalForAuth = globalThis as unknown as { __almirahAuth?: Promise<Auth> };

/**
 * Resolves the shared auth instance.
 *
 * Built on first use rather than at import. Constructing it opens a database
 * connection, and merely importing a module must never do that — during
 * `next build`, page-data collection loads every route across several worker
 * processes, and an eager connection would have all of them fighting for a
 * database that none of them was about to query.
 */
export function getAuth(): Promise<Auth> {
  globalForAuth.__almirahAuth ??= createAuth();
  return globalForAuth.__almirahAuth;
}
