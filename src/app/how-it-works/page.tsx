import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { ORNAMENTS, Ornament } from "@/components/ui/ornament";
import { Eyebrow, SectionHead } from "@/components/ui/primitives";
import { DEFAULT_CANCELLATION_POLICY, DEFAULT_FEE_SCHEDULE } from "@/domain/rental/pricing";
import { IMAGE_SIZES, mediaUrl } from "@/lib/media";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "What happens when you rent, what happens when you lend, what a deposit covers, and what we do when something goes wrong.",
  alternates: { canonical: "/how-it-works" },
};

/**
 * How it works.
 *
 * Written to be read by somebody deciding whether to trust this, which means
 * the awkward parts — deposits, damage, cancellations, fees — get the most
 * space rather than the least. Every figure is pulled from the same constants
 * the pricing engine uses, so the page cannot quote a commission the system
 * does not charge.
 */
export default function HowItWorksPage() {
  const commission = (DEFAULT_FEE_SCHEDULE.commissionBps / 100).toFixed(0);
  const serviceFee = (DEFAULT_FEE_SCHEDULE.serviceFeeBps / 100).toFixed(0);
  const tax = (DEFAULT_FEE_SCHEDULE.taxBps / 100).toFixed(0);

  return (
    <div className="pb-24">
      <header className="page-gutter pt-14 sm:pt-20">
        <div className="page-width max-w-3xl">
          <Eyebrow className="mb-4">How it works</Eyebrow>
          <h1 className="display-1">
            Borrow the look.
            <br />
            <span className="display-accent">Return the closet.</span>
          </h1>
          <p className="body-lg mt-6 max-w-xl">
            Almirah is a marketplace, not a shop. Everything here belongs to somebody, and both
            sides of every rental are people. This is exactly how that works.
          </p>
        </div>
      </header>

      {/* ── Renting ──────────────────────────────────────────────────────── */}
      <section className="page-gutter py-16 sm:py-20" aria-labelledby="renting-heading">
        <div className="page-width">
          <SectionHead
            eyebrow="If you're renting"
            title="Four steps and a deposit"
            headingLevel="h2"
          />

          <ol className="border-rule mt-12 space-y-10 border-t pt-10">
            {[
              {
                title: "Find something and check the dates",
                body: "The calendar on every listing shows exactly what is free. Turnaround days after each rental are already blocked out, so what you can select is what you can actually have.",
              },
              {
                title: "Request, or book instantly",
                body: "Some owners approve each request themselves; others let you book straight away. The listing says which before you commit. Where an owner approves, they have 24 hours.",
              },
              {
                title: "Pay once, including a deposit",
                body: `The rental, a ${serviceFee}% service fee, ${tax}% GST and delivery are all shown before you pay. On top of that sits a refundable deposit, which is held — not paid to the owner.`,
              },
              {
                title: "Wear it, then send it back",
                body: `It arrives cleaned, a day or two before your dates. Return it in the same packaging on the return date. Your deposit comes back in full within three days of a clean return.`,
              },
            ].map((step, index) => (
              <li key={step.title} className="grid gap-4 sm:grid-cols-[4rem_1fr] sm:gap-8">
                {/* Marked the way every other numbered sequence on the site is,
                    so the four steps here and the four on the homepage read as
                    the same device rather than two that happen to be numbered. */}
                <span className="flex items-baseline gap-2 sm:block">
                  <Ornament
                    name={ORNAMENTS[index % ORNAMENTS.length]}
                    className="text-ink-3 mb-2 hidden h-[0.9rem] w-[0.9rem] sm:block"
                  />
                  <span className="numeric font-display text-ink-3 text-[2.25rem] leading-none">
                    0{index + 1}
                  </span>
                </span>
                <div>
                  <h3 className="title-2">{step.title}</h3>
                  <p className="body-lg mt-2 max-w-prose">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Lending ──────────────────────────────────────────────────────── */}
      <section className="grain bg-obsidian text-ink-inverse" aria-labelledby="lending-heading">
        <div className="page-gutter">
          <div className="page-width grid gap-10 py-16 sm:py-20 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <Eyebrow className="mb-4 text-[color:color-mix(in_oklab,var(--color-ink-inverse)_60%,transparent)]">
                If you’re lending
              </Eyebrow>
              <h2 id="lending-heading" className="display-3">
                You keep {100 - Number(commission)}% and you keep control.
              </h2>
              <p className="text-body-lg mt-6 max-w-md text-[color:color-mix(in_oklab,var(--color-ink-inverse)_80%,transparent)]">
                List free, set your own price and dates, and decline anything you would rather not
                lend. The {commission}% commission is taken only from completed rentals.
              </p>
              <div className="mt-8">
                <ButtonLink
                  href="/sell"
                  variant="secondary"
                  className="text-ink-inverse hover:border-paper hover:bg-paper hover:text-ink border-[color:color-mix(in_oklab,var(--color-ink-inverse)_45%,transparent)]"
                >
                  More for owners
                </ButtonLink>
              </div>
            </div>

            <div className="lg:col-span-6 lg:col-start-7">
              <div className="photo-frame aspect-[4/3] w-full">
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
          </div>
        </div>
      </section>

      {/* ── The awkward parts ────────────────────────────────────────────── */}
      <section className="page-gutter py-16 sm:py-20" aria-labelledby="detail-heading">
        <div className="page-width">
          <SectionHead
            eyebrow="The parts nobody reads until they need to"
            title="Deposits, damage and cancellations"
            standfirst="Written down in advance, because a policy you only discover when something has gone wrong is not a policy."
            headingLevel="h2"
          />

          <dl className="mt-12 grid gap-x-14 gap-y-8 lg:grid-cols-2">
            {[
              [
                "What a deposit covers",
                "Damage beyond ordinary wear, and non-return. Nothing else. It is held by us, not passed to the owner, and it is returned in full within three days of a clean return.",
              ],
              [
                "What counts as ordinary wear",
                "A loose thread, a faint mark that cleans out, a stretched hook, a scuffed sole. Clothes are worn; that is the point. None of this is ever charged for.",
              ],
              [
                "What counts as damage",
                "A tear, a permanent stain, a lost embellishment, alteration without permission. The owner reports it with photographs within 48 hours of return, you respond, and we decide.",
              ],
              [
                "If you cancel",
                `More than ${DEFAULT_CANCELLATION_POLICY.fullRefundDaysBefore} days before the start date, everything comes back. Inside that window, ${(DEFAULT_CANCELLATION_POLICY.partialRefundBps / 100).toFixed(0)}% of the rental is returned along with your full deposit — the service fee covers work already done.`,
              ],
              [
                "If the owner cancels",
                "Everything you paid is returned in full, immediately, whenever it happens. We will also help you find something else in time.",
              ],
              [
                "If it doesn't fit",
                "Tell the owner within 24 hours of it arriving. Measurements are on every listing precisely so this does not happen, but where a piece is genuinely not as described, the rental is refunded.",
              ],
            ].map(([term, detail], index) => (
              <div key={term} className="border-rule border-t pt-5">
                <Ornament
                  name={ORNAMENTS[index % ORNAMENTS.length]}
                  className="text-ink-3 mb-3 h-[0.85rem] w-[0.85rem]"
                />
                <dt className="text-body text-ink font-medium">{term}</dt>
                <dd className="text-small text-ink-2 mt-2 leading-relaxed">{detail}</dd>
              </div>
            ))}
          </dl>

          <p className="meta text-ink-3 mt-12 max-w-prose">
            The full terms are in the{" "}
            <Link href="/legal/rental-agreement" className="link-underline text-ink-2">
              rental agreement
            </Link>{" "}
            and the{" "}
            <Link href="/legal/cancellation" className="link-underline text-ink-2">
              cancellation policy
            </Link>
            . Both are written in the same plain language as this page.
          </p>
        </div>
      </section>

      <section className="page-gutter">
        <div className="page-width">
          <div className="border-rule flex flex-wrap items-center gap-4 border-t pt-10">
            <ButtonLink href="/shop">Browse the wardrobe</ButtonLink>
            <ButtonLink href="/sell" variant="secondary">
              List your clothes
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
