import "server-only";

import { getDb } from "@/server/db/client";
import { errors } from "@/server/errors";

/**
 * Messaging.
 *
 * Threads are anchored to a listing and, once a booking exists, to a rental —
 * so a conversation always has a subject, and system events ("Booking
 * accepted", "Payment received") can be written into the same stream the two
 * members are already reading.
 *
 * Membership is the authorisation model: a thread is readable only by the
 * people in its `ConversationMember` rows. Every function here takes the
 * caller's id and filters on it.
 */

export async function getConversations(userId: string) {
  const db = await getDb();

  const memberships = await db.conversationMember.findMany({
    where: { userId },
    orderBy: { conversation: { lastMessageAt: "desc" } },
    select: {
      lastReadAt: true,
      conversation: {
        select: {
          id: true,
          subject: true,
          lastMessageAt: true,
          listing: {
            select: {
              item: {
                select: {
                  slug: true,
                  title: true,
                  images: {
                    orderBy: { position: "asc" },
                    take: 1,
                    select: { storageKey: true, blurDataUrl: true },
                  },
                },
              },
            },
          },
          rental: { select: { reference: true, status: true } },
          members: {
            where: { userId: { not: userId } },
            select: { user: { select: { id: true, name: true, image: true } } },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true, kind: true, senderId: true, createdAt: true },
          },
        },
      },
    },
  });

  return memberships.map((membership) => {
    const conversation = membership.conversation;
    const latest = conversation.messages[0];
    return {
      id: conversation.id,
      subject: conversation.subject,
      lastMessageAt: conversation.lastMessageAt,
      unread: !membership.lastReadAt || conversation.lastMessageAt > membership.lastReadAt,
      counterpart: conversation.members[0]?.user ?? null,
      listing: conversation.listing?.item ?? null,
      rental: conversation.rental,
      preview: latest
        ? { body: latest.body, kind: latest.kind, fromMe: latest.senderId === userId }
        : null,
    };
  });
}

export type ConversationSummary = Awaited<ReturnType<typeof getConversations>>[number];

/**
 * One thread, with its messages.
 *
 * Returns null rather than throwing when the caller is not a member, so the
 * page can render a not-found — which tells an outsider nothing about whether
 * the thread exists.
 */
export async function getConversation(conversationId: string, userId: string) {
  const db = await getDb();

  const membership = await db.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true },
  });
  if (!membership) return null;

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      subject: true,
      listing: {
        select: {
          id: true,
          baseRateMinor: true,
          baseDurationDays: true,
          currency: true,
          item: {
            select: {
              slug: true,
              title: true,
              brand: { select: { name: true } },
              images: {
                orderBy: { position: "asc" },
                take: 1,
                select: { storageKey: true, alt: true, blurDataUrl: true },
              },
            },
          },
        },
      },
      rental: {
        select: {
          id: true,
          reference: true,
          status: true,
          items: { select: { status: true, startDate: true, endDate: true } },
        },
      },
      members: {
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              profile: { select: { handle: true, city: true, isIdentityVerified: true } },
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        where: { moderation: { not: "REMOVED" } },
        select: {
          id: true,
          body: true,
          kind: true,
          systemEvent: true,
          senderId: true,
          createdAt: true,
        },
      },
    },
  });

  if (!conversation) return null;

  // Marking as read on open is what makes the unread count mean anything.
  await db.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });

  return {
    ...conversation,
    counterpart: conversation.members.find((member) => member.userId !== userId)?.user ?? null,
  };
}

export type ConversationDetail = NonNullable<Awaited<ReturnType<typeof getConversation>>>;

/** Posts a message. Membership is checked, not assumed. */
export async function sendMessage(input: {
  conversationId: string;
  senderId: string;
  body: string;
}): Promise<{ id: string }> {
  const db = await getDb();

  const membership = await db.conversationMember.findUnique({
    where: {
      conversationId_userId: { conversationId: input.conversationId, userId: input.senderId },
    },
    select: { id: true },
  });
  if (!membership) throw errors.notFound("conversation");

  const body = input.body.trim();
  if (body.length === 0) throw errors.validation("Write something first.");
  if (body.length > 4000) throw errors.validation("That message is too long.");

  return db.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: { conversationId: input.conversationId, senderId: input.senderId, kind: "TEXT", body },
      select: { id: true },
    });

    // Keeps thread ordering correct without an aggregate over messages.
    await tx.conversation.update({
      where: { id: input.conversationId },
      data: { lastMessageAt: new Date() },
    });

    // Everyone else in the thread gets told.
    const others = await tx.conversationMember.findMany({
      where: { conversationId: input.conversationId, userId: { not: input.senderId } },
      select: { userId: true },
    });

    if (others.length > 0) {
      const sender = await tx.user.findUnique({
        where: { id: input.senderId },
        select: { name: true },
      });

      await tx.notification.createMany({
        data: others.map((member) => ({
          userId: member.userId,
          kind: "MESSAGE_RECEIVED" as const,
          title: `${sender?.name ?? "Someone"} sent you a message`,
          body: body.slice(0, 140),
          href: `/account/messages/${input.conversationId}`,
        })),
      });
    }

    return message;
  });
}

/**
 * Finds or creates the thread between a renter and an owner about a listing.
 *
 * Idempotent, so "Ask a question" from a listing page always lands in the same
 * conversation rather than starting a new one each time.
 */
export async function openConversation(input: {
  listingId: string;
  askerId: string;
}): Promise<{ conversationId: string }> {
  const db = await getDb();

  const listing = await db.listing.findFirst({
    where: { id: input.listingId, status: "PUBLISHED", moderation: "APPROVED" },
    select: { id: true, ownerId: true, item: { select: { title: true } } },
  });
  if (!listing) throw errors.notFound("piece");
  if (listing.ownerId === input.askerId) {
    throw errors.validation("That is your own piece.");
  }

  const existing = await db.conversation.findFirst({
    where: {
      listingId: listing.id,
      AND: [
        { members: { some: { userId: input.askerId } } },
        { members: { some: { userId: listing.ownerId } } },
      ],
    },
    select: { id: true },
  });

  if (existing) return { conversationId: existing.id };

  const conversation = await db.conversation.create({
    data: {
      listingId: listing.id,
      subject: listing.item.title,
      members: { create: [{ userId: input.askerId }, { userId: listing.ownerId }] },
    },
    select: { id: true },
  });

  return { conversationId: conversation.id };
}

/**
 * Writes a platform event into a thread.
 *
 * System messages carry a machine-readable `systemEvent` alongside their prose,
 * so the interface can render them natively rather than parsing the text.
 */
export async function postSystemMessage(input: {
  rentalId: string;
  event: string;
  body: string;
}): Promise<void> {
  const db = await getDb();

  const conversations = await db.conversation.findMany({
    where: { rentalId: input.rentalId },
    select: { id: true },
  });

  for (const conversation of conversations) {
    await db.message.create({
      data: {
        conversationId: conversation.id,
        senderId: null,
        kind: "SYSTEM",
        systemEvent: input.event,
        body: input.body,
        rentalId: input.rentalId,
      },
    });
    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });
  }
}
