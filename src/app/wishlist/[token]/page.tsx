import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ListingTile } from "@/components/listing/listing-tile";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, EmptyState } from "@/components/ui/primitives";
import { IMAGE_SIZES } from "@/lib/media";
import { getDb } from "@/server/db/client";
import { listingCardSelect, toListingCard } from "@/server/services/listing-view";
import { PUBLIC_LISTING_WHERE } from "@/server/services/listings";

type Params = Promise<{ token: string }>;

export const metadata: Metadata = {
  title: "A shared wishlist",
  // Shared links are private-by-obscurity: findable by anyone holding the URL,
  // and deliberately not by anyone else.
  robots: { index: false, follow: false },
};

/**
 * A wishlist shared by link.
 *
 * Looked up by an opaque token rather than a user id, so a shared list never
 * exposes who owns it beyond their first name — and a token can be rotated
 * without touching the account.
 */
export default async function SharedWishlistPage({ params }: { params: Params }) {
  const { token } = await params;
  const db = await getDb();

  const wishlist = await db.wishlist.findUnique({
    where: { shareToken: token },
    select: {
      user: { select: { name: true, status: true } },
      items: {
        orderBy: { createdAt: "desc" },
        select: { listing: { select: listingCardSelect } },
      },
    },
  });

  if (!wishlist || wishlist.user.status !== "ACTIVE") notFound();

  // Re-read through the public predicate rather than trusting what is on the
  // wishlist: a saved piece may since have been withdrawn, paused or removed by
  // a moderator, and a shared link must not become a way to see any of those.
  const visible = await db.listing.findMany({
    where: {
      ...PUBLIC_LISTING_WHERE,
      id: { in: wishlist.items.map((item) => item.listing.id) },
    },
    select: listingCardSelect,
  });

  const cards = visible.map(toListingCard);
  const firstName = wishlist.user.name.split(" ")[0];

  return (
    <div className="page-gutter pt-14 pb-24">
      <div className="page-width">
        <header className="max-w-2xl">
          <Eyebrow className="mb-4">Shared with you</Eyebrow>
          <h1 className="display-2">{firstName}&rsquo;s list</h1>
          <p className="body-lg mt-4">
            {cards.length === 0
              ? "Nothing on it is available at the moment."
              : `${cards.length} ${cards.length === 1 ? "piece" : "pieces"} ${firstName} is thinking about. All of them can be rented.`}
          </p>
        </header>

        {cards.length === 0 ? (
          <EmptyState
            title="Everything here has been rented."
            body="The pieces on this list are either out or no longer listed. There is plenty else."
            action={<ButtonLink href="/shop">Browse the wardrobe</ButtonLink>}
            className="mt-12"
          />
        ) : (
          <ul className="mt-12 grid grid-cols-2 gap-x-5 gap-y-12 sm:grid-cols-3 sm:gap-x-6 xl:grid-cols-4">
            {cards.map((listing, index) => (
              <li key={listing.id}>
                <ListingTile listing={listing} sizes={IMAGE_SIZES.grid} priority={index < 4} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
