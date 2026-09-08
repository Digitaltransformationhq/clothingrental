import Link from "next/link";

import { formatDateRange, formatDateLong, toIsoDate } from "@/domain/dates";
import { formatMoney, money } from "@/domain/money";
import { describeStatus, statusTone } from "@/domain/rental/state-machine";
import { Chip } from "@/components/ui/primitives";
import { getRentalsForAdmin } from "@/server/services/admin";

export const metadata = { title: "Rentals" };

/**
 * Every rental on the marketplace.
 *
 * Support's first screen: somebody writes in quoting a reference, and this is
 * where it gets looked up. So the reference is prominent, the payment state is
 * visible without opening anything, and the deposit is listed apart from the
 * total — those three facts answer most enquiries on their own.
 */
export default async function AdminOrdersPage() {
  const rentals = await getRentalsForAdmin();

  return (
    <div className="border-rule bg-surface overflow-x-auto border">
      <table className="text-small w-full min-w-[72rem] border-collapse">
        <caption className="sr-only">Rentals</caption>
        <thead>
          <tr className="border-rule border-b text-left">
            {[
              "Reference",
              "Renter",
              "Pieces",
              "Dates",
              "Charged",
              "Deposit",
              "Payment",
              "Status",
            ].map((heading) => (
              <th key={heading} scope="col" className="label text-ink-3 px-4 py-3">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rentals.map((rental) => {
            const first = rental.items[0];
            const payment = rental.payments[0];

            return (
              <tr key={rental.id} className="border-rule border-b align-top last:border-b-0">
                <td className="numeric text-ink px-4 py-3">
                  {rental.reference}
                  <span className="meta text-ink-3 mt-0.5 block">
                    {formatDateLong(toIsoDate(rental.createdAt))}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-ink block">{rental.renter.name}</span>
                  <span className="meta text-ink-3 block">{rental.renter.email}</span>
                </td>
                <td className="text-ink-2 px-4 py-3">
                  {rental.items.map((item, index) => (
                    <span key={index} className="block">
                      <Link
                        href={`/item/${item.listing.item.slug}`}
                        className="link-underline text-ink"
                      >
                        {item.listing.item.title}
                      </Link>
                      <span className="meta text-ink-3 block">from {item.owner.name}</span>
                    </span>
                  ))}
                </td>
                <td className="text-ink-2 px-4 py-3">
                  {first
                    ? formatDateRange({
                        start: toIsoDate(first.startDate),
                        end: toIsoDate(first.endDate),
                      })
                    : "—"}
                </td>
                <td className="numeric text-ink px-4 py-3">
                  {formatMoney(money(rental.totalMinor, rental.currency as "INR"))}
                </td>
                <td className="numeric text-ink-2 px-4 py-3">
                  {formatMoney(money(rental.depositMinor, rental.currency as "INR"))}
                </td>
                <td className="px-4 py-3">
                  {payment ? (
                    <Chip
                      tone={
                        payment.status === "CAPTURED"
                          ? "positive"
                          : payment.status === "FAILED"
                            ? "critical"
                            : "caution"
                      }
                    >
                      {payment.status.toLowerCase()}
                    </Chip>
                  ) : (
                    <span className="meta text-ink-3">none</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {rental.items.map((item, index) => (
                    <Chip key={index} tone={statusTone(item.status)} className="mr-1 mb-1">
                      {describeStatus(item.status)}
                    </Chip>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {rentals.length === 0 ? <p className="text-body text-ink-2 p-6">No rentals yet.</p> : null}
    </div>
  );
}
