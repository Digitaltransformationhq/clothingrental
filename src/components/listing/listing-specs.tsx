import Link from "next/link";

import type { getListingBySlug } from "@/server/services/listings";
import { conditionLabel } from "@/server/services/listing-view";
import { formatMoney, money } from "@/domain/money";
import { cn } from "@/lib/cn";

type Listing = NonNullable<Awaited<ReturnType<typeof getListingBySlug>>>;

/**
 * The specification.
 *
 * Fit is the single biggest reason a rental is returned unworn, so measurements
 * are given prominence and in both centimetres and inches — this market shops in
 * both, and asking somebody to convert 870mm in their head is how you sell them
 * the wrong size.
 *
 * Rendered as definition lists over hairlines. No table borders, no zebra
 * striping, no card.
 */
export function ListingSpecs({ listing, className }: { listing: Listing; className?: string }) {
  const item = listing.item;

  const measurements = [
    { label: "Bust", mm: item.bustMm },
    { label: "Waist", mm: item.waistMm },
    { label: "Hip", mm: item.hipMm },
    { label: "Shoulder", mm: item.shoulderMm },
    { label: "Sleeve", mm: item.sleeveMm },
    { label: "Length", mm: item.lengthMm },
  ].filter((entry): entry is { label: string; mm: number } => typeof entry.mm === "number");

  const details = [
    { label: "Category", value: item.category.name, href: `/shop/${item.category.slug}` },
    { label: "Size", value: item.size.label },
    { label: "Colour", value: item.color.name },
    { label: "Condition", value: conditionLabel(item.condition) },
    { label: "Fabric", value: item.fabric },
    { label: "Worn by", value: titleCase(item.gender) },
    {
      label: "Retail price",
      value: item.retailPriceMinor
        ? formatMoney(money(item.retailPriceMinor, listing.currency as "INR"))
        : null,
    },
  ].filter((entry) => Boolean(entry.value));

  return (
    <section className={className} aria-labelledby="specs-heading">
      <h2 id="specs-heading" className="title-1">
        The details
      </h2>

      <div className="mt-6 grid gap-x-12 gap-y-8 sm:grid-cols-2">
        <dl className="border-rule border-t">
          {details.map((entry) => (
            <div
              key={entry.label}
              className="border-rule flex items-baseline justify-between gap-6 border-b py-2.5"
            >
              <dt className="text-small text-ink-2">{entry.label}</dt>
              <dd className="text-small text-ink">
                {entry.href ? (
                  <Link href={entry.href} className="link-underline">
                    {entry.value}
                  </Link>
                ) : (
                  entry.value
                )}
              </dd>
            </div>
          ))}
        </dl>

        {measurements.length > 0 ? (
          <div>
            <dl className="border-rule border-t">
              {measurements.map((entry) => (
                <div
                  key={entry.label}
                  className="border-rule flex items-baseline justify-between gap-6 border-b py-2.5"
                >
                  <dt className="text-small text-ink-2">{entry.label}</dt>
                  <dd className="numeric text-small text-ink">
                    {(entry.mm / 10).toFixed(0)} cm
                    <span className="text-ink-3"> · {(entry.mm / 254).toFixed(1)}″</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="meta text-ink-3 mt-3">
              Measured flat by the owner. Message them if you’re between sizes.
            </p>
          </div>
        ) : null}
      </div>

      {/* Rental terms that are policy rather than prose. */}
      <div className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2">
        <dl className="border-rule border-t">
          <SpecRow label="Minimum rental">{listing.minRentalDays} days</SpecRow>
          <SpecRow label="Maximum rental">{listing.maxRentalDays} days</SpecRow>
          <SpecRow label="Notice needed">
            {listing.leadTimeDays === 0
              ? "None"
              : `${listing.leadTimeDays} ${listing.leadTimeDays === 1 ? "day" : "days"}`}
          </SpecRow>
          <SpecRow label="Turnaround after return">
            {listing.bufferDays} {listing.bufferDays === 1 ? "day" : "days"}
          </SpecRow>
        </dl>

        <dl className="border-rule border-t">
          <SpecRow label="Handover">
            {listing.fulfilment.map((mode) => FULFILMENT_LABELS[mode]).join(", ")}
          </SpecRow>
          <SpecRow label="Deposit">
            {formatMoney(money(listing.depositMinor, listing.currency as "INR"))}
            <span className="text-ink-3"> refundable</span>
          </SpecRow>
          <SpecRow label="Booking">{listing.instantBook ? "Instant" : "Owner confirms"}</SpecRow>
          {item.careInstructions ? <SpecRow label="Care">{item.careInstructions}</SpecRow> : null}
        </dl>
      </div>

      {item.occasions.length > 0 ? (
        <div className="mt-10">
          <p className="label text-ink-3 mb-3">Right for</p>
          <ul className="flex flex-wrap gap-2">
            {item.occasions.map(({ occasion }) => (
              <li key={occasion.slug}>
                <Link
                  href={`/shop?occasion=${occasion.slug}`}
                  className="border-rule text-small text-ink-2 hover:border-ink hover:text-ink inline-block border px-3 py-1.5 transition-colors"
                >
                  {occasion.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-rule flex items-baseline justify-between gap-6 border-b py-2.5">
      <dt className="text-small text-ink-2 shrink-0">{label}</dt>
      <dd className={cn("text-small text-ink text-right")}>{children}</dd>
    </div>
  );
}

const FULFILMENT_LABELS: Record<string, string> = {
  PICKUP: "Collect in person",
  LOCAL_DELIVERY: "Local delivery",
  SHIPPING: "Shipped",
};

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
