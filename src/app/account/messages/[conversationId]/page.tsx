import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDateRange, toIsoDate } from "@/domain/dates";
import { formatMoney, money } from "@/domain/money";
import { describeStatus, statusTone } from "@/domain/rental/state-machine";
import { MessageComposer } from "@/components/messaging/message-composer";
import { MessageStream } from "@/components/messaging/message-stream";
import { Chip } from "@/components/ui/primitives";
import { mediaUrl } from "@/lib/media";
import { requireUser } from "@/server/auth/session";
import { getConversation } from "@/server/services/messaging";

export const metadata: Metadata = { title: "Conversation", robots: { index: false } };

type Params = Promise<{ conversationId: string }>;

/**
 * One conversation.
 *
 * The garment sits at the top and stays there, because almost every message in
 * a rental marketplace is a question about the thing — "will it fit", "can I
 * collect on Friday" — and having to scroll away to check is a small,
 * repeated annoyance.
 */
export default async function ConversationPage({ params }: { params: Params }) {
  const { conversationId } = await params;
  const user = await requireUser("/account/messages");
  const conversation = await getConversation(conversationId, user.id);

  // Null covers both "does not exist" and "not yours", deliberately.
  if (!conversation) notFound();

  const listing = conversation.listing;
  const image = listing?.item.images[0];
  const booking = conversation.rental?.items[0];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/account/messages" className="link-underline meta text-ink-2">
        ← All messages
      </Link>

      {/* ── What this is about ────────────────────────────────────────────── */}
      {listing ? (
        <div className="border-rule bg-surface mt-5 flex items-center gap-4 border p-4">
          <Link
            href={`/item/${listing.item.slug}`}
            className="bg-paper-3 relative aspect-[4/5] w-14 shrink-0 overflow-hidden"
          >
            {image ? (
              <Image
                src={mediaUrl(image.storageKey)}
                alt=""
                fill
                sizes="56px"
                placeholder={image.blurDataUrl ? "blur" : "empty"}
                blurDataURL={image.blurDataUrl ?? undefined}
                className="object-cover"
              />
            ) : null}
          </Link>

          <div className="min-w-0 flex-1">
            {listing.item.brand ? (
              <p className="meta text-ink-3 tracking-[0.1em] uppercase">
                {listing.item.brand.name}
              </p>
            ) : null}
            <p className="text-body text-ink">
              <Link href={`/item/${listing.item.slug}`} className="link-underline">
                {listing.item.title}
              </Link>
            </p>
            <p className="meta text-ink-3 mt-0.5">
              <span className="numeric">
                {formatMoney(money(listing.baseRateMinor, listing.currency as "INR"))}
              </span>{" "}
              / {listing.baseDurationDays} days
              {booking ? (
                <>
                  {" · "}
                  {formatDateRange({
                    start: toIsoDate(booking.startDate),
                    end: toIsoDate(booking.endDate),
                  })}
                </>
              ) : null}
            </p>
          </div>

          {booking ? (
            <Chip tone={statusTone(booking.status)}>{describeStatus(booking.status)}</Chip>
          ) : null}
        </div>
      ) : null}

      {/* ── Who ───────────────────────────────────────────────────────────── */}
      {conversation.counterpart ? (
        <p className="meta text-ink-3 mt-5 flex flex-wrap items-center gap-x-2">
          <span>Talking to</span>
          {conversation.counterpart.profile?.handle ? (
            <Link
              href={`/wardrobe/${conversation.counterpart.profile.handle}`}
              className="link-underline text-ink"
            >
              {conversation.counterpart.name}
            </Link>
          ) : (
            <span className="text-ink">{conversation.counterpart.name}</span>
          )}
          {conversation.counterpart.profile?.city ? (
            <span>· {conversation.counterpart.profile.city}</span>
          ) : null}
          {conversation.counterpart.profile?.isIdentityVerified ? (
            <span className="text-positive">· Verified</span>
          ) : null}
        </p>
      ) : null}

      <MessageStream
        messages={conversation.messages.map((message) => ({
          id: message.id,
          body: message.body,
          kind: message.kind,
          systemEvent: message.systemEvent,
          fromMe: message.senderId === user.id,
          createdAt: message.createdAt.toISOString(),
        }))}
        counterpartName={conversation.counterpart?.name ?? "Almirah"}
        className="mt-8"
      />

      <MessageComposer conversationId={conversation.id} className="mt-6" />

      <p className="meta border-rule text-ink-3 mt-6 border-t pt-4">
        Keep conversations and payments on Almirah. Moving off the platform means your rental is not
        covered, and there is no deposit held if something goes wrong.
      </p>
    </div>
  );
}
