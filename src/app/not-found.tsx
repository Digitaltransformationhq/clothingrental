import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/primitives";

/**
 * Not found.
 *
 * A wrong address is usually a piece that has been rented out and withdrawn, or
 * a link that has aged. So the page says that, and offers the two things that
 * actually help: search, and the shop.
 */
export default function NotFound() {
  return (
    <div className="page-gutter py-28 sm:py-40">
      <div className="page-width max-w-xl">
        <Eyebrow className="mb-4">Nothing here</Eyebrow>
        <h1 className="display-2">
          This page has
          <br />
          left the wardrobe.
        </h1>
        <p className="body-lg mt-5">
          It may have been a piece that is no longer listed, or a link that has aged. Neither is
          your fault.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/shop">Browse the wardrobe</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Back to the beginning
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
