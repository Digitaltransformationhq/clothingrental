"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isIsoDate, toUtcDate } from "@/domain/dates";
import { requireUserOrThrow } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { type ActionResult, errors, guard } from "@/server/errors";

/**
 * Availability blocks.
 *
 * An owner keeping dates for themselves. Two rules worth stating:
 *
 *  · The listing must belong to the caller. Scoped by ownerId, so a listing id
 *    from somebody else's wardrobe simply finds nothing.
 *  · A block may not be placed over a live booking. An owner who has accepted a
 *    rental cannot quietly make those dates unavailable and leave the renter
 *    with a garment that is no longer coming.
 */

const blockSchema = z.object({
  listingId: z.string().min(1).max(64),
  start: z.string().refine(isIsoDate, "Choose a start date"),
  end: z.string().refine(isIsoDate, "Choose an end date"),
  reason: z
    .enum(["OWNER_BLOCKED", "MAINTENANCE", "PERSONAL_USE", "CLEANING"])
    .default("OWNER_BLOCKED"),
  note: z.string().max(200).optional(),
});

export async function blockDates(
  input: z.input<typeof blockSchema>,
): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const parsed = blockSchema.parse(input);
    if (parsed.end <= parsed.start) {
      throw errors.validation("The end date has to come after the start date.");
    }

    const user = await requireUserOrThrow();
    const db = await getDb();

    const listing = await db.listing.findFirst({
      where: { id: parsed.listingId, ownerId: user.id },
      select: { id: true },
    });
    if (!listing) throw errors.notFound("listing");

    const clash = await db.rentalItem.findFirst({
      where: {
        listingId: listing.id,
        status: { notIn: ["CANCELLED", "DECLINED", "COMPLETED"] },
        startDate: { lt: toUtcDate(parsed.end) },
        endDate: { gt: toUtcDate(parsed.start) },
      },
      select: { id: true },
    });

    if (clash) {
      throw errors.conflict(
        "Someone has already booked part of that window. Cancel the booking first if you need those dates.",
      );
    }

    const created = await db.availabilityBlock.create({
      data: {
        listingId: listing.id,
        startDate: toUtcDate(parsed.start),
        endDate: toUtcDate(parsed.end),
        reason: parsed.reason,
        note: parsed.note,
      },
      select: { id: true },
    });

    revalidatePath("/account/calendar");
    return created;
  });
}

export async function unblockDates(input: { blockId: string }): Promise<ActionResult<void>> {
  return guard(async () => {
    const user = await requireUserOrThrow();
    const db = await getDb();

    const deleted = await db.availabilityBlock.deleteMany({
      where: { id: input.blockId, listing: { ownerId: user.id } },
    });
    if (deleted.count === 0) throw errors.notFound("blocked window");

    revalidatePath("/account/calendar");
  });
}
