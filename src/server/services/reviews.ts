import "server-only";

import { getDb } from "@/server/db/client";

/**
 * Reviews.
 *
 * Only reviews attached to a completed booking are ever written, and only
 * approved ones are ever read — which together are what stop the review list
 * being something anybody can post into.
 */

export interface ListingReview {
  readonly id: string;
  readonly rating: number;
  readonly fitRating: number | null;
  readonly conditionRating: number | null;
  readonly accuracyRating: number | null;
  readonly body: string | null;
  readonly authorName: string;
  readonly authorCity: string | null;
  readonly publishedAt: Date;
  readonly days: number;
}

export async function getListingReviews(
  listingId: string,
  limit = 6,
): Promise<{ reviews: ListingReview[]; total: number; averages: ReviewAverages }> {
  const db = await getDb();

  const [rows, total, aggregate] = await Promise.all([
    db.review.findMany({
      where: { listingId, direction: "RENTER_ON_ITEM", moderation: "APPROVED" },
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: {
        id: true,
        rating: true,
        fitRating: true,
        conditionRating: true,
        accuracyRating: true,
        body: true,
        publishedAt: true,
        author: { select: { name: true, profile: { select: { city: true } } } },
        rentalItem: { select: { days: true } },
      },
    }),
    db.review.count({
      where: { listingId, direction: "RENTER_ON_ITEM", moderation: "APPROVED" },
    }),
    db.review.aggregate({
      where: { listingId, direction: "RENTER_ON_ITEM", moderation: "APPROVED" },
      _avg: { fitRating: true, conditionRating: true, accuracyRating: true },
    }),
  ]);

  return {
    total,
    averages: {
      fit: aggregate._avg.fitRating,
      condition: aggregate._avg.conditionRating,
      accuracy: aggregate._avg.accuracyRating,
    },
    reviews: rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      fitRating: row.fitRating,
      conditionRating: row.conditionRating,
      accuracyRating: row.accuracyRating,
      body: row.body,
      authorName: row.author.name,
      authorCity: row.author.profile?.city ?? null,
      publishedAt: row.publishedAt,
      days: row.rentalItem.days,
    })),
  };
}

export interface ReviewAverages {
  fit: number | null;
  condition: number | null;
  accuracy: number | null;
}

export type ListingReviewResult = Awaited<ReturnType<typeof getListingReviews>>;
