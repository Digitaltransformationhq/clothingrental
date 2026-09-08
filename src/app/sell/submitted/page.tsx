import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Listing submitted",
  robots: { index: false, follow: false },
};

/**
 * After submitting a listing.
 *
 * Says what happens next and roughly when. A member who has just spent ten
 * minutes on a listing and is told only "Success!" has no idea whether they are
 * finished.
 */
export default function ListingSubmittedPage() {
  return (
    <div className="page-gutter py-24 sm:py-32">
      <div className="page-width max-w-xl">
        <Eyebrow className="mb-4">Submitted</Eyebrow>
        <h1 className="display-2">
          That’s with us
          <br />
          for a look.
        </h1>
        <p className="body-lg mt-6">
          Every listing is checked before it appears — photographs, description and price. It
          usually takes a few hours, and we will email you either way.
        </p>

        <ol className="border-rule mt-12 space-y-4 border-t pt-8">
          {[
            "We check the listing reads clearly and the photographs show the piece.",
            "It goes live and starts appearing in searches and collections.",
            "Requests arrive in your wardrobe, and you decide on each one.",
          ].map((step, index) => (
            <li key={step} className="text-small text-ink-2 flex gap-4">
              <span className="numeric text-ink-3 shrink-0">0{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>

        <div className="mt-12 flex flex-wrap gap-3">
          <ButtonLink href="/account/listings">Go to my wardrobe</ButtonLink>
          <ButtonLink href="/sell/new" variant="secondary">
            List another piece
          </ButtonLink>
        </div>

        <p className="meta border-rule text-ink-3 mt-10 border-t pt-6">
          Changed your mind about something?{" "}
          <Link href="/account/listings" className="link-underline text-ink-2">
            Edit the listing
          </Link>{" "}
          while it is still in review.
        </p>
      </div>
    </div>
  );
}
