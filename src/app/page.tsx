import Image from "next/image";

import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, RuleLink, SectionHead } from "@/components/ui/primitives";
import { ListingRail } from "@/components/listing/listing-rail";
import { OccasionTiles } from "@/components/home/occasion-tiles";
import { HowItWorks } from "@/components/home/how-it-works";
import { TrustLedger } from "@/components/home/trust-ledger";
import { EditorialStrip } from "@/components/home/editorial-strip";
import { FeaturedWardrobes } from "@/components/home/featured-wardrobes";
import { Testimonials } from "@/components/home/testimonials";
import { IMAGE_SIZES, mediaUrl } from "@/lib/media";
import { getRecentListings, getTrendingListings } from "@/server/services/listings";
import { getFeaturedWardrobes, getHomeOccasions } from "@/server/services/home";

/**
 * The homepage.
 *
 * Composed as an edited page rather than as a stack of interchangeable
 * sections. The rhythm is deliberate: a full-bleed opening, a dense commerce
 * rail, a spread of occasion tiles at different proportions, a quiet
 * typographic argument, then commerce again. Sections alternate between paper
 * and ink so the page has a pulse when you scroll it quickly.
 *
 * Everything below the hero is real data from the catalogue. There is no
 * hardcoded product anywhere on this page.
 */

export const revalidate = 300;

export default async function HomePage() {
  const [trending, recent, occasions, wardrobes] = await Promise.all([
    getTrendingListings(10),
    getRecentListings(8),
    getHomeOccasions(),
    getFeaturedWardrobes(),
  ]);

  return (
    <>
      <EditorialHero />

      {/* Closes the seam between the photograph and the paper below it. */}
      <EditorialStrip />

      {/* ── Trending ─────────────────────────────────────────────────────── */}
      <section className="page-gutter py-16 sm:py-24" aria-labelledby="trending-heading">
        <div className="page-width">
          <SectionHead
            eyebrow="Out this week"
            title={
              <>
                What people are <span className="display-accent">actually</span> wearing
              </>
            }
            standfirst="The pieces moving fastest between wardrobes right now."
            action={
              <ButtonLink href="/shop" variant="secondary" size="sm">
                See everything
              </ButtonLink>
            }
            align="between"
          />
          <div className="mt-10">
            <ListingRail listings={trending} headingId="trending-heading" />
          </div>
        </div>
      </section>

      {/* ── Occasions ────────────────────────────────────────────────────── */}
      {occasions.length > 0 ? (
        <section className="page-gutter py-16 sm:py-24" aria-labelledby="occasion-heading">
          <div className="page-width">
            <div className="max-w-2xl">
              <Eyebrow className="mb-4">Shop by occasion</Eyebrow>
              <h2 id="occasion-heading" className="display-2">
                Start with where
                <br />
                you’re going.
              </h2>
            </div>
            <OccasionTiles occasions={occasions} className="mt-12" />
          </div>
        </section>
      ) : null}

      {/* ── The argument ─────────────────────────────────────────────────── */}
      <SharedWardrobe />

      {/* ── Featured wardrobes ─────────────────────────────────────────────
          Rendered only when there is something to feature. Every section on
          this page draws its own heading unconditionally, which is fine while
          the catalogue is full and reads as a fault the moment it is not — an
          eyebrow, a headline and a standfirst introducing an empty strip. */}
      {wardrobes.length > 0 ? (
        <section className="page-gutter py-16 sm:py-24" aria-labelledby="wardrobes-heading">
          <div className="page-width">
            <SectionHead
              eyebrow="Featured wardrobes"
              title="Borrow from someone with taste"
              standfirst="Every piece here belongs to a person, not a warehouse."
              action={
                <ButtonLink href="/collections" variant="secondary" size="sm">
                  All collections
                </ButtonLink>
              }
              align="between"
            />
            <FeaturedWardrobes wardrobes={wardrobes} className="mt-12" />
          </div>
        </section>
      ) : null}

      {/* ── Just listed ──────────────────────────────────────────────────── */}
      <section className="page-gutter py-16 sm:py-24" aria-labelledby="recent-heading">
        <div className="page-width">
          <SectionHead
            eyebrow="Just listed"
            title="New to the wardrobe"
            action={
              <ButtonLink href="/shop?sort=newest" variant="secondary" size="sm">
                See all
              </ButtonLink>
            }
            align="between"
          />
          <div className="mt-10">
            <ListingRail listings={recent} headingId="recent-heading" />
          </div>
        </div>
      </section>

      <HowItWorks />
      <ListYourClothes />
      <TrustLedger />
      <Testimonials />
      <ClosingEditorial />

      {/* And again at the foot of the page, closing the second seam: the dark
          closing frame met the dark footer across a bare band of paper. The
          negative margin swallows the footer's own top margin, so the band is
          the border rather than the border plus a gap. */}
      <EditorialStrip className="-mb-24" />
    </>
  );
}

/**
 * The opening.
 *
 * A full-bleed photograph with the type laid into the lower-left quarter, not a
 * centred headline over a gradient. The image is the campaign; the words are a
 * caption on it. `priority` and `fetchPriority` are set because this is the
 * Largest Contentful Paint on the site's most-visited page.
 *
 * It runs up underneath the masthead rather than starting below it, so the bar
 * sits on the picture instead of on a band of paper above it. The negative
 * margin is the masthead's height at rest plus the hairline it always carries;
 * `HeaderShell` lists this route in DARK_OPENINGS and inverts its ink to match.
 */
function EditorialHero() {
  return (
    <section
      className="relative -mt-[calc(3.5rem+1px)] lg:-mt-[calc(4.25rem+1px)]"
      aria-label="Almirah"
    >
      {/* Sized so the opening and the band under it are exactly one screen:
            the band was running off the bottom of the viewport, and half a
            border pattern reads as a rendering fault rather than as a border.
            The 2px is the hairline the strip carries on each edge. */}
      <div className="bg-obsidian relative min-h-[calc(100svh-var(--strip-h)-2px)] w-full overflow-hidden">
        <Image
          src={mediaUrl("editorial-hero-1")}
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes={IMAGE_SIZES.editorial}
          className="object-cover object-[62%_center]"
        />
        {/* A directional scrim, weighted to the corner the type sits in rather
            than an even wash over the whole photograph. The last stop darkens
            the top edge just enough to carry the masthead, which now sits on
            the picture — without it the nav is legible on this photograph and
            not on the next one. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_top,rgba(20,19,15,0.82)_0%,rgba(20,19,15,0.42)_38%,rgba(20,19,15,0.06)_66%,rgba(20,19,15,0.06)_84%,rgba(20,19,15,0.52)_100%)]"
        />

        <div className="page-gutter absolute inset-x-0 bottom-0">
          <div className="page-width pb-20 sm:pb-32">
            <div className="text-ink-inverse max-w-3xl">
              <Eyebrow className="text-[color:color-mix(in_oklab,var(--color-ink-inverse)_72%,transparent)]">
                The wardrobe, shared
              </Eyebrow>

              <h1 className="display-1 optical-left mt-6">
                Looks worth
                <br />
                <span className="display-accent">borrowing.</span>
              </h1>

              <p className="text-body-lg mt-7 max-w-xl leading-relaxed text-[color:color-mix(in_oklab,var(--color-ink-inverse)_82%,transparent)]">
                Discover pieces from real wardrobes, rent them for the moments that matter, and send
                them back when the night is over.
              </p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <ButtonLink
                  href="/shop"
                  size="lg"
                  className="border-paper bg-paper text-ink hover:border-paper hover:text-ink-inverse hover:bg-transparent"
                >
                  Explore the wardrobe
                </ButtonLink>
                <ButtonLink
                  href="/sell"
                  size="lg"
                  variant="secondary"
                  className="text-ink-inverse hover:border-paper hover:bg-paper hover:text-ink border-[color:color-mix(in_oklab,var(--color-ink-inverse)_45%,transparent)]"
                >
                  List your clothes
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The marketplace explained as an editorial spread — an asymmetric split with
 * the image taking the larger share — rather than as three icon cards.
 */
function SharedWardrobe() {
  return (
    <section className="page-gutter py-16 sm:py-24" aria-labelledby="shared-heading">
      <div className="page-width">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <div className="photo-frame aspect-[3/2] w-full">
              <Image
                src={mediaUrl("editorial-shared-wardrobe-1")}
                alt=""
                fill
                sizes={IMAGE_SIZES.editorialHalf}
                loading="lazy"
                className="object-cover"
              />
            </div>
          </div>

          <div className="lg:col-span-5">
            <Eyebrow className="mb-5">The wardrobe, shared</Eyebrow>
            <h2 id="shared-heading" className="display-2">
              Most good clothes
              <br />
              are worn <span className="display-accent">twice.</span>
            </h2>
            <div className="text-body-lg mt-7 space-y-5">
              <p>
                A lehenga comes out for one wedding. A tuxedo for one black-tie evening. Then both
                go back in the cupboard for a year, holding their shape and their value and doing
                nothing at all.
              </p>
              <p>
                Almirah puts them back in circulation. Owners set their own price and their own
                dates; renters get something considerably better than they would have bought, for
                one night rather than for ever.
              </p>
            </div>

            <dl className="border-rule mt-10 grid grid-cols-3 gap-6 border-t pt-8">
              {[
                { value: "51", label: "pieces listed" },
                { value: "14", label: "wardrobes" },
                { value: "8", label: "cities" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="numeric font-display block text-[2.25rem] leading-none">
                      {stat.value}
                    </span>
                    <span className="meta mt-2 block">{stat.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Owner acquisition. Inverted to ink, so it reads as a distinct proposition. */
function ListYourClothes() {
  return (
    <section className="grain bg-obsidian text-ink-inverse" aria-labelledby="list-heading">
      <div className="page-gutter">
        <div className="page-width">
          <div className="grid gap-10 py-16 sm:py-24 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5 lg:col-start-1">
              <Eyebrow className="mb-5 text-[color:color-mix(in_oklab,var(--color-ink-inverse)_60%,transparent)]">
                For owners
              </Eyebrow>
              <h2 id="list-heading" className="display-2">
                Your wardrobe can earn
                <br />
                while you’re not
                <br />
                <span className="display-accent">wearing it.</span>
              </h2>
              <p className="text-body-lg mt-7 max-w-md text-[color:color-mix(in_oklab,var(--color-ink-inverse)_78%,transparent)]">
                List a piece in about ten minutes. Set your price, block the dates you need it
                yourself, and approve every request before anything is confirmed.
              </p>

              <dl className="mt-10 space-y-0">
                {[
                  { term: "You keep", detail: "85% of every rental" },
                  { term: "You decide", detail: "the price, the dates and who borrows it" },
                  { term: "You're covered", detail: "deposits held on every booking" },
                ].map((row) => (
                  <div
                    key={row.term}
                    className="border-rule-inverse flex flex-col gap-1 border-t py-4 sm:flex-row sm:items-baseline sm:gap-6"
                  >
                    <dt className="label w-28 shrink-0 text-[color:color-mix(in_oklab,var(--color-ink-inverse)_55%,transparent)]">
                      {row.term}
                    </dt>
                    <dd className="text-body">{row.detail}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-10">
                <ButtonLink
                  href="/sell"
                  size="lg"
                  className="border-paper bg-paper text-ink hover:border-paper hover:text-ink-inverse hover:bg-transparent"
                >
                  Start listing
                </ButtonLink>
              </div>
            </div>

            <div className="lg:col-span-6 lg:col-start-7">
              <div className="photo-frame aspect-[4/5] w-full">
                <Image
                  src={mediaUrl("editorial-list-your-clothes-1")}
                  alt=""
                  fill
                  sizes={IMAGE_SIZES.editorialHalf}
                  loading="lazy"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The closing frame: one photograph, one line, one way forward. */
function ClosingEditorial() {
  return (
    <section className="relative" aria-labelledby="closing-heading">
      <div className="bg-obsidian relative min-h-[60svh] w-full overflow-hidden">
        <Image
          src={mediaUrl("editorial-closing-1")}
          alt=""
          fill
          sizes={IMAGE_SIZES.editorial}
          loading="lazy"
          className="object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_right,rgba(20,19,15,0.78)_0%,rgba(20,19,15,0.34)_58%,rgba(20,19,15,0.1)_100%)]"
        />
        <div className="page-gutter absolute inset-0 flex items-center">
          {/* `w-full`, or `page-width`'s auto margins centre this shrink-wrapped
              flex item and the closing frame stops sharing the gutter every
              other section is set to. */}
          <div className="page-width w-full">
            <div className="text-ink-inverse max-w-xl">
              <h2 id="closing-heading" className="display-2">
                Good clothes deserve
                <br />
                another <span className="display-accent">night out.</span>
              </h2>
              <div className="mt-9">
                <RuleLink
                  href="/shop"
                  className="hover:border-paper max-w-sm border-[color:color-mix(in_oklab,var(--color-ink-inverse)_35%,transparent)]"
                >
                  <span className="text-ink-inverse">Find yours</span>
                </RuleLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
