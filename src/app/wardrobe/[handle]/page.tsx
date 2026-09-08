import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { formatDateLong, toIsoDate } from "@/domain/dates";
import { ListingTile } from "@/components/listing/listing-tile";
import { Eyebrow, EmptyState, Rating } from "@/components/ui/primitives";
import { IMAGE_SIZES, initialsAvatar } from "@/lib/media";
import { getDb } from "@/server/db/client";
import { listingCardSelect, toListingCard } from "@/server/services/listing-view";
import { PUBLIC_LISTING_WHERE } from "@/server/services/listings";

type Params = Promise<{ handle: string }>;

async function loadWardrobe(handle: string) {
  const db = await getDb();

  return db.profile.findUnique({
    where: { handle },
    select: {
      handle: true,
      bio: true,
      city: true,
      state: true,
      ratingAvgBps: true,
      ratingCount: true,
      rentalsHosted: true,
      rentalsTaken: true,
      responseRateBps: true,
      responseMins: true,
      isIdentityVerified: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          status: true,
          listings: {
            where: PUBLIC_LISTING_WHERE,
            orderBy: { publishedAt: "desc" },
            select: listingCardSelect,
          },
        },
      },
    },
  });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { handle } = await params;
  const wardrobe = await loadWardrobe(handle);
  if (!wardrobe) return { title: "Not found" };

  return {
    title: `${wardrobe.user.name}'s wardrobe`,
    description:
      wardrobe.bio ??
      `${wardrobe.user.listings.length} pieces to rent from ${wardrobe.user.name} in ${wardrobe.city ?? "India"}.`,
    alternates: { canonical: `/wardrobe/${handle}` },
  };
}

/**
 * A member's public wardrobe.
 *
 * The page that makes the marketplace two-sided rather than a shop with extra
 * steps. It carries only what is safe in public — no email, no address, no
 * rental history beyond counts — and a suspended member's wardrobe is not
 * reachable at all.
 */
export default async function WardrobePage({ params }: { params: Params }) {
  const { handle } = await params;
  const wardrobe = await loadWardrobe(handle);

  if (!wardrobe || wardrobe.user.status !== "ACTIVE") notFound();

  const listings = wardrobe.user.listings.map(toListingCard);

  return (
    <div className="page-gutter pt-12 pb-24 sm:pt-16">
      <div className="page-width">
        <header className="border-rule flex flex-wrap items-start gap-6 border-b pb-10">
          <span className="border-rule relative h-20 w-20 shrink-0 overflow-hidden rounded-full border">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URI avatar */}
            <img
              src={wardrobe.user.image ?? initialsAvatar(wardrobe.user.name, 340)}
              alt=""
              width={80}
              height={80}
              className="h-full w-full object-cover"
            />
          </span>

          <div className="min-w-0 flex-1">
            <Eyebrow className="mb-3">The wardrobe of</Eyebrow>
            <h1 className="display-3">{wardrobe.user.name}</h1>

            <p className="meta text-ink-2 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              {wardrobe.city ? <span>{wardrobe.city}</span> : null}
              {wardrobe.isIdentityVerified ? (
                <span className="text-positive">Verified wardrobe</span>
              ) : (
                <span className="text-ink-3">Identity not verified</span>
              )}
              <Rating value={wardrobe.ratingAvgBps / 10_000} count={wardrobe.ratingCount} />
              <span>Joined {formatDateLong(toIsoDate(wardrobe.joinedAt))}</span>
            </p>

            {wardrobe.bio ? (
              <p className="body-lg text-ink mt-5 max-w-prose">{wardrobe.bio}</p>
            ) : null}

            <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
              {[
                {
                  value: String(listings.length),
                  label: listings.length === 1 ? "piece listed" : "pieces listed",
                },
                { value: String(wardrobe.rentalsHosted), label: "rentals hosted" },
                ...(wardrobe.responseRateBps
                  ? [
                      {
                        value: `${Math.round(wardrobe.responseRateBps / 100)}%`,
                        label: "reply rate",
                      },
                    ]
                  : []),
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="numeric font-display block text-[1.5rem] leading-none">
                      {stat.value}
                    </span>
                    <span className="meta text-ink-3 mt-1.5 block">{stat.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </header>

        {listings.length === 0 ? (
          <EmptyState
            title="Nothing listed just now."
            body={`${wardrobe.user.name.split(" ")[0]} hasn't any pieces available at the moment. Try again in a week.`}
            className="border-t-0"
          />
        ) : (
          <ul className="mt-12 grid grid-cols-2 gap-x-5 gap-y-12 sm:grid-cols-3 sm:gap-x-6 xl:grid-cols-4">
            {listings.map((listing, index) => (
              <li key={listing.id}>
                <ListingTile
                  listing={listing}
                  sizes={IMAGE_SIZES.grid}
                  priority={index < 4}
                  showOwner={false}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
