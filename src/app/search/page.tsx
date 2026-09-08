import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { parseShopFilters } from "@/domain/catalog/filters";
import { ShopView } from "@/components/shop/shop-view";
import { ShopGridSkeleton } from "@/components/shop/shop-grid";
import { getSearchSuggestions } from "@/server/services/search";
import { Eyebrow } from "@/components/ui/primitives";

/**
 * Search results.
 *
 * Reuses the shop's own layout and filters, so a search is a starting point
 * that can then be narrowed rather than a dead end with its own rules.
 *
 * Never indexed: search result pages are thin, near-infinite in number, and
 * exactly the sort of thing that dilutes a catalogue in search results.
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  return {
    title: query ? `“${query}”` : "Search",
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const filters = parseShopFilters(raw);

  if (!filters.q) {
    const suggestions = await getSearchSuggestions();
    return <EmptyQuery suggestions={suggestions} />;
  }

  return (
    <Suspense key={JSON.stringify(raw)} fallback={<ShopGridSkeleton />}>
      <ShopView
        filters={filters}
        eyebrow="Search"
        heading={`“${filters.q}”`}
        standfirst="Narrow it further with the filters, or try a different word."
      />
    </Suspense>
  );
}

/**
 * The blank-search state.
 *
 * Rather than an empty box, it offers the things this catalogue is genuinely
 * good for — pulled from the taxonomy, so they can never point at nothing.
 */
async function EmptyQuery({
  suggestions,
}: {
  suggestions: Awaited<ReturnType<typeof getSearchSuggestions>>;
}) {
  return (
    <div className="page-gutter pt-14 pb-24">
      <div className="page-width max-w-3xl">
        <Eyebrow className="mb-4">Search</Eyebrow>
        <h1 className="display-2">What are you dressing for?</h1>
        <p className="body-lg mt-4 max-w-lg">
          Search by garment, brand, colour or occasion — or start from one of these.
        </p>

        <div className="mt-14 space-y-10">
          {suggestions.map((group) => (
            <section key={group.title}>
              <h2 className="label text-ink-3 mb-4">{group.title}</h2>
              <ul className="flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="border-rule text-small text-ink-2 hover:border-ink hover:text-ink inline-block border px-3.5 py-2 transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
