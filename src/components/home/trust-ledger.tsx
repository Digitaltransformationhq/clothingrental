import Link from "next/link";

import { Eyebrow } from "@/components/ui/primitives";

/**
 * Trust.
 *
 * Set as a ledger — a two-column list separated by hairlines — rather than as a
 * grid of shield icons. Peer-to-peer rental lives or dies on whether a member
 * believes their deposit is safe and their garment will come back, and that is
 * an argument made in specifics, not in badges.
 *
 * Each line is a commitment with a number or a mechanism in it. "Secure
 * payments" on its own is worth nothing.
 */

const COMMITMENTS = [
  {
    term: "Verified members",
    detail:
      "Government ID checked before anyone can list. Verified wardrobes carry a mark; unverified ones say so plainly.",
  },
  {
    term: "Money held, not sent",
    detail:
      "Payment is taken when a booking is confirmed and released to the owner after the piece comes home. Nothing moves in between.",
  },
  {
    term: "Deposits returned in three days",
    detail:
      "Held against damage, refunded in full on a clean return. Any deduction is itemised and can be disputed.",
  },
  {
    term: "Prices without surprises",
    detail:
      "Service fee, GST, delivery and deposit are all shown before you reach checkout. There is nothing added at the last step.",
  },
  {
    term: "Damage cover on every rental",
    detail:
      "Ordinary wear is expected and never charged for. Genuine damage is assessed against photographs from both sides.",
  },
  {
    term: "Someone answers",
    detail:
      "Support runs 9am to 9pm IST, every day. Disputes are read by a person, not closed by a rule.",
  },
] as const;

export function TrustLedger() {
  return (
    <section className="page-gutter py-16 sm:py-24" aria-labelledby="trust-heading">
      <div className="page-width">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <Eyebrow className="mb-4">Trust</Eyebrow>
            <h2 id="trust-heading" className="display-3">
              Lending a stranger
              <br />
              your best dress is
              <br />a real decision.
            </h2>
            <p className="body-lg mt-6 max-w-sm">
              So here is exactly what happens to your garment, your deposit and your money.
            </p>
            <p className="mt-8">
              <Link href="/how-it-works" className="link-underline text-small text-ink">
                Read the full policy
              </Link>
            </p>
          </div>

          <div className="lg:col-span-7 lg:col-start-6">
            <dl className="border-rule border-t">
              {COMMITMENTS.map((commitment) => (
                <div
                  key={commitment.term}
                  className="border-rule grid gap-2 border-b py-6 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-8"
                >
                  <dt className="text-body text-ink font-medium">{commitment.term}</dt>
                  <dd className="text-small text-ink-2 leading-relaxed">{commitment.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
