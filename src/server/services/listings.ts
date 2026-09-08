import "server-only";

import { cache } from "react";

import { PAGE_SIZE, type ShopFilters } from "@/domain/catalog/filters";
import { today } from "@/domain/dates";
import { availabilitySignal, type Occupancy } from "@/domain/rental/availability";
import { OCCUPYING_STATUSES } from "@/domain/rental/state-machine";
import { type Db, type DbExecutor, getDb } from "@/server/db/client";
import { toListingCard, type ListingCard, listingCardSelect } from "./listing-view";

/**
 * Catalogue queries.
 *
 * All reads of published listings go through here. Two invariants this module
 * exists to hold:
 *
 *  1. Only listings that are PUBLISHED *and* moderation-APPROVED are ever
 *     returned to the public. That predicate is defined once, below, and
 *     reused — a page that forgets it would quietly publish rejected content.
 *  2. Nothing here returns a raw Prisma row. Rows are mapped to view models so
 *     that an owner's email address cannot reach a listing card by accident.
 */

/** The only definition of "publicly visible" in the codebase. */
export const PUBLIC_LISTING_WHERE = {
  status: "PUBLISHED",
  moderation: "APPROVED",
} as const;

export interface ListingPage {
  readonly listings: ListingCard[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
}

/**
 * Translates shop filters into a query.
 *
 * Filters are matched on slugs rather than ids, because the URL carries slugs
 * and a join on a human-readable key keeps shareable links stable across a
 * reseed.
 */
function buildWhere(filters: ShopFilters) {
  const item: Record<string, unknown> = {};

  if (filters.category.length > 0) {
    // A parent category matches its children too, so /shop?category=indian-wear
    // returns sarees and lehengas rather than nothing.
    item.category = {
      OR: [{ slug: { in: filters.category } }, { parent: { slug: { in: filters.category } } }],
    };
  }
  if (filters.size.length > 0) item.size = { slug: { in: filters.size } };
  if (filters.brand.length > 0) item.brand = { slug: { in: filters.brand } };
  if (filters.colour.length > 0) item.color = { slug: { in: filters.colour } };
  if (filters.gender.length > 0) item.gender = { in: filters.gender };
  if (filters.condition.length > 0) item.condition = { in: filters.condition };
  if (filters.occasion.length > 0) {
    item.occasions = { some: { occasion: { slug: { in: filters.occasion } } } };
  }

  if (filters.q) {
    // Postgres full-text ranking is applied separately for sorting; this is the
    // cheap, index-friendly predicate that narrows the set.
    const terms = filters.q.split(/\s+/).filter(Boolean).slice(0, 6);
    item.OR = terms.map((term) => ({
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { brand: { name: { contains: term, mode: "insensitive" } } },
        { category: { name: { contains: term, mode: "insensitive" } } },
      ],
    }));
  }

  const where: Record<string, unknown> = { ...PUBLIC_LISTING_WHERE };

  if (Object.keys(item).length > 0) where.item = item;
  if (filters.city.length > 0) where.city = { in: filters.city };
  if (filters.availability === "instant") where.instantBook = true;

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.baseRateMinor = {
      ...(filters.minPrice !== undefined && { gte: filters.minPrice * 100 }),
      ...(filters.maxPrice !== undefined && { lte: filters.maxPrice * 100 }),
    };
  }

  // A requested rental window excludes anything already committed over it.
  // This is a coarse pass — `bufferDays` and policy are applied precisely by
  // the availability service when a member actually picks dates — but it is
  // what stops the grid showing pieces that are plainly unavailable.
  if (filters.from && filters.to) {
    where.bookings = {
      none: {
        status: { in: [...OCCUPYING_STATUSES] },
        startDate: { lt: new Date(`${filters.to}T00:00:00.000Z`) },
        endDate: { gt: new Date(`${filters.from}T00:00:00.000Z`) },
      },
    };
    where.blocks = {
      none: {
        startDate: { lt: new Date(`${filters.to}T00:00:00.000Z`) },
        endDate: { gt: new Date(`${filters.from}T00:00:00.000Z`) },
      },
    };
  }

  return where;
}

function buildOrderBy(filters: ShopFilters) {
  switch (filters.sort) {
    case "newest":
      return [{ publishedAt: "desc" as const }];
    case "price-asc":
      return [{ baseRateMinor: "asc" as const }];
    case "price-desc":
      return [{ baseRateMinor: "desc" as const }];
    case "rating":
      return [{ ratingAvgBps: "desc" as const }, { ratingCount: "desc" as const }];
    default:
      // "Recommended" favours pieces that people actually rent and rate, then
      // falls back to recency so new wardrobes are not buried forever.
      return [
        { rentalCount: "desc" as const },
        { ratingAvgBps: "desc" as const },
        { publishedAt: "desc" as const },
      ];
  }
}

export async function searchListings(filters: ShopFilters): Promise<ListingPage> {
  const db = await getDb();
  const page = Math.max(1, filters.page ?? 1);
  const where = buildWhere(filters);

  const [total, rows] = await Promise.all([
    db.listing.count({ where }),
    db.listing.findMany({
      where,
      orderBy: buildOrderBy(filters),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: listingCardSelect,
    }),
  ]);

  return {
    listings: rows.map(toListingCard),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** The homepage rail: pieces being rented right now. */
export const getTrendingListings = cache(async (limit = 12): Promise<ListingCard[]> => {
  const db = await getDb();
  const rows = await db.listing.findMany({
    where: PUBLIC_LISTING_WHERE,
    orderBy: [{ rentalCount: "desc" }, { ratingAvgBps: "desc" }],
    take: limit,
    select: listingCardSelect,
  });
  return rows.map(toListingCard);
});

/** Recently published pieces, for the "just in" rail. */
export const getRecentListings = cache(async (limit = 8): Promise<ListingCard[]> => {
  const db = await getDb();
  const rows = await db.listing.findMany({
    where: PUBLIC_LISTING_WHERE,
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: listingCardSelect,
  });
  return rows.map(toListingCard);
});

/** Other pieces from the same wardrobe, shown on a listing page. */
export async function getListingsByOwner(
  ownerId: string,
  options: { excludeListingId?: string; limit?: number } = {},
): Promise<ListingCard[]> {
  const db = await getDb();
  const rows = await db.listing.findMany({
    where: {
      ...PUBLIC_LISTING_WHERE,
      ownerId,
      ...(options.excludeListingId && { id: { not: options.excludeListingId } }),
    },
    orderBy: { rentalCount: "desc" },
    take: options.limit ?? 6,
    select: listingCardSelect,
  });
  return rows.map(toListingCard);
}

/**
 * Pieces that go with this one: same occasion, comparable price, different
 * wardrobe. Deliberately not "same category" — someone looking at a lehenga
 * does not want eleven more lehengas, they want what completes the evening.
 */
export async function getRelatedListings(input: {
  listingId: string;
  occasionSlugs: string[];
  baseRateMinor: number;
  ownerId: string;
  limit?: number;
}): Promise<ListingCard[]> {
  const db = await getDb();
  const rows = await db.listing.findMany({
    where: {
      ...PUBLIC_LISTING_WHERE,
      id: { not: input.listingId },
      ownerId: { not: input.ownerId },
      baseRateMinor: {
        gte: Math.round(input.baseRateMinor * 0.5),
        lte: Math.round(input.baseRateMinor * 2),
      },
      ...(input.occasionSlugs.length > 0 && {
        item: { occasions: { some: { occasion: { slug: { in: input.occasionSlugs } } } } },
      }),
    },
    orderBy: [{ ratingAvgBps: "desc" }, { rentalCount: "desc" }],
    take: input.limit ?? 8,
    select: listingCardSelect,
  });
  return rows.map(toListingCard);
}

/**
 * Everything the listing page needs, in one query.
 *
 * Returns null rather than throwing so the page can render its own not-found
 * state; a listing that was withdrawn is a normal event, not an error.
 */
export async function getListingBySlug(slug: string) {
  const db = await getDb();

  const listing = await db.listing.findFirst({
    where: { ...PUBLIC_LISTING_WHERE, item: { slug } },
    select: {
      id: true,
      status: true,
      currency: true,
      baseRateMinor: true,
      baseDurationDays: true,
      extraDayRateMinor: true,
      depositMinor: true,
      cleaningFeeMinor: true,
      deliveryFeeMinor: true,
      minRentalDays: true,
      maxRentalDays: true,
      bufferDays: true,
      leadTimeDays: true,
      instantBook: true,
      fulfilment: true,
      city: true,
      state: true,
      rentalTerms: true,
      rentalCount: true,
      ratingAvgBps: true,
      ratingCount: true,
      wishlistCount: true,
      publishedAt: true,
      ownerId: true,
      owner: {
        select: {
          id: true,
          name: true,
          image: true,
          createdAt: true,
          profile: {
            select: {
              handle: true,
              bio: true,
              city: true,
              state: true,
              avatarKey: true,
              ratingAvgBps: true,
              ratingCount: true,
              rentalsHosted: true,
              responseRateBps: true,
              responseMins: true,
              isIdentityVerified: true,
              joinedAt: true,
            },
          },
        },
      },
      item: {
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          gender: true,
          condition: true,
          fabric: true,
          careInstructions: true,
          retailPriceMinor: true,
          bustMm: true,
          waistMm: true,
          hipMm: true,
          lengthMm: true,
          shoulderMm: true,
          sleeveMm: true,
          brand: { select: { name: true, slug: true, isDesigner: true } },
          category: { select: { name: true, slug: true } },
          size: { select: { label: true, slug: true, system: true } },
          color: { select: { name: true, slug: true, hex: true, family: true } },
          occasions: { select: { occasion: { select: { name: true, slug: true } } } },
          images: {
            orderBy: { position: "asc" },
            select: {
              storageKey: true,
              alt: true,
              width: true,
              height: true,
              blurDataUrl: true,
              isCover: true,
            },
          },
        },
      },
    },
  });

  return listing;
}

export type ListingDetail = NonNullable<Awaited<ReturnType<typeof getListingBySlug>>>;

/**
 * Live occupancy for a listing: confirmed bookings and owner blocks, as the
 * pure availability functions expect them.
 *
 * Reads only the columns the calculation needs. Accepts an executor so the
 * booking service can call it inside its transaction and see the same snapshot
 * as its own writes.
 */
export async function getOccupancy(listingId: string, executor?: DbExecutor): Promise<Occupancy[]> {
  const db = executor ?? ((await getDb()) as Db);

  const [bookings, blocks] = await Promise.all([
    db.rentalItem.findMany({
      where: { listingId, status: { in: [...OCCUPYING_STATUSES] } },
      select: { id: true, startDate: true, endDate: true, bufferDays: true },
    }),
    db.availabilityBlock.findMany({
      where: { listingId },
      select: { id: true, startDate: true, endDate: true },
    }),
  ]);

  const toIso = (value: Date) => value.toISOString().slice(0, 10);

  return [
    ...bookings.map((booking) => ({
      id: booking.id,
      kind: "BOOKING" as const,
      bufferDays: booking.bufferDays,
      range: { start: toIso(booking.startDate), end: toIso(booking.endDate) },
    })),
    ...blocks.map((block) => ({
      id: block.id,
      kind: "BLOCK" as const,
      bufferDays: 0,
      range: { start: toIso(block.startDate), end: toIso(block.endDate) },
    })),
  ];
}

/** The coarse availability signal shown on a listing card or page. */
export async function getAvailabilitySignal(listing: {
  id: string;
  minRentalDays: number;
  maxRentalDays: number;
  bufferDays: number;
  leadTimeDays: number;
}) {
  const occupancy = await getOccupancy(listing.id);
  return availabilitySignal({
    policy: {
      minRentalDays: listing.minRentalDays,
      maxRentalDays: listing.maxRentalDays,
      bufferDays: listing.bufferDays,
      leadTimeDays: listing.leadTimeDays,
    },
    occupancy,
    today: today(),
  });
}

/**
 * Records a view. Fire-and-forget: a failed counter increment must never fail
 * the page that triggered it.
 */
export async function recordListingView(listingId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.listing.update({
      where: { id: listingId },
      data: { viewCount: { increment: 1 } },
    });
  } catch {
    // Deliberately swallowed.
  }
}

// ── Taxonomy, for the filter rail ───────────────────────────────────────────

export const getFilterFacets = cache(async () => {
  const db = await getDb();

  const [categories, brands, sizes, colours, occasions, cities, priceRange] = await Promise.all([
    db.category.findMany({
      where: { parentId: { not: null } },
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        name: true,
        parent: { select: { slug: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    db.brand.findMany({
      where: { items: { some: { listing: PUBLIC_LISTING_WHERE } } },
      orderBy: { name: "asc" },
      select: { slug: true, name: true, isDesigner: true },
    }),
    db.size.findMany({
      orderBy: { sortOrder: "asc" },
      select: { slug: true, label: true, system: true },
    }),
    db.color.findMany({
      orderBy: { name: "asc" },
      select: { slug: true, name: true, hex: true, family: true },
    }),
    db.occasion.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
    db.listing.groupBy({
      by: ["city"],
      where: PUBLIC_LISTING_WHERE,
      _count: { city: true },
      orderBy: { _count: { city: "desc" } },
    }),
    db.listing.aggregate({
      where: PUBLIC_LISTING_WHERE,
      _min: { baseRateMinor: true },
      _max: { baseRateMinor: true },
    }),
  ]);

  return {
    categories: categories.filter((category) => category._count.items > 0),
    brands,
    sizes,
    colours,
    occasions,
    cities: cities.map((row) => ({ city: row.city, count: row._count.city })),
    priceRange: {
      minRupees: Math.floor((priceRange._min.baseRateMinor ?? 0) / 100),
      maxRupees: Math.ceil((priceRange._max.baseRateMinor ?? 1_500_000) / 100),
    },
  };
});

export type FilterFacets = Awaited<ReturnType<typeof getFilterFacets>>;
