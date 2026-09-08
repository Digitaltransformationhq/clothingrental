import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { formatDateRange, toIsoDate } from "@/domain/dates";
import { formatMoney, money } from "@/domain/money";
import { describeStatus, statusTone } from "@/domain/rental/state-machine";
import { ButtonLink } from "@/components/ui/button";
import { Chip, EmptyState, Rating } from "@/components/ui/primitives";
import { RentalActions } from "@/components/account/rental-actions";
import { mediaUrl } from "@/lib/media";
import { requireUser } from "@/server/auth/session";
import {
  getMyBookings,
  getMyListings,
  type MyBooking,
  type MyListing,
} from "@/server/services/account";

export const metadata: Metadata = { title: "My wardrobe" };

/**
 * The owner's view.
 *
 * Requests waiting on a reply come first and are the only thing on this page
 * given any visual urgency — they are the one thing that costs an owner money
 * if ignored. The wardrobe itself follows as a list of garments, not as a table
 * of rows with an "Actions" column.
 */
export default async function ListingsPage() {
  const user = await requireUser("/account/listings");
  const [listings, bookings] = await Promise.all([getMyListings(user.id), getMyBookings(user.id)]);

  const pending = bookings.filter((booking) => booking.status === "REQUESTED");
  const active = bookings.filter((booking) =>
    [
      "ACCEPTED",
      "READY_FOR_PICKUP",
      "SHIPPED",
      "DELIVERED",
      "ACTIVE",
      "RETURN_REQUESTED",
      "RETURNED",
      "INSPECTION",
    ].includes(booking.status),
  );

  if (listings.length === 0) {
    return (
      <EmptyState
        title="Your wardrobe is waiting."
        body="List a piece and let someone else give it another night out. It takes about ten minutes, and you set the price."
        action={<ButtonLink href="/sell/new">List your first piece</ButtonLink>}
        className="border-t-0"
      />
    );
  }

  return (
    <div className="space-y-16">
      {pending.length > 0 ? (
        <section aria-labelledby="pending-heading">
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h2 id="pending-heading" className="label text-ink-3">
              Waiting on you
            </h2>
            <p className="meta text-claret">
              {pending.length} {pending.length === 1 ? "request" : "requests"}
            </p>
          </div>
          <ul className="space-y-4">
            {pending.map((booking) => (
              <RequestCard key={booking.id} booking={booking} />
            ))}
          </ul>
        </section>
      ) : null}

      {active.length > 0 ? (
        <section aria-labelledby="out-heading">
          <h2 id="out-heading" className="label text-ink-3 mb-5">
            Out on rental
          </h2>
          <ul className="border-rule border-t">
            {active.map((booking) => (
              <BookingRow key={booking.id} booking={booking} />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="pieces-heading">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 id="pieces-heading" className="label text-ink-3">
            Your pieces
          </h2>
          <ButtonLink href="/sell/new" variant="secondary" size="sm">
            List another
          </ButtonLink>
        </div>
        <ul className="border-rule border-t">
          {listings.map((listing) => (
            <ListingRow key={listing.id} listing={listing} />
          ))}
        </ul>
      </section>
    </div>
  );
}

/** A request needing a decision. The only bordered surface on the page. */
function RequestCard({ booking }: { booking: MyBooking }) {
  const image = booking.listing.item.images[0];
  const renter = booking.rental.renter;
  const range = { start: toIsoDate(booking.startDate), end: toIsoDate(booking.endDate) };

  return (
    <li className="border-rule bg-surface border p-5 sm:p-6">
      <div className="flex flex-wrap gap-5">
        <Link
          href={`/item/${booking.listing.item.slug}`}
          aria-label={booking.listing.item.title}
          className="bg-paper-3 relative aspect-[4/5] w-20 shrink-0 overflow-hidden"
        >
          {image ? (
            <Image
              src={mediaUrl(image.storageKey)}
              alt=""
              fill
              sizes="80px"
              placeholder={image.blurDataUrl ? "blur" : "empty"}
              blurDataURL={image.blurDataUrl ?? undefined}
              className="object-cover"
            />
          ) : null}
        </Link>

        <div className="min-w-0 flex-1">
          <h3 className="title-2">{booking.listing.item.title}</h3>
          <p className="text-small text-ink-2 mt-2">
            {formatDateRange(range)}
            <span className="text-ink-3"> · {booking.days} days</span>
          </p>

          <p className="meta text-ink-3 mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-ink">{renter.name}</span>
            {renter.profile?.city ? <span>· {renter.profile.city}</span> : null}
            {renter.profile?.isIdentityVerified ? (
              <span className="text-positive">· Verified</span>
            ) : (
              <span>· Not yet verified</span>
            )}
            {renter.profile?.ratingCount ? (
              <>
                <span aria-hidden="true">·</span>
                <Rating
                  value={renter.profile.ratingAvgBps / 10_000}
                  count={renter.profile.ratingCount}
                />
              </>
            ) : null}
          </p>
        </div>

        <div className="text-right">
          <p className="numeric font-display text-ink text-[1.5rem] leading-none">
            {formatMoney(money(booking.ownerEarningsMinor, booking.rental.currency as "INR"))}
          </p>
          <p className="meta text-ink-3 mt-1.5">you’d earn</p>
        </div>
      </div>

      <RentalActions
        bookingId={booking.id}
        status={booking.status}
        perspective="OWNER"
        className="border-rule mt-5 border-t pt-5"
      />
    </li>
  );
}

function BookingRow({ booking }: { booking: MyBooking }) {
  const range = { start: toIsoDate(booking.startDate), end: toIsoDate(booking.endDate) };

  return (
    <li className="border-rule flex flex-wrap items-center gap-4 border-b py-4">
      <div className="min-w-0 flex-1">
        <h3 className="text-body text-ink">{booking.listing.item.title}</h3>
        <p className="meta text-ink-3 mt-0.5">
          {formatDateRange(range)} · {booking.rental.renter.name} ·{" "}
          <span className="numeric">{booking.rental.reference}</span>
        </p>
      </div>

      <Chip tone={statusTone(booking.status)}>{describeStatus(booking.status, "OWNER")}</Chip>

      <RentalActions bookingId={booking.id} status={booking.status} perspective="OWNER" />
    </li>
  );
}

function ListingRow({ listing }: { listing: MyListing }) {
  const image = listing.item.images[0];
  const upcoming = listing.bookings.length;

  const statusChip =
    listing.status === "PUBLISHED" ? (
      <Chip tone="positive">Live</Chip>
    ) : listing.status === "PENDING_REVIEW" ? (
      <Chip tone="caution">In review</Chip>
    ) : listing.status === "DRAFT" ? (
      <Chip>Draft</Chip>
    ) : listing.status === "PAUSED" ? (
      <Chip>Paused</Chip>
    ) : (
      <Chip>Archived</Chip>
    );

  return (
    <li className="border-rule flex flex-wrap items-center gap-5 border-b py-5">
      <Link
        href={`/item/${listing.item.slug}`}
        aria-label={listing.item.title}
        className="bg-paper-3 relative aspect-[4/5] w-16 shrink-0 overflow-hidden"
      >
        {image ? (
          <Image
            src={mediaUrl(image.storageKey)}
            alt=""
            fill
            sizes="64px"
            placeholder={image.blurDataUrl ? "blur" : "empty"}
            blurDataURL={image.blurDataUrl ?? undefined}
            className="object-cover"
          />
        ) : null}
      </Link>

      <div className="min-w-0 flex-1">
        <h3 className="text-body text-ink">
          <Link href={`/item/${listing.item.slug}`} className="link-underline">
            {listing.item.title}
          </Link>
        </h3>
        <p className="meta text-ink-3 mt-1">
          <span className="numeric">
            {formatMoney(money(listing.baseRateMinor, listing.currency as "INR"))}
          </span>{" "}
          / {listing.baseDurationDays} days · {listing.viewCount} views · {listing.wishlistCount}{" "}
          saved
          {upcoming > 0 ? ` · ${upcoming} booked` : ""}
        </p>
        {listing.moderation === "REJECTED" && listing.moderationNote ? (
          <p className="meta text-critical mt-1.5">{listing.moderationNote}</p>
        ) : null}
      </div>

      {listing.ratingCount > 0 ? (
        <Rating value={listing.ratingAvgBps / 10_000} count={listing.ratingCount} />
      ) : null}

      {statusChip}

      <Link href={`/sell/${listing.id}/edit`} className="link-underline text-small text-ink">
        Edit
      </Link>
    </li>
  );
}
