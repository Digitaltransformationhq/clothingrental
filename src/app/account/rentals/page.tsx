import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { differenceInDays, formatDateRange, today, toIsoDate } from "@/domain/dates";
import { formatMoney, money } from "@/domain/money";
import {
  describeStatus,
  journeyPosition,
  statusTone,
  BOOKING_JOURNEY,
} from "@/domain/rental/state-machine";
import { ButtonLink } from "@/components/ui/button";
import { Chip, EmptyState } from "@/components/ui/primitives";
import { RentalActions } from "@/components/account/rental-actions";
import { cn } from "@/lib/cn";
import { mediaUrl } from "@/lib/media";
import { requireUser } from "@/server/auth/session";
import { getMyRentals, type MyRental } from "@/server/services/account";

export const metadata: Metadata = { title: "My rentals" };

/**
 * The renter's view.
 *
 * Leads with one large "your next look" card rather than a table, because the
 * next thing you are wearing is the only row most people came here for. Older
 * rentals collapse into a quiet list underneath.
 */
export default async function RentalsPage() {
  const user = await requireUser("/account/rentals");
  const { live, finished } = await getMyRentals(user.id);

  if (live.length === 0 && finished.length === 0) {
    return (
      <EmptyState
        title="Your next look hasn't been booked yet."
        body="When you rent something, it will live here — with its dates, its tracking and a way to reach the owner."
        action={<ButtonLink href="/shop">Find something to wear</ButtonLink>}
        className="border-t-0"
      />
    );
  }

  const [next, ...rest] = live;

  return (
    <div className="space-y-16">
      {next ? (
        <section aria-labelledby="next-heading">
          <h2 id="next-heading" className="label text-ink-3 mb-5">
            Your next look
          </h2>
          <NextRental rental={next} />
        </section>
      ) : null}

      {rest.length > 0 ? (
        <section aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading" className="label text-ink-3 mb-5">
            Also coming up
          </h2>
          <ul className="border-rule border-t">
            {rest.map((rental) => (
              <RentalRow key={rental.id} rental={rental} />
            ))}
          </ul>
        </section>
      ) : null}

      {finished.length > 0 ? (
        <section aria-labelledby="past-heading">
          <h2 id="past-heading" className="label text-ink-3 mb-5">
            Previously worn
          </h2>
          <ul className="border-rule border-t">
            {finished.map((rental) => (
              <RentalRow key={rental.id} rental={rental} showReviewPrompt />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * The lead card.
 *
 * Big photograph, the dates in display type, a progress trail, and whatever
 * action is actually available next. No metrics.
 */
function NextRental({ rental }: { rental: MyRental }) {
  const image = rental.listing.item.images[0];
  const range = { start: toIsoDate(rental.startDate), end: toIsoDate(rental.endDate) };
  const daysAway = differenceInDays(today(), range.start);
  const position = journeyPosition(rental.status);

  return (
    <article className="border-rule bg-surface grid gap-8 border p-6 sm:grid-cols-[minmax(0,14rem)_1fr] sm:p-8">
      <Link
        href={`/item/${rental.listing.item.slug}`}
        aria-label={rental.listing.item.title}
        className="photo-zoom group relative block"
      >
        <div className="photo-frame aspect-[4/5] w-full">
          {image ? (
            <Image
              src={mediaUrl(image.storageKey)}
              alt={image.alt}
              fill
              sizes="(max-width: 640px) 100vw, 224px"
              placeholder={image.blurDataUrl ? "blur" : "empty"}
              blurDataURL={image.blurDataUrl ?? undefined}
              className="object-cover"
            />
          ) : null}
        </div>
      </Link>

      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {rental.listing.item.brand ? (
              <p className="meta text-ink-3 tracking-[0.1em] uppercase">
                {rental.listing.item.brand.name}
              </p>
            ) : null}
            <h3 className="display-3 mt-2">{rental.listing.item.title}</h3>
          </div>
          <Chip tone={statusTone(rental.status)}>{describeStatus(rental.status)}</Chip>
        </div>

        <p className="font-display text-ink mt-5 text-[1.5rem] leading-none">
          {formatDateRange(range)}
        </p>
        <p className="meta text-ink-2 mt-2">
          {daysAway > 0
            ? `In ${daysAway} ${daysAway === 1 ? "day" : "days"}`
            : daysAway === 0
              ? "Starts today"
              : "With you now"}
          <span aria-hidden="true"> · </span>
          {rental.days} days
          <span aria-hidden="true"> · </span>
          Size {rental.listing.item.size.label}
        </p>

        {/* The trail. Marks rather than a bar: a percentage-complete bar
            implies a duration, and this is a sequence of events. */}
        {position >= 0 ? (
          <ol className="mt-7 flex items-center gap-1.5" aria-label="Rental progress">
            {BOOKING_JOURNEY.map((step, index) => (
              <li key={step} className="flex-1">
                <span
                  className={cn(
                    "block h-0.5 w-full transition-colors",
                    index <= position ? "bg-ink" : "bg-rule",
                  )}
                />
                <span className="sr-only">
                  {describeStatus(step)}
                  {index === position ? " — current" : index < position ? " — done" : ""}
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        <dl className="mt-7 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <div className="text-small flex gap-2">
            <dt className="text-ink-3">From</dt>
            <dd className="text-ink">
              {rental.listing.owner.name} · {rental.listing.city}
            </dd>
          </div>
          <div className="text-small flex gap-2">
            <dt className="text-ink-3">Paid</dt>
            <dd className="numeric text-ink">
              {formatMoney(money(rental.rental.totalMinor, rental.rental.currency as "INR"))}
            </dd>
          </div>
          <div className="text-small flex gap-2">
            <dt className="text-ink-3">Reference</dt>
            <dd className="numeric text-ink">{rental.rental.reference}</dd>
          </div>
          {rental.delivery?.trackingNumber ? (
            <div className="text-small flex gap-2">
              <dt className="text-ink-3">Tracking</dt>
              <dd className="numeric text-ink">
                {rental.delivery.carrier} {rental.delivery.trackingNumber}
              </dd>
            </div>
          ) : null}
        </dl>

        <RentalActions
          bookingId={rental.id}
          status={rental.status}
          perspective="RENTER"
          className="mt-8"
        />
      </div>
    </article>
  );
}

function RentalRow({
  rental,
  showReviewPrompt = false,
}: {
  rental: MyRental;
  showReviewPrompt?: boolean;
}) {
  const image = rental.listing.item.images[0];
  const range = { start: toIsoDate(rental.startDate), end: toIsoDate(rental.endDate) };
  const needsReview =
    showReviewPrompt && rental.status === "COMPLETED" && rental.reviews.length === 0;

  return (
    <li className="border-rule flex flex-wrap items-center gap-5 border-b py-5">
      <Link
        href={`/item/${rental.listing.item.slug}`}
        aria-label={rental.listing.item.title}
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
          <Link href={`/item/${rental.listing.item.slug}`} className="link-underline">
            {rental.listing.item.title}
          </Link>
        </h3>
        <p className="meta text-ink-3 mt-1">
          {formatDateRange(range)} · {rental.listing.owner.name} ·{" "}
          <span className="numeric">{rental.rental.reference}</span>
        </p>
      </div>

      {needsReview ? (
        <Link
          href={`/account/rentals/${rental.id}/review`}
          className="link-underline text-small text-ink"
        >
          Leave a review
        </Link>
      ) : null}

      <Chip tone={statusTone(rental.status)}>{describeStatus(rental.status)}</Chip>
    </li>
  );
}
