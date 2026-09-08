import Image from "next/image";
import Link from "next/link";

import { formatMoney, money } from "@/domain/money";
import { cn } from "@/lib/cn";
import { IMAGE_SIZES, mediaUrl } from "@/lib/media";
import type { ListingCard } from "@/server/services/listing-view";
import { WishlistButton } from "@/components/listing/wishlist-button";

/**
 * The listing tile.
 *
 * The most repeated object on the site, so its restraint sets the tone for
 * everything. Deliberate decisions:
 *
 *  · It is a card: a dark hairline, square corners and the surface ground. No
 *    shadow and no radius, because on this site elevation is a rule and corners
 *    are square unless a control needs to read as a control.
 *
 *    The photograph is matted rather than bled to the frame: the padding is
 *    what makes an outline read as a mount instead of a box drawn around the
 *    picture.
 *
 *    The outline does not respond to hover. A border that lightens or darkens
 *    under the cursor makes the frame the thing being pointed at, when the
 *    photograph inside it is what the grid exists to show.
 *
 *    It was a bare tile before — photograph on the paper, type under it, the
 *    way a catalogue page works. That reads well in a full grid and thinly when
 *    the grid holds one or two pieces, which is why it is bounded now.
 *  · Metadata is quiet. Brand, size and city are set small and grey; the eye
 *    should go to the garment, then the price, then everything else.
 *  · One photograph, and it stays put. A second image used to be rendered
 *    underneath and revealed by fading the cover out on hover — which reads as
 *    the picture going blank whenever the second shot is pale, missing or just
 *    unrelated to the first, and that is most of a real catalogue.
 *  · The whole tile is one link, so the wishlist control cannot live inside it:
 *    an interactive element nested in an anchor is invalid, and the click would
 *    have to fight the navigation. It is a sibling, placed over the card at the
 *    foot, beside the metadata rather than over the photograph — which is why
 *    the type block reserves room on its right for it.
 *  · No badges over the photograph. An "instant booking" flag was tried here
 *    and removed: most of the catalogue books instantly, so it appeared on
 *    nearly every tile, informed nobody, and put a box of type over the one
 *    thing the grid exists to show. It belongs on the listing page, where the
 *    decision is actually made, and in the filter rail.
 */
export function ListingTile({
  listing,
  sizes = IMAGE_SIZES.grid,
  priority = false,
  className,
  showOwner = true,
  initialSaved = false,
}: {
  listing: ListingCard;
  sizes?: string;
  priority?: boolean;
  className?: string;
  showOwner?: boolean;
  /** Whether the viewing member has already saved this piece. */
  initialSaved?: boolean;
}) {
  const [cover] = listing.images;
  const price = money(listing.baseRateMinor, listing.currency as "INR");

  return (
    <article
      className={cn("photo-zoom group border-ink bg-surface relative border p-4", className)}
    >
      <Link href={`/item/${listing.slug}`} className="block" data-focus-silent>
        <div className="photo-frame aspect-[4/5] w-full">
          {cover ? (
            <Image
              src={mediaUrl(cover.storageKey)}
              alt={cover.alt}
              fill
              sizes={sizes}
              priority={priority}
              placeholder={cover.blurDataUrl ? "blur" : "empty"}
              blurDataURL={cover.blurDataUrl ?? undefined}
              className="object-cover"
            />
          ) : (
            <div className="bg-paper-3 h-full w-full" />
          )}
        </div>

        <div className="pt-4 pr-10">
          {listing.brand ? (
            <p className="meta text-ink-3 tracking-[0.1em] uppercase">{listing.brand}</p>
          ) : null}

          <h3 className="text-body text-ink mt-1 leading-snug">{listing.title}</h3>

          <p className="numeric text-body text-ink mt-2">
            {formatMoney(price)}
            <span className="text-ink-3">
              {" "}
              / {listing.baseDurationDays} {listing.baseDurationDays === 1 ? "day" : "days"}
            </span>
          </p>

          <p className="meta text-ink-3 mt-1.5">
            {listing.size === "Free size" ? "Free size" : `Size ${listing.size}`}
            <span aria-hidden="true"> · </span>
            {listing.city}
            {showOwner && listing.ownerName ? (
              <>
                <span aria-hidden="true"> · </span>
                {listing.ownerName.split(" ")[0]}
              </>
            ) : null}
          </p>
        </div>
      </Link>

      <WishlistButton
        listingId={listing.id}
        title={listing.title}
        initialSaved={initialSaved}
        className="absolute right-3 bottom-3"
      />
    </article>
  );
}

/**
 * The tile's loading state.
 *
 * Reserves the exact aspect ratio and the exact number of metadata lines, so
 * nothing moves when the real content arrives. A skeleton that changes the
 * layout is worse than no skeleton.
 */
export function ListingTileSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("border-ink bg-surface animate-pulse border p-4", className)}
      aria-hidden="true"
    >
      <div className="bg-paper-3 aspect-[4/5] w-full" />
      <div className="pt-4">
        <div className="bg-paper-3 h-2.5 w-16" />
        <div className="bg-paper-3 mt-2.5 h-3 w-4/5" />
        <div className="bg-paper-3 mt-3 h-3 w-24" />
        <div className="bg-paper-3 mt-2.5 h-2.5 w-32" />
      </div>
    </div>
  );
}
