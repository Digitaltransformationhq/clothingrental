import "server-only";

import { cache } from "react";

import { env } from "@/env";
import { getDb } from "@/server/db/client";
import { PUBLIC_LISTING_WHERE } from "./listings";

/**
 * Search.
 *
 * PostgreSQL is the default engine and is entirely adequate at this catalogue's
 * size — a few thousand listings ranked by relevance over a handful of indexed
 * columns. The `SearchDriver` seam exists so that a dedicated engine can take
 * over when it stops being adequate, without the pages that call search
 * knowing.
 *
 * What would change at scale: typo tolerance, synonyms ("lehnga", "langa"),
 * and faceted counts computed alongside results rather than separately. All of
 * those are reasons to move to Meilisearch or Typesense, none of them is a
 * reason to build them here first.
 */

export interface SearchHit {
  slug: string;
  title: string;
  brand: string | null;
  kind: "listing" | "brand" | "category" | "occasion";
  href: string;
}

/**
 * Autocomplete across listings, brands, categories and occasions.
 *
 * Deliberately mixed rather than listings-only: somebody typing "sabyasachi"
 * usually wants the designer's pieces, not the one listing whose description
 * happens to mention them.
 */
export async function suggest(query: string, limit = 8): Promise<SearchHit[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const db = await getDb();
  const contains = { contains: term, mode: "insensitive" as const };

  const [listings, brands, categories, occasions] = await Promise.all([
    db.listing.findMany({
      where: {
        ...PUBLIC_LISTING_WHERE,
        item: { OR: [{ title: contains }, { description: contains }] },
      },
      orderBy: [{ rentalCount: "desc" }],
      take: limit,
      select: {
        item: { select: { slug: true, title: true, brand: { select: { name: true } } } },
      },
    }),
    db.brand.findMany({
      where: { name: contains, items: { some: { listing: PUBLIC_LISTING_WHERE } } },
      take: 3,
      select: { slug: true, name: true },
    }),
    db.category.findMany({
      where: { name: contains },
      take: 3,
      select: { slug: true, name: true },
    }),
    db.occasion.findMany({
      where: { name: contains },
      take: 3,
      select: { slug: true, name: true },
    }),
  ]);

  return [
    ...brands.map((brand) => ({
      slug: brand.slug,
      title: brand.name,
      brand: null,
      kind: "brand" as const,
      href: `/shop?brand=${brand.slug}`,
    })),
    ...categories.map((category) => ({
      slug: category.slug,
      title: category.name,
      brand: null,
      kind: "category" as const,
      href: `/shop/${category.slug}`,
    })),
    ...occasions.map((occasion) => ({
      slug: occasion.slug,
      title: occasion.name,
      brand: null,
      kind: "occasion" as const,
      href: `/shop?occasion=${occasion.slug}`,
    })),
    ...listings.map((listing) => ({
      slug: listing.item.slug,
      title: listing.item.title,
      brand: listing.item.brand?.name ?? null,
      kind: "listing" as const,
      href: `/item/${listing.item.slug}`,
    })),
  ].slice(0, limit + 4);
}

/**
 * What to offer somebody who has opened search and typed nothing.
 *
 * Built from the taxonomy rather than hardcoded, so a suggestion can never lead
 * to an empty result page.
 */
export const getSearchSuggestions = cache(async () => {
  const db = await getDb();

  const [occasions, categories, brands, cities] = await Promise.all([
    db.occasion.findMany({
      orderBy: { sortOrder: "asc" },
      take: 8,
      select: { slug: true, name: true },
    }),
    db.category.findMany({
      where: { parentId: { not: null } },
      orderBy: { sortOrder: "asc" },
      take: 8,
      select: { slug: true, name: true },
    }),
    db.brand.findMany({
      where: { isDesigner: true, items: { some: { listing: PUBLIC_LISTING_WHERE } } },
      take: 8,
      select: { slug: true, name: true },
    }),
    db.listing.groupBy({
      by: ["city"],
      where: PUBLIC_LISTING_WHERE,
      _count: { city: true },
      orderBy: { _count: { city: "desc" } },
      take: 6,
    }),
  ]);

  return [
    {
      title: "By occasion",
      items: occasions.map((entry) => ({
        label: entry.name,
        href: `/shop?occasion=${entry.slug}`,
      })),
    },
    {
      title: "By garment",
      items: categories.map((entry) => ({ label: entry.name, href: `/shop/${entry.slug}` })),
    },
    {
      title: "By house",
      items: brands.map((entry) => ({ label: entry.name, href: `/shop?brand=${entry.slug}` })),
    },
    {
      title: "By city",
      items: cities.map((entry) => ({
        label: entry.city,
        href: `/shop?city=${encodeURIComponent(entry.city)}`,
      })),
    },
  ].filter((group) => group.items.length > 0);
});

/** Which engine is configured. Read by the health endpoint and by tests. */
export function activeSearchDriver(): string {
  return env.SEARCH_DRIVER;
}
