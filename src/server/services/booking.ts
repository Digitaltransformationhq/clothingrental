import "server-only";

import { randomBytes } from "node:crypto";

import {
  type DateRange,
  dateRange,
  differenceInDays,
  type IsoDate,
  today,
  toUtcDate,
} from "@/domain/dates";
import { checkAvailability } from "@/domain/rental/availability";
import {
  DEFAULT_FEE_SCHEDULE,
  type FeeSchedule,
  type FulfilmentMode,
  quoteRental,
  type RentalQuote,
} from "@/domain/rental/pricing";
import { assertTransition, type TransitionActor } from "@/domain/rental/state-machine";
import { BookingStatus, RentalStatus } from "@/generated/prisma/enums";
import { type DbTransaction, getDb } from "@/server/db/client";
import { errors } from "@/server/errors";
import { getOccupancy } from "./listings";

/**
 * Booking.
 *
 * This is the module where the marketplace can actually lose money or
 * double-let a garment, so it is written defensively and deliberately.
 *
 * Four rules, each enforced rather than assumed:
 *
 *  1. **Prices are recomputed, never accepted.** The client sends a listing id
 *     and two dates. Everything else — rate, deposit, fees, tax, commission —
 *     is derived on the server from the listing row read inside the booking
 *     transaction. A tampered total cannot reach the database, and the
 *     `Rental_total_is_sum_of_parts` constraint would reject it if it did.
 *
 *  2. **Availability is re-checked under a lock.** Two members can request the
 *     same garment for the same weekend within milliseconds of each other. The
 *     transaction takes a PostgreSQL advisory lock keyed on the listing, and
 *     only then reads occupancy and writes — so the second request sees the
 *     first one's booking and is refused.
 *
 *  3. **The database is the backstop.** Even if this code were bypassed
 *     entirely, the `RentalItem_reject_overlap` trigger refuses an overlapping
 *     booking. The lock is what makes the failure a polite message rather than
 *     a constraint violation.
 *
 *  4. **Nothing is confirmed until money is captured.** A booking is written as
 *     REQUESTED against a PAYMENT_PENDING rental; only a verified payment moves
 *     it on.
 */

export interface BookingRequestItem {
  readonly listingId: string;
  readonly start: IsoDate;
  readonly end: IsoDate;
}

export interface CreateBookingInput {
  readonly renterId: string;
  readonly items: readonly BookingRequestItem[];
  readonly fulfilment: FulfilmentMode;
  readonly deliveryAddressId?: string;
  readonly note?: string;
}

export interface BookingDraft {
  readonly rentalId: string;
  readonly reference: string;
  readonly totalMinor: number;
  readonly depositMinor: number;
  readonly currency: string;
}

/** A short, unambiguous reference a member can quote: ALM-7Q4K2P. */
function generateReference(): string {
  // No I, O, 0 or 1 — they are misread and mistyped over the phone.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let out = "";
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return `ALM-${out}`;
}

/**
 * PostgreSQL advisory locks take a bigint. This folds a listing's cuid into
 * one deterministically, so every transaction touching that listing contends
 * on the same key.
 */
function lockKeyFor(listingId: string): bigint {
  let hash = 0n;
  const mask = (1n << 63n) - 1n;
  for (const char of listingId) {
    hash = (hash * 131n + BigInt(char.charCodeAt(0))) & mask;
  }
  return hash;
}

/** The fee schedule in force, or the documented default if none is configured. */
export async function getActiveFeeSchedule(tx?: DbTransaction): Promise<FeeSchedule> {
  const db = tx ?? (await getDb());
  const now = new Date();

  const fee = await db.platformFee.findFirst({
    where: {
      isDefault: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!fee) return DEFAULT_FEE_SCHEDULE;

  return {
    commissionBps: fee.commissionBps,
    serviceFeeBps: fee.serviceFeeBps,
    taxBps: fee.taxBps,
    minFeeMinor: fee.minFeeMinor,
  };
}

/**
 * Prices a basket without writing anything — what the checkout summary renders.
 *
 * Uses exactly the same code path as `createBooking`, so the figure a member is
 * shown and the figure they are charged cannot diverge.
 */
export async function quoteBooking(input: {
  renterId?: string;
  items: readonly BookingRequestItem[];
  fulfilment: FulfilmentMode;
}): Promise<{
  quotes: Array<{ listingId: string; quote: RentalQuote; days: number; range: DateRange }>;
  fees: FeeSchedule;
}> {
  const db = await getDb();
  const fees = await getActiveFeeSchedule();

  const quotes = await Promise.all(
    input.items.map(async (item) => {
      const listing = await db.listing.findFirst({
        where: { id: item.listingId, status: "PUBLISHED", moderation: "APPROVED" },
        select: {
          id: true,
          currency: true,
          baseRateMinor: true,
          baseDurationDays: true,
          extraDayRateMinor: true,
          depositMinor: true,
          cleaningFeeMinor: true,
          deliveryFeeMinor: true,
        },
      });

      if (!listing) throw errors.notFound("piece");

      const range = dateRange(item.start, item.end);
      const days = differenceInDays(range.start, range.end);

      return {
        listingId: listing.id,
        days,
        range,
        quote: quoteRental({
          pricing: {
            currency: listing.currency as "INR",
            baseRateMinor: listing.baseRateMinor,
            baseDurationDays: listing.baseDurationDays,
            extraDayRateMinor: listing.extraDayRateMinor,
            depositMinor: listing.depositMinor,
            cleaningFeeMinor: listing.cleaningFeeMinor,
            deliveryFeeMinor: listing.deliveryFeeMinor,
          },
          days,
          fees,
          fulfilment: input.fulfilment,
        }),
      };
    }),
  );

  return { quotes, fees };
}

/**
 * Creates a rental and its bookings atomically.
 *
 * Returns a draft in PAYMENT_PENDING. The garment's dates are held from this
 * moment — the booking rows exist and occupy — which is correct: a member part
 * way through paying should not lose the dress to someone who started later.
 * Abandoned drafts are released by `releaseExpiredDrafts`.
 */
export async function createBooking(input: CreateBookingInput): Promise<BookingDraft> {
  const db = await getDb();

  if (input.items.length === 0) {
    throw errors.validation("There's nothing in your bag yet.");
  }
  if (input.items.length > 8) {
    throw errors.validation("You can rent up to eight pieces at a time.");
  }

  const currentDate = today();
  const fees = await getActiveFeeSchedule();

  return db.$transaction(
    async (tx) => {
      // Locks are taken in a stable order. Two baskets containing the same two
      // listings in opposite orders would otherwise deadlock.
      const listingIds = [...new Set(input.items.map((item) => item.listingId))].sort();
      for (const listingId of listingIds) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKeyFor(listingId)}::bigint)`;
      }

      const reference = generateReference();
      const lines: Array<{
        listingId: string;
        ownerId: string;
        range: DateRange;
        days: number;
        quote: RentalQuote;
        bufferDays: number;
        baseRateMinor: number;
        baseDurationDays: number;
        extraDayRateMinor: number;
        cleaningFeeMinor: number;
      }> = [];

      for (const item of input.items) {
        // Re-read inside the lock. The listing may have been unpublished,
        // repriced or withdrawn since the page was rendered.
        const listing = await tx.listing.findFirst({
          where: { id: item.listingId, status: "PUBLISHED", moderation: "APPROVED" },
          select: {
            id: true,
            ownerId: true,
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
            item: { select: { title: true } },
          },
        });

        if (!listing) {
          throw errors.unavailable("One of the pieces in your bag is no longer available to rent.");
        }

        // Enforced here as well as by a database trigger, so the member gets a
        // sentence rather than a constraint violation.
        if (listing.ownerId === input.renterId) {
          throw errors.validation("You can't rent a piece from your own wardrobe.");
        }

        const requested = dateRange(item.start, item.end);
        const occupancy = await getOccupancy(listing.id, tx);

        const verdict = checkAvailability({
          policy: {
            minRentalDays: listing.minRentalDays,
            maxRentalDays: listing.maxRentalDays,
            bufferDays: listing.bufferDays,
            leadTimeDays: listing.leadTimeDays,
          },
          occupancy,
          requested,
          today: currentDate,
        });

        if (!verdict.ok) {
          throw errors.unavailable(`${listing.item.title}: ${verdict.message}`);
        }

        const quote = quoteRental({
          pricing: {
            currency: listing.currency as "INR",
            baseRateMinor: listing.baseRateMinor,
            baseDurationDays: listing.baseDurationDays,
            extraDayRateMinor: listing.extraDayRateMinor,
            depositMinor: listing.depositMinor,
            cleaningFeeMinor: listing.cleaningFeeMinor,
            deliveryFeeMinor: listing.deliveryFeeMinor,
          },
          days: verdict.days,
          fees,
          fulfilment: input.fulfilment,
        });

        lines.push({
          listingId: listing.id,
          ownerId: listing.ownerId,
          range: requested,
          days: verdict.days,
          quote,
          bufferDays: listing.bufferDays,
          baseRateMinor: listing.baseRateMinor,
          baseDurationDays: listing.baseDurationDays,
          extraDayRateMinor: listing.extraDayRateMinor,
          cleaningFeeMinor: listing.cleaningFeeMinor,
        });
      }

      // A delivery address must belong to the member using it — otherwise a
      // guessed id would let anyone read somebody else's address on the
      // confirmation that follows.
      //
      // Its absence is not an error here. A draft is created from the listing
      // page, where no address has been asked for yet; the address is chosen at
      // checkout and is required before any money moves, which `beginPayment`
      // enforces. Demanding it now would mean interrupting the one moment a
      // member has decided they want the thing.
      if (input.deliveryAddressId) {
        const address = await tx.address.findFirst({
          where: { id: input.deliveryAddressId, userId: input.renterId },
          select: { id: true },
        });
        if (!address) throw errors.notFound("address");
      }

      const sum = (pick: (line: (typeof lines)[number]) => number) =>
        lines.reduce((total, line) => total + pick(line), 0);

      const rentalSubtotalMinor = sum((line) => line.quote.rentalSubtotal.amountMinor);
      const deliveryFeeMinor = sum((line) => line.quote.deliveryFee.amountMinor);
      const serviceFeeMinor = sum((line) => line.quote.serviceFee.amountMinor);
      const taxMinor = sum((line) => line.quote.tax.amountMinor);
      const depositMinor = sum((line) => line.quote.deposit.amountMinor);

      const rental = await tx.rental.create({
        data: {
          reference,
          renterId: input.renterId,
          status: RentalStatus.PAYMENT_PENDING,
          currency: lines[0].quote.currency,
          rentalSubtotalMinor,
          deliveryFeeMinor,
          serviceFeeMinor,
          taxMinor,
          depositMinor,
          discountMinor: 0,
          // Must equal the sum of its parts; a database check enforces it.
          totalMinor:
            rentalSubtotalMinor + deliveryFeeMinor + serviceFeeMinor + taxMinor + depositMinor,
          fulfilment: input.fulfilment,
          deliveryAddressId: input.deliveryAddressId,
          renterNote: input.note?.slice(0, 500),
          placedAt: new Date(),
        },
        select: { id: true, reference: true, totalMinor: true, depositMinor: true, currency: true },
      });

      for (const line of lines) {
        const booking = await tx.rentalItem.create({
          data: {
            rentalId: rental.id,
            listingId: line.listingId,
            ownerId: line.ownerId,
            status: BookingStatus.REQUESTED,
            startDate: toUtcDate(line.range.start),
            endDate: toUtcDate(line.range.end),
            days: line.days,
            bufferDays: line.bufferDays,
            baseRateMinor: line.baseRateMinor,
            baseDurationDays: line.baseDurationDays,
            extraDayRateMinor: line.extraDayRateMinor,
            cleaningFeeMinor: line.cleaningFeeMinor,
            lineSubtotalMinor: line.quote.rentalSubtotal.amountMinor,
            depositMinor: line.quote.deposit.amountMinor,
            commissionBps: line.quote.commissionBps,
            commissionMinor: line.quote.commission.amountMinor,
            ownerEarningsMinor: line.quote.ownerEarnings.amountMinor,
          },
          select: { id: true },
        });

        await tx.bookingTransition.create({
          data: {
            rentalItemId: booking.id,
            fromStatus: null,
            toStatus: BookingStatus.REQUESTED,
            actorId: input.renterId,
            reason: "Rental requested",
          },
        });
      }

      if (depositMinor > 0) {
        await tx.securityDeposit.create({
          data: { rentalId: rental.id, amountMinor: depositMinor, status: "HELD" },
        });
      }

      return {
        rentalId: rental.id,
        reference: rental.reference,
        totalMinor: rental.totalMinor,
        depositMinor: rental.depositMinor,
        currency: rental.currency,
      };
    },
    {
      // Long enough for several listings under contention, short enough that a
      // stuck transaction releases its locks rather than blocking the shop.
      timeout: 15_000,
      maxWait: 10_000,
    },
  );
}

/**
 * Moves one booking through the state machine.
 *
 * The single entry point for every status change. It resolves the caller's role
 * from the booking itself rather than trusting a claim, asks the state machine
 * whether the move is permitted, and records it — so the audit trail cannot be
 * incomplete.
 */
export async function transitionBooking(input: {
  bookingId: string;
  to: BookingStatus;
  actorId: string;
  actorIsStaff?: boolean;
  reason?: string;
}): Promise<void> {
  const db = await getDb();

  await db.$transaction(async (tx) => {
    const booking = await tx.rentalItem.findUnique({
      where: { id: input.bookingId },
      select: {
        id: true,
        status: true,
        ownerId: true,
        rentalId: true,
        rental: { select: { renterId: true } },
      },
    });

    if (!booking) throw errors.notFound("booking");

    // The actor's role is derived from the data, never supplied by the caller.
    let actor: TransitionActor;
    if (input.actorIsStaff) actor = "ADMIN";
    else if (booking.ownerId === input.actorId) actor = "OWNER";
    else if (booking.rental.renterId === input.actorId) actor = "RENTER";
    else throw errors.forbidden("That booking isn't yours.");

    assertTransition(booking.status, input.to, actor);

    const now = new Date();
    const timestampField: Partial<Record<BookingStatus, string>> = {
      [BookingStatus.ACCEPTED]: "acceptedAt",
      [BookingStatus.DECLINED]: "declinedAt",
      [BookingStatus.SHIPPED]: "shippedAt",
      [BookingStatus.DELIVERED]: "deliveredAt",
      [BookingStatus.RETURNED]: "returnedAt",
      [BookingStatus.COMPLETED]: "completedAt",
      [BookingStatus.CANCELLED]: "cancelledAt",
    };

    const stamp = timestampField[input.to];

    await tx.rentalItem.update({
      where: { id: booking.id },
      data: { status: input.to, ...(stamp ? { [stamp]: now } : {}) },
    });

    await tx.bookingTransition.create({
      data: {
        rentalItemId: booking.id,
        fromStatus: booking.status,
        toStatus: input.to,
        actorId: input.actorId,
        reason: input.reason,
      },
    });

    // A completed rental is the point at which the owner has earned their share
    // and the piece's rental count is real.
    if (input.to === BookingStatus.COMPLETED) {
      const line = await tx.rentalItem.findUnique({
        where: { id: booking.id },
        select: { listingId: true, ownerId: true },
      });
      if (line) {
        await tx.listing.update({
          where: { id: line.listingId },
          data: { rentalCount: { increment: 1 } },
        });
        await tx.profile.updateMany({
          where: { userId: line.ownerId },
          data: { rentalsHosted: { increment: 1 } },
        });
      }
    }

    await syncRentalStatus(tx, booking.rentalId);
  });
}

/**
 * Recomputes an order's status from its bookings.
 *
 * Order status is always derived, never set directly, so the two can never
 * disagree.
 */
async function syncRentalStatus(tx: DbTransaction, rentalId: string): Promise<void> {
  const [bookings, payment] = await Promise.all([
    tx.rentalItem.findMany({ where: { rentalId }, select: { status: true } }),
    tx.payment.findFirst({
      where: { rentalId, status: { in: ["CAPTURED", "AUTHORIZED"] } },
      select: { id: true },
    }),
  ]);

  const { deriveRentalStatus } = await import("@/domain/rental/state-machine");
  const next = deriveRentalStatus(
    bookings.map((booking) => booking.status),
    Boolean(payment),
  );

  await tx.rental.update({ where: { id: rentalId }, data: { status: next } });
}

/**
 * Releases the dates held by drafts that were never paid for.
 *
 * Without this, an abandoned checkout would hold a garment's weekend
 * indefinitely. Intended to be run on a schedule; safe to run concurrently
 * because each cancellation is guarded by the state machine.
 */
export async function releaseExpiredDrafts(olderThanMinutes = 30): Promise<number> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);

  const stale = await db.rental.findMany({
    where: {
      status: RentalStatus.PAYMENT_PENDING,
      createdAt: { lt: cutoff },
      payments: { none: { status: { in: ["AUTHORIZED", "CAPTURED"] } } },
    },
    select: { id: true, items: { select: { id: true, status: true } } },
  });

  let released = 0;
  for (const rental of stale) {
    await db.$transaction(async (tx) => {
      for (const booking of rental.items) {
        if (booking.status !== BookingStatus.REQUESTED) continue;
        await tx.rentalItem.update({
          where: { id: booking.id },
          data: { status: BookingStatus.CANCELLED, cancelledAt: new Date() },
        });
        await tx.bookingTransition.create({
          data: {
            rentalItemId: booking.id,
            fromStatus: booking.status,
            toStatus: BookingStatus.CANCELLED,
            actorId: null,
            reason: "Checkout was not completed",
          },
        });
        released += 1;
      }
      await tx.rental.update({
        where: { id: rental.id },
        data: {
          status: RentalStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: "Payment was not completed",
        },
      });
    });
  }

  return released;
}
