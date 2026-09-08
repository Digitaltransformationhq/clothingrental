import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { ListingTile } from "@/components/listing/listing-tile";
import { ShareWishlist } from "@/components/account/share-wishlist";
import { IMAGE_SIZES } from "@/lib/media";
import { requireUser } from "@/server/auth/session";
import { getWishlist } from "@/server/services/account";

export const metadata: Metadata = { title: "Saved pieces" };

/**
 * Saved pieces.
 *
 * The same tile as the shop, so a saved piece looks like the thing that was
 * saved. Sharing is a first-class action: choosing an outfit is usually a
 * conversation with somebody else, and the share token exists so a wishlist can
 * be sent without exposing the member's id.
 */
export default async function WishlistPage() {
  const user = await requireUser("/account/wishlist");
  const { listings, shareToken } = await getWishlist(user.id);

  if (listings.length === 0) {
    return (
      <EmptyState
        title="Nothing saved yet."
        body="Start building your next look. Tap the heart on anything you like and it will wait for you here."
        action={<ButtonLink href="/shop">Browse the wardrobe</ButtonLink>}
        className="border-t-0"
      />
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <p className="meta text-ink-2">
          <span className="numeric text-ink">{listings.length}</span>{" "}
          {listings.length === 1 ? "piece" : "pieces"} saved
        </p>
        {shareToken ? <ShareWishlist token={shareToken} /> : null}
      </div>

      <ul className="grid grid-cols-2 gap-x-5 gap-y-12 sm:grid-cols-3 sm:gap-x-6 xl:grid-cols-4">
        {listings.map((listing) => (
          <li key={listing.id}>
            <ListingTile listing={listing} sizes={IMAGE_SIZES.grid} initialSaved />
          </li>
        ))}
      </ul>
    </div>
  );
}
