import Link from "next/link";

import { formatMoney, formatMoneyCompact, money } from "@/domain/money";
import { getModerationCounts, getPlatformOverview } from "@/server/services/admin";

export const metadata = { title: "Overview" };

/**
 * The operations overview.
 *
 * Two blocks: what needs a decision, and what the marketplace is doing.
 * The queue comes first because that is the reason anybody opens this page.
 *
 * Deposits held are shown separately from revenue throughout. They are members'
 * money in our custody, and a dashboard that adds them to takings is telling
 * its operators something untrue.
 */
export default async function AdminOverviewPage() {
  const [overview, counts] = await Promise.all([getPlatformOverview(), getModerationCounts()]);

  const queue = [
    { label: "Listings awaiting review", value: counts.listings, href: "/admin/listings" },
    { label: "Open reports", value: counts.reports, href: "/admin/reports" },
    { label: "Disputes", value: counts.disputes, href: "/admin/reports" },
    { label: "Identity checks", value: counts.verifications, href: "/admin/reports" },
    { label: "Payouts to release", value: counts.payouts, href: "/admin/payouts" },
  ];

  const totalQueue = queue.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="space-y-10">
      <section aria-labelledby="queue-heading">
        <h2 id="queue-heading" className="label text-ink-3 mb-4">
          Needs a decision
        </h2>

        {totalQueue === 0 ? (
          <p className="border-rule bg-surface text-body text-ink-2 border p-6">
            Nothing is waiting. Every listing has been reviewed, every report closed.
          </p>
        ) : (
          <ul className="border-rule bg-rule grid gap-px border sm:grid-cols-3 lg:grid-cols-5">
            {queue.map((entry) => (
              <li key={entry.label} className="bg-surface">
                <Link href={entry.href} className="hover:bg-paper-2 block p-5 transition-colors">
                  <span
                    className={`numeric font-display block text-[2rem] leading-none ${
                      entry.value > 0 ? "text-claret" : "text-ink-3"
                    }`}
                  >
                    {entry.value}
                  </span>
                  <span className="meta text-ink-2 mt-2 block">{entry.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="numbers-heading">
        <h2 id="numbers-heading" className="label text-ink-3 mb-4">
          The marketplace
        </h2>

        <dl className="border-rule bg-rule grid gap-px border sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Members", value: String(overview.members) },
            {
              label: "Live listings",
              value: `${overview.liveListings}`,
              detail: `${overview.listings} total`,
            },
            {
              label: "Rentals",
              value: String(overview.rentals),
              detail: `${overview.recentRentals} in the last 30 days`,
            },
            {
              label: "Gross merchandise value",
              value: formatMoneyCompact(money(overview.grossMerchandiseMinor, "INR")),
              detail: "Excludes refundable deposits",
            },
            {
              label: "Commission earned",
              value: formatMoneyCompact(money(overview.commissionMinor, "INR")),
              detail: "On completed rentals",
            },
            {
              label: "Paid to owners",
              value: formatMoneyCompact(money(overview.ownerEarningsMinor, "INR")),
              detail: "On completed rentals",
            },
            {
              label: "Deposits held",
              value: formatMoney(money(overview.depositsHeldMinor, "INR")),
              detail: "Members' money in our custody — not revenue",
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-surface p-5">
              <dd className="numeric font-display text-ink text-[1.75rem] leading-none">
                {stat.value}
              </dd>
              <dt className="meta text-ink-2 mt-2">{stat.label}</dt>
              {stat.detail ? <p className="meta text-ink-3 mt-1">{stat.detail}</p> : null}
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
