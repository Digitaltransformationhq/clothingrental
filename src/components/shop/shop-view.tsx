import { Suspense } from "react";

import type { ShopFilters } from "@/domain/catalog/filters";
import { getFilterFacets, searchListings } from "@/server/services/listings";
import { getSavedListingIds } from "@/server/actions/wishlist";
import { Eyebrow } from "@/components/ui/primitives";
import { FilterRail } from "./filter-rail";
import { MobileFilters } from "./mobile-filters";
import { ShopGrid } from "./shop-grid";
import { ShopToolbar } from "./shop-toolbar";
import { ActiveFilterPills } from "./active-filter-pills";

/**
 * The shop's layout.
 *
 * Shared by /shop, /shop/[category] and /search so the three cannot drift apart.
 * A persistent left rail on desktop, a drawer on mobile, and a grid that is
 * image-led — no cards, no borders, no panels.
 */
export async function ShopView({
  filters,
  heading,
  standfirst,
  eyebrow,
}: {
  filters: ShopFilters;
  heading: string;
  standfirst?: string;
  eyebrow?: string;
}) {
  const [page, facets, saved] = await Promise.all([
    searchListings(filters),
    getFilterFacets(),
    getSavedListingIds(),
  ]);

  return (
    <div className="page-gutter pt-10 pb-24 sm:pt-14">
      <div className="page-width">
        <header className="max-w-3xl">
          {eyebrow ? <Eyebrow className="mb-4">{eyebrow}</Eyebrow> : null}
          <h1 className="display-2">{heading}</h1>
          {standfirst ? <p className="body-lg mt-4 max-w-xl">{standfirst}</p> : null}
        </header>

        <div className="mt-10 grid gap-x-12 lg:grid-cols-[16rem_1fr] xl:grid-cols-[17.5rem_1fr]">
          {/* The rail is sticky and scrolls independently, so a member deep in
              a long grid can still reach the filters. */}
          <aside className="hidden lg:block">
            <div className="sticky top-28 max-h-[calc(100svh-9rem)] overflow-y-auto pr-2 pb-8">
              <Suspense fallback={null}>
                <FilterRail facets={facets} />
              </Suspense>
            </div>
          </aside>

          <div className="min-w-0">
            <Suspense fallback={null}>
              <ShopToolbar total={page.total} filters={filters} />
            </Suspense>

            <Suspense fallback={null}>
              <ActiveFilterPills filters={filters} facets={facets} />
            </Suspense>

            <ShopGrid page={page} filters={filters} savedListingIds={saved} />
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <MobileFilters facets={facets} filters={filters} total={page.total} />
      </Suspense>
    </div>
  );
}
