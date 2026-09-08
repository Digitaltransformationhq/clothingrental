import type { MetadataRoute } from "next";

import { getDb } from "@/server/db/client";

/**
 * The sitemap.
 *
 * Lists only what should genuinely be indexed: the editorial pages, the
 * catalogue, and every published listing. Deliberately absent are the account
 * area, checkout, search results and filtered shop views — thin, duplicative or
 * private pages that dilute a catalogue's standing in search results.
 *
 * `lastModified` comes from the row rather than from the build, so a crawler
 * that has seen a listing before knows whether it is worth fetching again.
 */

const BASE = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = await getDb();

  const [listings, categories, collections, occasions, wardrobes] = await Promise.all([
    db.listing.findMany({
      where: { status: "PUBLISHED", moderation: "APPROVED" },
      select: { updatedAt: true, item: { select: { slug: true } } },
    }),
    db.category.findMany({ select: { slug: true, updatedAt: true } }),
    db.collection.findMany({
      where: { publishedAt: { not: null } },
      select: { slug: true, updatedAt: true },
    }),
    db.occasion.findMany({ select: { slug: true } }),
    db.profile.findMany({
      where: { user: { status: "ACTIVE", listings: { some: { status: "PUBLISHED" } } } },
      select: { handle: true, updatedAt: true },
    }),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/collections`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/sell`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/how-it-works`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/about`, changeFrequency: "monthly", priority: 0.5 },
    ...["terms", "privacy", "rental-agreement", "cancellation"].map((slug) => ({
      url: `${BASE}/legal/${slug}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];

  return [
    ...staticPages,
    ...categories.map((category) => ({
      url: `${BASE}/shop/${category.slug}`,
      lastModified: category.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    // Occasion views are the one filtered form worth indexing: they are how
    // people actually search ("wedding guest outfit"), and each is a stable,
    // meaningful set rather than an arbitrary filter combination.
    ...occasions.map((occasion) => ({
      url: `${BASE}/shop?occasion=${occasion.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...collections.map((collection) => ({
      url: `${BASE}/collections/${collection.slug}`,
      lastModified: collection.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...listings.map((listing) => ({
      url: `${BASE}/item/${listing.item.slug}`,
      lastModified: listing.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...wardrobes.map((wardrobe) => ({
      url: `${BASE}/wardrobe/${wardrobe.handle}`,
      lastModified: wardrobe.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
