/**
 * Prepares a real database for its first member.
 *
 * The seed in `prisma/seed.ts` builds a marketplace that looks lived-in — demo
 * wardrobes, rentals mid-flight, reviews — and clears every table before it
 * writes. That is exactly what development wants and exactly what a production
 * database must never see: those accounts share one published password, and the
 * clearing step would take real listings with it.
 *
 * But a fresh database is not usable either. The listing wizard offers
 * categories, sizes, colours and occasions read straight from these tables, so
 * an empty catalogue renders a form on which nothing can be chosen and every
 * submission fails on "that category no longer exists".
 *
 * This script is the middle path: the taxonomy and the fee schedule, and
 * nothing else. No accounts, no garments, no bookings. It upserts on the
 * natural key rather than deleting, so running it twice changes nothing and
 * running it against a catalogue already in use is safe — a renamed category
 * is corrected, an added one appears, and no row is ever removed.
 *
 *   npm run db:provision
 */

import { DEFAULT_FEE_SCHEDULE } from "../src/domain/rental/pricing";
import {
  SEED_BRANDS,
  SEED_CATEGORIES,
  SEED_COLORS,
  SEED_OCCASIONS,
  SEED_SIZES,
} from "../src/server/seed/taxonomy";

async function main() {
  const { getDb } = await import("../src/server/db/client");
  const db = await getDb();

  // ── Commercial terms ──────────────────────────────────────────────────────
  // `getActiveFeeSchedule` falls back to the same constant when no row exists,
  // so this is not strictly required to make pricing work. It is written
  // anyway: a fee schedule that lives only in code cannot be changed without a
  // deployment, and the row is what makes the terms auditable.
  await db.platformFee.upsert({
    where: { key: "standard" },
    update: {},
    create: {
      key: "standard",
      name: "Listing fee only — no commission on rentals",
      commissionBps: DEFAULT_FEE_SCHEDULE.commissionBps,
      serviceFeeBps: DEFAULT_FEE_SCHEDULE.serviceFeeBps,
      taxBps: DEFAULT_FEE_SCHEDULE.taxBps,
      minFeeMinor: DEFAULT_FEE_SCHEDULE.minFeeMinor,
      isDefault: true,
    },
  });

  // ── Taxonomy ──────────────────────────────────────────────────────────────
  // Parents before children: a subcategory carries its parent's id, which does
  // not exist until the parent row does.
  const categoryIds = new Map<string, string>();
  for (const category of SEED_CATEGORIES.filter((entry) => !entry.parent)) {
    const row = await db.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, tagline: category.tagline, sortOrder: category.sortOrder },
      create: {
        slug: category.slug,
        name: category.name,
        tagline: category.tagline,
        sortOrder: category.sortOrder,
      },
      select: { id: true },
    });
    categoryIds.set(category.slug, row.id);
  }
  for (const category of SEED_CATEGORIES.filter((entry) => entry.parent)) {
    const parentId = categoryIds.get(category.parent as string);
    const row = await db.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        tagline: category.tagline,
        sortOrder: category.sortOrder,
        parentId,
      },
      create: {
        slug: category.slug,
        name: category.name,
        tagline: category.tagline,
        sortOrder: category.sortOrder,
        parentId,
        heroKey: `occasion-${category.slug}`,
      },
      select: { id: true },
    });
    categoryIds.set(category.slug, row.id);
  }

  for (const brand of SEED_BRANDS) {
    await db.brand.upsert({
      where: { slug: brand.slug },
      update: { name: brand.name, isDesigner: brand.isDesigner },
      create: brand,
    });
  }

  for (const size of SEED_SIZES) {
    await db.size.upsert({
      where: { slug: size.slug },
      update: { label: size.label, system: size.system, sortOrder: size.sortOrder },
      create: size,
    });
  }

  for (const colour of SEED_COLORS) {
    await db.color.upsert({
      where: { slug: colour.slug },
      update: { name: colour.name, hex: colour.hex, family: colour.family },
      create: colour,
    });
  }

  for (const occasion of SEED_OCCASIONS) {
    await db.occasion.upsert({
      where: { slug: occasion.slug },
      update: { name: occasion.name, tagline: occasion.tagline, sortOrder: occasion.sortOrder },
      create: { ...occasion, heroKey: `occasion-${occasion.slug}` },
    });
  }

  const [categories, brands, sizes, colours, occasions, members, listings] = await Promise.all([
    db.category.count(),
    db.brand.count(),
    db.size.count(),
    db.color.count(),
    db.occasion.count(),
    db.user.count(),
    db.listing.count(),
  ]);

  console.log("\n  Provisioned");
  console.log(
    `    ${categories} categories · ${brands} brands · ${sizes} sizes · ` +
      `${colours} colours · ${occasions} occasions`,
  );
  console.log(`    Catalogue untouched: ${members} members · ${listings} listings\n`);
}

main()
  .catch((error) => {
    console.error("\nProvision failed:", error);
    process.exit(1);
  })
  .then(() => process.exit(0));
