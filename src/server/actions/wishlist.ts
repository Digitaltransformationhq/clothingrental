"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/server/db/client";
import { requireUserOrThrow } from "@/server/auth/session";
import { type ActionResult, guard } from "@/server/errors";

/**
 * Wishlist actions.
 *
 * The wishlist is the lowest-friction thing a member can do, so it is also the
 * most attacked surface for cheap abuse — a loop that saves every listing to
 * inflate its counter. The listing id is validated, the wishlist is resolved
 * from the session rather than from the request, and the counter is moved in
 * the same transaction as the row so the two cannot drift.
 */

const listingIdSchema = z.object({ listingId: z.string().min(1).max(64) });

export async function toggleWishlist(input: {
  listingId: string;
}): Promise<ActionResult<{ saved: boolean }>> {
  return guard(async () => {
    const { listingId } = listingIdSchema.parse(input);
    const user = await requireUserOrThrow();
    const db = await getDb();

    return db.$transaction(async (tx) => {
      // The wishlist is found by user id from the session. A wishlist id from
      // the client would let anyone write to anyone's saved pieces.
      const wishlist = await tx.wishlist.upsert({
        where: { userId: user.id },
        create: { userId: user.id, shareToken: crypto.randomUUID().replaceAll("-", "") },
        update: {},
        select: { id: true },
      });

      const existing = await tx.wishlistItem.findUnique({
        where: { wishlistId_listingId: { wishlistId: wishlist.id, listingId } },
        select: { id: true },
      });

      if (existing) {
        await tx.wishlistItem.delete({ where: { id: existing.id } });
        await tx.listing.update({
          where: { id: listingId },
          data: { wishlistCount: { decrement: 1 } },
        });
        revalidatePath("/account/wishlist");
        return { saved: false };
      }

      // Confirms the listing is real and public before counting it.
      const listing = await tx.listing.findFirst({
        where: { id: listingId, status: "PUBLISHED", moderation: "APPROVED" },
        select: { id: true },
      });
      if (!listing) {
        throw new Error("listing not available");
      }

      await tx.wishlistItem.create({ data: { wishlistId: wishlist.id, listingId } });
      await tx.listing.update({
        where: { id: listingId },
        data: { wishlistCount: { increment: 1 } },
      });

      revalidatePath("/account/wishlist");
      return { saved: true };
    });
  });
}

/** The set of listing ids a member has saved, for painting hearts on a grid. */
export async function getSavedListingIds(): Promise<Set<string>> {
  const db = await getDb();
  const { getCurrentUser } = await import("@/server/auth/session");
  const user = await getCurrentUser();
  if (!user) return new Set();

  const items = await db.wishlistItem.findMany({
    where: { wishlist: { userId: user.id } },
    select: { listingId: true },
  });
  return new Set(items.map((item) => item.listingId));
}
