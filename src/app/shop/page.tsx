import type { Metadata } from "next";
import { Suspense } from "react";

import { ShopView } from "@/components/shop/shop-view";
import { ShopGridSkeleton } from "@/components/shop/shop-grid";
import { parseShopFilters } from "@/domain/catalog/filters";

/**
 * The shop.
 *
 * A server component that reads its entire state from the URL, so the page is
 * cacheable, shareable and crawlable. The filter rail writes to the URL; this
 * page reads it. There is no shared client state between them.
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const filters = parseShopFilters(await searchParams);

  // A filtered view describes itself, so a shared link previews usefully.
  const parts: string[] = [];
  if (filters.occasion.length === 1) parts.push(titleCase(filters.occasion[0]));
  if (filters.category.length === 1) parts.push(titleCase(filters.category[0]));
  if (filters.city.length === 1) parts.push(`in ${filters.city[0]}`);

  const title = parts.length > 0 ? `${parts.join(" ")} to rent` : "Rent from real wardrobes";

  return {
    title,
    description:
      "Browse sarees, lehengas, tailoring and evening wear listed by members across India. Filter by occasion, size, colour, city and dates.",
    alternates: {
      // Filtered views point back at the unfiltered shop, so pagination and
      // filter permutations do not compete with each other in search results.
      canonical: filters.category.length === 1 ? `/shop/${filters.category[0]}` : "/shop",
    },
    // Deep filter combinations are useful to people and worthless to a crawler.
    robots: hasManyFilters(filters) ? { index: false, follow: true } : undefined,
  };
}

function hasManyFilters(filters: ReturnType<typeof parseShopFilters>): boolean {
  const count =
    filters.category.length +
    filters.occasion.length +
    filters.size.length +
    filters.brand.length +
    filters.colour.length +
    filters.city.length;
  return count > 1;
}

function titleCase(value: string): string {
  return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const filters = parseShopFilters(raw);

  return (
    <Suspense key={JSON.stringify(raw)} fallback={<ShopGridSkeleton />}>
      <ShopView
        filters={filters}
        heading="Everything"
        standfirst="Pieces from real wardrobes across India. Filter down to what you're actually dressing for."
      />
    </Suspense>
  );
}
