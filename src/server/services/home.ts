import "server-only";

import { cache } from "react";

import { getDb } from "@/server/db/client";
import { PUBLIC_LISTING_WHERE } from "./listings";

/**
 * Homepage data.
 *
 * Kept apart from the catalogue service because the homepage asks a different
 * kind of question: not "which listings match this filter" but "what is worth
 * putting on the front page". Both read the same tables; only one of them cares
 * about editorial ordering.
 */

/** Occasion tiles, with a live count so a tile never leads to an empty shop. */
export const getHomeOccasions = cache(async () => {
  const db = await getDb();

  const occasions = await db.occasion.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      slug: true,
      name: true,
      tagline: true,
      heroKey: true,
      _count: { select: { items: true } },
    },
  });

  return occasions
    .filter((occasion) => occasion._count.items > 0)
    .slice(0, 6)
    .map((occasion) => ({
      slug: occasion.slug,
      name: occasion.name,
      tagline: occasion.tagline,
      heroKey: occasion.heroKey ?? `occasion-${occasion.slug}`,
      count: occasion._count.items,
    }));
});

export type HomeOccasion = Awaited<ReturnType<typeof getHomeOccasions>>[number];

/**
 * Member-curated wardrobes.
 *
 * Seeded as collections with a curator, which is what makes "Ananya's wedding
 * edit" a real object in the database rather than a label invented by the
 * homepage.
 */
export const getFeaturedWardrobes = cache(async () => {
  const db = await getDb();

  const collections = await db.collection.findMany({
    // `listings: { some: {} }` is load-bearing: a curated wardrobe whose pieces
    // have all been removed is still a published collection with a curator, and
    // without this it kept its place on the front page as an empty card.
    where: { curatorId: { not: null }, publishedAt: { not: null }, listings: { some: {} } },
    orderBy: { sortOrder: "asc" },
    take: 3,
    select: {
      slug: true,
      title: true,
      standfirst: true,
      curatorId: true,
      listings: {
        orderBy: { position: "asc" },
        take: 3,
        select: {
          listing: {
            select: {
              id: true,
              item: {
                select: {
                  slug: true,
                  title: true,
                  images: {
                    orderBy: { position: "asc" },
                    take: 1,
                    select: { storageKey: true, alt: true, blurDataUrl: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const curatorIds = collections
    .map((collection) => collection.curatorId)
    .filter((id): id is string => Boolean(id));

  const curators = await db.user.findMany({
    where: { id: { in: curatorIds } },
    select: {
      id: true,
      name: true,
      profile: {
        select: {
          handle: true,
          city: true,
          ratingAvgBps: true,
          ratingCount: true,
          rentalsHosted: true,
          isIdentityVerified: true,
        },
      },
    },
  });

  const curatorById = new Map(curators.map((curator) => [curator.id, curator]));

  return collections.map((collection) => {
    const curator = collection.curatorId ? curatorById.get(collection.curatorId) : undefined;
    return {
      slug: collection.slug,
      title: collection.title,
      standfirst: collection.standfirst,
      curator: curator
        ? {
            name: curator.name,
            handle: curator.profile?.handle ?? null,
            city: curator.profile?.city ?? null,
            ratingAvgBps: curator.profile?.ratingAvgBps ?? 0,
            ratingCount: curator.profile?.ratingCount ?? 0,
            rentalsHosted: curator.profile?.rentalsHosted ?? 0,
            verified: curator.profile?.isIdentityVerified ?? false,
          }
        : null,
      pieces: collection.listings.map((entry) => ({
        id: entry.listing.id,
        slug: entry.listing.item.slug,
        title: entry.listing.item.title,
        image: entry.listing.item.images[0] ?? null,
      })),
    };
  });
});

export type FeaturedWardrobe = Awaited<ReturnType<typeof getFeaturedWardrobes>>[number];

/**
 * Recent reviews, for social proof.
 *
 * Only reviews with a body: a five-star rating with nothing written is true but
 * says nothing, and a wall of them reads as invented.
 */
export const getRecentReviews = cache(async (limit = 3) => {
  const db = await getDb();

  const reviews = await db.review.findMany({
    where: {
      direction: "RENTER_ON_ITEM",
      moderation: "APPROVED",
      body: { not: null },
      listing: PUBLIC_LISTING_WHERE,
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      id: true,
      rating: true,
      body: true,
      publishedAt: true,
      author: { select: { name: true, profile: { select: { city: true } } } },
      listing: {
        select: {
          item: {
            select: {
              slug: true,
              title: true,
              brand: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  return reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    body: review.body as string,
    author: review.author.name,
    city: review.author.profile?.city ?? null,
    itemSlug: review.listing?.item.slug ?? null,
    itemTitle: review.listing?.item.title ?? null,
    brand: review.listing?.item.brand?.name ?? null,
  }));
});

export type HomeReview = Awaited<ReturnType<typeof getRecentReviews>>[number];
