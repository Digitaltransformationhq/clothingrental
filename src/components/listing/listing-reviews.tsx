import { formatDateLong, toIsoDate } from "@/domain/dates";
import { cn } from "@/lib/cn";
import type { ListingReviewResult } from "@/server/services/reviews";

/**
 * Reviews for a listing.
 *
 * Leads with the sub-scores that actually decide a rental — fit, condition,
 * accuracy — because "4.9 stars" tells a renter nothing about whether the dress
 * will fit them. Each review states how long the rental was, which is context a
 * three-day review and a two-week review do not share.
 */
export function ListingReviews({
  reviews: result,
  ratingAvgBps,
  ratingCount,
  className,
}: {
  reviews: ListingReviewResult;
  ratingAvgBps: number;
  ratingCount: number;
  className?: string;
}) {
  const { reviews, total, averages } = result;

  if (ratingCount === 0 || reviews.length === 0) {
    return (
      <section
        className={cn("border-rule border-t pt-8", className)}
        aria-labelledby="reviews-heading"
      >
        <h2 id="reviews-heading" className="label text-ink-3 mb-4">
          Reviews
        </h2>
        <p className="body-lg">
          Nobody has rented this piece yet. You would be the first — and the owner will be paying
          close attention.
        </p>
      </section>
    );
  }

  const subScores = [
    { label: "Fit", value: averages.fit },
    { label: "Condition", value: averages.condition },
    { label: "As described", value: averages.accuracy },
  ].filter((entry): entry is { label: string; value: number } => typeof entry.value === "number");

  return (
    <section
      className={cn("border-rule border-t pt-8", className)}
      aria-labelledby="reviews-heading"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="reviews-heading" className="title-1">
          <span className="numeric">{(ratingAvgBps / 10_000).toFixed(1)}</span>
          <span className="text-claret"> ★</span>
          <span className="text-ink-2 ml-3 text-[0.9375rem] font-normal">
            {total} {total === 1 ? "review" : "reviews"}
          </span>
        </h2>
      </div>

      {subScores.length > 0 ? (
        <dl className="mt-6 grid gap-x-10 gap-y-3 sm:grid-cols-3">
          {subScores.map((score) => (
            <div key={score.label} className="flex items-center gap-3">
              <dt className="text-small text-ink-2">{score.label}</dt>
              <dd className="flex flex-1 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="bg-rule h-px flex-1"
                  style={{
                    background: `linear-gradient(to right, var(--color-ink) ${(score.value / 5) * 100}%, var(--color-rule) ${(score.value / 5) * 100}%)`,
                  }}
                />
                <span className="numeric text-small text-ink">{score.value.toFixed(1)}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <ul className="mt-10 space-y-8">
        {reviews.map((review) => (
          <li key={review.id} className="border-rule border-t pt-6 first:border-t-0 first:pt-0">
            <p className="text-claret" aria-hidden="true">
              {"★".repeat(review.rating)}
              <span className="text-rule-strong">{"★".repeat(5 - review.rating)}</span>
            </p>
            <span className="sr-only">Rated {review.rating} out of 5</span>

            {review.body ? (
              <p className="text-body text-ink mt-3 leading-relaxed">{review.body}</p>
            ) : null}

            <p className="meta text-ink-3 mt-3">
              <span className="text-ink-2">{review.authorName}</span>
              {review.authorCity ? <span> · {review.authorCity}</span> : null}
              <span> · rented {review.days} days</span>
              <span> · {formatDateLong(toIsoDate(review.publishedAt))}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
