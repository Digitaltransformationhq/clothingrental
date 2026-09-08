/**
 * Seeds the marketplace.
 *
 * Produces a catalogue that behaves like a marketplace that has been running
 * for a while: fifty-one garments across fourteen wardrobes, rentals in every
 * state the dashboards render, reviews written by the people who actually took
 * those rentals, message threads attached to real bookings, and earnings that
 * reconcile against the commission on each line.
 *
 * The seed is idempotent — it clears the tables it owns and rewrites them — and
 * refuses to run against a production database.
 *
 *   npm run db:seed
 */

import { createHash } from "node:crypto";

import { addDays, toUtcDate, today as todayIso, type IsoDate } from "../src/domain/dates";
import { quoteRental, DEFAULT_FEE_SCHEDULE } from "../src/domain/rental/pricing";
import { SEED_GARMENTS } from "../src/server/seed/catalogue";
import { FEATURED_WARDROBES, SEED_PASSWORD, SEED_PEOPLE } from "../src/server/seed/people";
import { garmentImageKeys, GARMENT_FRAME } from "../src/server/seed/photography-plan";
import {
  SEED_BRANDS,
  SEED_CATEGORIES,
  SEED_COLORS,
  SEED_OCCASIONS,
  SEED_SIZES,
} from "../src/server/seed/taxonomy";

/**
 * Deterministic pseudo-randomness. The catalogue must look organic — varied
 * ratings, staggered join dates, rentals scattered across the calendar — while
 * producing identical output on every run, so that screenshots, tests and
 * review all see the same marketplace.
 */
function seededRandom(seed: string) {
  let state = parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16);
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const pick = <T>(random: () => number, items: readonly T[]): T =>
  items[Math.floor(random() * items.length) % items.length];

/**
 * A tiny inline preview for each photograph.
 *
 * Derived from the garment's colour rather than rasterised from the frame:
 * it costs nothing, it is deterministic, and a blur placeholder only ever needs
 * to carry the right tonal range — it is displayed at a few pixels wide behind
 * a heavy blur.
 */
function blurPlaceholder(hex: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="10">` +
    `<rect width="8" height="10" fill="${hex}"/>` +
    `<rect width="8" height="4" fill="#ffffff" opacity="0.16"/>` +
    `<rect y="7" width="8" height="3" fill="#000000" opacity="0.18"/>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const TODAY: IsoDate = todayIso();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to seed a production database. The seed creates accounts with a shared, published password.",
    );
  }

  const { getDb } = await import("../src/server/db/client");
  const db = await getDb();

  console.log("→ clearing existing catalogue");

  // Order matters: children before parents. Cascades would handle most of this,
  // but being explicit means a change to a relation cannot silently orphan rows.
  await db.$transaction([
    db.bookingTransition.deleteMany(),
    db.payoutItem.deleteMany(),
    db.payout.deleteMany(),
    db.refund.deleteMany(),
    db.payment.deleteMany(),
    db.securityDeposit.deleteMany(),
    db.damageReport.deleteMany(),
    db.dispute.deleteMany(),
    db.review.deleteMany(),
    db.delivery.deleteMany(),
    db.rentalItem.deleteMany(),
    db.rental.deleteMany(),
    db.message.deleteMany(),
    db.conversationMember.deleteMany(),
    db.conversation.deleteMany(),
    db.notification.deleteMany(),
    db.report.deleteMany(),
    db.auditLog.deleteMany(),
    db.wishlistItem.deleteMany(),
    db.wishlist.deleteMany(),
    db.collectionListing.deleteMany(),
    db.collection.deleteMany(),
    db.availabilityBlock.deleteMany(),
    db.listing.deleteMany(),
    db.clothingImage.deleteMany(),
    db.itemOccasion.deleteMany(),
    db.clothingItem.deleteMany(),
    db.identityVerification.deleteMany(),
    db.address.deleteMany(),
    db.payoutAccount.deleteMany(),
    db.profile.deleteMany(),
    db.session.deleteMany(),
    db.account.deleteMany(),
    db.verification.deleteMany(),
    db.user.deleteMany(),
    db.itemOccasion.deleteMany(),
    db.occasion.deleteMany(),
    db.color.deleteMany(),
    db.size.deleteMany(),
    db.brand.deleteMany(),
    db.category.deleteMany(),
    db.platformFee.deleteMany(),
  ]);

  // ── Commercial terms ──────────────────────────────────────────────────────
  console.log("→ fee schedule");
  await db.platformFee.create({
    data: {
      key: "standard",
      name: "Standard marketplace terms",
      commissionBps: DEFAULT_FEE_SCHEDULE.commissionBps,
      serviceFeeBps: DEFAULT_FEE_SCHEDULE.serviceFeeBps,
      taxBps: DEFAULT_FEE_SCHEDULE.taxBps,
      minFeeMinor: DEFAULT_FEE_SCHEDULE.minFeeMinor,
      isDefault: true,
    },
  });

  // ── Taxonomy ──────────────────────────────────────────────────────────────
  console.log("→ taxonomy");

  const categoryIds = new Map<string, string>();
  for (const category of SEED_CATEGORIES.filter((entry) => !entry.parent)) {
    const created = await db.category.create({
      data: {
        slug: category.slug,
        name: category.name,
        tagline: category.tagline,
        sortOrder: category.sortOrder,
      },
    });
    categoryIds.set(category.slug, created.id);
  }
  for (const category of SEED_CATEGORIES.filter((entry) => entry.parent)) {
    const created = await db.category.create({
      data: {
        slug: category.slug,
        name: category.name,
        tagline: category.tagline,
        sortOrder: category.sortOrder,
        parentId: categoryIds.get(category.parent as string),
        heroKey: `occasion-${category.slug}`,
      },
    });
    categoryIds.set(category.slug, created.id);
  }

  const brandIds = new Map<string, string>();
  for (const brand of SEED_BRANDS) {
    const created = await db.brand.create({ data: brand });
    brandIds.set(brand.slug, created.id);
  }

  const sizeIds = new Map<string, string>();
  for (const size of SEED_SIZES) {
    const created = await db.size.create({ data: size });
    sizeIds.set(size.slug, created.id);
  }

  const colorIds = new Map<string, string>();
  const colorHex = new Map<string, string>();
  for (const colour of SEED_COLORS) {
    const created = await db.color.create({ data: colour });
    colorIds.set(colour.slug, created.id);
    colorHex.set(colour.slug, colour.hex);
  }

  const occasionIds = new Map<string, string>();
  for (const occasion of SEED_OCCASIONS) {
    const created = await db.occasion.create({
      data: { ...occasion, heroKey: `occasion-${occasion.slug}` },
    });
    occasionIds.set(occasion.slug, created.id);
  }

  // ── People ────────────────────────────────────────────────────────────────
  console.log(`→ ${SEED_PEOPLE.length} members`);

  // Hashed with the same function the auth layer uses, and keyed with the same
  // issuer helper, so seeded accounts sign in through the real sign-in path
  // rather than through a special case. Deriving the issuer rather than
  // hardcoding "local:credential" means a change in the auth library cannot
  // silently leave every seeded account unable to sign in.
  const { hashPassword } = await import("better-auth/crypto");
  const { createLocalAccountIssuer } = await import("@better-auth/core/db");
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const credentialIssuer = createLocalAccountIssuer("credential");

  const userIds = new Map<string, string>();
  for (const person of SEED_PEOPLE) {
    const joinedAt = new Date(Date.now() - person.joinedMonthsAgo * 30 * 86_400_000);

    const user = await db.user.create({
      data: {
        email: person.email,
        emailVerified: true,
        name: person.name,
        role: person.role ?? "MEMBER",
        status: "ACTIVE",
        createdAt: joinedAt,
        profile: {
          create: {
            handle: person.handle,
            bio: person.bio,
            city: person.city,
            state: person.state,
            country: "IN",
            ratingAvgBps: person.ratingAvgBps,
            ratingCount: person.ratingCount,
            rentalsHosted: person.rentalsHosted,
            rentalsTaken: person.rentalsTaken,
            responseRateBps: person.responseRateBps,
            responseMins: person.responseMins,
            isIdentityVerified: person.isIdentityVerified,
            joinedAt,
          },
        },
        wishlist: {
          create: {
            shareToken: createHash("sha256").update(person.handle).digest("hex").slice(0, 24),
          },
        },
      },
      select: { id: true },
    });

    // The credential account is written after the user, because better-auth
    // keys it on the user's own id — that is the row sign-in looks up.
    await db.account.create({
      data: {
        userId: user.id,
        issuer: credentialIssuer,
        accountId: user.id,
        providerId: "credential",
        password: passwordHash,
      },
    });

    userIds.set(person.handle, user.id);

    if (person.isIdentityVerified) {
      await db.identityVerification.create({
        data: {
          userId: user.id,
          kind: "GOVERNMENT_ID",
          status: "APPROVED",
          reviewedAt: joinedAt,
        },
      });
    }

    // Everyone needs somewhere for a garment to arrive.
    await db.address.create({
      data: {
        userId: user.id,
        kind: "HOME",
        label: "Home",
        recipient: person.name,
        phone: `+9198${String(70_000_000 + Math.floor(seededRandom(person.handle)() * 9_000_000))}`,
        line1: `${1 + Math.floor(seededRandom(`${person.handle}-line`)() * 200)}, ${pick(seededRandom(person.handle), ["Ashok Nagar", "Model Colony", "Green Park", "Alkapuri", "Indiranagar", "Salt Lake", "Panampilly Nagar"])}`,
        line2:
          pick(seededRandom(`${person.handle}-2`), [
            "Flat 4B",
            "2nd Floor",
            "Above the pharmacy",
            "",
          ]) || undefined,
        city: person.city,
        state: person.state,
        postalCode: String(380_001 + Math.floor(seededRandom(`${person.handle}-pin`)() * 400_000)),
        country: "IN",
        isDefault: true,
      },
    });

    if (person.rentalsHosted > 0) {
      await db.payoutAccount.create({
        data: {
          userId: user.id,
          beneficiaryName: person.name,
          bankLast4: String(1000 + Math.floor(seededRandom(`${person.handle}-bank`)() * 8999)),
          ifscCode: "HDFC0001234",
          upiHandle: `${person.handle.split("-")[0]}@okhdfcbank`,
          isVerified: person.isIdentityVerified,
        },
      });
    }
  }

  // ── Garments and listings ─────────────────────────────────────────────────
  console.log(`→ ${SEED_GARMENTS.length} garments`);

  const listingIds = new Map<string, string>();
  const listingByOwner = new Map<string, string[]>();

  for (const garment of SEED_GARMENTS) {
    const random = seededRandom(garment.slug);
    const ownerId = userIds.get(garment.owner);
    if (!ownerId) throw new Error(`Unknown owner "${garment.owner}" on ${garment.slug}`);

    const person = SEED_PEOPLE.find((entry) => entry.handle === garment.owner);
    const hex = colorHex.get(garment.color) ?? "#8A8580";
    const publishedAt = new Date(Date.now() - Math.floor(random() * 300 + 5) * 86_400_000);

    const item = await db.clothingItem.create({
      data: {
        ownerId,
        slug: garment.slug,
        title: garment.title,
        description: garment.description,
        brandId: brandIds.get(garment.brand),
        categoryId: categoryIds.get(garment.category) as string,
        sizeId: sizeIds.get(garment.size) as string,
        colorId: colorIds.get(garment.color) as string,
        gender: garment.gender,
        condition: garment.condition,
        retailPriceMinor: garment.retailMinor,
        fabric: garment.fabric,
        careInstructions: garment.care,
        bustMm: garment.measurements?.bustMm,
        waistMm: garment.measurements?.waistMm,
        hipMm: garment.measurements?.hipMm,
        lengthMm: garment.measurements?.lengthMm,
        shoulderMm: garment.measurements?.shoulderMm,
        sleeveMm: garment.measurements?.sleeveMm,
        createdAt: publishedAt,
        images: {
          create: garmentImageKeys(garment.slug).map((key, index) => ({
            storageKey: key,
            alt:
              index === 0
                ? `${garment.title}${garment.brand !== "unbranded" ? ` by ${SEED_BRANDS.find((b) => b.slug === garment.brand)?.name}` : ""}`
                : `${garment.title} — view ${index + 1} of 3`,
            width: GARMENT_FRAME.width,
            height: GARMENT_FRAME.height,
            blurDataUrl: blurPlaceholder(hex),
            position: index,
            isCover: index === 0,
          })),
        },
        occasions: {
          create: garment.occasions.map((slug) => ({
            occasionId: occasionIds.get(slug) as string,
          })),
        },
      },
      select: { id: true },
    });

    const listing = await db.listing.create({
      data: {
        itemId: item.id,
        ownerId,
        status: "PUBLISHED",
        moderation: "APPROVED",
        publishedAt,
        currency: "INR",
        baseRateMinor: garment.baseRateMinor,
        baseDurationDays: garment.baseDurationDays,
        extraDayRateMinor: garment.extraDayRateMinor,
        depositMinor: garment.depositMinor,
        cleaningFeeMinor: garment.cleaningFeeMinor ?? 0,
        minRentalDays: garment.minRentalDays ?? 3,
        maxRentalDays: garment.maxRentalDays ?? 14,
        bufferDays: garment.bufferDays ?? 1,
        leadTimeDays: garment.leadTimeDays ?? 1,
        instantBook: garment.instantBook ?? false,
        fulfilment: [...garment.fulfilment],
        deliveryFeeMinor: garment.deliveryFeeMinor ?? 0,
        deliveryRadiusKm: garment.fulfilment.includes("LOCAL_DELIVERY") ? 12 : null,
        city: person?.city ?? "Mumbai",
        state: person?.state ?? "Maharashtra",
        country: "IN",
        rentalTerms: garment.terms,
        rentalCount: garment.rentalCount,
        ratingAvgBps: garment.ratingAvgBps,
        ratingCount: garment.ratingCount,
        viewCount: garment.rentalCount * (14 + Math.floor(random() * 40)),
        wishlistCount: Math.floor(garment.rentalCount * (0.6 + random())),
        createdAt: publishedAt,
      },
      select: { id: true },
    });

    listingIds.set(garment.slug, listing.id);
    listingByOwner.set(garment.owner, [...(listingByOwner.get(garment.owner) ?? []), listing.id]);

    // A couple of owner-blocked windows, so the calendar has something in it.
    if (random() > 0.65) {
      const start = addDays(TODAY, 20 + Math.floor(random() * 60));
      await db.availabilityBlock.create({
        data: {
          listingId: listing.id,
          startDate: toUtcDate(start),
          endDate: toUtcDate(addDays(start, 2 + Math.floor(random() * 4))),
          reason: pick(random, ["OWNER_BLOCKED", "PERSONAL_USE", "MAINTENANCE"] as const),
          note: "Wearing this one myself.",
        },
      });
    }
  }

  // ── Collections ───────────────────────────────────────────────────────────
  console.log("→ collections");

  const collectionPlan = [
    {
      slug: "the-wedding-season",
      title: "The wedding season",
      standfirst:
        "Eleven functions, four cities, one suitcase. What to wear when you are a guest and not the reason everybody came.",
      occasion: "wedding",
      featured: true,
    },
    {
      slug: "quiet-luxury",
      title: "Quiet luxury",
      standfirst: "Nothing with a logo. Everything with a lining.",
      occasion: "formal",
      featured: true,
    },
    {
      slug: "handloom-first",
      title: "Handloom first",
      standfirst:
        "Woven by people whose names the owners can tell you. Jamdani, chanderi, kanjivaram and khadi.",
      occasion: "traditional",
      featured: true,
    },
    {
      slug: "black-tie",
      title: "Black tie, actually",
      standfirst: "For the invitations that mean it.",
      occasion: "party",
      featured: false,
    },
    {
      slug: "festive-nights",
      title: "Festive nights",
      standfirst: "Diwali, Eid and the long run of dinners that follow.",
      occasion: "festive",
      featured: true,
    },
  ];

  for (const [index, plan] of collectionPlan.entries()) {
    const matching = SEED_GARMENTS.filter((garment) => garment.occasions.includes(plan.occasion));
    const collection = await db.collection.create({
      data: {
        slug: plan.slug,
        title: plan.title,
        standfirst: plan.standfirst,
        heroKey: `collection-${plan.slug}`,
        isFeatured: plan.featured,
        sortOrder: index,
        publishedAt: new Date(),
      },
      select: { id: true },
    });

    await db.collectionListing.createMany({
      data: matching.slice(0, 10).map((garment, position) => ({
        collectionId: collection.id,
        listingId: listingIds.get(garment.slug) as string,
        position,
      })),
    });
  }

  // Member-curated wardrobes shown on the homepage.
  for (const [index, wardrobe] of FEATURED_WARDROBES.entries()) {
    const ownerListings = listingByOwner.get(wardrobe.handle) ?? [];
    const collection = await db.collection.create({
      data: {
        slug: `wardrobe-${wardrobe.handle}`,
        title: wardrobe.title,
        standfirst: wardrobe.standfirst,
        curatorId: userIds.get(wardrobe.handle),
        isFeatured: false,
        sortOrder: 100 + index,
        publishedAt: new Date(),
      },
      select: { id: true },
    });
    await db.collectionListing.createMany({
      data: ownerListings.map((listingId, position) => ({
        collectionId: collection.id,
        listingId,
        position,
      })),
    });
  }

  // ── Rentals ───────────────────────────────────────────────────────────────
  // A spread across the lifecycle, so every dashboard, empty state and status
  // chip has something real behind it.
  console.log("→ rentals, reviews and messages");

  const renters = [
    "ishaan-nair",
    "anjali-verma",
    "rhea-dsouza",
    "tara-menon",
    "arjun-malhotra",
    "nikhil-reddy",
  ];

  const rentalPlan: Array<{
    garment: string;
    renter: string;
    startOffset: number;
    days: number;
    status: "COMPLETED" | "ACTIVE" | "ACCEPTED" | "REQUESTED" | "SHIPPED" | "RETURNED";
    review?: { rating: number; body: string };
  }> = [
    {
      garment: "black-satin-midi-dress",
      renter: "ishaan-nair",
      startOffset: -46,
      days: 3,
      status: "COMPLETED",
      review: {
        rating: 5,
        body: "Arrived pressed and in a garment bag, which I did not expect. Fit exactly as the measurements said. Ananya even messaged to ask how the evening went.",
      },
    },
    {
      garment: "vintage-silk-saree-in-claret",
      renter: "anjali-verma",
      startOffset: -32,
      days: 4,
      status: "COMPLETED",
      review: {
        rating: 5,
        body: "I have never worn anything with this much history. Meher sent a note explaining how to drape the pleats over the border. Returned it slightly reluctantly.",
      },
    },
    {
      garment: "bottle-green-velvet-blazer",
      renter: "arjun-malhotra",
      startOffset: -21,
      days: 3,
      status: "COMPLETED",
      review: {
        rating: 4,
        body: "Excellent jacket, ran a touch large on the shoulders for me. Worth knowing if you are between sizes — size down.",
      },
    },
    {
      garment: "kanjivaram-saree-in-bottle-green",
      renter: "rhea-dsouza",
      startOffset: -14,
      days: 3,
      status: "COMPLETED",
      review: {
        rating: 5,
        body: "Genuinely heavy in the way a real Kanjivaram should be. Priya was clear about that in advance so it was not a surprise.",
      },
    },
    {
      garment: "cobalt-sequinned-mini-dress",
      renter: "anjali-verma",
      startOffset: -6,
      days: 3,
      status: "RETURNED",
    },
    {
      garment: "emerald-velvet-anarkali",
      renter: "ishaan-nair",
      startOffset: -1,
      days: 4,
      status: "ACTIVE",
    },
    {
      garment: "black-leather-biker-jacket",
      renter: "tara-menon",
      startOffset: 2,
      days: 3,
      status: "SHIPPED",
    },
    {
      garment: "gold-tissue-sharara-set",
      renter: "anjali-verma",
      startOffset: 9,
      days: 3,
      status: "ACCEPTED",
    },
    {
      garment: "black-raw-silk-sherwani",
      renter: "ishaan-nair",
      startOffset: 16,
      days: 3,
      status: "ACCEPTED",
    },
    {
      garment: "blush-organza-lehenga",
      renter: "rhea-dsouza",
      startOffset: 24,
      days: 4,
      status: "REQUESTED",
    },
    {
      garment: "linen-saree-in-indigo",
      renter: "anjali-verma",
      startOffset: 31,
      days: 3,
      status: "REQUESTED",
    },
    {
      garment: "ivory-sequinned-gown",
      renter: "tara-menon",
      startOffset: 40,
      days: 3,
      status: "ACCEPTED",
    },
  ];

  const statusJourney: Record<string, string[]> = {
    REQUESTED: ["REQUESTED"],
    ACCEPTED: ["REQUESTED", "ACCEPTED"],
    SHIPPED: ["REQUESTED", "ACCEPTED", "SHIPPED"],
    ACTIVE: ["REQUESTED", "ACCEPTED", "SHIPPED", "DELIVERED", "ACTIVE"],
    RETURNED: [
      "REQUESTED",
      "ACCEPTED",
      "SHIPPED",
      "DELIVERED",
      "ACTIVE",
      "RETURN_REQUESTED",
      "RETURNED",
    ],
    COMPLETED: [
      "REQUESTED",
      "ACCEPTED",
      "SHIPPED",
      "DELIVERED",
      "ACTIVE",
      "RETURN_REQUESTED",
      "RETURNED",
      "COMPLETED",
    ],
  };

  let referenceCounter = 0;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const nextReference = () => {
    referenceCounter += 1;
    const random = seededRandom(`ref-${referenceCounter}`);
    return `ALM-${Array.from({ length: 6 }, () => alphabet[Math.floor(random() * alphabet.length)]).join("")}`;
  };

  for (const plan of rentalPlan) {
    const garment = SEED_GARMENTS.find((entry) => entry.slug === plan.garment);
    const listingId = listingIds.get(plan.garment);
    if (!garment || !listingId) continue;

    const renterId = userIds.get(plan.renter);
    const ownerId = userIds.get(garment.owner);
    if (!renterId || !ownerId || renterId === ownerId) continue;

    const start = addDays(TODAY, plan.startOffset);
    const end = addDays(start, plan.days);
    const fulfilment = garment.fulfilment.includes("SHIPPING") ? "SHIPPING" : "PICKUP";

    const quote = quoteRental({
      pricing: {
        currency: "INR",
        baseRateMinor: garment.baseRateMinor,
        baseDurationDays: garment.baseDurationDays,
        extraDayRateMinor: garment.extraDayRateMinor,
        depositMinor: garment.depositMinor,
        cleaningFeeMinor: garment.cleaningFeeMinor ?? 0,
        deliveryFeeMinor: garment.deliveryFeeMinor ?? 0,
      },
      days: plan.days,
      fulfilment,
    });

    const address = await db.address.findFirst({
      where: { userId: renterId },
      select: { id: true },
    });
    const placedAt = new Date(Date.now() - (Math.abs(plan.startOffset) + 6) * 86_400_000);

    const rental = await db.rental.create({
      data: {
        reference: nextReference(),
        renterId,
        status:
          plan.status === "COMPLETED"
            ? "COMPLETED"
            : plan.status === "ACTIVE" || plan.status === "SHIPPED" || plan.status === "RETURNED"
              ? "ACTIVE"
              : "CONFIRMED",
        currency: "INR",
        rentalSubtotalMinor: quote.rentalSubtotal.amountMinor,
        deliveryFeeMinor: quote.deliveryFee.amountMinor,
        serviceFeeMinor: quote.serviceFee.amountMinor,
        taxMinor: quote.tax.amountMinor,
        depositMinor: quote.deposit.amountMinor,
        discountMinor: 0,
        totalMinor: quote.total.amountMinor,
        fulfilment,
        deliveryAddressId: fulfilment === "PICKUP" ? null : address?.id,
        placedAt,
        createdAt: placedAt,
      },
      select: { id: true },
    });

    const booking = await db.rentalItem.create({
      data: {
        rentalId: rental.id,
        listingId,
        ownerId,
        status: plan.status,
        startDate: toUtcDate(start),
        endDate: toUtcDate(end),
        days: plan.days,
        bufferDays: garment.bufferDays ?? 1,
        baseRateMinor: garment.baseRateMinor,
        baseDurationDays: garment.baseDurationDays,
        extraDayRateMinor: garment.extraDayRateMinor,
        cleaningFeeMinor: garment.cleaningFeeMinor ?? 0,
        lineSubtotalMinor: quote.rentalSubtotal.amountMinor,
        depositMinor: quote.deposit.amountMinor,
        commissionBps: quote.commissionBps,
        commissionMinor: quote.commission.amountMinor,
        ownerEarningsMinor: quote.ownerEarnings.amountMinor,
        acceptedAt: plan.status !== "REQUESTED" ? placedAt : null,
        completedAt: plan.status === "COMPLETED" ? toUtcDate(end) : null,
        createdAt: placedAt,
      },
      select: { id: true },
    });

    // The full audit trail, not just the final status.
    let previous: string | null = null;
    for (const [index, status] of (statusJourney[plan.status] ?? [plan.status]).entries()) {
      await db.bookingTransition.create({
        data: {
          rentalItemId: booking.id,
          fromStatus: previous as never,
          toStatus: status as never,
          actorId: index === 0 ? renterId : ownerId,
          createdAt: new Date(placedAt.getTime() + index * 86_400_000),
        },
      });
      previous = status;
    }

    await db.payment.create({
      data: {
        rentalId: rental.id,
        provider: "SANDBOX",
        status: "CAPTURED",
        providerOrderId: `order_seed_${booking.id.slice(-16)}`,
        providerPaymentId: `pay_seed_${booking.id.slice(-16)}`,
        currency: "INR",
        amountMinor: quote.total.amountMinor,
        capturedMinor: quote.total.amountMinor,
        capturedAt: placedAt,
        authorizedAt: placedAt,
        createdAt: placedAt,
      },
    });

    await db.securityDeposit.create({
      data: {
        rentalId: rental.id,
        amountMinor: quote.deposit.amountMinor,
        status: plan.status === "COMPLETED" ? "RELEASED" : "HELD",
        releasedAt: plan.status === "COMPLETED" ? toUtcDate(addDays(end, 2)) : null,
      },
    });

    if (fulfilment === "SHIPPING") {
      await db.delivery.create({
        data: {
          rentalItemId: booking.id,
          mode: "SHIPPING",
          status:
            plan.status === "COMPLETED" || plan.status === "RETURNED"
              ? "RETURNED"
              : plan.status === "ACTIVE"
                ? "DELIVERED"
                : plan.status === "SHIPPED"
                  ? "IN_TRANSIT"
                  : "PENDING",
          carrier: "Bluedart",
          trackingNumber: `BD${booking.id.slice(-10).toUpperCase()}`,
        },
      });
    }

    if (plan.review) {
      await db.review.create({
        data: {
          rentalItemId: booking.id,
          listingId,
          authorId: renterId,
          subjectId: ownerId,
          direction: "RENTER_ON_ITEM",
          rating: plan.review.rating,
          fitRating: plan.review.rating,
          conditionRating: 5,
          accuracyRating: plan.review.rating,
          body: plan.review.body,
          publishedAt: toUtcDate(addDays(end, 1)),
        },
      });

      await db.review.create({
        data: {
          rentalItemId: booking.id,
          authorId: ownerId,
          subjectId: renterId,
          direction: "OWNER_ON_RENTER",
          rating: 5,
          body: "Returned on time and beautifully looked after. Welcome back any time.",
          publishedAt: toUtcDate(addDays(end, 2)),
        },
      });
    }

    // A thread per booking, with the system events the interface renders.
    const conversation = await db.conversation.create({
      data: {
        listingId,
        rentalId: rental.id,
        subject: garment.title,
        lastMessageAt: placedAt,
        members: { create: [{ userId: renterId }, { userId: ownerId }] },
      },
      select: { id: true },
    });

    await db.message.createMany({
      data: [
        {
          conversationId: conversation.id,
          senderId: null,
          kind: "SYSTEM",
          systemEvent: "RENTAL_REQUESTED",
          body: "Rental request sent",
          rentalId: rental.id,
          createdAt: placedAt,
        },
        {
          conversationId: conversation.id,
          senderId: renterId,
          kind: "TEXT",
          body:
            plan.status === "REQUESTED"
              ? "Hello! Is this still free for those dates? Happy to collect if that's easier."
              : "Thank you — looking forward to it. Should I collect or will you send it?",
          createdAt: new Date(placedAt.getTime() + 3_600_000),
        },
        ...(plan.status !== "REQUESTED"
          ? [
              {
                conversationId: conversation.id,
                senderId: ownerId,
                kind: "TEXT" as const,
                body: "All yours. I'll have it cleaned and sent across two days before — I'll share the tracking here.",
                createdAt: new Date(placedAt.getTime() + 7_200_000),
              },
              {
                conversationId: conversation.id,
                senderId: null,
                kind: "SYSTEM" as const,
                systemEvent: "RENTAL_ACCEPTED",
                body: "Booking accepted",
                rentalId: rental.id,
                createdAt: new Date(placedAt.getTime() + 7_300_000),
              },
            ]
          : []),
      ],
    });

    await db.notification.create({
      data: {
        userId: plan.status === "REQUESTED" ? ownerId : renterId,
        kind: plan.status === "REQUESTED" ? "RENTAL_REQUESTED" : "RENTAL_ACCEPTED",
        title:
          plan.status === "REQUESTED"
            ? `New request for your ${garment.title.toLowerCase()}`
            : `Your ${garment.title.toLowerCase()} is confirmed`,
        body:
          plan.status === "REQUESTED"
            ? "Someone would like to borrow this. Reply within 24 hours to keep your response rate up."
            : "The owner has confirmed your dates.",
        href: "/account/rentals",
        createdAt: placedAt,
      },
    });
  }

  // ── Payouts ───────────────────────────────────────────────────────────────
  console.log("→ payouts");

  const completed = await db.rentalItem.findMany({
    where: { status: "COMPLETED" },
    select: { id: true, ownerId: true, ownerEarningsMinor: true },
  });

  const byOwner = new Map<string, typeof completed>();
  for (const line of completed) {
    byOwner.set(line.ownerId, [...(byOwner.get(line.ownerId) ?? []), line]);
  }

  for (const [ownerId, lines] of byOwner) {
    const amountMinor = lines.reduce((total, line) => total + line.ownerEarningsMinor, 0);
    if (amountMinor <= 0) continue;

    const payout = await db.payout.create({
      data: {
        ownerId,
        reference: `PO-${ownerId.slice(-8).toUpperCase()}`,
        amountMinor,
        currency: "INR",
        status: "PAID",
        paidAt: new Date(Date.now() - 5 * 86_400_000),
      },
      select: { id: true },
    });

    await db.payoutItem.createMany({
      data: lines.map((line) => ({
        payoutId: payout.id,
        rentalItemId: line.id,
        amountMinor: line.ownerEarningsMinor,
      })),
    });
  }

  // ── Wishlists ─────────────────────────────────────────────────────────────
  console.log("→ wishlists");

  for (const handle of renters) {
    const userId = userIds.get(handle);
    if (!userId) continue;
    const wishlist = await db.wishlist.findUnique({ where: { userId }, select: { id: true } });
    if (!wishlist) continue;

    const random = seededRandom(`wishlist-${handle}`);
    const chosen = [...SEED_GARMENTS]
      .filter((garment) => garment.owner !== handle)
      .sort(() => random() - 0.5)
      .slice(0, 4 + Math.floor(random() * 4));

    await db.wishlistItem.createMany({
      data: chosen.map((garment) => ({
        wishlistId: wishlist.id,
        listingId: listingIds.get(garment.slug) as string,
      })),
      skipDuplicates: true,
    });
  }

  // ── A listing awaiting moderation, so the admin queue is not empty ────────
  const pendingOwner = userIds.get("arjun-malhotra") as string;
  const pendingItem = await db.clothingItem.create({
    data: {
      ownerId: pendingOwner,
      slug: "unreviewed-silk-scarf",
      title: "Printed silk scarf",
      description:
        "Square silk scarf, hand-rolled edges. Bought in Paris and worn twice — I keep forgetting I own it.",
      brandId: brandIds.get("unbranded"),
      categoryId: categoryIds.get("tops") as string,
      sizeId: sizeIds.get("free-size") as string,
      colorId: colorIds.get("saffron") as string,
      gender: "UNISEX",
      condition: "LIKE_NEW",
      retailPriceMinor: 8_000_00,
      fabric: "Silk twill",
      careInstructions: "Dry clean.",
      images: {
        create: [
          {
            storageKey: "printed-silk-slip-dress-1",
            alt: "Printed silk scarf",
            width: GARMENT_FRAME.width,
            height: GARMENT_FRAME.height,
            blurDataUrl: blurPlaceholder("#D08428"),
            position: 0,
            isCover: true,
          },
        ],
      },
    },
    select: { id: true },
  });

  await db.listing.create({
    data: {
      itemId: pendingItem.id,
      ownerId: pendingOwner,
      status: "PENDING_REVIEW",
      moderation: "PENDING",
      currency: "INR",
      baseRateMinor: 350_00,
      baseDurationDays: 3,
      extraDayRateMinor: 90_00,
      depositMinor: 1_000_00,
      minRentalDays: 3,
      maxRentalDays: 10,
      fulfilment: ["SHIPPING"],
      deliveryFeeMinor: 120_00,
      city: "Chandigarh",
      state: "Punjab",
    },
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  const [users, listings, rentals, reviews] = await Promise.all([
    db.user.count(),
    db.listing.count(),
    db.rental.count(),
    db.review.count(),
  ]);

  console.log("\n  Seeded successfully");
  console.log(
    `    ${users} members · ${listings} listings · ${rentals} rentals · ${reviews} reviews`,
  );
  console.log(`\n  Sign in with any seeded address, password: ${SEED_PASSWORD}`);
  console.log(`    Owner with a busy wardrobe   ananya@almirah.example`);
  console.log(`    Renter with active rentals   ishaan@almirah.example`);
  console.log(`    Administrator                nandini@almirah.example\n`);
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exit(1);
  })
  .then(() => process.exit(0));
