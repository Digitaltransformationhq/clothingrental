import type { Metadata } from "next";

import { toIsoDate } from "@/domain/dates";
import { OwnerCalendar } from "@/components/account/owner-calendar";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { OCCUPYING_STATUSES } from "@/domain/rental/state-machine";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Availability" };

/**
 * The owner's calendar.
 *
 * One month grid per garment would be unreadable at eleven pieces, so this is a
 * single calendar with a garment selector: pick a piece, see what is booked and
 * what you have blocked, and block or free dates in place.
 */
export default async function CalendarPage() {
  const user = await requireUser("/account/calendar");
  const db = await getDb();

  const listings = await db.listing.findMany({
    where: { ownerId: user.id, status: { in: ["PUBLISHED", "PAUSED", "PENDING_REVIEW"] } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      minRentalDays: true,
      maxRentalDays: true,
      bufferDays: true,
      leadTimeDays: true,
      item: {
        select: {
          title: true,
          images: {
            orderBy: { position: "asc" },
            take: 1,
            select: { storageKey: true, blurDataUrl: true },
          },
        },
      },
      bookings: {
        where: { status: { in: [...OCCUPYING_STATUSES] } },
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          bufferDays: true,
          rental: { select: { renter: { select: { name: true } } } },
        },
      },
      blocks: {
        select: { id: true, startDate: true, endDate: true, reason: true, note: true },
      },
    },
  });

  if (listings.length === 0) {
    return (
      <EmptyState
        title="Nothing to schedule yet."
        body="Once you have listed a piece, this is where you keep dates for yourself and see what is booked."
        action={<ButtonLink href="/sell/new">List a piece</ButtonLink>}
        className="border-t-0"
      />
    );
  }

  return (
    <OwnerCalendar
      listings={listings.map((listing) => ({
        id: listing.id,
        title: listing.item.title,
        image: listing.item.images[0] ?? null,
        status: listing.status,
        policy: {
          minRentalDays: listing.minRentalDays,
          maxRentalDays: listing.maxRentalDays,
          bufferDays: listing.bufferDays,
          leadTimeDays: listing.leadTimeDays,
        },
        bookings: listing.bookings.map((booking) => ({
          id: booking.id,
          status: booking.status,
          renter: booking.rental.renter.name,
          bufferDays: booking.bufferDays,
          start: toIsoDate(booking.startDate),
          end: toIsoDate(booking.endDate),
        })),
        blocks: listing.blocks.map((block) => ({
          id: block.id,
          reason: block.reason,
          note: block.note,
          start: toIsoDate(block.startDate),
          end: toIsoDate(block.endDate),
        })),
      }))}
    />
  );
}
