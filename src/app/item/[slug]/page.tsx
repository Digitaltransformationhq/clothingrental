import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatMoney, money } from "@/domain/money";
import { today } from "@/domain/dates";
import { availabilitySignal } from "@/domain/rental/availability";
import { ItemGallery } from "@/components/listing/item-gallery";
import { OwnerCard } from "@/components/listing/owner-card";
import { ListingReviews } from "@/components/listing/listing-reviews";
import { ListingSpecs } from "@/components/listing/listing-specs";
import { RentalPanel } from "@/components/rental/rental-panel";
import { StickyRentBar } from "@/components/rental/sticky-rent-bar";
import { ListingRail } from "@/components/listing/listing-rail";
import { WishlistButton } from "@/components/listing/wishlist-button";
import { Chip, Rating, SectionHead, StatusDot } from "@/components/ui/primitives";
import { conditionLabel } from "@/server/services/listing-view";
import {
  getListingBySlug,
  getListingsByOwner,
  getOccupancy,
  getRelatedListings,
  recordListingView,
} from "@/server/services/listings";
import { getActiveFeeSchedule } from "@/server/services/booking";
import { getListingReviews } from "@/server/services/reviews";
import { getCurrentUser } from "@/server/auth/session";
import { getSavedListingIds } from "@/server/actions/wishlist";
import { mediaUrl } from "@/lib/media";

/**
 * The listing page.
 *
 * An editorial commerce layout rather than the usual image-left / card-right:
 * the gallery takes nearly 60% of the measure and runs as a stacked column, and
 * the commercial panel sticks alongside it. Everything below the fold — the
 * description, the specification, the owner, the reviews — runs at a reading
 * width under the gallery column, so the page reads like an article once you
 * are past the decision.
 */

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) return { title: "Piece not found" };

  const brand = listing.item.brand?.name;
  const price = formatMoney(money(listing.baseRateMinor, listing.currency as "INR"));
  const cover = listing.item.images.find((image) => image.isCover) ?? listing.item.images[0];

  return {
    title: brand ? `${listing.item.title} by ${brand}` : listing.item.title,
    description: `Rent this ${listing.item.category.name.toLowerCase()} from ${price} for ${listing.baseDurationDays} days in ${listing.city}. ${listing.item.description.slice(0, 120)}`,
    alternates: { canonical: `/item/${slug}` },
    openGraph: {
      type: "website",
      title: `${listing.item.title} — to rent on Almirah`,
      description: `${price} / ${listing.baseDurationDays} days · ${listing.city}`,
      images: cover
        ? [{ url: mediaUrl(cover.storageKey), width: cover.width, height: cover.height }]
        : [],
    },
  };
}

export default async function ItemPage({ params }: { params: Params }) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) notFound();

  const [occupancy, fees, reviews, user, saved, alsoFromOwner, related] = await Promise.all([
    getOccupancy(listing.id),
    getActiveFeeSchedule(),
    getListingReviews(listing.id),
    getCurrentUser(),
    getSavedListingIds(),
    getListingsByOwner(listing.ownerId, { excludeListingId: listing.id, limit: 6 }),
    getRelatedListings({
      listingId: listing.id,
      occasionSlugs: listing.item.occasions.map((entry) => entry.occasion.slug),
      baseRateMinor: listing.baseRateMinor,
      ownerId: listing.ownerId,
      limit: 8,
    }),
  ]);

  // Fire and forget; a counter must never delay a page.
  void recordListingView(listing.id);

  const currentDate = today();
  const policy = {
    minRentalDays: listing.minRentalDays,
    maxRentalDays: listing.maxRentalDays,
    bufferDays: listing.bufferDays,
    leadTimeDays: listing.leadTimeDays,
  };
  const signal = availabilitySignal({ policy, occupancy, today: currentDate });

  const pricing = {
    currency: listing.currency as "INR",
    baseRateMinor: listing.baseRateMinor,
    baseDurationDays: listing.baseDurationDays,
    extraDayRateMinor: listing.extraDayRateMinor,
    depositMinor: listing.depositMinor,
    cleaningFeeMinor: listing.cleaningFeeMinor,
    deliveryFeeMinor: listing.deliveryFeeMinor,
  };

  const isOwnListing = user?.id === listing.ownerId;
  const retail = listing.item.retailPriceMinor;

  return (
    <>
      {/* Structured data. A rental has a price and availability like any other
          offer, and describing it properly is what earns a rich result. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildProductSchema(listing, signal.signal)),
        }}
      />

      <div className="page-gutter pt-6 pb-24 sm:pt-10">
        <div className="page-width">
          <Breadcrumbs listing={listing} />

          {/*
            Three blocks in source order — gallery, the commercial panel, then
            the written half. That order is what a phone gets, and it is the
            right one: photograph, what it is, what it costs, when you can have
            it, and only then the reading.

            On desktop the same three are placed explicitly on a two-column
            grid, so the panel can sit alongside the gallery and stick while the
            description scrolls past it. Ordering for mobile and placing for
            desktop, rather than one compromise serving both.
          */}
          <div className="mt-6 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_23rem] lg:grid-rows-[auto_1fr] xl:grid-cols-[minmax(0,1fr)_25rem]">
            {/* ── Gallery ─────────────────────────────────────────────── */}
            <div className="lg:col-start-1 lg:row-start-1">
              <div className="relative -mx-5 sm:mx-0">
                <ItemGallery
                  images={listing.item.images.map((image) => ({
                    storageKey: image.storageKey,
                    alt: image.alt,
                    width: image.width,
                    height: image.height,
                    blurDataUrl: image.blurDataUrl,
                  }))}
                  title={listing.item.title}
                />
              </div>
            </div>

            {/* ── Commercial panel ────────────────────────────────────── */}
            <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <div className="lg:sticky lg:top-28">
                <header className="mb-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      {listing.item.brand ? (
                        <Link
                          href={`/shop?brand=${listing.item.brand.slug}`}
                          className="link-underline label text-ink-2"
                        >
                          {listing.item.brand.name}
                        </Link>
                      ) : null}
                      <h1 className="display-3 mt-2.5">{listing.item.title}</h1>
                    </div>
                    <WishlistButton
                      listingId={listing.id}
                      title={listing.item.title}
                      initialSaved={saved.has(listing.id)}
                      size="lg"
                      className="-mr-2 shrink-0 opacity-100"
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Rating value={listing.ratingAvgBps / 10_000} count={listing.ratingCount} />
                    {listing.rentalCount > 0 ? (
                      <span className="meta text-ink-3">
                        Rented {listing.rentalCount} {listing.rentalCount === 1 ? "time" : "times"}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Chip>{conditionLabel(listing.item.condition)}</Chip>
                    <Chip>
                      {listing.item.size.label === "Free size"
                        ? "Free size"
                        : `Size ${listing.item.size.label}`}
                    </Chip>
                    {/* The retail price is stated as a fact, not as a discount.
                        "95% below retail" compares a three-day rental to owning
                        the thing outright, which is true, meaningless, and
                        precisely the sort of claim that costs a marketplace its
                        credibility. Members can draw their own conclusion. */}
                    {retail ? (
                      <Chip>
                        Retails at {formatMoney(money(retail, listing.currency as "INR"))}
                      </Chip>
                    ) : null}
                  </div>

                  <p className="meta text-ink-2 mt-4 flex items-center gap-2">
                    <StatusDot
                      tone={
                        signal.signal === "AVAILABLE_NOW"
                          ? "positive"
                          : signal.signal === "AVAILABLE_SOON"
                            ? "caution"
                            : "critical"
                      }
                    />
                    {signal.signal === "AVAILABLE_NOW"
                      ? "Available now"
                      : signal.from
                        ? `Next free from ${signal.from.split("-").reverse().slice(0, 2).join("/")}`
                        : "Heavily booked"}
                    <span aria-hidden="true">·</span>
                    {listing.city}
                  </p>
                </header>

                <RentalPanel
                  listingId={listing.id}
                  pricing={pricing}
                  policy={policy}
                  occupancy={occupancy}
                  fees={fees}
                  today={currentDate}
                  fulfilmentOptions={listing.fulfilment}
                  instantBook={listing.instantBook}
                  isOwnListing={isOwnListing}
                />
              </div>
            </div>

            {/* ── The written half ────────────────────────────────────── */}
            <div className="lg:col-start-1 lg:row-start-2">
              <div className="max-w-[62ch]">
                <h2 className="title-1">About this piece</h2>
                <p className="body-lg text-ink mt-5 whitespace-pre-line">
                  {listing.item.description}
                </p>

                {listing.rentalTerms ? (
                  <div className="border-rule-strong mt-8 border-l-2 pl-5">
                    <p className="label text-ink-3 mb-2">The owner asks</p>
                    <p className="text-body text-ink-2">{listing.rentalTerms}</p>
                  </div>
                ) : null}
              </div>

              <ListingSpecs listing={listing} className="mt-14 max-w-[62ch]" />

              <OwnerCard
                owner={listing.owner}
                ownerId={listing.ownerId}
                listingCity={listing.city}
                className="mt-14 max-w-[62ch]"
              />

              <ListingReviews
                reviews={reviews}
                ratingAvgBps={listing.ratingAvgBps}
                ratingCount={listing.ratingCount}
                className="mt-14 max-w-[62ch]"
              />
            </div>
          </div>

          {/* ── More from this wardrobe ─────────────────────────────────── */}
          {alsoFromOwner.length > 0 ? (
            <section className="mt-24" aria-labelledby="owner-more">
              <SectionHead
                eyebrow={`From ${listing.owner.name.split(" ")[0]}'s wardrobe`}
                title="More from this cupboard"
                headingLevel="h2"
              />
              <div className="mt-8">
                <ListingRail listings={alsoFromOwner} headingId="owner-more" />
              </div>
            </section>
          ) : null}

          {related.length > 0 ? (
            <section className="mt-20" aria-labelledby="related">
              <SectionHead
                eyebrow="Goes with this"
                title="For the same evening"
                headingLevel="h2"
              />
              <div className="mt-8">
                <ListingRail listings={related} headingId="related" />
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {/* On a phone the panel is far down the page, so the action follows. */}
      <StickyRentBar
        priceMinor={listing.baseRateMinor}
        currency={listing.currency}
        days={listing.baseDurationDays}
        instantBook={listing.instantBook}
        hidden={isOwnListing}
      />
    </>
  );
}

function Breadcrumbs({
  listing,
}: {
  listing: NonNullable<Awaited<ReturnType<typeof getListingBySlug>>>;
}) {
  const trail = [
    { href: "/shop", label: "Shop" },
    { href: `/shop/${listing.item.category.slug}`, label: listing.item.category.name },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              ...trail.map((crumb, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: crumb.label,
                item: crumb.href,
              })),
              {
                "@type": "ListItem",
                position: trail.length + 1,
                name: listing.item.title,
              },
            ],
          }),
        }}
      />
      <nav aria-label="Breadcrumb">
        <ol className="meta text-ink-3 flex flex-wrap items-center gap-2">
          {trail.map((crumb) => (
            <li key={crumb.href} className="flex items-center gap-2">
              <Link href={crumb.href} className="link-underline text-ink-2">
                {crumb.label}
              </Link>
              <span aria-hidden="true">/</span>
            </li>
          ))}
          <li aria-current="page" className="text-ink-3 truncate">
            {listing.item.title}
          </li>
        </ol>
      </nav>
    </>
  );
}

function buildProductSchema(
  listing: NonNullable<Awaited<ReturnType<typeof getListingBySlug>>>,
  signal: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.item.title,
    description: listing.item.description,
    sku: listing.item.slug,
    image: listing.item.images.map((image) => mediaUrl(image.storageKey)),
    ...(listing.item.brand && { brand: { "@type": "Brand", name: listing.item.brand.name } }),
    color: listing.item.color.name,
    size: listing.item.size.label,
    material: listing.item.fabric ?? undefined,
    offers: {
      "@type": "Offer",
      // The rental rate for the base period, which is what the page quotes.
      price: (listing.baseRateMinor / 100).toFixed(2),
      priceCurrency: listing.currency,
      availability:
        signal === "HEAVILY_BOOKED"
          ? "https://schema.org/LimitedAvailability"
          : "https://schema.org/InStock",
      businessFunction: "https://schema.org/LeaseOut",
      areaServed: listing.city,
    },
    ...(listing.ratingCount > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: (listing.ratingAvgBps / 10_000).toFixed(1),
        reviewCount: listing.ratingCount,
        bestRating: 5,
      },
    }),
  };
}
