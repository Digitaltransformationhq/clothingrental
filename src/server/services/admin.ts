import "server-only";

import { cache } from "react";

import { getDb } from "@/server/db/client";

/**
 * Administration queries.
 *
 * Every function here is only ever called from a page or action that has
 * already passed `requireStaff`. None of them takes an actor id, because none
 * of them is scoped to a person — that is exactly what makes them privileged
 * and why the guard sits above them rather than inside them.
 */

export interface ModerationCounts {
  listings: number;
  reports: number;
  disputes: number;
  verifications: number;
  payouts: number;
}

export const getModerationCounts = cache(async (): Promise<ModerationCounts> => {
  const db = await getDb();

  const [listings, reports, disputes, verifications, payouts] = await Promise.all([
    db.listing.count({ where: { moderation: "PENDING" } }),
    db.report.count({ where: { status: { in: ["PENDING", "REVIEWING"] } } }),
    db.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW", "AWAITING_RESPONSE"] } } }),
    db.identityVerification.count({ where: { status: "PENDING" } }),
    db.payout.count({ where: { status: { in: ["SCHEDULED", "PROCESSING"] } } }),
  ]);

  return { listings, reports, disputes, verifications, payouts };
});

/** The marketplace at a glance. */
export async function getPlatformOverview() {
  const db = await getDb();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

  const [members, listings, liveListings, rentals, recentRentals, gross, commission, deposits] =
    await Promise.all([
      db.user.count(),
      db.listing.count(),
      db.listing.count({ where: { status: "PUBLISHED", moderation: "APPROVED" } }),
      db.rental.count(),
      db.rental.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      db.rental.aggregate({
        where: { status: { in: ["CONFIRMED", "ACTIVE", "COMPLETED"] } },
        _sum: { totalMinor: true, depositMinor: true },
      }),
      db.rentalItem.aggregate({
        where: { status: "COMPLETED" },
        _sum: { commissionMinor: true, ownerEarningsMinor: true },
      }),
      db.securityDeposit.aggregate({
        where: { status: "HELD" },
        _sum: { amountMinor: true },
      }),
    ]);

  const grossMinor = gross._sum.totalMinor ?? 0;
  const heldDeposits = deposits._sum.amountMinor ?? 0;

  return {
    members,
    listings,
    liveListings,
    rentals,
    recentRentals,
    // Deposits are held, not earned. Counting them as revenue is the classic
    // way a marketplace overstates itself to its own operators.
    grossMerchandiseMinor: grossMinor - (gross._sum.depositMinor ?? 0),
    commissionMinor: commission._sum.commissionMinor ?? 0,
    ownerEarningsMinor: commission._sum.ownerEarningsMinor ?? 0,
    depositsHeldMinor: heldDeposits,
  };
}

/** The moderation queue. Oldest first — nothing should wait indefinitely. */
export async function getModerationQueue(status: "PENDING" | "REJECTED" | "FLAGGED" = "PENDING") {
  const db = await getDb();

  return db.listing.findMany({
    where: { moderation: status },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      id: true,
      status: true,
      moderation: true,
      moderationNote: true,
      baseRateMinor: true,
      baseDurationDays: true,
      depositMinor: true,
      currency: true,
      city: true,
      createdAt: true,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          profile: { select: { isIdentityVerified: true, rentalsHosted: true } },
        },
      },
      item: {
        select: {
          slug: true,
          title: true,
          description: true,
          condition: true,
          retailPriceMinor: true,
          brand: { select: { name: true } },
          category: { select: { name: true } },
          images: {
            orderBy: { position: "asc" },
            select: { storageKey: true, alt: true, blurDataUrl: true },
          },
        },
      },
    },
  });
}

export type ModerationItem = Awaited<ReturnType<typeof getModerationQueue>>[number];

export async function getMembers(query?: string) {
  const db = await getDb();

  return db.user.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      suspendedReason: true,
      profile: {
        select: {
          handle: true,
          city: true,
          isIdentityVerified: true,
          rentalsHosted: true,
          rentalsTaken: true,
          ratingAvgBps: true,
          ratingCount: true,
        },
      },
      _count: { select: { listings: true, rentals: true } },
    },
  });
}

export async function getRentalsForAdmin() {
  const db = await getDb();

  return db.rental.findMany({
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      reference: true,
      status: true,
      totalMinor: true,
      depositMinor: true,
      currency: true,
      createdAt: true,
      renter: { select: { name: true, email: true } },
      payments: {
        select: { status: true, provider: true },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
      items: {
        select: {
          status: true,
          startDate: true,
          endDate: true,
          owner: { select: { name: true } },
          listing: { select: { item: { select: { title: true, slug: true } } } },
        },
      },
    },
  });
}

export async function getPayoutsForAdmin() {
  const db = await getDb();

  return db.payout.findMany({
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      reference: true,
      amountMinor: true,
      currency: true,
      status: true,
      paidAt: true,
      createdAt: true,
      failureMessage: true,
      owner: {
        select: {
          name: true,
          email: true,
          payoutAccount: { select: { bankLast4: true, isVerified: true } },
        },
      },
      items: { select: { id: true } },
    },
  });
}

export async function getReportsForAdmin() {
  const db = await getDb();

  return db.report.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: 60,
    select: {
      id: true,
      subject: true,
      subjectId: true,
      reason: true,
      detail: true,
      status: true,
      createdAt: true,
      actionNote: true,
      reporter: { select: { name: true, email: true } },
    },
  });
}

export async function getDisputesForAdmin() {
  const db = await getDb();

  return db.dispute.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: 60,
    select: {
      id: true,
      status: true,
      outcome: true,
      reason: true,
      detail: true,
      settlementMinor: true,
      createdAt: true,
      resolvedAt: true,
      openedBy: { select: { name: true } },
      rental: {
        select: {
          reference: true,
          totalMinor: true,
          depositMinor: true,
          currency: true,
          renter: { select: { name: true } },
        },
      },
    },
  });
}

/**
 * The identity-verification queue.
 *
 * Pending first and oldest first, because a member waiting on verification
 * cannot rent — the queue order is somebody's blocked evening. Resolved rows
 * are kept in the list so a decision can be read back and, if it was wrong,
 * reversed.
 *
 * `documentKey` is deliberately not selected. It is a storage key for a
 * government ID; the review interface needs to know a document was submitted,
 * not to put it on a page.
 */
export async function getVerificationsForAdmin() {
  const db = await getDb();

  const rows = await db.identityVerification.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: 60,
    select: {
      id: true,
      kind: true,
      status: true,
      notes: true,
      createdAt: true,
      reviewedAt: true,
      documentKey: true,
      user: { select: { name: true, email: true, profile: { select: { handle: true } } } },
    },
  });

  // The key is reduced to a yes/no here so it cannot travel any further. A
  // reviewer needs to know a document was submitted; nothing on the page needs
  // the key itself, and a props object is a short trip from a client bundle.
  return rows.map(({ documentKey, ...row }) => ({ ...row, hasDocument: documentKey !== null }));
}
