"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { BookingStatus } from "@/generated/prisma/enums";
import { isStaff, requireUserOrThrow } from "@/server/auth/session";
import { transitionBooking } from "@/server/services/booking";
import { getDb } from "@/server/db/client";
import { type ActionResult, guard } from "@/server/errors";
import { checkRateLimit } from "@/server/rate-limit";
import { settleDeposit } from "@/server/services/payments";

/**
 * Booking actions.
 *
 * Thin by design. Each one validates its input, identifies the caller from the
 * session, and hands over to `transitionBooking` — the single place any
 * booking's status changes and the only place the state machine is consulted.
 *
 * Note what is *not* here: no action takes a status from the client and writes
 * it. The caller says what they want to do; the domain decides whether they may.
 *
 * Every export is an `async function` declaration rather than a const arrow,
 * because Next.js only treats the former as server actions — an arrow export
 * compiles away and fails at import time.
 */

const bookingSchema = z.object({
  bookingId: z.string().min(1).max(64),
  reason: z.string().max(300).optional(),
});

type BookingInput = z.input<typeof bookingSchema>;

async function move(input: BookingInput, to: BookingStatus): Promise<ActionResult<void>> {
  return guard(async () => {
    const parsed = bookingSchema.parse(input);
    const user = await requireUserOrThrow();
    await checkRateLimit({ key: `booking:${user.id}`, limit: 40, windowSeconds: 60 });

    await transitionBooking({
      bookingId: parsed.bookingId,
      to,
      actorId: user.id,
      actorIsStaff: isStaff(user),
      reason: parsed.reason,
    });

    revalidatePath("/account/rentals");
    revalidatePath("/account/listings");
    revalidatePath("/account/calendar");
  });
}

/** Owner accepts a request. */
export async function acceptBooking(input: BookingInput): Promise<ActionResult<void>> {
  return move(input, BookingStatus.ACCEPTED);
}

/** Owner declines a request. */
export async function declineBooking(input: BookingInput): Promise<ActionResult<void>> {
  return move(input, BookingStatus.DECLINED);
}

/** Either side cancels before handover. */
export async function cancelBooking(input: BookingInput): Promise<ActionResult<void>> {
  return move(input, BookingStatus.CANCELLED);
}

/** Owner has sent the garment. */
export async function markShipped(input: BookingInput): Promise<ActionResult<void>> {
  return move(input, BookingStatus.SHIPPED);
}

/** Owner has it ready to collect. */
export async function markReadyForPickup(input: BookingInput): Promise<ActionResult<void>> {
  return move(input, BookingStatus.READY_FOR_PICKUP);
}

/** Renter confirms it arrived. */
export async function markDelivered(input: BookingInput): Promise<ActionResult<void>> {
  return move(input, BookingStatus.DELIVERED);
}

/** Renter has started the return. */
export async function requestReturn(input: BookingInput): Promise<ActionResult<void>> {
  return move(input, BookingStatus.RETURN_REQUESTED);
}

/** Owner has the garment back. */
export async function markReturned(input: BookingInput): Promise<ActionResult<void>> {
  return move(input, BookingStatus.RETURNED);
}

/** Owner opens an inspection instead of closing straight away. */
export async function markInspection(input: BookingInput): Promise<ActionResult<void>> {
  return move(input, BookingStatus.INSPECTION);
}

/**
 * Owner closes the rental cleanly.
 *
 * This is the transition that releases the renter's deposit, so it deliberately
 * does two things in sequence: a completed rental whose deposit was never
 * returned is the worst outcome in the system.
 */
export async function completeBooking(input: BookingInput): Promise<ActionResult<void>> {
  return guard(async () => {
    const parsed = bookingSchema.parse(input);
    const user = await requireUserOrThrow();
    const db = await getDb();

    const booking = await db.rentalItem.findUnique({
      where: { id: parsed.bookingId },
      select: { rentalId: true },
    });

    await transitionBooking({
      bookingId: parsed.bookingId,
      to: BookingStatus.COMPLETED,
      actorId: user.id,
      actorIsStaff: isStaff(user),
      reason: parsed.reason ?? "Returned in good order",
    });

    if (booking) {
      // Nothing captured: a clean return means the whole deposit goes back.
      await settleDeposit({ rentalId: booking.rentalId, captureMinor: 0 });
    }

    revalidatePath("/account/rentals");
    revalidatePath("/account/listings");
    revalidatePath("/account/earnings");
  });
}
