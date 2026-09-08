import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ListingWizard } from "@/components/sell/listing-wizard";
import { Eyebrow } from "@/components/ui/primitives";
import { loadTaxonomy } from "@/app/sell/new/page";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = {
  title: "Edit listing",
  robots: { index: false, follow: false },
};

type Params = Promise<{ id: string }>;

/**
 * Editing a listing.
 *
 * The same wizard as creating one, loaded with the existing values. Reusing it
 * rather than writing a separate edit form is what stops the two drifting —
 * a field added to the wizard is editable immediately, and validation cannot
 * differ between the two paths.
 *
 * Saving sends the listing back through moderation, which is stated on the page
 * rather than discovered afterwards.
 */
export default async function EditListingPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requireUser(`/sell/${id}/edit`);
  const db = await getDb();

  // Scoped by ownerId: another member's listing id simply does not resolve.
  const listing = await db.listing.findFirst({
    where: { id, ownerId: user.id },
    select: {
      id: true,
      status: true,
      moderation: true,
      moderationNote: true,
      baseRateMinor: true,
      baseDurationDays: true,
      extraDayRateMinor: true,
      depositMinor: true,
      cleaningFeeMinor: true,
      deliveryFeeMinor: true,
      minRentalDays: true,
      maxRentalDays: true,
      bufferDays: true,
      leadTimeDays: true,
      instantBook: true,
      fulfilment: true,
      city: true,
      state: true,
      rentalTerms: true,
      item: {
        select: {
          title: true,
          description: true,
          gender: true,
          condition: true,
          fabric: true,
          careInstructions: true,
          retailPriceMinor: true,
          bustMm: true,
          waistMm: true,
          hipMm: true,
          lengthMm: true,
          shoulderMm: true,
          sleeveMm: true,
          brand: { select: { slug: true } },
          category: { select: { slug: true } },
          size: { select: { slug: true } },
          color: { select: { slug: true } },
          occasions: { select: { occasion: { select: { slug: true } } } },
          images: {
            orderBy: { position: "asc" },
            select: { storageKey: true, width: true, height: true, blurDataUrl: true, alt: true },
          },
        },
      },
    },
  });

  if (!listing) notFound();

  const taxonomy = await loadTaxonomy();
  const mmToCm = (value: number | null) => (value === null ? undefined : Math.round(value / 10));

  return (
    <div className="page-gutter pt-10 pb-24 sm:pt-14">
      <div className="page-width max-w-6xl">
        <header className="mb-12 max-w-2xl">
          <Eyebrow className="mb-4">Editing</Eyebrow>
          <h1 className="display-2">{listing.item.title}</h1>
          <p className="body-lg mt-4">
            Changes go back through review before they appear, which usually takes a few hours. Any
            confirmed bookings are unaffected.
          </p>

          {listing.moderation === "REJECTED" && listing.moderationNote ? (
            <div className="border-caution bg-caution-soft mt-6 border-l-2 px-4 py-3">
              <p className="label text-ink-2 mb-1">What we asked for</p>
              <p className="text-small text-ink">{listing.moderationNote}</p>
            </div>
          ) : null}
        </header>

        <ListingWizard
          taxonomy={taxonomy}
          listingId={listing.id}
          initial={{
            photos: listing.item.images.map((image) => ({
              storageKey: image.storageKey,
              width: image.width,
              height: image.height,
              blurDataUrl: image.blurDataUrl ?? undefined,
              alt: image.alt,
            })),
            title: listing.item.title,
            categorySlug: listing.item.category.slug,
            brandSlug: listing.item.brand?.slug,
            gender: listing.item.gender,
            description: listing.item.description,
            condition: listing.item.condition,
            colourSlug: listing.item.color.slug,
            occasionSlugs: listing.item.occasions.map((entry) => entry.occasion.slug),
            fabric: listing.item.fabric ?? undefined,
            careInstructions: listing.item.careInstructions ?? undefined,
            retailPriceRupees: listing.item.retailPriceMinor
              ? Math.round(listing.item.retailPriceMinor / 100)
              : undefined,
            sizeSlug: listing.item.size.slug,
            bustCm: mmToCm(listing.item.bustMm),
            waistCm: mmToCm(listing.item.waistMm),
            hipCm: mmToCm(listing.item.hipMm),
            lengthCm: mmToCm(listing.item.lengthMm),
            shoulderCm: mmToCm(listing.item.shoulderMm),
            sleeveCm: mmToCm(listing.item.sleeveMm),
            baseRateRupees: Math.round(listing.baseRateMinor / 100),
            baseDurationDays: listing.baseDurationDays,
            extraDayRateRupees: Math.round(listing.extraDayRateMinor / 100),
            depositRupees: Math.round(listing.depositMinor / 100),
            cleaningFeeRupees: listing.cleaningFeeMinor
              ? Math.round(listing.cleaningFeeMinor / 100)
              : undefined,
            minRentalDays: listing.minRentalDays,
            maxRentalDays: listing.maxRentalDays,
            bufferDays: listing.bufferDays,
            leadTimeDays: listing.leadTimeDays,
            instantBook: listing.instantBook,
            fulfilment: listing.fulfilment,
            deliveryFeeRupees: listing.deliveryFeeMinor
              ? Math.round(listing.deliveryFeeMinor / 100)
              : undefined,
            city: listing.city,
            state: listing.state,
            rentalTerms: listing.rentalTerms ?? undefined,
          }}
        />
      </div>
    </div>
  );
}
