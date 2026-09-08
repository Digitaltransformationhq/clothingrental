import "server-only";

import { perDayRate } from "@/domain/rental/pricing";
import type { ImageRef } from "@/lib/media";

/**
 * The listing card view model.
 *
 * Every grid, rail and wishlist on the site renders this one shape. Defining it
 * — and the exact Prisma selection that produces it — in a single place means
 * a card cannot accidentally carry an owner's email address, and adding a field
 * to a card does not require touching six queries.
 */

/** The columns a card needs, and not one more. */
export const listingCardSelect = {
  id: true,
  currency: true,
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
  city: true,
  state: true,
  rentalCount: true,
  ratingAvgBps: true,
  ratingCount: true,
  ownerId: true,
  owner: {
    select: {
      name: true,
      profile: { select: { handle: true, isIdentityVerified: true } },
    },
  },
  item: {
    select: {
      slug: true,
      title: true,
      condition: true,
      gender: true,
      brand: { select: { name: true, slug: true, isDesigner: true } },
      category: { select: { name: true, slug: true } },
      size: { select: { label: true } },
      color: { select: { name: true, hex: true } },
      images: {
        orderBy: { position: "asc" as const },
        take: 2, // cover plus the one revealed on hover
        select: {
          storageKey: true,
          alt: true,
          width: true,
          height: true,
          blurDataUrl: true,
        },
      },
    },
  },
} as const;

export interface ListingCard {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly brand: string | null;
  readonly isDesigner: boolean;
  readonly category: string;
  readonly size: string;
  readonly colour: string;
  readonly colourHex: string;
  readonly condition: string;
  readonly city: string;

  readonly currency: string;
  readonly baseRateMinor: number;
  readonly baseDurationDays: number;
  readonly perDayMinor: number;
  readonly depositMinor: number;

  readonly instantBook: boolean;
  readonly rentalCount: number;
  readonly ratingAvgBps: number;
  readonly ratingCount: number;

  readonly ownerId: string;
  readonly ownerName: string;
  readonly ownerHandle: string | null;
  readonly ownerVerified: boolean;

  readonly images: ImageRef[];

  /** Policy, carried so a card can compute availability without another query. */
  readonly policy: {
    readonly minRentalDays: number;
    readonly maxRentalDays: number;
    readonly bufferDays: number;
    readonly leadTimeDays: number;
  };
}

type ListingCardRow = {
  id: string;
  currency: string;
  baseRateMinor: number;
  baseDurationDays: number;
  extraDayRateMinor: number;
  depositMinor: number;
  cleaningFeeMinor: number;
  deliveryFeeMinor: number;
  minRentalDays: number;
  maxRentalDays: number;
  bufferDays: number;
  leadTimeDays: number;
  instantBook: boolean;
  city: string;
  state: string;
  rentalCount: number;
  ratingAvgBps: number;
  ratingCount: number;
  ownerId: string;
  owner: {
    name: string;
    profile: { handle: string; isIdentityVerified: boolean } | null;
  };
  item: {
    slug: string;
    title: string;
    condition: string;
    gender: string;
    brand: { name: string; slug: string; isDesigner: boolean } | null;
    category: { name: string; slug: string };
    size: { label: string };
    color: { name: string; hex: string };
    images: Array<{
      storageKey: string;
      alt: string;
      width: number;
      height: number;
      blurDataUrl: string | null;
    }>;
  };
};

export function toListingCard(row: ListingCardRow): ListingCard {
  return {
    id: row.id,
    slug: row.item.slug,
    title: row.item.title,
    brand: row.item.brand?.name ?? null,
    isDesigner: row.item.brand?.isDesigner ?? false,
    category: row.item.category.name,
    size: row.item.size.label,
    colour: row.item.color.name,
    colourHex: row.item.color.hex,
    condition: row.item.condition,
    city: row.city,

    currency: row.currency,
    baseRateMinor: row.baseRateMinor,
    baseDurationDays: row.baseDurationDays,
    perDayMinor: perDayRate({
      currency: row.currency as "INR",
      baseRateMinor: row.baseRateMinor,
      baseDurationDays: row.baseDurationDays,
      extraDayRateMinor: row.extraDayRateMinor,
      depositMinor: row.depositMinor,
      cleaningFeeMinor: row.cleaningFeeMinor,
      deliveryFeeMinor: row.deliveryFeeMinor,
    }).amountMinor,
    depositMinor: row.depositMinor,

    instantBook: row.instantBook,
    rentalCount: row.rentalCount,
    ratingAvgBps: row.ratingAvgBps,
    ratingCount: row.ratingCount,

    ownerId: row.ownerId,
    ownerName: row.owner.name,
    ownerHandle: row.owner.profile?.handle ?? null,
    ownerVerified: row.owner.profile?.isIdentityVerified ?? false,

    images: row.item.images.map((image) => ({
      storageKey: image.storageKey,
      alt: image.alt,
      width: image.width,
      height: image.height,
      blurDataUrl: image.blurDataUrl,
    })),

    policy: {
      minRentalDays: row.minRentalDays,
      maxRentalDays: row.maxRentalDays,
      bufferDays: row.bufferDays,
      leadTimeDays: row.leadTimeDays,
    },
  };
}

/** Star rating as a number out of five, for display. */
export function ratingStars(ratingAvgBps: number): number {
  return Math.round((ratingAvgBps / 10_000) * 10) / 10;
}

const CONDITION_LABELS: Record<string, string> = {
  NEW_WITH_TAGS: "New, with tags",
  LIKE_NEW: "Like new",
  GENTLY_WORN: "Gently worn",
  WELL_LOVED: "Well loved",
};

export function conditionLabel(condition: string): string {
  return CONDITION_LABELS[condition] ?? condition;
}
