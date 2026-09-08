"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminOrThrow, requireStaffOrThrow } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { type ActionResult, errors, guard } from "@/server/errors";

/**
 * Administrative actions.
 *
 * Two rules hold across every function here:
 *
 *  1. Authorisation is checked inside the action, not only by the page that
 *     renders the button. Server actions are addressable endpoints; a hidden
 *     button is not access control.
 *  2. Everything is written to `AuditLog`, in the same transaction as the
 *     change. A moderation decision that leaves no record of who made it is
 *     indistinguishable from an unauthorised one after the fact.
 */

async function audit(
  tx: Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["$transaction"]>[0]>[0],
  input: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  },
) {
  await tx.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata as never,
    },
  });
}

// ── Listing moderation ──────────────────────────────────────────────────────

/**
 * Every cached surface a listing appears on.
 *
 * Only `/shop` was being revalidated. The homepage caches for five minutes and
 * collections for ten, so an approval could take that long to appear — and,
 * the way round that actually matters, a listing that had just been rejected
 * or removed stayed on both until the cache expired. Rejection revalidated
 * nothing public at all.
 *
 * Item and wardrobe pages are not listed here: they read the session through
 * the root layout, so they are rendered per request and cannot go stale.
 */
function revalidatePublicListingSurfaces() {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/collections");
}

export async function approveListing(input: { listingId: string }): Promise<ActionResult<void>> {
  return guard(async () => {
    const staff = await requireStaffOrThrow();
    const parsed = z.object({ listingId: z.string().min(1).max(64) }).parse(input);
    const db = await getDb();

    await db.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({
        where: { id: parsed.listingId },
        select: { id: true, ownerId: true, item: { select: { title: true } } },
      });
      if (!listing) throw errors.notFound("listing");

      await tx.listing.update({
        where: { id: listing.id },
        data: {
          moderation: "APPROVED",
          status: "PUBLISHED",
          publishedAt: new Date(),
          moderationNote: null,
        },
      });

      await tx.notification.create({
        data: {
          userId: listing.ownerId,
          kind: "LISTING_APPROVED",
          title: `${listing.item.title} is live`,
          body: "Your piece is now visible in the wardrobe and can be rented.",
          href: "/account/listings",
        },
      });

      await audit(tx, {
        actorId: staff.id,
        action: "listing.approve",
        entityType: "Listing",
        entityId: listing.id,
      });
    });

    revalidatePath("/admin/listings");
    revalidatePublicListingSurfaces();
  });
}

export async function rejectListing(input: {
  listingId: string;
  note: string;
}): Promise<ActionResult<void>> {
  return guard(async () => {
    const staff = await requireStaffOrThrow();
    const parsed = z
      .object({
        listingId: z.string().min(1).max(64),
        note: z
          .string()
          .trim()
          .min(10, "Tell the owner what needs changing — a rejection with no reason is useless.")
          .max(500),
      })
      .parse(input);

    const db = await getDb();

    await db.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({
        where: { id: parsed.listingId },
        select: { id: true, ownerId: true, item: { select: { title: true } } },
      });
      if (!listing) throw errors.notFound("listing");

      await tx.listing.update({
        where: { id: listing.id },
        data: { moderation: "REJECTED", status: "DRAFT", moderationNote: parsed.note },
      });

      await tx.notification.create({
        data: {
          userId: listing.ownerId,
          kind: "LISTING_REJECTED",
          title: `${listing.item.title} needs a change`,
          body: parsed.note,
          href: "/account/listings",
        },
      });

      await audit(tx, {
        actorId: staff.id,
        action: "listing.reject",
        entityType: "Listing",
        entityId: listing.id,
        metadata: { note: parsed.note },
      });
    });

    revalidatePath("/admin/listings");
    revalidatePublicListingSurfaces();
  });
}

/** Pulls a live listing. Used when something is reported after publication. */
export async function removeListing(input: {
  listingId: string;
  note: string;
}): Promise<ActionResult<void>> {
  return guard(async () => {
    const staff = await requireStaffOrThrow();
    const parsed = z
      .object({ listingId: z.string().min(1).max(64), note: z.string().trim().min(5).max(500) })
      .parse(input);
    const db = await getDb();

    await db.$transaction(async (tx) => {
      await tx.listing.update({
        where: { id: parsed.listingId },
        data: { moderation: "REMOVED", status: "ARCHIVED", moderationNote: parsed.note },
      });
      await audit(tx, {
        actorId: staff.id,
        action: "listing.remove",
        entityType: "Listing",
        entityId: parsed.listingId,
        metadata: { note: parsed.note },
      });
    });

    revalidatePath("/admin/listings");
    revalidatePublicListingSurfaces();
  });
}

// ── Members ─────────────────────────────────────────────────────────────────

export async function suspendMember(input: {
  userId: string;
  reason: string;
}): Promise<ActionResult<void>> {
  return guard(async () => {
    const staff = await requireStaffOrThrow();
    const parsed = z
      .object({ userId: z.string().min(1).max(64), reason: z.string().trim().min(5).max(500) })
      .parse(input);
    const db = await getDb();

    const target = await db.user.findUnique({
      where: { id: parsed.userId },
      select: { id: true, role: true },
    });
    if (!target) throw errors.notFound("member");

    // Staff cannot suspend other staff. Removing a colleague's access is an
    // administrator decision, taken deliberately elsewhere.
    if (target.role !== "MEMBER") {
      throw errors.forbidden("Staff accounts cannot be suspended from here.");
    }

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: { status: "SUSPENDED", suspendedAt: new Date(), suspendedReason: parsed.reason },
      });

      // Suspension has to take effect now, not when the session expires.
      await tx.session.deleteMany({ where: { userId: target.id } });

      // And their listings come down with them.
      await tx.listing.updateMany({
        where: { ownerId: target.id, status: "PUBLISHED" },
        data: { status: "PAUSED" },
      });

      await audit(tx, {
        actorId: staff.id,
        action: "user.suspend",
        entityType: "User",
        entityId: target.id,
        metadata: { reason: parsed.reason },
      });
    });

    revalidatePath("/admin/users");
  });
}

export async function reinstateMember(input: { userId: string }): Promise<ActionResult<void>> {
  return guard(async () => {
    const staff = await requireStaffOrThrow();
    const db = await getDb();

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: input.userId },
        data: { status: "ACTIVE", suspendedAt: null, suspendedReason: null },
      });
      await audit(tx, {
        actorId: staff.id,
        action: "user.reinstate",
        entityType: "User",
        entityId: input.userId,
      });
    });

    revalidatePath("/admin/users");
  });
}

/** Granting staff access is an administrator-only action. */
export async function setMemberRole(input: {
  userId: string;
  role: "MEMBER" | "MODERATOR" | "ADMIN";
}): Promise<ActionResult<void>> {
  return guard(async () => {
    const admin = await requireAdminOrThrow();
    const parsed = z
      .object({
        userId: z.string().min(1).max(64),
        role: z.enum(["MEMBER", "MODERATOR", "ADMIN"]),
      })
      .parse(input);

    if (parsed.userId === admin.id) {
      throw errors.validation("You cannot change your own role.");
    }

    const db = await getDb();
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: parsed.userId }, data: { role: parsed.role } });
      await audit(tx, {
        actorId: admin.id,
        action: "user.role",
        entityType: "User",
        entityId: parsed.userId,
        metadata: { role: parsed.role },
      });
    });

    revalidatePath("/admin/users");
  });
}

// ── Verification ────────────────────────────────────────────────────────────

export async function reviewVerification(input: {
  verificationId: string;
  decision: "APPROVED" | "REJECTED";
  notes?: string;
}): Promise<ActionResult<void>> {
  return guard(async () => {
    const staff = await requireStaffOrThrow();
    const db = await getDb();

    await db.$transaction(async (tx) => {
      const verification = await tx.identityVerification.update({
        where: { id: input.verificationId },
        data: {
          status: input.decision,
          reviewedAt: new Date(),
          reviewedBy: staff.id,
          notes: input.notes,
        },
        select: { userId: true, kind: true },
      });

      if (input.decision === "APPROVED" && verification.kind === "GOVERNMENT_ID") {
        await tx.profile.updateMany({
          where: { userId: verification.userId },
          data: { isIdentityVerified: true },
        });
      }

      await audit(tx, {
        actorId: staff.id,
        action: `verification.${input.decision.toLowerCase()}`,
        entityType: "IdentityVerification",
        entityId: input.verificationId,
      });
    });

    revalidatePath("/admin/reports");
  });
}

// ── Reports ─────────────────────────────────────────────────────────────────

export async function resolveReport(input: {
  reportId: string;
  status: "ACTIONED" | "DISMISSED";
  note?: string;
}): Promise<ActionResult<void>> {
  return guard(async () => {
    const staff = await requireStaffOrThrow();
    const db = await getDb();

    await db.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: input.reportId },
        data: {
          status: input.status,
          reviewedBy: staff.id,
          reviewedAt: new Date(),
          actionNote: input.note,
        },
      });
      await audit(tx, {
        actorId: staff.id,
        action: `report.${input.status.toLowerCase()}`,
        entityType: "Report",
        entityId: input.reportId,
        metadata: { note: input.note },
      });
    });

    revalidatePath("/admin/reports");
  });
}

// ── Disputes ────────────────────────────────────────────────────────────────

export async function resolveDispute(input: {
  disputeId: string;
  outcome: "RENTER_FAVOURED" | "OWNER_FAVOURED" | "SPLIT" | "NO_ACTION";
  settlementRupees?: number;
  note: string;
}): Promise<ActionResult<void>> {
  return guard(async () => {
    const staff = await requireStaffOrThrow();
    const parsed = z
      .object({
        disputeId: z.string().min(1).max(64),
        outcome: z.enum(["RENTER_FAVOURED", "OWNER_FAVOURED", "SPLIT", "NO_ACTION"]),
        settlementRupees: z.number().int().min(0).max(1_000_000).optional(),
        note: z
          .string()
          .trim()
          .min(20, "Both members will read this. Explain the decision properly.")
          .max(2000),
      })
      .parse(input);

    const db = await getDb();

    await db.$transaction(async (tx) => {
      const dispute = await tx.dispute.update({
        where: { id: parsed.disputeId },
        data: {
          status: "RESOLVED",
          outcome: parsed.outcome,
          resolutionNote: parsed.note,
          settlementMinor: parsed.settlementRupees ? parsed.settlementRupees * 100 : null,
          resolvedAt: new Date(),
          resolvedBy: staff.id,
        },
        select: { rentalId: true, rental: { select: { renterId: true } } },
      });

      await tx.notification.create({
        data: {
          userId: dispute.rental.renterId,
          kind: "DISPUTE_OPENED",
          title: "Your dispute has been decided",
          body: parsed.note.slice(0, 200),
          href: "/account/rentals",
        },
      });

      await audit(tx, {
        actorId: staff.id,
        action: "dispute.resolve",
        entityType: "Dispute",
        entityId: parsed.disputeId,
        metadata: { outcome: parsed.outcome, settlementRupees: parsed.settlementRupees },
      });
    });

    revalidatePath("/admin/reports");
  });
}
