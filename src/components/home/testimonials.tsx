import Link from "next/link";

import { Eyebrow } from "@/components/ui/primitives";
import { getRecentReviews } from "@/server/services/home";

/**
 * Social proof.
 *
 * Real reviews, from the review table, written by the members who took those
 * rentals — not a carousel of invented quotes with stock headshots. Each one
 * names the piece it is about and links to it, which is both more honest and
 * more useful: a review that leads nowhere is decoration.
 *
 * Set as pull quotes on the paper with no cards and no avatars.
 */
export async function Testimonials() {
  const reviews = await getRecentReviews(3);
  if (reviews.length === 0) return null;

  return (
    <section className="page-gutter py-16 sm:py-24" aria-labelledby="reviews-heading">
      <div className="page-width">
        <Eyebrow className="mb-4">From recent rentals</Eyebrow>
        <h2 id="reviews-heading" className="display-3 max-w-xl">
          What people said when
          <br />
          they sent it back.
        </h2>

        <ul className="border-rule mt-14 grid gap-px border-t md:grid-cols-3">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="border-rule border-b py-8 md:border-r md:border-b-0 md:pr-8 md:last:border-r-0"
            >
              <p className="text-claret" aria-hidden="true">
                {"★".repeat(review.rating)}
                <span className="text-rule-strong">{"★".repeat(5 - review.rating)}</span>
              </p>
              <span className="sr-only">Rated {review.rating} out of 5</span>

              <blockquote className="mt-5">
                <p className="font-display text-ink text-[1.1875rem] leading-[1.45]">
                  “{review.body}”
                </p>
              </blockquote>

              <footer className="meta text-ink-3 mt-5">
                <span className="text-ink">{review.author}</span>
                {review.city ? <span> · {review.city}</span> : null}
                {review.itemSlug && review.itemTitle ? (
                  <>
                    <br />
                    <span>on </span>
                    <Link href={`/item/${review.itemSlug}`} className="link-underline text-ink-2">
                      {review.itemTitle}
                    </Link>
                  </>
                ) : null}
              </footer>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
