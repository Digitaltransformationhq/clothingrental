import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDateRange, toIsoDate } from "@/domain/dates";
import { formatMoney, money } from "@/domain/money";
import { CheckoutPayment } from "@/components/checkout/checkout-payment";
import { DeliveryPicker } from "@/components/checkout/delivery-picker";
import { Eyebrow } from "@/components/ui/primitives";
import { mediaUrl } from "@/lib/media";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

/**
 * Checkout.
 *
 * Deliberately the plainest page on the site. The masthead's navigation is
 * still there for escape, but nothing else competes: one column of what you are
 * about to pay for, one column of what it costs, one button.
 *
 * Every figure shown is read from the rental row, which the server computed and
 * stored when the booking was created. Nothing here is recalculated in the
 * browser and nothing is passed in from the previous page.
 */

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

type Params = Promise<{ rentalId: string }>;

export default async function CheckoutPage({ params }: { params: Params }) {
  const { rentalId } = await params;
  const user = await requireUser(`/checkout/${rentalId}`);
  const db = await getDb();

  const rental = await db.rental.findUnique({
    where: { id: rentalId },
    select: {
      id: true,
      reference: true,
      renterId: true,
      status: true,
      currency: true,
      rentalSubtotalMinor: true,
      deliveryFeeMinor: true,
      serviceFeeMinor: true,
      taxMinor: true,
      depositMinor: true,
      discountMinor: true,
      totalMinor: true,
      fulfilment: true,
      deliveryAddressId: true,
      deliveryAddress: {
        select: {
          recipient: true,
          line1: true,
          line2: true,
          city: true,
          state: true,
          postalCode: true,
          phone: true,
        },
      },
      items: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          days: true,
          lineSubtotalMinor: true,
          depositMinor: true,
          listing: {
            select: {
              instantBook: true,
              city: true,
              owner: { select: { name: true } },
              item: {
                select: {
                  slug: true,
                  title: true,
                  size: { select: { label: true } },
                  brand: { select: { name: true } },
                  images: {
                    orderBy: { position: "asc" },
                    take: 1,
                    select: { storageKey: true, alt: true, blurDataUrl: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!rental) notFound();
  // A rental id in the URL is not authorisation to view it. Checked before
  // anything else is loaded.
  if (rental.renterId !== user.id) notFound();

  // Loaded only when they are actually needed, and always scoped to the caller.
  const addresses =
    rental.fulfilment === "PICKUP"
      ? []
      : await db.address.findMany({
          where: { userId: user.id },
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            label: true,
            recipient: true,
            phone: true,
            line1: true,
            line2: true,
            city: true,
            state: true,
            postalCode: true,
            isDefault: true,
          },
        });

  // Already paid: send them to the confirmation rather than charging again.
  if (
    rental.status === "CONFIRMED" ||
    rental.status === "ACTIVE" ||
    rental.status === "COMPLETED"
  ) {
    return <AlreadyPaid rentalId={rental.id} reference={rental.reference} />;
  }

  if (rental.status === "CANCELLED") {
    return <Expired />;
  }

  const currency = rental.currency as "INR";
  const lines = [
    { label: "Rental", amount: rental.rentalSubtotalMinor },
    ...(rental.deliveryFeeMinor > 0
      ? [
          {
            label: rental.fulfilment === "LOCAL_DELIVERY" ? "Delivery" : "Shipping, both ways",
            amount: rental.deliveryFeeMinor,
          },
        ]
      : []),
    { label: "Service fee", amount: rental.serviceFeeMinor },
    ...(rental.taxMinor > 0 ? [{ label: "GST", amount: rental.taxMinor }] : []),
    ...(rental.discountMinor > 0 ? [{ label: "Discount", amount: -rental.discountMinor }] : []),
  ];

  const costToRenter = rental.totalMinor - rental.depositMinor;
  const needsOwnerApproval = rental.items.some((item) => !item.listing.instantBook);

  return (
    <div className="page-gutter pt-10 pb-24 sm:pt-14">
      <div className="page-width max-w-5xl">
        <Eyebrow className="mb-3">Checkout</Eyebrow>
        <h1 className="display-3">Confirm your rental</h1>
        <p className="meta text-ink-3 mt-3">
          Reference <span className="numeric text-ink-2">{rental.reference}</span>
        </p>

        <div className="mt-12 grid gap-x-16 gap-y-12 lg:grid-cols-[1fr_22rem]">
          {/* ── What you're renting ──────────────────────────────────────── */}
          <div>
            <section aria-labelledby="items-heading">
              <h2 id="items-heading" className="label text-ink-3 mb-5">
                The pieces
              </h2>

              <ul className="border-rule border-t">
                {rental.items.map((item) => {
                  const image = item.listing.item.images[0];
                  const range = {
                    start: toIsoDate(item.startDate),
                    end: toIsoDate(item.endDate),
                  };

                  return (
                    <li key={item.id} className="border-rule flex gap-5 border-b py-6">
                      <Link
                        href={`/item/${item.listing.item.slug}`}
                        className="bg-paper-3 relative aspect-[4/5] w-24 shrink-0 overflow-hidden sm:w-28"
                      >
                        {image ? (
                          <Image
                            src={mediaUrl(image.storageKey)}
                            alt={image.alt}
                            fill
                            sizes="120px"
                            placeholder={image.blurDataUrl ? "blur" : "empty"}
                            blurDataURL={image.blurDataUrl ?? undefined}
                            className="object-cover"
                          />
                        ) : null}
                      </Link>

                      <div className="min-w-0 flex-1">
                        {item.listing.item.brand ? (
                          <p className="meta text-ink-3 tracking-[0.1em] uppercase">
                            {item.listing.item.brand.name}
                          </p>
                        ) : null}
                        <h3 className="text-body text-ink mt-1">
                          <Link href={`/item/${item.listing.item.slug}`} className="link-underline">
                            {item.listing.item.title}
                          </Link>
                        </h3>

                        <dl className="mt-3 space-y-1">
                          <div className="text-small flex gap-2">
                            <dt className="text-ink-3">Dates</dt>
                            <dd className="text-ink">
                              {formatDateRange(range)}
                              <span className="text-ink-3"> · {item.days} days</span>
                            </dd>
                          </div>
                          <div className="text-small flex gap-2">
                            <dt className="text-ink-3">Size</dt>
                            <dd className="text-ink">{item.listing.item.size.label}</dd>
                          </div>
                          <div className="text-small flex gap-2">
                            <dt className="text-ink-3">From</dt>
                            <dd className="text-ink">
                              {item.listing.owner.name} · {item.listing.city}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <p className="numeric text-body text-ink shrink-0">
                        {formatMoney(money(item.lineSubtotalMinor, currency))}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* ── Where it goes ────────────────────────────────────────── */}
            <section className="mt-10" aria-labelledby="delivery-heading">
              <h2 id="delivery-heading" className="label text-ink-3 mb-4">
                {rental.fulfilment === "PICKUP" ? "Collection" : "Delivery"}
              </h2>

              {rental.fulfilment === "PICKUP" ? (
                <p className="text-body text-ink-2">
                  You’re collecting in person. The owner will send you the address and a time once
                  the booking is confirmed.
                </p>
              ) : (
                <DeliveryPicker
                  rentalId={rental.id}
                  addresses={addresses}
                  selectedId={rental.deliveryAddressId}
                />
              )}
            </section>

            {/* ── What happens next ────────────────────────────────────── */}
            <section className="border-rule mt-10 border-t pt-8" aria-labelledby="next-heading">
              <h2 id="next-heading" className="label text-ink-3 mb-4">
                What happens next
              </h2>
              <ol className="text-small text-ink-2 space-y-3">
                <li className="flex gap-3">
                  <span className="numeric text-ink-3 shrink-0">01</span>
                  {needsOwnerApproval
                    ? "The owner has 24 hours to accept. Your card is charged only when they do."
                    : "Your booking is confirmed straight away."}
                </li>
                <li className="flex gap-3">
                  <span className="numeric text-ink-3 shrink-0">02</span>
                  The piece is cleaned and sent so it reaches you a day or two before your dates.
                </li>
                <li className="flex gap-3">
                  <span className="numeric text-ink-3 shrink-0">03</span>
                  Send it back in the same packaging on your return date.
                </li>
                <li className="flex gap-3">
                  <span className="numeric text-ink-3 shrink-0">04</span>
                  Your {formatMoney(money(rental.depositMinor, currency))} deposit is returned
                  within three days of a clean return.
                </li>
              </ol>
            </section>
          </div>

          {/* ── Summary and payment ──────────────────────────────────────── */}
          <div>
            <div className="lg:sticky lg:top-28">
              <div className="border-rule bg-surface border p-6">
                <h2 className="label text-ink-3 mb-5">Price</h2>

                <dl>
                  {lines.map((line) => (
                    <div key={line.label} className="flex justify-between gap-4 py-1.5">
                      <dt className="text-small text-ink-2">{line.label}</dt>
                      <dd className="numeric text-small text-ink">
                        {formatMoney(money(line.amount, currency))}
                      </dd>
                    </div>
                  ))}

                  <div className="border-rule mt-2 flex justify-between gap-4 border-t pt-3">
                    <dt className="text-body text-ink font-medium">Cost of the rental</dt>
                    <dd className="numeric text-body text-ink font-medium">
                      {formatMoney(money(costToRenter, currency))}
                    </dd>
                  </div>

                  {rental.depositMinor > 0 ? (
                    <>
                      <div className="border-rule mt-3 flex justify-between gap-4 border-t pt-3">
                        <dt className="text-small text-ink-2">
                          Security deposit
                          <span className="meta text-ink-3 mt-0.5 block">Fully refundable</span>
                        </dt>
                        <dd className="numeric text-small text-ink">
                          {formatMoney(money(rental.depositMinor, currency))}
                        </dd>
                      </div>

                      <div className="border-ink mt-3 flex justify-between gap-4 border-t pt-3">
                        <dt className="text-body text-ink font-medium">Charged today</dt>
                        <dd className="numeric text-body text-ink font-medium">
                          {formatMoney(money(rental.totalMinor, currency))}
                        </dd>
                      </div>
                    </>
                  ) : null}
                </dl>

                <CheckoutPayment
                  rentalId={rental.id}
                  totalMinor={rental.totalMinor}
                  currency={currency}
                  needsOwnerApproval={needsOwnerApproval}
                  needsAddress={rental.fulfilment !== "PICKUP" && !rental.deliveryAddressId}
                  className="mt-6"
                />
              </div>

              <p className="meta text-ink-3 mt-4">
                By confirming you agree to the{" "}
                <Link href="/legal/rental-agreement" className="link-underline text-ink-2">
                  rental agreement
                </Link>{" "}
                and the{" "}
                <Link href="/legal/cancellation" className="link-underline text-ink-2">
                  cancellation policy
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlreadyPaid({ rentalId, reference }: { rentalId: string; reference: string }) {
  return (
    <div className="page-gutter py-24">
      <div className="page-width max-w-xl text-center">
        <h1 className="display-3">This one’s already booked.</h1>
        <p className="body-lg mt-4">
          Rental <span className="numeric">{reference}</span> has been paid for and confirmed.
        </p>
        <p className="mt-8">
          <Link href={`/checkout/success/${rentalId}`} className="link-underline text-ink">
            See the confirmation
          </Link>
        </p>
      </div>
    </div>
  );
}

function Expired() {
  return (
    <div className="page-gutter py-24">
      <div className="page-width max-w-xl text-center">
        <h1 className="display-3">These dates have been released.</h1>
        <p className="body-lg mt-4">
          The booking wasn’t completed in time, so the piece went back into the wardrobe. Nothing
          has been charged.
        </p>
        <p className="mt-8">
          <Link href="/shop" className="link-underline text-ink">
            Find it again
          </Link>
        </p>
      </div>
    </div>
  );
}
