/**
 * Creates (or repairs) the administrator account.
 *
 * Separate from `prisma/seed.ts` on purpose. The seed builds a whole demo
 * marketplace and drops what is already there; this touches exactly one user,
 * so it is safe to run against a database with real listings in it — including
 * one where you have just submitted something for review.
 *
 * Idempotent. Run it twice and the second run resets the password and re-asserts
 * the ADMIN role rather than failing on the unique email.
 *
 * The password is hashed with the same function the auth layer uses, and the
 * credential row is keyed with the same issuer helper, so this account signs in
 * through the ordinary sign-in form rather than through a special case.
 *
 *   npm run admin:create
 *   ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_NAME=… npm run admin:create
 *
 * The bundled PGlite database is single-writer: stop `next dev` before running
 * this, or it will refuse with "already in use by process …".
 */

const EMAIL = (process.env.ADMIN_EMAIL ?? "admin@almirah.com").trim().toLowerCase();
const PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin@2026";
const NAME = process.env.ADMIN_NAME ?? "Almirah Admin";
const HANDLE = process.env.ADMIN_HANDLE ?? "almirah-admin";

async function main() {
  // The default password is written down in this file and in the repo's docs.
  // An account that can approve listings, suspend members and release payouts
  // must never be created with a published password on a live database.
  if (process.env.NODE_ENV === "production" && !process.env.ADMIN_PASSWORD) {
    throw new Error(
      "Refusing to create an administrator in production with the default password.\n" +
        "Set ADMIN_PASSWORD to something private and run this again.",
    );
  }

  const { getDb } = await import("../src/server/db/client");
  const { hashPassword } = await import("better-auth/crypto");
  const { createLocalAccountIssuer } = await import("@better-auth/core/db");
  const { createHash, randomUUID } = await import("node:crypto");

  const db = await getDb();
  const passwordHash = await hashPassword(PASSWORD);
  const credentialIssuer = createLocalAccountIssuer("credential");

  const existing = await db.user.findUnique({
    where: { email: EMAIL },
    select: { id: true, role: true, profile: { select: { id: true } } },
  });

  let userId: string;
  let created: boolean;

  if (existing) {
    // Promote and re-verify, in case the address was signed up as an ordinary
    // member first.
    await db.user.update({
      where: { id: existing.id },
      data: { role: "ADMIN", status: "ACTIVE", emailVerified: true, name: NAME },
    });
    userId = existing.id;
    created = false;
  } else {
    const user = await db.user.create({
      data: {
        email: EMAIL,
        emailVerified: true,
        name: NAME,
        role: "ADMIN",
        status: "ACTIVE",
        profile: {
          create: {
            handle: HANDLE,
            bio: "Wardrobe standards, moderation and member support.",
            city: "Mumbai",
            state: "Maharashtra",
            country: "IN",
            isIdentityVerified: true,
          },
        },
        wishlist: {
          create: {
            shareToken: createHash("sha256")
              .update(`${HANDLE}:${randomUUID()}`)
              .digest("hex")
              .slice(0, 24),
          },
        },
      },
      select: { id: true },
    });
    userId = user.id;
    created = true;
  }

  // better-auth keys the credential row on the user's own id — that is the row
  // sign-in looks up. Rewritten every run so the password is always the one
  // printed below, even if this account already existed with another.
  const credential = await db.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { id: true },
  });

  if (credential) {
    await db.account.update({
      where: { id: credential.id },
      data: { password: passwordHash, issuer: credentialIssuer, accountId: userId },
    });
  } else {
    await db.account.create({
      data: {
        userId,
        issuer: credentialIssuer,
        accountId: userId,
        providerId: "credential",
        password: passwordHash,
      },
    });
  }

  const check = await db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      role: true,
      status: true,
      accounts: { where: { providerId: "credential" }, select: { id: true } },
    },
  });

  console.log(`\n  Administrator ${created ? "created" : "updated"}`);
  console.log(`    Email      ${check?.email}`);
  console.log(`    Password   ${PASSWORD}`);
  console.log(`    Role       ${check?.role}`);
  console.log(`    Status     ${check?.status}`);
  console.log(`    Credential ${check?.accounts.length === 1 ? "ok" : "MISSING"}`);
  console.log(`\n  Sign in at /auth/sign-in, then open /admin\n`);
}

main()
  .catch((error) => {
    console.error("\n  Could not create the administrator.\n");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .then(() => process.exit(0));

export {};
