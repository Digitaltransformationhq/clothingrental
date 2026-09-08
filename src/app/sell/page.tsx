import type { Metadata } from "next";
import Image from "next/image";

import { ButtonLink } from "@/components/ui/button";
import { ORNAMENTS, Ornament } from "@/components/ui/ornament";
import { Eyebrow, SectionHead } from "@/components/ui/primitives";
import { formatMoney } from "@/domain/money";
import { DEFAULT_FEE_SCHEDULE, quoteRental } from "@/domain/rental/pricing";
import { IMAGE_SIZES, mediaUrl } from "@/lib/media";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = {
  title: "List your clothes",
  description:
    "Your wardrobe can earn while you are not wearing it. Set your own price and dates, approve every request, and keep 85% of each rental.",
  alternates: { canonical: "/sell" },
};

export const revalidate = 3600;

/**
 * Owner acquisition.
 *
 * The audience here is a person who owns something expensive and is nervous
 * about lending it. So the page leads with the money, states the commission
 * plainly rather than burying it, and spends most of its length on what happens
 * if something goes wrong — which is the actual objection.
 */
export default async function SellPage() {
  const db = await getDb();

  // Worked from real listings rather than invented, so the figures on this page
  // are the ones the marketplace actually produces.
  const [averages, ownerCount] = await Promise.all([
    db.listing.aggregate({
      where: { status: "PUBLISHED" },
      _avg: { baseRateMinor: true, rentalCount: true },
    }),
    db.listing.groupBy({ by: ["ownerId"], where: { status: "PUBLISHED" } }),
  ]);

  const averageRate = Math.round(averages._avg.baseRateMinor ?? 120_000);
  const example = quoteRental({
    pricing: {
      currency: "INR",
      baseRateMinor: averageRate,
      baseDurationDays: 3,
      extraDayRateMinor: Math.round(averageRate / 4),
      depositMinor: 0,
      cleaningFeeMinor: 0,
      deliveryFeeMinor: 0,
    },
    days: 3,
  });

  return (
    <div>
      {/* ── Opening ──────────────────────────────────────────────────────── */}
      <section className="relative -mt-[calc(3.5rem+1px)] lg:-mt-[calc(4.25rem+1px)]">
        <div className="bg-obsidian relative flex min-h-svh w-full items-center overflow-hidden">
          <Image
            src={mediaUrl("editorial-list-your-clothes-1")}
            alt=""
            fill
            priority
            sizes={IMAGE_SIZES.editorial}
            className="object-cover object-[68%_center]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(to_right,rgba(20,19,15,0.86)_0%,rgba(20,19,15,0.5)_48%,rgba(20,19,15,0.1)_100%)]"
          />
          {/* The scrim above runs left-to-right and leaves the top-right corner
              almost clear — which is exactly where the masthead's controls sit.
              This carries them. */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-44 bg-[linear-gradient(to_bottom,rgba(20,19,15,0.5)_0%,rgba(20,19,15,0)_100%)]"
          />
          {/* In flow, not `absolute inset-0`. Absolutely positioned content
              cannot grow its box, so on a short viewport the block overflowed
              and centring drove the eyebrow up under the masthead. In flow the
              section grows instead, and the opening can never collide with the
              navigation.

              `relative` so it paints above the two scrims, which are positioned
              and would otherwise cover it. The top padding is the masthead's
              own height — the picture runs under the bar, but the words must
              not. And `page-width` needs `w-full`: it carries
              `margin-inline: auto`, so as a shrink-wrapped flex item those auto
              margins centre it, which pulled the whole opening 400px off the
              gutter every other section aligns to. */}
          <div className="page-gutter relative w-full pt-[calc(3.5rem+1px)] pb-16 lg:pt-[calc(4.25rem+1px)]">
            <div className="page-width w-full">
              <div className="text-ink-inverse max-w-4xl">
                <Eyebrow className="text-[color:color-mix(in_oklab,var(--color-ink-inverse)_70%,transparent)]">
                  For owners
                </Eyebrow>
                <h1 className="display-1 mt-6">
                  Your wardrobe can
                  <br />
                  earn while you’re
                  <br />
                  not <span className="display-accent">wearing it.</span>
                </h1>
                <p className="text-body-lg mt-7 max-w-lg text-[color:color-mix(in_oklab,var(--color-ink-inverse)_84%,transparent)]">
                  The lehenga you wore once. The suit from an interview four years ago. Somebody
                  near you needs it for Saturday.
                </p>
                <div className="mt-10">
                  <ButtonLink
                    href="/sell/new"
                    size="lg"
                    className="border-paper bg-paper text-ink hover:border-paper hover:text-ink-inverse hover:bg-transparent"
                  >
                    Start listing
                  </ButtonLink>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── The money ────────────────────────────────────────────────────── */}
      <section className="page-gutter py-16 sm:py-24" id="pricing" aria-labelledby="money-heading">
        <div className="page-width">
          <SectionHead
            eyebrow="What you'll earn"
            title="You keep 85%. Here is the other 15%."
            standfirst="Most marketplaces make you find this out after your first rental. The commission covers payment processing, identity checks, support and damage cover."
          />

          <div className="mt-12 grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-7">
              <div className="border-rule bg-surface border p-7">
                <p className="label text-ink-3 mb-5">A typical three-day rental on Almirah</p>
                <dl className="space-y-3">
                  <div className="flex justify-between gap-4">
                    <dt className="text-small text-ink-2">The renter pays</dt>
                    <dd className="numeric text-small text-ink">
                      {formatMoney(example.costToRenter)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-small text-ink-2">
                      Of which our commission
                      <span className="meta text-ink-3 mt-0.5 block">
                        {(DEFAULT_FEE_SCHEDULE.commissionBps / 100).toFixed(0)}% of the rental
                      </span>
                    </dt>
                    <dd className="numeric text-small text-ink-2">
                      −{formatMoney(example.commission)}
                    </dd>
                  </div>
                  <div className="border-ink flex justify-between gap-4 border-t pt-4">
                    <dt className="text-body text-ink font-medium">You receive</dt>
                    <dd className="numeric font-display text-ink text-[1.75rem] leading-none">
                      {formatMoney(example.ownerEarnings)}
                    </dd>
                  </div>
                </dl>
                <p className="meta text-ink-3 mt-5">
                  Based on the average rate across {ownerCount.length} wardrobes currently listed.
                  Listing is free; you are charged nothing until a piece actually goes out.
                </p>
              </div>
            </div>

            <div className="lg:col-span-5">
              <dl className="border-rule border-t">
                {[
                  ["Listing", "Free, always"],
                  ["Commission", "15% of each completed rental"],
                  ["Payouts", "Two working days after a piece comes home"],
                  ["Cancellation by you", "Free, but it affects your standing"],
                ].map(([term, detail]) => (
                  <div
                    key={term}
                    className="border-rule flex flex-wrap items-baseline justify-between gap-4 border-b py-3.5"
                  >
                    <dt className="text-small text-ink-2">{term}</dt>
                    <dd className="text-small text-ink">{detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ── The objection ────────────────────────────────────────────────── */}
      <section
        className="grain bg-obsidian text-ink-inverse"
        id="protection"
        aria-labelledby="protection-heading"
      >
        <div className="page-gutter">
          <div className="page-width py-16 sm:py-24">
            <div className="max-w-2xl">
              <Eyebrow className="mb-5 text-[color:color-mix(in_oklab,var(--color-ink-inverse)_60%,transparent)]">
                What if something happens to it
              </Eyebrow>
              <h2 id="protection-heading" className="display-2">
                The honest answer.
              </h2>
              <p className="text-body-lg mt-6 max-w-xl text-[color:color-mix(in_oklab,var(--color-ink-inverse)_80%,transparent)]">
                Most pieces come back exactly as they left. Occasionally one does not. Here is
                precisely what happens then — written down before you need it, rather than
                discovered afterwards.
              </p>
            </div>

            <dl className="mt-14 grid gap-x-14 gap-y-8 lg:grid-cols-2">
              {[
                [
                  "Every renter is identified",
                  "Government ID is verified before anyone can book. You see their rating, their history and whether they are verified before you accept.",
                ],
                [
                  "A deposit is held on every rental",
                  "You set the amount. It is taken from the renter at checkout and held by us — not passed to you, and not released to them until you have the piece back.",
                ],
                [
                  "You decide who borrows it",
                  "Unless you turn on instant booking, every request comes to you first. You can decline without giving a reason.",
                ],
                [
                  "Ordinary wear is never charged for",
                  "A rental is not a sale. Loose thread, a faint mark that cleans out, a stretched hook — these are the cost of a garment being worn, and we will not take a renter's deposit for them.",
                ],
                [
                  "Real damage is assessed on evidence",
                  "You report it with photographs within 48 hours of return. The renter responds. We decide, and we tell you both why.",
                ],
                [
                  "If a piece is not returned",
                  "The deposit is released to you in full and we pursue the renter directly. Their account is suspended pending resolution.",
                ],
              ].map(([term, detail]) => (
                <div key={term} className="border-rule-inverse border-t pt-5">
                  <dt className="text-body font-medium">{term}</dt>
                  <dd className="text-small mt-2 leading-relaxed text-[color:color-mix(in_oklab,var(--color-ink-inverse)_72%,transparent)]">
                    {detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ── The steps ────────────────────────────────────────────────────── */}
      <section className="page-gutter py-16 sm:py-24" aria-labelledby="steps-heading">
        <div className="page-width">
          <SectionHead
            eyebrow="Listing a piece"
            title="Ten minutes, once."
            standfirst="Photographs are the part that matters. Everything else takes two minutes."
          />

          {/* An index, not a table.
              It was three columns — numeral, title, copy — spread across
              twelve, which left two wide bands of nothing in the middle of
              every row and made four steps read as a spreadsheet. A narrow
              marked rail and one reading column give the eye a single axis to
              come down, and the copy a measure it can actually be read at.

              The marks and the ghosted numerals are the same ones the homepage
              numbers its steps with, so the two sequences on this site are
              plainly the same device. */}
          <ol className="border-rule mt-14 border-t">
            {[
              {
                title: "Photograph it",
                body: "Natural light, a plain wall, three or four angles. A phone is fine — the best listings on Almirah were all shot on one.",
              },
              {
                title: "Describe it",
                body: "Fabric, fit, and any flaw. Honesty here prevents every dispute later, and a surprise on arrival is what turns a rental into an argument.",
              },
              {
                title: "Price it",
                body: "We suggest a rate from what the piece retailed at, and you decide. Change it whenever you like.",
              },
              {
                title: "Set your dates",
                body: "Block the weekends you need it yourself. Nothing can be booked over a date you have kept back.",
              },
            ].map((step, index) => (
              <li key={step.title} className="group border-rule relative overflow-hidden border-b">
                {/* The numeral is printed under the row and runs off its top
                    edge. At this weight it is texture; the small one on the
                    rail does the counting. */}
                <span
                  aria-hidden="true"
                  className="numeric font-display pointer-events-none absolute -top-8 right-0 hidden text-[9rem] leading-none tracking-[-0.05em] text-[color:color-mix(in_oklab,var(--color-ink)_7%,transparent)] select-none lg:block"
                >
                  0{index + 1}
                </span>

                <div className="relative grid gap-x-10 gap-y-4 py-10 lg:grid-cols-12">
                  <div className="flex items-center gap-3 lg:col-span-2">
                    <Ornament
                      name={ORNAMENTS[index % ORNAMENTS.length]}
                      className="text-ink-3 h-[1.05rem] w-[1.05rem]"
                    />
                    <span className="numeric meta text-ink-3 tracking-[0.18em]">0{index + 1}</span>
                  </div>

                  <div className="lg:col-span-9">
                    <h3 className="title-1">{step.title}</h3>
                    <p className="text-body text-ink-2 mt-3 max-w-[54ch] leading-relaxed">
                      {step.body}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-14">
            <ButtonLink href="/sell/new" size="lg">
              Start listing
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
