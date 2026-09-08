"use server";

import { revalidatePath } from "next/cache";

import { listingDraftRefined, type ListingDraft } from "@/domain/listing/draft";
import { requireUserOrThrow } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { type ActionResult, errors, guard } from "@/server/errors";
import { checkRateLimit } from "@/server/rate-limit";

/**
 * Listing actions.
 *
 * Creating a listing is the one place a member writes content that other people
 * will see, so it is also the one place content moderation and abuse controls
 * belong. A new listing enters PENDING_REVIEW, not PUBLISHED — the database
 * itself refuses to publish an unapproved listing, so this is enforced twice.
 */

/** URL-safe, unique, and readable: `black-satin-midi-dress-k4p2`. */
function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "piece"}-${suffix}`;
}

const cmToMm = (value: number | undefined) => (value === undefined ? undefined : value * 10);
const rupeesToPaise = (value: number | undefined) => (value === undefined ? 0 : value * 100);

export async function createListing(
  input: ListingDraft,
): Promise<ActionResult<{ listingId: string; slug: string }>> {
  return guard(async () => {
    const user = await requireUserOrThrow();
    await checkRateLimit({
      key: `listing:${user.id}`,
      limit: 10,
      windowSeconds: 3600,
      message: "That's a lot of listings in one hour. Take a breath and try again shortly.",
    });

    const draft = listingDraftRefined.parse(input);
    const db = await getDb();

    // Taxonomy is resolved from slugs the client sent, and each must exist.
    // Passing an id straight through would let a crafted request attach a
    // listing to anything.
    const [category, size, colour, brand, occasions] = await Promise.all([
      db.category.findUnique({ where: { slug: draft.categorySlug }, select: { id: true } }),
      db.size.findUnique({ where: { slug: draft.sizeSlug }, select: { id: true } }),
      db.color.findUnique({ where: { slug: draft.colourSlug }, select: { id: true } }),
      draft.brandSlug
        ? db.brand.findUnique({ where: { slug: draft.brandSlug }, select: { id: true } })
        : Promise.resolve(null),
      db.occasion.findMany({ where: { slug: { in: draft.occasionSlugs } }, select: { id: true } }),
    ]);

    if (!category)
      throw errors.validation("That category no longer exists.", {
        categorySlug: "Choose a category",
      });
    if (!size)
      throw errors.validation("That size no longer exists.", { sizeSlug: "Choose a size" });
    if (!colour)
      throw errors.validation("That colour no longer exists.", { colourSlug: "Choose a colour" });

    const listing = await db.$transaction(async (tx) => {
      const item = await tx.clothingItem.create({
        data: {
          ownerId: user.id,
          slug: slugify(draft.title),
          title: draft.title,
          description: draft.description,
          categoryId: category.id,
          sizeId: size.id,
          colorId: colour.id,
          brandId: brand?.id,
          gender: draft.gender,
          condition: draft.condition,
          retailPriceMinor: draft.retailPriceRupees ? draft.retailPriceRupees * 100 : null,
          fabric: draft.fabric,
          careInstructions: draft.careInstructions,
          bustMm: cmToMm(draft.bustCm),
          waistMm: cmToMm(draft.waistCm),
          hipMm: cmToMm(draft.hipCm),
          lengthMm: cmToMm(draft.lengthCm),
          shoulderMm: cmToMm(draft.shoulderCm),
          sleeveMm: cmToMm(draft.sleeveCm),
          images: {
            create: draft.photos.map((photo, index) => ({
              storageKey: photo.storageKey,
              alt: photo.alt?.slice(0, 200) || `${draft.title} — view ${index + 1}`,
              width: photo.width,
              height: photo.height,
              blurDataUrl: photo.blurDataUrl,
              position: index,
              isCover: index === 0,
            })),
          },
          occasions: { create: occasions.map((occasion) => ({ occasionId: occasion.id })) },
        },
        select: { id: true, slug: true },
      });

      const created = await tx.listing.create({
        data: {
          itemId: item.id,
          ownerId: user.id,
          // Never PUBLISHED directly. A database check constraint enforces the
          // same rule, so this cannot be bypassed by another code path.
          status: "PENDING_REVIEW",
          moderation: "PENDING",
          currency: "INR",
          baseRateMinor: rupeesToPaise(draft.baseRateRupees),
          baseDurationDays: draft.baseDurationDays,
          extraDayRateMinor: rupeesToPaise(draft.extraDayRateRupees),
          depositMinor: rupeesToPaise(draft.depositRupees),
          cleaningFeeMinor: rupeesToPaise(draft.cleaningFeeRupees),
          minRentalDays: draft.minRentalDays,
          maxRentalDays: draft.maxRentalDays,
          bufferDays: draft.bufferDays,
          leadTimeDays: draft.leadTimeDays,
          instantBook: draft.instantBook,
          fulfilment: draft.fulfilment,
          deliveryFeeMinor: rupeesToPaise(draft.deliveryFeeRupees),
          city: draft.city,
          state: draft.state,
          country: "IN",
          rentalTerms: draft.rentalTerms,
        },
        select: { id: true },
      });

      return { listingId: created.id, slug: item.slug };
    });

    revalidatePath("/account/listings");
    return listing;
  });
}

export async function updateListing(
  input: ListingDraft & { listingId: string },
): Promise<ActionResult<{ listingId: string }>> {
  return guard(async () => {
    const user = await requireUserOrThrow();
    const draft = listingDraftRefined.parse(input);
    const db = await getDb();

    // Scoped by ownerId: a listing id belonging to somebody else finds nothing.
    const existing = await db.listing.findFirst({
      where: { id: input.listingId, ownerId: user.id },
      select: { id: true, itemId: true, status: true },
    });
    if (!existing) throw errors.notFound("listing");

    const [category, size, colour, brand, occasions] = await Promise.all([
      db.category.findUnique({ where: { slug: draft.categorySlug }, select: { id: true } }),
      db.size.findUnique({ where: { slug: draft.sizeSlug }, select: { id: true } }),
      db.color.findUnique({ where: { slug: draft.colourSlug }, select: { id: true } }),
      draft.brandSlug
        ? db.brand.findUnique({ where: { slug: draft.brandSlug }, select: { id: true } })
        : Promise.resolve(null),
      db.occasion.findMany({ where: { slug: { in: draft.occasionSlugs } }, select: { id: true } }),
    ]);

    if (!category || !size || !colour)
      throw errors.validation("Some of those options no longer exist.");

    await db.$transaction(async (tx) => {
      await tx.clothingItem.update({
        where: { id: existing.itemId },
        data: {
          title: draft.title,
          description: draft.description,
          categoryId: category.id,
          sizeId: size.id,
          colorId: colour.id,
          brandId: brand?.id ?? null,
          gender: draft.gender,
          condition: draft.condition,
          retailPriceMinor: draft.retailPriceRupees ? draft.retailPriceRupees * 100 : null,
          fabric: draft.fabric,
          careInstructions: draft.careInstructions,
          bustMm: cmToMm(draft.bustCm),
          waistMm: cmToMm(draft.waistCm),
          hipMm: cmToMm(draft.hipCm),
          lengthMm: cmToMm(draft.lengthCm),
          shoulderMm: cmToMm(draft.shoulderCm),
          sleeveMm: cmToMm(draft.sleeveCm),
        },
      });

      // Photographs are replaced wholesale: reordering, deleting and adding all
      // arrive as one new ordered list, and reconciling that in place is more
      // code and more ways to be wrong.
      await tx.clothingImage.deleteMany({ where: { itemId: existing.itemId } });
      await tx.clothingImage.createMany({
        data: draft.photos.map((photo, index) => ({
          itemId: existing.itemId,
          storageKey: photo.storageKey,
          alt: photo.alt?.slice(0, 200) || `${draft.title} — view ${index + 1}`,
          width: photo.width,
          height: photo.height,
          blurDataUrl: photo.blurDataUrl,
          position: index,
          isCover: index === 0,
        })),
      });

      await tx.itemOccasion.deleteMany({ where: { itemId: existing.itemId } });
      await tx.itemOccasion.createMany({
        data: occasions.map((occasion) => ({ itemId: existing.itemId, occasionId: occasion.id })),
      });

      await tx.listing.update({
        where: { id: existing.id },
        data: {
          baseRateMinor: rupeesToPaise(draft.baseRateRupees),
          baseDurationDays: draft.baseDurationDays,
          extraDayRateMinor: rupeesToPaise(draft.extraDayRateRupees),
          depositMinor: rupeesToPaise(draft.depositRupees),
          cleaningFeeMinor: rupeesToPaise(draft.cleaningFeeRupees),
          minRentalDays: draft.minRentalDays,
          maxRentalDays: draft.maxRentalDays,
          bufferDays: draft.bufferDays,
          leadTimeDays: draft.leadTimeDays,
          instantBook: draft.instantBook,
          fulfilment: draft.fulfilment,
          deliveryFeeMinor: rupeesToPaise(draft.deliveryFeeRupees),
          city: draft.city,
          state: draft.state,
          rentalTerms: draft.rentalTerms,
          // A previously rejected listing goes back into the queue when it is
          // edited, rather than staying rejected forever.
          ...(existing.status === "ARCHIVED"
            ? {}
            : { status: "PENDING_REVIEW", moderation: "PENDING", moderationNote: null }),
        },
      });
    });

    revalidatePath("/account/listings");
    revalidatePath(`/item/${input.listingId}`);
    return { listingId: existing.id };
  });
}

/** Takes a listing out of circulation without deleting its history. */
export async function pauseListing(input: { listingId: string }): Promise<ActionResult<void>> {
  return guard(async () => {
    const user = await requireUserOrThrow();
    const db = await getDb();

    const updated = await db.listing.updateMany({
      where: { id: input.listingId, ownerId: user.id, status: "PUBLISHED" },
      data: { status: "PAUSED" },
    });
    if (updated.count === 0) throw errors.notFound("listing");

    revalidatePath("/account/listings");
  });
}

export async function resumeListing(input: { listingId: string }): Promise<ActionResult<void>> {
  return guard(async () => {
    const user = await requireUserOrThrow();
    const db = await getDb();

    // Only a listing that was approved may return to PUBLISHED — otherwise
    // pausing would be a way around moderation.
    const listing = await db.listing.findFirst({
      where: { id: input.listingId, ownerId: user.id, status: "PAUSED" },
      select: { id: true, moderation: true },
    });
    if (!listing) throw errors.notFound("listing");

    await db.listing.update({
      where: { id: listing.id },
      data:
        listing.moderation === "APPROVED"
          ? { status: "PUBLISHED", publishedAt: new Date() }
          : { status: "PENDING_REVIEW" },
    });

    revalidatePath("/account/listings");
  });
}
