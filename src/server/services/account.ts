import "server-only";

import { cache } from "react";

import { OCCUPYING_STATUSES } from "@/domain/rental/state-machine";
import { getDb } from "@/server/db/client";

/**
 * The member's own data.
 *
 * Every query here is scoped by a user id that came from the session. There is
 * no function in this module that takes an id from a request and trusts it.
 */

export interface AccountCounts {
  activeRentals: number;
  pendingRequests: number;
  unreadMessages: number;
}

export const getAccountCounts = cache(async (userId: string): Promise<AccountCounts> => {
  const db = await getDb();

  const [activeRentals, pendingRequests, conversations] = await Promise.all([
    // Rentals the member is taking that are still live.
    db.rentalItem.count({
      where: {
        rental: { renterId: userId },
        status: { in: ["ACCEPTED", "READY_FOR_PICKUP", "SHIPPED", "DELIVERED", "ACTIVE"] },
      },
    }),
    // Requests waiting on the member as an owner. This is the one number that
    // genuinely needs acting on, which is why it is the one shown in claret.
    db.rentalItem.count({ where: { ownerId: userId, status: "REQUESTED" } }),
    db.conversationMember.findMany({
      where: { userId },
      select: { lastReadAt: true, conversation: { select: { lastMessageAt: true } } },
    }),
  ]);

  const unreadMessages = conversations.filter(
    (member) => !member.lastReadAt || member.conversation.lastMessageAt > member.lastReadAt,
  ).length;

  return { activeRentals, pendingRequests, unreadMessages };
});

/**
 * Rentals the member is taking, split into what is happening now and what has
 * already happened. "Upcoming" leads, because that is what somebody opening
 * this page wants to know.
 */
export async function getMyRentals(userId: string) {
  const db = await getDb();

  const rows = await db.rentalItem.findMany({
    where: { rental: { renterId: userId } },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      days: true,
      lineSubtotalMinor: true,
      depositMinor: true,
      rental: {
        select: {
          id: true,
          reference: true,
          currency: true,
          totalMinor: true,
          fulfilment: true,
          status: true,
        },
      },
      delivery: { select: { status: true, carrier: true, trackingNumber: true } },
      reviews: { where: { direction: "RENTER_ON_ITEM" }, select: { id: true } },
      listing: {
        select: {
          id: true,
          city: true,
          owner: { select: { id: true, name: true } },
          item: {
            select: {
              slug: true,
              title: true,
              brand: { select: { name: true } },
              size: { select: { label: true } },
              images: {
                orderBy: { position: "asc" },
                take: 1,
                select: { storageKey: true, alt: true, blurDataUrl: true },
              },
            },
          },
        },
      },
    },
  });

  const finished: typeof rows = [];
  const live: typeof rows = [];

  for (const row of rows) {
    if (["COMPLETED", "CANCELLED", "DECLINED"].includes(row.status)) finished.push(row);
    else live.push(row);
  }

  // Finished rentals read best newest-first; upcoming ones soonest-first.
  finished.reverse();

  return { live, finished };
}

export type MyRental = Awaited<ReturnType<typeof getMyRentals>>["live"][number];

/** The member's own listings, with the numbers an owner actually watches. */
export async function getMyListings(userId: string) {
  const db = await getDb();

  return db.listing.findMany({
    where: { ownerId: userId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      moderation: true,
      moderationNote: true,
      currency: true,
      baseRateMinor: true,
      baseDurationDays: true,
      viewCount: true,
      wishlistCount: true,
      rentalCount: true,
      ratingAvgBps: true,
      ratingCount: true,
      city: true,
      instantBook: true,
      item: {
        select: {
          slug: true,
          title: true,
          brand: { select: { name: true } },
          size: { select: { label: true } },
          images: {
            orderBy: { position: "asc" },
            take: 1,
            select: { storageKey: true, alt: true, blurDataUrl: true },
          },
        },
      },
      bookings: {
        where: { status: { in: [...OCCUPYING_STATUSES] } },
        orderBy: { startDate: "asc" },
        select: { id: true, status: true, startDate: true, endDate: true },
      },
    },
  });
}

export type MyListing = Awaited<ReturnType<typeof getMyListings>>[number];

/** Bookings on the member's own pieces — the owner's side of the marketplace. */
export async function getMyBookings(userId: string) {
  const db = await getDb();

  return db.rentalItem.findMany({
    where: { ownerId: userId },
    orderBy: [{ status: "asc" }, { startDate: "asc" }],
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      days: true,
      ownerEarningsMinor: true,
      commissionMinor: true,
      lineSubtotalMinor: true,
      createdAt: true,
      rental: {
        select: {
          reference: true,
          currency: true,
          fulfilment: true,
          renter: {
            select: {
              id: true,
              name: true,
              profile: {
                select: {
                  city: true,
                  isIdentityVerified: true,
                  ratingAvgBps: true,
                  ratingCount: true,
                },
              },
            },
          },
        },
      },
      listing: {
        select: {
          item: {
            select: {
              slug: true,
              title: true,
              images: {
                orderBy: { position: "asc" },
                take: 1,
                select: { storageKey: true, alt: true, blurDataUrl: true },
              },
            },
          },
        },
      },
    },
  });
}

export type MyBooking = Awaited<ReturnType<typeof getMyBookings>>[number];

/**
 * Earnings.
 *
 * Three figures matter to an owner: what has been paid out, what is earned but
 * not yet settled, and what is coming from rentals that have not happened yet.
 * Conflating them is how a marketplace ends up arguing about money.
 */
export async function getEarnings(userId: string) {
  const db = await getDb();

  const [completed, upcoming, payouts, listingCount, profile] = await Promise.all([
    db.rentalItem.findMany({
      where: { ownerId: userId, status: "COMPLETED" },
      select: {
        id: true,
        ownerEarningsMinor: true,
        commissionMinor: true,
        payoutItems: { select: { id: true } },
      },
    }),
    db.rentalItem.aggregate({
      where: {
        ownerId: userId,
        status: {
          in: [
            "ACCEPTED",
            "READY_FOR_PICKUP",
            "SHIPPED",
            "DELIVERED",
            "ACTIVE",
            "RETURNED",
            "INSPECTION",
          ],
        },
      },
      _sum: { ownerEarningsMinor: true },
      _count: true,
    }),
    db.payout.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reference: true,
        amountMinor: true,
        currency: true,
        status: true,
        paidAt: true,
        createdAt: true,
        items: { select: { id: true } },
      },
    }),
    db.listing.count({ where: { ownerId: userId, status: "PUBLISHED" } }),
    db.profile.findUnique({
      where: { userId },
      select: { ratingAvgBps: true, ratingCount: true, rentalsHosted: true },
    }),
  ]);

  // Settled if the booking already belongs to a payout; available otherwise.
  const settledMinor = completed
    .filter((line) => line.payoutItems.length > 0)
    .reduce((total, line) => total + line.ownerEarningsMinor, 0);

  const availableMinor = completed
    .filter((line) => line.payoutItems.length === 0)
    .reduce((total, line) => total + line.ownerEarningsMinor, 0);

  const commissionMinor = completed.reduce((total, line) => total + line.commissionMinor, 0);

  return {
    availableMinor,
    settledMinor,
    pendingMinor: upcoming._sum.ownerEarningsMinor ?? 0,
    upcomingCount: upcoming._count,
    commissionMinor,
    lifetimeMinor: settledMinor + availableMinor,
    payouts,
    listingCount,
    rating: {
      avgBps: profile?.ratingAvgBps ?? 0,
      count: profile?.ratingCount ?? 0,
      hosted: profile?.rentalsHosted ?? 0,
    },
  };
}

export type Earnings = Awaited<ReturnType<typeof getEarnings>>;

/** Saved pieces, with enough to render a full listing tile. */
export async function getWishlist(userId: string) {
  const db = await getDb();
  const { listingCardSelect, toListingCard } = await import("./listing-view");

  const wishlist = await db.wishlist.findUnique({
    where: { userId },
    select: {
      shareToken: true,
      items: {
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          listing: { select: listingCardSelect },
        },
      },
    },
  });

  if (!wishlist) return { shareToken: null, listings: [] };

  return {
    shareToken: wishlist.shareToken,
    listings: wishlist.items.map((item) => toListingCard(item.listing)),
  };
}
