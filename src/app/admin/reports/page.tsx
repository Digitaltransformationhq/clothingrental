import { formatDateLong, toIsoDate } from "@/domain/dates";
import { formatMoney, money } from "@/domain/money";
import { Chip } from "@/components/ui/primitives";
import { DisputeActions } from "@/components/admin/dispute-actions";
import { ReportActions } from "@/components/admin/report-actions";
import { VerificationActions } from "@/components/admin/verification-actions";
import {
  getDisputesForAdmin,
  getReportsForAdmin,
  getVerificationsForAdmin,
} from "@/server/services/admin";

export const metadata = { title: "Reports" };

/**
 * Reports and disputes.
 *
 * Three queues of things a person has to read and decide, so each is shown in
 * full rather than summarised — a report you have to click into to understand
 * is a report that waits longer than it should.
 *
 * Every row carries its decision controls inline. The actions behind them
 * already existed and were reachable by nothing: reports could be listed but
 * not resolved, disputes not settled, and identity checks had no interface at
 * all, while the owner-facing pages promise that every renter is identified.
 */
export default async function AdminReportsPage() {
  const [reports, disputes, verifications] = await Promise.all([
    getReportsForAdmin(),
    getDisputesForAdmin(),
    getVerificationsForAdmin(),
  ]);

  const pendingVerifications = verifications.filter((row) => row.status === "PENDING").length;

  return (
    <div className="space-y-10">
      <section aria-labelledby="reports-heading">
        <h2 id="reports-heading" className="label text-ink-3 mb-4">
          Reported content
        </h2>

        {reports.length === 0 ? (
          <p className="border-rule bg-surface text-body text-ink-2 border p-6">
            Nothing has been reported.
          </p>
        ) : (
          <ul className="space-y-3">
            {reports.map((report) => (
              <li key={report.id} className="border-rule bg-surface border p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-body text-ink">
                      {report.subject.toLowerCase()} · {report.reason}
                    </p>
                    <p className="meta text-ink-3 mt-1">
                      Reported by {report.reporter.name} on{" "}
                      {formatDateLong(toIsoDate(report.createdAt))} ·{" "}
                      <span className="numeric">{report.subjectId}</span>
                    </p>
                  </div>
                  <Chip
                    tone={
                      report.status === "PENDING"
                        ? "caution"
                        : report.status === "ACTIONED"
                          ? "positive"
                          : "neutral"
                    }
                  >
                    {report.status.toLowerCase()}
                  </Chip>
                </div>
                {report.detail ? (
                  <p className="text-small text-ink-2 mt-3">{report.detail}</p>
                ) : null}
                {report.actionNote ? (
                  <p className="meta text-ink-3 mt-3">Outcome: {report.actionNote}</p>
                ) : null}
                <ReportActions reportId={report.id} status={report.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="disputes-heading">
        <h2 id="disputes-heading" className="label text-ink-3 mb-4">
          Disputes
        </h2>

        {disputes.length === 0 ? (
          <p className="border-rule bg-surface text-body text-ink-2 border p-6">
            No disputes open. Deposits are being returned cleanly.
          </p>
        ) : (
          <ul className="space-y-3">
            {disputes.map((dispute) => (
              <li key={dispute.id} className="border-rule bg-surface border p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-body text-ink">{dispute.reason}</p>
                    <p className="meta text-ink-3 mt-1">
                      <span className="numeric">{dispute.rental.reference}</span> ·{" "}
                      {dispute.rental.renter.name} · opened by {dispute.openedBy.name} on{" "}
                      {formatDateLong(toIsoDate(dispute.createdAt))}
                    </p>
                  </div>
                  <div className="text-right">
                    <Chip tone={dispute.status === "RESOLVED" ? "positive" : "caution"}>
                      {dispute.status.replace(/_/g, " ").toLowerCase()}
                    </Chip>
                    <p className="numeric meta text-ink-3 mt-1.5">
                      deposit{" "}
                      {formatMoney(
                        money(dispute.rental.depositMinor, dispute.rental.currency as "INR"),
                      )}
                    </p>
                  </div>
                </div>
                {dispute.detail ? (
                  <p className="text-small text-ink-2 mt-3">{dispute.detail}</p>
                ) : null}
                {dispute.settlementMinor !== null ? (
                  <p className="meta text-ink-2 mt-3">
                    Settled at {formatMoney(money(dispute.settlementMinor, "INR"))} ·{" "}
                    {dispute.outcome?.replace(/_/g, " ").toLowerCase()}
                  </p>
                ) : null}
                <DisputeActions
                  disputeId={dispute.id}
                  status={dispute.status}
                  depositMinor={dispute.rental.depositMinor}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="verifications-heading">
        <h2 id="verifications-heading" className="label text-ink-3 mb-4">
          Identity checks
          {pendingVerifications > 0 ? ` · ${pendingVerifications} waiting` : null}
        </h2>

        {verifications.length === 0 ? (
          <p className="border-rule bg-surface text-body text-ink-2 border p-6">
            Nobody has submitted a document for review.
          </p>
        ) : (
          <ul className="space-y-3">
            {verifications.map((verification) => (
              <li key={verification.id} className="border-rule bg-surface border p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-body text-ink">
                      {verification.user.name}
                      {verification.user.profile?.handle ? (
                        <span className="text-ink-3"> · @{verification.user.profile.handle}</span>
                      ) : null}
                    </p>
                    <p className="meta text-ink-3 mt-1">
                      {verification.kind.replace(/_/g, " ").toLowerCase()} · submitted{" "}
                      {formatDateLong(toIsoDate(verification.createdAt))} ·{" "}
                      {verification.hasDocument ? "document attached" : "no document attached"}
                    </p>
                  </div>
                  <Chip
                    tone={
                      verification.status === "PENDING"
                        ? "caution"
                        : verification.status === "APPROVED"
                          ? "positive"
                          : "neutral"
                    }
                  >
                    {verification.status.toLowerCase()}
                  </Chip>
                </div>
                {verification.notes ? (
                  <p className="text-small text-ink-2 mt-3">{verification.notes}</p>
                ) : null}
                <VerificationActions
                  verificationId={verification.id}
                  status={verification.status}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
