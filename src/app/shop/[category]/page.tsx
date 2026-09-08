import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { parseShopFilters } from "@/domain/catalog/filters";
import { ShopView } from "@/components/shop/shop-view";
import { ShopGridSkeleton } from "@/components/shop/shop-grid";
import { getDb } from "@/server/db/client";

/**
 * A category landing page.
 *
 * `/shop/sarees` rather than `/shop?category=sarees`, because a category is a
 * place in the catalogue rather than a filter applied to it — it has its own
 * name, its own line of copy and its own canonical URL worth indexing. Filters
 * layered on top still travel in the query string.
 */

type Params = Promise<{ category: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function loadCategory(slug: string) {
  const db = await getDb();
  return db.category.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      tagline: true,
      parent: { select: { name: true, slug: true } },
      children: { select: { slug: true } },
    },
  });
}

// Deliberately no `generateStaticParams`. A category's contents change every
// time a listing is published, rented or withdrawn, so pre-rendering the set at
// build time buys nothing that `revalidate` does not — and Next runs the
// function in its own worker process, which would mean a second process opening
// the bundled single-writer database.

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await loadCategory(slug);
  if (!category) return { title: "Not found" };

  return {
    title: `${category.name} to rent`,
    description:
      category.tagline ??
      `Rent ${category.name.toLowerCase()} from members across India. Choose your dates, pay once, send it back.`,
    alternates: { canonical: `/shop/${category.slug}` },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { category: slug } = await params;
  const [category, raw] = await Promise.all([loadCategory(slug), searchParams]);
  if (!category) notFound();

  // The path segment is the category; anything else in the query string layers
  // on top of it. A `category` parameter in the URL is deliberately ignored so
  // the page cannot contradict its own address.
  const filters = { ...parseShopFilters(raw), category: [category.slug] };

  return (
    <Suspense key={`${slug}:${JSON.stringify(raw)}`} fallback={<ShopGridSkeleton />}>
      <ShopView
        filters={filters}
        eyebrow={category.parent?.name ?? "The wardrobe"}
        heading={category.name}
        standfirst={category.tagline ?? undefined}
      />
    </Suspense>
  );
}
