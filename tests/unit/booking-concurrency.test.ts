import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { addDays, today, toUtcDate } from "@/domain/dates";

/**
 * Double-booking, against a real database.
 *
 * This is the claim the whole marketplace rests on: two members cannot rent the
 * same garment over the same dates, however close together they press the
 * button. It is not something a unit test over pure functions can establish —
 * it depends on transactions, locks and a database trigger — so this suite runs
 * against a real PostgreSQL instance (the bundled in-process one, unless
 * DATABASE_URL points elsewhere).
 *
 * There are two independent guarantees, and both are tested here:
 *
 *   1. The booking service serialises writes per listing with an advisory lock
 *      and re-checks availability inside it. This is what turns a race into a
 *      polite "already booked" message.
 *
 *   2. The `RentalItem_reject_overlap` trigger refuses an overlapping row even
 *      if the service is bypassed entirely. This is what makes the guarantee
 *      true rather than merely likely.
 */

const RUN = process.env.NODE_ENV !== "production";

let db: Awaited<ReturnType<typeof import("@/server/db/client").getDb>>;
let listingId: string;
let ownerId: string;
let renterA: string;
let renterB: string;

const start = addDays(today(), 30);
const end = addDays(start, 3);

beforeAll(async () => {
  const { getDb } = await import("@/server/db/client");
  db = await getDb();

  // A listing nothing else in the seed touches, so the test is independent of
  // catalogue state and can run repeatedly.
  const suffix = Math.random().toString(36).slice(2, 10);

  const owner = await db.user.create({
    data: { email: `owner-${suffix}@test.invalid`, name: "Test Owner" },
    select: { id: true },
  });
  const a = await db.user.create({
    data: { email: `a-${suffix}@test.invalid`, name: "Renter A" },
    select: { id: true },
  });
  const b = await db.user.create({
    data: { email: `b-${suffix}@test.invalid`, name: "Renter B" },
    select: { id: true },
  });
  ownerId = owner.id;
  renterA = a.id;
  renterB = b.id;

  const category = await db.category.findFirstOrThrow({ select: { id: true } });
  const size = await db.size.findFirstOrThrow({ select: { id: true } });
  const colour = await db.color.findFirstOrThrow({ select: { id: true } });

  const item = await db.clothingItem.create({
    data: {
      ownerId,
      slug: `concurrency-${suffix}`,
      title: "Concurrency test piece",
      description: "Exists only for the double-booking test.",
      categoryId: category.id,
      sizeId: size.id,
      colorId: colour.id,
    },
    select: { id: true },
  });

  const listing = await db.listing.create({
    data: {
      itemId: item.id,
      ownerId,
      status: "PUBLISHED",
      moderation: "APPROVED",
      publishedAt: new Date(),
      baseRateMinor: 100_000,
      baseDurationDays: 3,
      extraDayRateMinor: 20_000,
      depositMinor: 200_000,
      minRentalDays: 1,
      maxRentalDays: 30,
      bufferDays: 1,
      leadTimeDays: 0,
      fulfilment: ["PICKUP"],
      city: "Mumbai",
      state: "Maharashtra",
    },
    select: { id: true },
  });
  listingId = listing.id;
});

afterAll(async () => {
  if (!db) return;

  // Torn down child-first. `RentalItem.ownerId` is a RESTRICT foreign key on
  // purpose — a member with live bookings against their name must not be
  // deletable — so the bookings have to go before the people do.
  const ids = [ownerId, renterA, renterB].filter(Boolean);
  const rentals = await db.rental.findMany({
    where: { renterId: { in: ids } },
    select: { id: true },
  });
  const rentalIds = rentals.map((rental) => rental.id);

  await db.bookingTransition.deleteMany({ where: { rentalItem: { rentalId: { in: rentalIds } } } });
  await db.securityDeposit.deleteMany({ where: { rentalId: { in: rentalIds } } });
  await db.rentalItem.deleteMany({ where: { rentalId: { in: rentalIds } } });
  await db.rental.deleteMany({ where: { id: { in: rentalIds } } });
  await db.listing.deleteMany({ where: { ownerId } });
  await db.clothingItem.deleteMany({ where: { ownerId } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
});

describe.runIf(RUN)("double-booking is impossible", () => {
  it("lets the first booking through and refuses the second", async () => {
    const { createBooking } = await import("@/server/services/booking");

    const first = await createBooking({
      renterId: renterA,
      items: [{ listingId, start, end }],
      fulfilment: "PICKUP",
    });
    expect(first.rentalId).toBeTruthy();

    await expect(
      createBooking({
        renterId: renterB,
        items: [{ listingId, start, end }],
        fulfilment: "PICKUP",
      }),
    ).rejects.toThrow(/already out|not available|booked/i);
  });

  it("refuses a booking that only overlaps the turnaround", async () => {
    const { createBooking } = await import("@/server/services/booking");

    // The first booking ends on `end`; its one buffer day runs to end+1. A
    // rental starting on `end` would collect a garment still being cleaned.
    await expect(
      createBooking({
        renterId: renterB,
        items: [{ listingId, start: end, end: addDays(end, 2) }],
        fulfilment: "PICKUP",
      }),
    ).rejects.toThrow(/already out|not available|booked/i);
  });

  it("allows a booking that starts once the turnaround has cleared", async () => {
    const { createBooking } = await import("@/server/services/booking");

    const clear = addDays(end, 1);
    const booking = await createBooking({
      renterId: renterB,
      items: [{ listingId, start: clear, end: addDays(clear, 2) }],
      fulfilment: "PICKUP",
    });
    expect(booking.rentalId).toBeTruthy();
  });

  it("survives simultaneous requests for the same dates", async () => {
    const { createBooking } = await import("@/server/services/booking");

    const contested = addDays(today(), 120);
    const contestedEnd = addDays(contested, 3);

    // Ten members pressing the button at the same instant. Exactly one may win.
    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, (_, index) =>
        createBooking({
          renterId: index % 2 === 0 ? renterA : renterB,
          items: [{ listingId, start: contested, end: contestedEnd }],
          fulfilment: "PICKUP",
        }),
      ),
    );

    const succeeded = attempts.filter((result) => result.status === "fulfilled");
    expect(succeeded).toHaveLength(1);

    // And the database agrees: one live booking over those dates, not ten.
    const live = await db.rentalItem.count({
      where: {
        listingId,
        status: { notIn: ["CANCELLED", "DECLINED", "COMPLETED"] },
        startDate: toUtcDate(contested),
      },
    });
    expect(live).toBe(1);
  });

  it("is refused by the database even when the service is bypassed", async () => {
    // The backstop. This writes straight to the table, skipping the advisory
    // lock and the availability check entirely — exactly what a future code
    // path that forgets them would do.
    const existing = await db.rentalItem.findFirstOrThrow({
      where: { listingId, status: { notIn: ["CANCELLED", "DECLINED", "COMPLETED"] } },
      select: { startDate: true, endDate: true, rentalId: true },
    });

    const rental = await db.rental.create({
      data: {
        reference: `TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        renterId: renterB,
        status: "PAYMENT_PENDING",
        rentalSubtotalMinor: 100_000,
        serviceFeeMinor: 0,
        taxMinor: 0,
        depositMinor: 0,
        deliveryFeeMinor: 0,
        discountMinor: 0,
        totalMinor: 100_000,
      },
      select: { id: true },
    });

    await expect(
      db.rentalItem.create({
        data: {
          rentalId: rental.id,
          listingId,
          ownerId,
          status: "REQUESTED",
          startDate: existing.startDate,
          endDate: existing.endDate,
          days: 3,
          bufferDays: 1,
          baseRateMinor: 100_000,
          baseDurationDays: 3,
          extraDayRateMinor: 20_000,
          lineSubtotalMinor: 100_000,
          depositMinor: 0,
          commissionBps: 1500,
          commissionMinor: 15_000,
          ownerEarningsMinor: 85_000,
        },
      }),
    ).rejects.toThrow(/already booked|exclusion|overlap/i);

    await db.rental.delete({ where: { id: rental.id } });
  });

  it("refuses to let an owner rent their own garment", async () => {
    const { createBooking } = await import("@/server/services/booking");

    await expect(
      createBooking({
        renterId: ownerId,
        items: [{ listingId, start: addDays(today(), 200), end: addDays(today(), 203) }],
        fulfilment: "PICKUP",
      }),
    ).rejects.toThrow(/your own/i);
  });
});
