import { formatMoney } from "@/domain/money";
import type { RentalQuote } from "@/domain/rental/pricing";
import { cn } from "@/lib/cn";

/**
 * The price breakdown.
 *
 * Two rules, and they are the whole design:
 *
 *  1. Everything is shown before checkout. Service fee, GST and delivery all
 *     appear here, on the listing page, because a fee revealed at the payment
 *     step is the fastest way to lose somebody's trust permanently.
 *
 *  2. The refundable deposit is separated from the cost of the rental by a
 *     rule and restated underneath. "Total ₹3,250" is true and misleading when
 *     ₹2,000 of it comes back; a member deciding whether they can afford this
 *     needs both numbers.
 */
export function PriceBreakdown({
  quote,
  days,
  className,
  compact = false,
}: {
  quote: RentalQuote;
  days: number;
  className?: string;
  compact?: boolean;
}) {
  const refundable = quote.lines.filter((line) => line.refundable);
  const charged = quote.lines.filter((line) => !line.refundable);

  return (
    <div className={className}>
      {!compact ? (
        <p className="label text-ink-3 mb-3">
          {days} {days === 1 ? "day" : "days"}
        </p>
      ) : null}

      <dl>
        {charged.map((line) => (
          <div key={line.key} className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="text-small text-ink-2">
              {line.label}
              {line.detail && !compact ? (
                <span className="meta text-ink-3 mt-0.5 block">{line.detail}</span>
              ) : null}
            </dt>
            <dd
              className={cn(
                "numeric text-small shrink-0",
                line.amount.amountMinor < 0 ? "text-positive" : "text-ink",
              )}
            >
              {formatMoney(line.amount)}
            </dd>
          </div>
        ))}

        <div className="border-rule mt-2 flex items-baseline justify-between gap-4 border-t pt-3">
          <dt className="text-body text-ink font-medium">
            {refundable.length > 0 ? "Cost of the rental" : "Total"}
          </dt>
          <dd className="numeric text-body text-ink font-medium">
            {formatMoney(quote.costToRenter)}
          </dd>
        </div>

        {refundable.length > 0 ? (
          <>
            {refundable.map((line) => (
              <div
                key={line.key}
                className="border-rule mt-3 flex items-baseline justify-between gap-4 border-t pt-3"
              >
                <dt className="text-small text-ink-2">
                  {line.label}
                  <span className="meta text-ink-3 mt-0.5 block">
                    {line.detail ?? "Refundable"}
                  </span>
                </dt>
                <dd className="numeric text-small text-ink shrink-0">{formatMoney(line.amount)}</dd>
              </div>
            ))}

            <div className="border-ink mt-3 flex items-baseline justify-between gap-4 border-t pt-3">
              <dt className="text-body text-ink font-medium">Charged today</dt>
              <dd className="numeric text-body text-ink font-medium">
                {formatMoney(quote.total)}
                {/* Inside the <dd>: only <dt>, <dd> and <div> may be children of
                    a <dl>, and this note belongs to the figure above it. */}
                <span className="meta text-ink-2 mt-2.5 block text-right font-normal">
                  {formatMoney(quote.deposit)} of this comes back to you within three days of a
                  clean return.
                </span>
              </dd>
            </div>
          </>
        ) : null}
      </dl>
    </div>
  );
}
