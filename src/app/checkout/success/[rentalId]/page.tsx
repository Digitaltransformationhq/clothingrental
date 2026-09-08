import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDateRange, formatDateLong, toIsoDate } from "@/domain/dates";
import { formatMoney, money } from "@/domain/money";
import { describeStatus } from "@/domain/rental/state-machine";
import { ButtonLink } from "@/components/ui/button";
import { MessageOwner } from "@/components/rental/message-owner";
import { Eyebrow } from "@/components/ui/primitives";
import { mediaUrl } from "@/lib/media";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

/**
 * The confirmation.
 *
 * Answers the four questions a member has the moment they have paid: did it
 * work, what did I get, when do I get it, and what do I do now. In that order,
 * above the fold, with no upsell.
 */

export const metadata: Metadata = {
  title: "Rental confirmed",
  robots: { index: false, follow: false },
};

type Params = Promise<{ rentalId: string }>;

export default async function CheckoutSuccessPage({ params }: { params: Params }) {
  const { rentalId } = await params;
  const user = await requireUser();
  const db = await getDb();

  const rental = await db.rental.findUnique({
    where: { id: rentalId },
    select: {
      id: true,
      reference: true,
      renterId: true,
      currency: true,
      totalMinor: true,
      depositMinor: true,
      placedAt: true,
      items: {
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          days: true,
          listing: {
            select: {
              id: true,
              city: true,
              ownerId: true,
              owner: { select: { name: true } },
              item: {
                select: {
                  slug: true,
                  title: true,
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

  if (!rental || rental.renterId !== user.id) notFound();

  const currency = rental.currency as "INR";
  const awaiting = rental.items.filter((item) => item.status === "REQUESTED");
  const first = rental.items[0];
  const mixed = awaiting.length > 0 && awaiting.length < rental.items.length;

  // `openConversation` refuses a thread with yourself, so the button is not
  // offered on a piece the member happens to own.
  const ownPiece = first.listing.ownerId === user.id;

  return (
    <div className="page-gutter pt-14 pb-24 sm:pt-20">
      <div className="page-width max-w-3xl">
        <Eyebrow className="mb-4">{awaiting.length > 0 ? "Request sent" : "Confirmed"}</Eyebrow>

        <h1 className="display-2">
          {awaiting.length > 0 ? (
            <>
              That’s with
              <br />
              the owner now.
            </>
          ) : (
            <>
              You have
              <br />
              somewhere to be.
            </>
          )}
        </h1>

        <p className="body-lg mt-5 max-w-lg">
          {awaiting.length > 0
            ? `${first.listing.owner.name.split(" ")[0]} has 24 hours to confirm. We'll email you the moment they do — and you won't be charged until then.`
            : "Everything's confirmed and the owner has been told. Look out for tracking a couple of days before your dates."}
        </p>

        <p className="meta text-ink-3 mt-4">
          Reference <span className="numeric text-ink-2">{rental.reference}</span>
          {rental.placedAt ? <> · placed {formatDateLong(toIsoDate(rental.placedAt))}</> : null}
        </p>

        {/* ── What you booked ────────────────────────────────────────────── */}
        <ul className="border-rule mt-14 border-t">
          {rental.items.map((item) => {
            const image = item.listing.item.images[0];
            return (
              <li key={item.id} className="border-rule flex gap-5 border-b py-6">
                <Link
                  href={`/item/${item.listing.item.slug}`}
                  className="bg-paper-3 relative aspect-[4/5] w-24 shrink-0 overflow-hidden"
                >
                  {image ? (
                    <Image
                      src={mediaUrl(image.storageKey)}
                      alt={image.alt}
                      fill
                      sizes="96px"
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
                  <h2 className="title-2 mt-1">{item.listing.item.title}</h2>
                  <p className="text-small text-ink-2 mt-2">
                    {formatDateRange({
                      start: toIsoDate(item.startDate),
                      end: toIsoDate(item.endDate),
                    })}
                    <span className="text-ink-3"> · {item.days} days</span>
                  </p>
                  <p className="meta text-ink-3 mt-1.5">
                    From {item.listing.owner.name} in {item.listing.city}
                  </p>
                </div>

                {/* The status of each row only says something when the rows
                    disagree. When every piece is confirmed, the eyebrow and the
                    headline have both said so already. */}
                {mixed ? (
                  <p className="meta text-ink-2 shrink-0">{describeStatus(item.status)}</p>
                ) : null}
              </li>
            );
          })}
        </ul>

        <dl className="mt-8 max-w-sm">
          <div className="border-rule flex justify-between gap-4 border-b py-2.5">
            <dt className="text-small text-ink-2">Charged today</dt>
            <dd className="numeric text-small text-ink">
              {formatMoney(money(rental.totalMinor, currency))}
            </dd>
          </div>
          {rental.depositMinor > 0 ? (
            <div className="border-rule flex justify-between gap-4 border-b py-2.5">
              <dt className="text-small text-ink-2">Refundable deposit within it</dt>
              <dd className="numeric text-small text-ink">
                {formatMoney(money(rental.depositMinor, currency))}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-12 flex flex-wrap items-start gap-3">
          <ButtonLink href="/account/rentals">See your rentals</ButtonLink>
          {ownPiece ? null : <MessageOwner listingId={first.listing.id} />}
        </div>

        {/* This used to promise a receipt by email. Nothing in the application
            sends one — `server/email` has no callers at all — so the sentence
            was telling members to watch for something that was never coming. */}
        <p className="meta border-rule text-ink-3 mt-10 border-t pt-6">
          Need to change something?{" "}
          <Link href="/account/rentals" className="link-underline text-ink-2">
            Manage this rental
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
