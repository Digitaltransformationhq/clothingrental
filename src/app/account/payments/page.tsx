import type { Metadata } from "next";

import { formatMoney, money } from "@/domain/money";
import { PayoutAccountForm } from "@/components/account/payout-account-form";
import { Chip } from "@/components/ui/primitives";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { getEarnings } from "@/server/services/account";

export const metadata: Metadata = { title: "Payments" };

/**
 * Payment and payout settings.
 *
 * States plainly what is stored and what is not. A member handing over bank
 * details deserves to know that this application keeps four digits and an IFSC
 * code, and that the number itself goes to the payment provider.
 */
export default async function PaymentsPage() {
  const user = await requireUser("/account/payments");
  const db = await getDb();

  const [account, earnings] = await Promise.all([
    db.payoutAccount.findUnique({
      where: { userId: user.id },
      select: {
        beneficiaryName: true,
        bankLast4: true,
        ifscCode: true,
        upiHandle: true,
        isVerified: true,
      },
    }),
    getEarnings(user.id),
  ]);

  return (
    <div className="max-w-2xl space-y-14">
      <section aria-labelledby="payout-heading">
        <h2 id="payout-heading" className="title-1 mb-2">
          Where your earnings go
        </h2>
        <p className="body-lg mb-6">
          Paid out two working days after a piece comes home and the rental closes.
        </p>

        {account ? (
          <dl className="border-rule mb-8 border-t">
            <Row label="Beneficiary">{account.beneficiaryName}</Row>
            <Row label="Account">
              <span className="numeric">••••{account.bankLast4}</span>
              <span className="numeric text-ink-3 ml-3">{account.ifscCode}</span>
            </Row>
            {account.upiHandle ? <Row label="UPI">{account.upiHandle}</Row> : null}
            <Row label="Status">
              {account.isVerified ? (
                <Chip tone="positive">Verified</Chip>
              ) : (
                <Chip tone="caution">Being verified</Chip>
              )}
            </Row>
            <Row label="Available now">
              <span className="numeric">{formatMoney(money(earnings.availableMinor, "INR"))}</span>
            </Row>
          </dl>
        ) : (
          <p className="border-caution bg-caution-soft text-small text-ink mb-8 border-l-2 px-4 py-3">
            You have not added an account yet. Earnings accumulate either way — they simply cannot
            be paid out until there is somewhere to send them.
          </p>
        )}

        <PayoutAccountForm
          initial={
            account
              ? {
                  beneficiaryName: account.beneficiaryName,
                  ifscCode: account.ifscCode ?? "",
                  upiHandle: account.upiHandle ?? "",
                }
              : undefined
          }
          hasAccount={Boolean(account)}
        />
      </section>

      <section aria-labelledby="storage-heading">
        <h2 id="storage-heading" className="title-1 mb-4">
          What we store
        </h2>
        <dl className="border-rule border-t">
          <Row label="Card details">
            Never. Card data goes straight to the payment provider and never reaches our servers.
          </Row>
          <Row label="Bank account">
            The last four digits and the IFSC code, so you can tell which account you nominated. The
            full number is held by the payment provider.
          </Row>
          <Row label="Payment history">
            Kept for as long as the law requires, and visible to you under Earnings.
          </Row>
        </dl>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-rule flex flex-wrap items-baseline justify-between gap-4 border-b py-3.5">
      <dt className="text-small text-ink-2 shrink-0">{label}</dt>
      <dd className="text-small text-ink max-w-md text-right">{children}</dd>
    </div>
  );
}
