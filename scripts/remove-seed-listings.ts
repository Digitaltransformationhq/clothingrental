/**
 * Removes the seeded demo listings, keeping everything real.
 *
 * "Seeded" means owned by one of the demo accounts, which are the only ones on
 * an `@almirah.example` address — the seed refuses to run in production, so no
 * real member can ever hold one. Anything owned by anybody else is left alone.
 *
 * Order matters. `RentalItem.listing` carries no `onDelete`, so Prisma defaults
 * it to Restrict and a listing that has ever been rented cannot be deleted
 * while its booking rows exist. Rentals therefore go first, and the garments go
 * before the listings: `Listing.item` cascades from `ClothingItem`, so deleting
 * the garment takes its listing with it and leaves nothing orphaned.
 *
 * The whole thing runs in one transaction — a half-removed catalogue is worse
 * than either end state.
 *
 *   npm run db:remove-seed-listings
 *
 * The bundled PGlite database is single-writer: stop `next dev` first.
 */

const SEED_DOMAIN = "@almirah.example";

async function main() {
  const { getDb } = await import("../src/server/db/client");
  const db = await getDb();

  const seededUsers = await db.user.findMany({
    where: { email: { endsWith: SEED_DOMAIN } },
    select: { id: true, email: true },
  });
  const ownerIds = seededUsers.map((u) => u.id);

  if (ownerIds.length === 0) {
    console.log("\n  No seeded accounts found — nothing to remove.\n");
    return;
  }

  const doomed = await db.listing.findMany({
    where: { ownerId: { in: ownerIds } },
    select: { id: true, itemId: true, item: { select: { title: true } } },
  });
  const listingIds = doomed.map((l) => l.id);
  const itemIds = doomed.map((l) => l.itemId);

  const keeping = await db.listing.count({ where: { ownerId: { notIn: ownerIds } } });

  console.log(`\n  Seeded accounts   ${seededUsers.length}`);
  console.log(`  Listings to remove ${doomed.length}`);
  console.log(`  Listings kept      ${keeping}`);

  if (doomed.length === 0) {
    console.log("\n  Nothing to remove.\n");
    return;
  }

  const removed = await db.$transaction(async (tx) => {
    // `PayoutItem.rentalItem` is Restrict too, so the money rows have to go
    // before the bookings they were calculated from. Payouts are deleted whole
    // rather than item by item: a payout stripped of some of its items would
    // still carry the original total, which is a worse artefact than no payout
    // record at all on a demo dataset.
    const payouts = await tx.payout.deleteMany({
      where: { items: { some: { rentalItem: { listingId: { in: listingIds } } } } },
    });

    // Then the rentals: their booking rows restrict the listing delete.
    // Deleting the rental cascades to its items.
    const rentals = await tx.rental.deleteMany({
      where: { items: { some: { listingId: { in: listingIds } } } },
    });

    // Then the garments. `Listing` cascades from `ClothingItem`, and the
    // listing's own dependants (wishlist entries, collection membership,
    // reviews, availability) cascade from the listing.
    const items = await tx.clothingItem.deleteMany({ where: { id: { in: itemIds } } });

    return { rentals: rentals.count, items: items.count, payouts: payouts.count };
  });

  const after = await db.listing.count();
  const orphans = await db.clothingItem.count({ where: { listing: null } });

  console.log(
    `\n  Removed ${removed.items} garments, ${removed.rentals} rentals, ${removed.payouts} payouts`,
  );
  console.log(`  Listings remaining ${after}`);
  console.log(`  Orphaned garments  ${orphans}`);

  const survivors = await db.listing.findMany({
    select: { status: true, moderation: true, item: { select: { title: true } } },
  });
  for (const s of survivors) {
    console.log(`    kept "${s.item.title}" ${s.status}/${s.moderation}`);
  }
  console.log("");
}

main()
  .catch((error) => {
    console.error("\n  Could not remove the seeded listings. Nothing was changed.\n");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .then(() => process.exit(0));

export {};
