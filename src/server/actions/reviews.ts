"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUserOrThrow } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { type ActionResult, errors, guard } from "@/server/errors";
import { checkRateLimit } from "@/server/rate-limit";

/**
 * Reviews.
 *
 * The rule that makes ratings mean anything: a review can only be written by
 * somebody who completed the rental it is about. There is no code path that
 * creates a review without a `RentalItem` in COMPLETED, and the database's
 * unique constraint on (rentalItemId, direction) allows exactly one from each
 * side.
 *
 * Reputation aggregates are recomputed inside the same transaction as the
 * review, so a listing's rating and its reviews can never disagree.
 */

const reviewSchema = z.object({
  bookingId: z.string().min(1).max(64),
  rating: z.number().int().min(1, "Choose a rating").max(5),
  fitRating: z.number().int().min(1).max(5).optional(),
  conditionRating: z.number().int().min(1).max(5).optional(),
  accuracyRating: z.number().int().min(1).max(5).optional(),
  body: z.string().trim().max(2000).optional(),
});

export async function leaveReview(
  input: z.input<typeof reviewSchema>,
): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const user = await requireUserOrThrow();
    const parsed = reviewSchema.parse(input);
    await checkRateLimit({ key: `review:${user.id}`, limit: 20, windowSeconds: 3600 });

    const db = await getDb();

    const booking = await db.rentalItem.findUnique({
      where: { id: parsed.bookingId },
      select: {
        id: true,
        status: true,
        listingId: true,
        ownerId: true,
        rental: { select: { renterId: true } },
      },
    });

    if (!booking) throw errors.notFound("rental");

    // Which side of the rental is writing decides what the review is about.
    const isRenter = booking.rental.renterId === user.id;
    const isOwner = booking.ownerId === user.id;
    if (!isRenter && !isOwner) throw errors.forbidden("That rental isn't yours to review.");

    if (booking.status !== "COMPLETED") {
      throw errors.conflict(
        "You can leave a review once the rental has finished and the piece is back with its owner.",
      );
    }

    const direction = isRenter ? "RENTER_ON_ITEM" : "OWNER_ON_RENTER";
    const subjectId = isRenter ? booking.ownerId : booking.rental.renterId;

    const existing = await db.review.findUnique({
      where: { rentalItemId_direction: { rentalItemId: booking.id, direction } },
      select: { id: true },
    });
    if (existing) throw errors.conflict("You have already reviewed this rental.");

    return db.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          rentalItemId: booking.id,
          // Only a renter's review is about the garment; an owner's is about
          // the person, and attaching it to the listing would distort its
          // rating with feedback that has nothing to do with the clothes.
          listingId: isRenter ? booking.listingId : null,
          authorId: user.id,
          subjectId,
          direction,
          rating: parsed.rating,
          fitRating: isRenter ? parsed.fitRating : null,
          conditionRating: isRenter ? parsed.conditionRating : null,
          accuracyRating: isRenter ? parsed.accuracyRating : null,
          body: parsed.body || null,
        },
        select: { id: true },
      });

      // Recomputed from the reviews themselves rather than incremented, so a
      // moderated or deleted review cannot leave the average permanently wrong.
      if (isRenter) {
        const listingStats = await tx.review.aggregate({
          where: { listingId: booking.listingId, moderation: "APPROVED" },
          _avg: { rating: true },
          _count: true,
        });

        await tx.listing.update({
          where: { id: booking.listingId },
          data: {
            ratingAvgBps: Math.round((listingStats._avg.rating ?? 0) * 10_000),
            ratingCount: listingStats._count,
          },
        });
      }

      const profileStats = await tx.review.aggregate({
        where: { subjectId, moderation: "APPROVED" },
        _avg: { rating: true },
        _count: true,
      });

      await tx.profile.updateMany({
        where: { userId: subjectId },
        data: {
          ratingAvgBps: Math.round((profileStats._avg.rating ?? 0) * 10_000),
          ratingCount: profileStats._count,
        },
      });

      await tx.notification.create({
        data: {
          userId: subjectId,
          kind: "REVIEW_RECEIVED",
          title: "You have a new review",
          body: parsed.body?.slice(0, 140) ?? `Rated ${parsed.rating} out of 5.`,
          href: isRenter ? "/account/listings" : "/account/rentals",
        },
      });

      revalidatePath("/account/rentals");
      revalidatePath("/account/listings");

      return review;
    });
  });
}
