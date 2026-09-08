import "server-only";

import { cache } from "react";

import { getDb } from "@/server/db/client";
import { PUBLIC_LISTING_WHERE } from "./listings";

/**
 * The navigation panel's contents.
 *
 * Read from the catalogue rather than hardcoded in the header, so a category an
 * administrator adds appears in the navigation without a deploy — and so the
 * menu can never offer a route that leads to an empty shop.
 *
 * Cached per request: the header renders on every page.
 */
export const getNavigation = cache(async () => {
  const db = await getDb();

  const [categories, occasions, featured] = await Promise.all([
    db.category.findMany({
      where: { parentId: { not: null } },
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        name: true,
        parent: { select: { slug: true, name: true, sortOrder: true } },
        _count: { select: { items: true } },
      },
    }),
    db.occasion.findMany({
      orderBy: { sortOrder: "asc" },
      take: 8,
      select: { slug: true, name: true },
    }),
    db.collection.findFirst({
      where: { isFeatured: true, publishedAt: { not: null } },
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        title: true,
        standfirst: true,
        heroKey: true,
        _count: { select: { listings: true } },
      },
    }),
  ]);

  // Grouped under their parent, in the taxonomy's own order. Empty categories
  // are dropped: a menu entry that leads nowhere is worse than one fewer entry.
  const groups = new Map<
    string,
    { name: string; sortOrder: number; items: Array<{ slug: string; name: string }> }
  >();

  for (const category of categories) {
    if (category._count.items === 0 || !category.parent) continue;
    const key = category.parent.slug;
    if (!groups.has(key)) {
      groups.set(key, {
        name: category.parent.name,
        sortOrder: category.parent.sortOrder,
        items: [],
      });
    }
    groups.get(key)?.items.push({ slug: category.slug, name: category.name });
  }

  const cityRows = await db.listing.groupBy({
    by: ["city"],
    where: PUBLIC_LISTING_WHERE,
    _count: { city: true },
    orderBy: { _count: { city: "desc" } },
    take: 5,
  });

  return {
    groups: [...groups.entries()]
      .map(([slug, group]) => ({ slug, ...group }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    occasions,
    cities: cityRows.map((row) => row.city),
    featured,
  };
});

export type Navigation = Awaited<ReturnType<typeof getNavigation>>;
