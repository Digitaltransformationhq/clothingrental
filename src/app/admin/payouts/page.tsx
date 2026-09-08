import { formatDateLong, toIsoDate } from "@/domain/dates";
import { formatMoney, money } from "@/domain/money";
import { Chip } from "@/components/ui/primitives";
import { getPayoutsForAdmin } from "@/server/services/admin";

export const metadata = { title: "Payouts" };

/**
 * Owner payouts.
 *
 * Whether an owner's account is verified is shown on every row, because paying
 * an unverified beneficiary is how money goes to the wrong person and does not
 * come back.
 */
export default async function AdminPayoutsPage() {
  const payouts = await getPayoutsForAdmin();

  return (
    <div className="border-rule bg-surface overflow-x-auto border">
      <table className="text-small w-full min-w-[56rem] border-collapse">
        <caption className="sr-only">Payouts</caption>
        <thead>
          <tr className="border-rule border-b text-left">
            {["Reference", "Owner", "Account", "Rentals", "Amount", "Status"].map((heading) => (
              <th key={heading} scope="col" className="label text-ink-3 px-4 py-3">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {payouts.map((payout) => (
            <tr key={payout.id} className="border-rule border-b last:border-b-0">
              <td className="numeric text-ink px-4 py-3">
                {payout.reference}
                <span className="meta text-ink-3 mt-0.5 block">
                  {formatDateLong(toIsoDate(payout.paidAt ?? payout.createdAt))}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-ink block">{payout.owner.name}</span>
                <span className="meta text-ink-3 block">{payout.owner.email}</span>
              </td>
              <td className="text-ink-2 px-4 py-3">
                {payout.owner.payoutAccount ? (
                  <>
                    <span className="numeric">••••{payout.owner.payoutAccount.bankLast4}</span>
                    {payout.owner.payoutAccount.isVerified ? (
                      <span className="meta text-positive block">verified</span>
                    ) : (
                      <span className="meta text-caution block">not verified</span>
                    )}
                  </>
                ) : (
                  <span className="meta text-critical">no account on file</span>
                )}
              </td>
              <td className="numeric text-ink-2 px-4 py-3">{payout.items.length}</td>
              <td className="numeric text-ink px-4 py-3">
                {formatMoney(money(payout.amountMinor, payout.currency as "INR"))}
              </td>
              <td className="px-4 py-3">
                <Chip
                  tone={
                    payout.status === "PAID"
                      ? "positive"
                      : payout.status === "FAILED"
                        ? "critical"
                        : "caution"
                  }
                >
                  {payout.status.toLowerCase()}
                </Chip>
                {payout.failureMessage ? (
                  <span className="meta text-critical mt-1 block">{payout.failureMessage}</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {payouts.length === 0 ? <p className="text-body text-ink-2 p-6">No payouts yet.</p> : null}
    </div>
  );
}
