import Link from "next/link";

import { hasActiveFilters, serialiseShopFilters, type ShopFilters } from "@/domain/catalog/filters";
import { IMAGE_SIZES } from "@/lib/media";
import { cn } from "@/lib/cn";
import type { ListingPage } from "@/server/services/listings";
import { ListingTile, ListingTileSkeleton } from "@/components/listing/listing-tile";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";

/**
 * The results grid.
 *
 * Two up on a phone rather than one: garments are recognisable at small sizes,
 * and a single column makes browsing fifty pieces an endurance test.
 */
export function ShopGrid({
  page,
  filters,
  savedListingIds,
}: {
  page: ListingPage;
  filters: ShopFilters;
  savedListingIds: Set<string>;
}) {
  if (page.listings.length === 0) {
    return (
      <EmptyState
        title={
          hasActiveFilters(filters)
            ? "Nothing matches all of that."
            : "The wardrobe is empty just now."
        }
        body={
          hasActiveFilters(filters)
            ? "Try loosening a filter — the dates and the price range are usually the ones doing it."
            : "Pieces are added most days. Check back, or list something of your own."
        }
        action={
          hasActiveFilters(filters) ? (
            <ButtonLink href="/shop" variant="secondary">
              Clear filters
            </ButtonLink>
          ) : (
            <ButtonLink href="/sell" variant="secondary">
              List a piece
            </ButtonLink>
          )
        }
        className="mt-4"
      />
    );
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-x-5 gap-y-12 sm:grid-cols-3 sm:gap-x-6 xl:grid-cols-4">
        {page.listings.map((listing, index) => (
          <li key={listing.id}>
            <ListingTile
              listing={listing}
              sizes={IMAGE_SIZES.grid}
              initialSaved={savedListingIds.has(listing.id)}
              // The first row is above the fold at every width.
              priority={index < 4}
            />
          </li>
        ))}
      </ul>

      <Pagination page={page} filters={filters} />
    </>
  );
}

/**
 * Pagination as real links.
 *
 * Every page is a distinct, crawlable URL — not a "load more" button that
 * hides the catalogue from search engines and loses your place on a refresh.
 */
function Pagination({ page, filters }: { page: ListingPage; filters: ShopFilters }) {
  if (page.pageCount <= 1) return null;

  const href = (target: number) =>
    `/shop${serialiseShopFilters({ ...filters, page: target === 1 ? undefined : target })}`;

  // A compact window around the current page, with the ends always reachable.
  const windowed = new Set<number>([1, page.pageCount, page.page - 1, page.page, page.page + 1]);
  const pages = [...windowed]
    .filter((value) => value >= 1 && value <= page.pageCount)
    .sort((a, b) => a - b);

  return (
    <nav
      className="border-rule mt-16 flex items-center justify-between border-t pt-6"
      aria-label="Pagination"
    >
      {page.page > 1 ? (
        <Link
          href={href(page.page - 1)}
          className="label text-ink transition-opacity hover:opacity-60"
        >
          ← Previous
        </Link>
      ) : (
        <span className="label text-ink-3">← Previous</span>
      )}

      <ol className="flex items-center gap-1">
        {pages.map((value, index) => {
          const previous = pages[index - 1];
          return (
            <li key={value} className="flex items-center gap-1">
              {previous !== undefined && value - previous > 1 ? (
                <span className="meta text-ink-3 px-1" aria-hidden="true">
                  …
                </span>
              ) : null}
              <Link
                href={href(value)}
                aria-current={value === page.page ? "page" : undefined}
                className={cn(
                  "numeric text-small grid h-9 min-w-9 place-items-center px-2 transition-colors",
                  value === page.page
                    ? "bg-ink text-ink-inverse"
                    : "text-ink-2 hover:bg-paper-2 hover:text-ink",
                )}
              >
                {value}
              </Link>
            </li>
          );
        })}
      </ol>

      {page.page < page.pageCount ? (
        <Link
          href={href(page.page + 1)}
          className="label text-ink transition-opacity hover:opacity-60"
        >
          Next →
        </Link>
      ) : (
        <span className="label text-ink-3">Next →</span>
      )}
    </nav>
  );
}

/**
 * The loading state.
 *
 * Mirrors the real grid's columns and ratio exactly, so the page does not
 * reflow when results arrive.
 */
export function ShopGridSkeleton() {
  return (
    <div className="page-gutter pt-10 pb-24 sm:pt-14">
      <div className="page-width">
        <div className="bg-paper-3 h-12 w-64 animate-pulse" />
        <div className="mt-10 grid gap-x-12 lg:grid-cols-[16rem_1fr] xl:grid-cols-[17.5rem_1fr]">
          <div className="hidden space-y-4 lg:block" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="bg-paper-3 h-10 animate-pulse" />
            ))}
          </div>
          <ul className="grid grid-cols-2 gap-x-5 gap-y-12 sm:grid-cols-3 sm:gap-x-6 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <li key={index}>
                <ListingTileSkeleton />
              </li>
            ))}
          </ul>
        </div>
      </div>
      <span className="sr-only" role="status">
        Loading pieces…
      </span>
    </div>
  );
}
