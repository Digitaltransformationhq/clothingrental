import type { Metadata } from "next";
import Image from "next/image";

import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/primitives";
import { IMAGE_SIZES, mediaUrl } from "@/lib/media";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = {
  title: "About",
  description:
    "Almirah is a marketplace for the clothes that spend most of the year in the dark. Own less, wear more.",
  alternates: { canonical: "/about" },
};

export const revalidate = 3600;

/**
 * About.
 *
 * An argument rather than a company history. The sustainability point is made
 * once, in numbers, and then dropped — a rental marketplace that lectures its
 * members about consumption while taking a commission on consumption is not a
 * position worth holding for four paragraphs.
 */
export default async function AboutPage() {
  const db = await getDb();
  const [listings, members, cities] = await Promise.all([
    db.listing.count({ where: { status: "PUBLISHED" } }),
    db.user.count(),
    db.listing.groupBy({ by: ["city"], where: { status: "PUBLISHED" } }),
  ]);

  return (
    <div className="pb-24">
      <header className="page-gutter pt-14 sm:pt-20">
        <div className="page-width max-w-3xl">
          <Eyebrow className="mb-4">About</Eyebrow>
          <h1 className="display-1">
            Own less.
            <br />
            <span className="display-accent">Wear more.</span>
          </h1>
        </div>
      </header>

      <section className="page-gutter py-14">
        <div className="page-width">
          <div className="text-body-lg max-w-[62ch] space-y-6">
            <p className="text-ink">
              There is a lehenga in a cupboard in Hyderabad that has been worn once. A tuxedo in
              Delhi that was bought for an evening that got cancelled. A saree in Vadodara that has
              been to more weddings than the person who owns it.
            </p>
            <p>
              Between them, those three garments are worth more than most people spend on clothes in
              a year, and for the overwhelming majority of that year they do nothing at all. That is
              the entire idea behind Almirah: not that people should own less in some abstract
              sense, but that the good things already in circulation should circulate.
            </p>
            <p>
              An almirah is the cupboard where a household keeps what it does not wear every day.
              Every one of them is a small, closed, private archive. We are trying to open a few of
              them to each other.
            </p>
          </div>
        </div>
      </section>

      <section className="page-gutter">
        <div className="page-width">
          <div className="photo-frame aspect-[21/9] w-full">
            <Image
              src={mediaUrl("editorial-closing-1")}
              alt=""
              fill
              sizes={IMAGE_SIZES.editorial}
              loading="lazy"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="page-gutter py-16" aria-labelledby="numbers-heading">
        <div className="page-width">
          <h2 id="numbers-heading" className="sr-only">
            Almirah in numbers
          </h2>
          <dl className="border-rule grid gap-x-10 gap-y-8 border-t pt-10 sm:grid-cols-3">
            {[
              { value: String(listings), label: "pieces listed" },
              { value: String(members), label: "members" },
              { value: String(new Set(cities.map((c) => c.city)).size), label: "cities" },
            ].map((stat) => (
              <div key={stat.label}>
                <dd className="numeric font-display text-[clamp(2.5rem,5vw,3.5rem)] leading-none">
                  {stat.value}
                </dd>
                <dt className="meta mt-3">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="page-gutter py-6" aria-labelledby="belief-heading">
        <div className="page-width">
          <h2 id="belief-heading" className="label text-ink-3 mb-8">
            What we hold to
          </h2>
          <dl className="grid gap-x-14 gap-y-8 lg:grid-cols-2">
            {[
              [
                "Price is stated once",
                "Every fee, the tax and the deposit appear before checkout. There is nothing added at the last step, because a surprise at the payment screen is a decision made under pressure.",
              ],
              [
                "The deposit is not ours",
                "It is held, not earned, and it is returned in full on a clean return. We do not treat it as revenue and we do not report it as such.",
              ],
              [
                "Wear is not damage",
                "Clothes that go out get worn. An owner who wants their garment to come back untouched should not be lending it, and we will say so.",
              ],
              [
                "Both sides are people",
                "Renters rate owners and owners rate renters. Nobody here is a faceless counterparty, which is what makes the whole thing work.",
              ],
            ].map(([term, detail]) => (
              <div key={term} className="border-rule border-t pt-5">
                <dt className="text-body text-ink font-medium">{term}</dt>
                <dd className="text-small text-ink-2 mt-2 leading-relaxed">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="page-gutter pt-12">
        <div className="page-width">
          <div className="border-rule flex flex-wrap items-center gap-4 border-t pt-10">
            <ButtonLink href="/shop">Browse the wardrobe</ButtonLink>
            <ButtonLink href="/sell" variant="secondary">
              Open yours
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
