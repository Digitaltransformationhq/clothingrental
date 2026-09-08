"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { type DateRange, differenceInDays, formatDateShort, type IsoDate } from "@/domain/dates";
import { formatMoney, money } from "@/domain/money";
import {
  type AvailabilityPolicy,
  checkAvailability,
  nextAvailableRange,
  type Occupancy,
} from "@/domain/rental/availability";
import {
  type FeeSchedule,
  type FulfilmentMode,
  type ListingPricing,
  quoteRental,
} from "@/domain/rental/pricing";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { AvailabilityCalendar } from "./availability-calendar";
import { PriceBreakdown } from "./price-breakdown";
import { startCheckout } from "@/server/actions/checkout";

/**
 * The rental panel.
 *
 * The commercial heart of the listing page: dates in, price out, one action.
 *
 * The price is computed in the browser by `quoteRental` — the same function the
 * server calls when the booking is actually written. Nothing is fetched to
 * price a date change, so dragging across a fortnight repriced instantly, and
 * the figure shown is by construction the figure charged.
 *
 * The button submits only the listing id and the two dates. Every amount is
 * recomputed server-side; nothing on this screen is trusted.
 */
export function RentalPanel({
  listingId,
  pricing,
  policy,
  occupancy,
  fees,
  today,
  fulfilmentOptions,
  instantBook,
  isOwnListing,
  className,
}: {
  listingId: string;
  pricing: ListingPricing;
  policy: AvailabilityPolicy;
  occupancy: Occupancy[];
  fees: FeeSchedule;
  today: IsoDate;
  fulfilmentOptions: FulfilmentMode[];
  instantBook: boolean;
  isOwnListing: boolean;
  className?: string;
}) {
  const router = useRouter();

  // Opens on the first bookable window of the minimum length, so the panel
  // arrives with a real price on it rather than an empty prompt.
  const suggested = React.useMemo(
    () =>
      nextAvailableRange({
        policy,
        occupancy,
        days: policy.minRentalDays,
        from: today,
        today,
      }),
    [policy, occupancy, today],
  );

  const [range, setRange] = React.useState<Partial<DateRange>>(suggested ?? {});
  const [fulfilment, setFulfilment] = React.useState<FulfilmentMode>(
    fulfilmentOptions.includes("SHIPPING") ? "SHIPPING" : (fulfilmentOptions[0] ?? "PICKUP"),
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const verdict = React.useMemo(() => {
    if (!range.start || !range.end) return null;
    return checkAvailability({
      policy,
      occupancy,
      requested: { start: range.start, end: range.end },
      today,
    });
  }, [range, policy, occupancy, today]);

  const quote = React.useMemo(() => {
    if (!range.start || !range.end) return null;
    const days = differenceInDays(range.start, range.end);
    if (days < 1) return null;
    return quoteRental({ pricing, days, fees, fulfilment });
  }, [range, pricing, fees, fulfilment]);

  const onSubmit = async () => {
    if (!range.start || !range.end || !verdict?.ok) return;
    setSubmitting(true);
    setError(null);

    const result = await startCheckout({
      listingId,
      start: range.start,
      end: range.end,
      fulfilment,
    });

    if (result.ok) {
      router.push(`/checkout/${result.data.rentalId}`);
      return;
    }

    setSubmitting(false);
    if (result.error.code === "UNAUTHENTICATED") {
      router.push(`/auth/sign-in?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setError(result.error.message);
  };

  const days = range.start && range.end ? differenceInDays(range.start, range.end) : 0;

  return (
    <div data-rental-panel className={cn("border-rule bg-surface border", className)}>
      {/* ── Price header ───────────────────────────────────────────────── */}
      <div className="border-rule border-b px-5 py-5 sm:px-6">
        <p className="flex items-baseline gap-2">
          <span className="numeric font-display text-ink text-[1.75rem] leading-none">
            {formatMoney(money(pricing.baseRateMinor, pricing.currency))}
          </span>
          <span className="text-small text-ink-2">
            / {pricing.baseDurationDays} {pricing.baseDurationDays === 1 ? "day" : "days"}
          </span>
        </p>
        <p className="meta text-ink-2 mt-2">
          {formatMoney(money(pricing.extraDayRateMinor, pricing.currency))} for each further day ·{" "}
          {formatMoney(money(pricing.depositMinor, pricing.currency))} refundable deposit
        </p>
      </div>

      {/* ── Dates ──────────────────────────────────────────────────────── */}
      <div className="px-5 py-5 sm:px-6">
        <div className="border-rule mb-5 grid grid-cols-2 border">
          <DateField
            label="Start"
            date={range.start}
            active={!range.start || Boolean(range.start && range.end)}
          />
          <DateField label="Return" date={range.end} active={Boolean(range.start && !range.end)} />
        </div>

        <AvailabilityCalendar
          policy={policy}
          occupancy={occupancy}
          today={today}
          value={range}
          onChange={(next) => {
            setRange(next);
            setError(null);
          }}
        />

        {/* The one message that matters, in the member's words. */}
        {verdict && !verdict.ok ? (
          <div className="border-caution bg-caution-soft mt-4 border-l-2 px-3 py-2.5">
            <p className="text-small text-ink">{verdict.message}</p>
            {verdict.suggestion ? (
              <button
                type="button"
                onClick={() => setRange(verdict.suggestion as DateRange)}
                className="link-underline meta text-ink mt-1.5"
              >
                Try {formatDateShort(verdict.suggestion.start)} –{" "}
                {formatDateShort(verdict.suggestion.end)} instead
              </button>
            ) : null}
          </div>
        ) : null}

        {range.start && !range.end ? (
          <p className="meta text-ink-2 mt-4">
            Now choose a return date — minimum {policy.minRentalDays} days.
          </p>
        ) : null}
      </div>

      {/* ── Handover ───────────────────────────────────────────────────── */}
      {fulfilmentOptions.length > 1 ? (
        <fieldset className="border-rule border-t px-5 py-5 sm:px-6">
          <legend className="label text-ink-3 mb-3">Getting it to you</legend>
          <div className="space-y-1">
            {fulfilmentOptions.map((option) => (
              <label
                key={option}
                className="text-small flex cursor-pointer items-center gap-2.5 py-1.5"
              >
                <input
                  type="radio"
                  name="fulfilment"
                  value={option}
                  checked={fulfilment === option}
                  onChange={() => setFulfilment(option)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border transition-colors",
                    "peer-focus-visible:outline-claret peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
                    fulfilment === option ? "border-ink" : "border-rule-strong",
                  )}
                >
                  {fulfilment === option ? (
                    <span className="bg-ink h-1.5 w-1.5 rounded-full" />
                  ) : null}
                </span>
                <span className={fulfilment === option ? "text-ink" : "text-ink-2"}>
                  {FULFILMENT_LABELS[option]}
                </span>
                {option !== "PICKUP" && pricing.deliveryFeeMinor > 0 ? (
                  <span className="numeric meta text-ink-3 ml-auto">
                    +{formatMoney(money(pricing.deliveryFeeMinor, pricing.currency))}
                  </span>
                ) : (
                  <span className="meta text-ink-3 ml-auto">Free</span>
                )}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {/* ── Price ──────────────────────────────────────────────────────── */}
      {quote && verdict?.ok ? (
        <div className="border-rule border-t px-5 py-5 sm:px-6">
          <PriceBreakdown quote={quote} days={days} />
        </div>
      ) : null}

      {/* ── Action ─────────────────────────────────────────────────────── */}
      <div className="border-rule border-t px-5 py-5 sm:px-6">
        {isOwnListing ? (
          <p className="text-small text-ink-2">
            This is your own piece. You can edit it from your wardrobe.
          </p>
        ) : (
          <>
            <Button
              fullWidth
              size="lg"
              onClick={onSubmit}
              loading={submitting}
              disabled={!verdict?.ok}
            >
              {instantBook ? "Rent now" : "Request to rent"}
            </Button>

            <p className="meta text-ink-3 mt-3 text-center">
              {instantBook
                ? "Confirmed immediately. You won't be charged until it is."
                : "The owner has 24 hours to reply. You won't be charged until they accept."}
            </p>

            {error ? (
              <p
                role="alert"
                className="border-critical bg-critical-soft text-small text-ink mt-3 border-l-2 px-3 py-2"
              >
                {error}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

const FULFILMENT_LABELS: Record<FulfilmentMode, string> = {
  PICKUP: "Collect in person",
  LOCAL_DELIVERY: "Delivered locally",
  SHIPPING: "Shipped, both ways",
};

function DateField({ label, date, active }: { label: string; date?: IsoDate; active: boolean }) {
  return (
    <div
      className={cn(
        "first:border-rule px-3.5 py-3 transition-colors first:border-r",
        active && "bg-paper-2",
      )}
    >
      <p className="label text-ink-3">{label}</p>
      <p className={cn("text-body mt-1", date ? "text-ink" : "text-ink-2")}>
        {date ? formatDateShort(date).toUpperCase() : "Select"}
      </p>
    </div>
  );
}
