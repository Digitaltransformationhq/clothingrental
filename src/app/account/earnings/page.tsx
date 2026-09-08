import type { Metadata } from "next";

import { formatDateLong, toIsoDate } from "@/domain/dates";
import { formatMoney, money } from "@/domain/money";
import { Chip, EmptyState } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/server/auth/session";
import { getEarnings } from "@/server/services/account";

export const metadata: Metadata = { title: "Earnings" };

/**
 * Earnings.
 *
 * Figures set in the display serif at a size that makes them the page, with
 * hairlines instead of stat cards. The distinction that matters — and that most
 * marketplaces blur — is between money that is *available*, money that is
 * *earned but not yet settled*, and money that is merely *expected*. Each gets
 * its own figure and its own sentence.
 */
export default async function EarningsPage() {
  const user = await requireUser("/account/earnings");
  const earnings = await getEarnings(user.id);

  if (earnings.lifetimeMinor === 0 && earnings.pendingMinor === 0) {
    return (
      <EmptyState
        title="Nothing has been earned yet."
        body="Once a piece of yours goes out and comes home again, what you have made will appear here — and you can withdraw it."
        action={<ButtonLink href="/sell/new">List a piece</ButtonLink>}
        className="border-t-0"
      />
    );
  }

  const figures = [
    {
      value: earnings.availableMinor,
      label: "Available to withdraw",
      detail: "From rentals that have completed and been settled.",
      lead: true,
    },
    {
      value: earnings.pendingMinor,
      label: "On its way",
      detail: `From ${earnings.upcomingCount} ${earnings.upcomingCount === 1 ? "rental" : "rentals"} still out or upcoming.`,
    },
    {
      value: earnings.settledMinor,
      label: "Already paid out",
      detail: "Across every payout to date.",
    },
  ];

  return (
    <div className="space-y-16">
      <section aria-labelledby="figures-heading">
        <h2 id="figures-heading" className="sr-only">
          Your earnings
        </h2>

        <dl className="border-rule grid gap-x-10 gap-y-10 border-t pt-8 sm:grid-cols-3">
          {figures.map((figure) => (
            <div key={figure.label}>
              <dd
                className={
                  figure.lead
                    ? "numeric font-display text-ink text-[clamp(2.5rem,5vw,3.75rem)] leading-none"
                    : "numeric font-display text-ink-2 text-[2rem] leading-none"
                }
              >
                {formatMoney(money(figure.value, "INR"))}
              </dd>
              <dt className="label text-ink mt-4">
                {figure.label}
                {/* Inside the <dt>: a <p> is not a permitted child of <dl>, and
                    the detail is part of what the term means. */}
                <span className="meta text-ink-3 mt-2 block max-w-xs font-normal tracking-normal normal-case">
                  {figure.detail}
                </span>
              </dt>
            </div>
          ))}
        </dl>

        {earnings.availableMinor > 0 ? (
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <ButtonLink href="/account/payments">Withdraw earnings</ButtonLink>
            <p className="meta text-ink-3">
              Paid to your registered account, usually within two working days.
            </p>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="wardrobe-heading">
        <h2 id="wardrobe-heading" className="label text-ink-3 mb-6">
          Your wardrobe, in numbers
        </h2>
        <dl className="border-rule grid gap-x-10 gap-y-8 border-t pt-8 sm:grid-cols-4">
          {[
            { value: String(earnings.listingCount), label: "pieces listed" },
            { value: String(earnings.rating.hosted), label: "rentals hosted" },
            {
              value: earnings.rating.count > 0 ? (earnings.rating.avgBps / 10_000).toFixed(1) : "—",
              label: "wardrobe rating",
            },
            {
              value: formatMoney(money(earnings.commissionMinor, "INR")),
              label: "platform commission paid",
            },
          ].map((stat) => (
            <div key={stat.label}>
              <dd className="numeric font-display text-ink text-[1.75rem] leading-none">
                {stat.value}
              </dd>
              <dt className="meta text-ink-3 mt-2">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </section>

      {earnings.payouts.length > 0 ? (
        <section aria-labelledby="payouts-heading">
          <h2 id="payouts-heading" className="label text-ink-3 mb-5">
            Payouts
          </h2>
          <ul className="border-rule border-t">
            {earnings.payouts.map((payout) => (
              <li
                key={payout.id}
                className="border-rule flex flex-wrap items-center gap-4 border-b py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="numeric text-body text-ink">
                    {formatMoney(money(payout.amountMinor, payout.currency as "INR"))}
                  </p>
                  <p className="meta text-ink-3 mt-0.5">
                    <span className="numeric">{payout.reference}</span> · {payout.items.length}{" "}
                    {payout.items.length === 1 ? "rental" : "rentals"} ·{" "}
                    {formatDateLong(toIsoDate(payout.paidAt ?? payout.createdAt))}
                  </p>
                </div>
                <Chip
                  tone={
                    payout.status === "PAID"
                      ? "positive"
                      : payout.status === "FAILED"
                        ? "critical"
                        : "caution"
                  }
                >
                  {payout.status === "PAID" ? "Paid" : payout.status.toLowerCase()}
                </Chip>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
