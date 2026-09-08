import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { formatDateRange, toIsoDate } from "@/domain/dates";
import { ReviewForm } from "@/components/account/review-form";
import { Eyebrow } from "@/components/ui/primitives";
import { mediaUrl } from "@/lib/media";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Leave a review", robots: { index: false } };

type Params = Promise<{ bookingId: string }>;

/**
 * Leaving a review.
 *
 * Which review you are writing depends on which side of the rental you were on,
 * and that is decided here from the booking rather than from anything in the
 * URL. A renter rates the garment and its owner; an owner rates the renter.
 */
export default async function ReviewPage({ params }: { params: Params }) {
  const { bookingId } = await params;
  const user = await requireUser("/account/rentals");
  const db = await getDb();

  const booking = await db.rentalItem.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      ownerId: true,
      rental: { select: { renterId: true, renter: { select: { name: true } } } },
      owner: { select: { name: true } },
      reviews: { select: { direction: true } },
      listing: {
        select: {
          item: {
            select: {
              title: true,
              brand: { select: { name: true } },
              images: {
                orderBy: { position: "asc" },
                take: 1,
                select: { storageKey: true, alt: true, blurDataUrl: true },
              },
            },
          },
        },
      },
    },
  });

  if (!booking) notFound();

  const isRenter = booking.rental.renterId === user.id;
  const isOwner = booking.ownerId === user.id;
  if (!isRenter && !isOwner) notFound();

  const direction = isRenter ? "RENTER_ON_ITEM" : "OWNER_ON_RENTER";
  const alreadyReviewed = booking.reviews.some((review) => review.direction === direction);

  const image = booking.listing.item.images[0];
  const range = { start: toIsoDate(booking.startDate), end: toIsoDate(booking.endDate) };

  if (booking.status !== "COMPLETED") {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="display-3">Not quite yet.</h1>
        <p className="body-lg mt-4">
          You can leave a review once the rental has finished and the piece is back with its owner.
        </p>
      </div>
    );
  }

  if (alreadyReviewed) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="display-3">Already done.</h1>
        <p className="body-lg mt-4">
          You have reviewed this rental. Thank you — it is the thing that makes the next person
          confident enough to book.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <Eyebrow className="mb-4">How did it go?</Eyebrow>

      <div className="mb-8 flex items-center gap-4">
        <span className="bg-paper-3 relative aspect-[4/5] w-16 shrink-0 overflow-hidden">
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
        </span>
        <div>
          <h1 className="title-1">{booking.listing.item.title}</h1>
          <p className="meta text-ink-3 mt-1">
            {formatDateRange(range)} ·{" "}
            {isRenter ? `from ${booking.owner.name}` : `rented by ${booking.rental.renter.name}`}
          </p>
        </div>
      </div>

      <ReviewForm
        bookingId={booking.id}
        perspective={isRenter ? "RENTER" : "OWNER"}
        counterpartName={isRenter ? booking.owner.name : booking.rental.renter.name}
      />
    </div>
  );
}
