/**
 * Removes the seeded demo members, keeping every real account.
 *
 * "Seeded" means an `@almirah.example` address. The seed refuses to run against
 * production, so no real member can ever hold one — but this checks the role
 * too and refuses to touch an administrator, because the cost of being wrong
 * about that is losing the only way back into `/admin`.
 *
 * Most of what hangs off a member cascades: profile, wishlist, credentials,
 * sessions, listings, reviews, reports, notifications. Three relations do not —
 * `Rental.renter`, `RentalItem.owner` and `Dispute.openedBy` are all Restrict —
 * so a seeded member who still has a rental against their name cannot be
 * deleted, and this says so rather than half-finishing.
 *
 * `Collection.curatorId` is a bare string with no foreign key, so deleting a
 * curator would leave a dangling id behind rather than an error. Those are
 * cleared first.
 *
 *   npm run db:remove-seed-users
 *
 * The bundled PGlite database is single-writer: stop `next dev` first.
 */

const SEED_DOMAIN = "@almirah.example";

async function main() {
  const { getDb } = await import("../src/server/db/client");
  const db = await getDb();

  const seeded = await db.user.findMany({
    where: { email: { endsWith: SEED_DOMAIN } },
    select: { id: true, email: true, name: true, role: true },
  });
  const kept = await db.user.findMany({
    where: { email: { not: { endsWith: SEED_DOMAIN } } },
    select: { email: true, role: true },
  });

  console.log(`\n  Seeded members ${seeded.length}`);
  console.log(`  Real accounts  ${kept.length}`);
  for (const u of kept) console.log(`    keep ${u.email} (${u.role})`);

  if (seeded.length === 0) {
    console.log("\n  Nothing to remove.\n");
    return;
  }

  // The seed ships its own administrator, so refusing to delete any ADMIN would
  // refuse this whole job. What actually has to hold is that an administrator
  // survives it — otherwise there is no way back into /admin afterwards.
  const survivingAdmins = kept.filter((u) => u.role === "ADMIN");
  if (survivingAdmins.length === 0) {
    throw new Error(
      "Refusing to delete the seeded members: they include the only ADMIN accounts.\n" +
        "Run `npm run admin:create` first so an administrator survives this.",
    );
  }
  const seededAdmins = seeded.filter((u) => u.role === "ADMIN");
  if (seededAdmins.length > 0) {
    console.log(
      `\n  Also removing seeded administrator(s): ${seededAdmins.map((a) => a.email).join(", ")}`,
    );
    console.log(`  Administrator kept: ${survivingAdmins.map((a) => a.email).join(", ")}`);
  }

  const ids = seeded.map((u) => u.id);

  // The three Restrict relations. Report them rather than failing mid-way.
  const [rentals, bookings, disputes] = await Promise.all([
    db.rental.count({ where: { renterId: { in: ids } } }),
    db.rentalItem.count({ where: { ownerId: { in: ids } } }),
    db.dispute.count({ where: { openedById: { in: ids } } }),
  ]);
  if (rentals + bookings + disputes > 0) {
    throw new Error(
      `Seeded members still hold ${rentals} rentals, ${bookings} bookings and ${disputes} disputes.\n` +
        "Those relations are Restrict, so the members cannot be deleted while they exist.\n" +
        "Run db:remove-seed-listings first — it clears the rentals those rows belong to.",
    );
  }

  const result = await db.$transaction(async (tx) => {
    // No foreign key here, so this would be left dangling rather than caught.
    const uncurated = await tx.collection.updateMany({
      where: { curatorId: { in: ids } },
      data: { curatorId: null },
    });

    const removed = await tx.user.deleteMany({ where: { id: { in: ids } } });
    return { uncurated: uncurated.count, removed: removed.count };
  });

  const remaining = await db.user.count();
  const orphanCurators = await db.collection.count({ where: { curatorId: { in: ids } } });

  console.log(`\n  Removed ${result.removed} members`);
  console.log(`  Collections un-curated ${result.uncurated}`);
  console.log(`  Members remaining ${remaining}`);
  console.log(`  Dangling curator ids ${orphanCurators}`);
  console.log("");
}

main()
  .catch((error) => {
    console.error("\n  Could not remove the seeded members. Nothing was changed.\n");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .then(() => process.exit(0));

export {};
