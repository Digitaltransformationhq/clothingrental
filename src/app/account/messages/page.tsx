import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { formatRelativeTime } from "@/domain/dates";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { mediaUrl } from "@/lib/media";
import { requireUser } from "@/server/auth/session";
import { getConversations } from "@/server/services/messaging";

export const metadata: Metadata = { title: "Messages" };

/**
 * The message list.
 *
 * Each row leads with the garment rather than the person, because that is what
 * the conversation is about and what makes one thread distinguishable from
 * another when you have eleven of them.
 */
export default async function MessagesPage() {
  const user = await requireUser("/account/messages");
  const conversations = await getConversations(user.id);

  if (conversations.length === 0) {
    return (
      <EmptyState
        title="No messages yet."
        body="When you ask an owner a question — or somebody asks you about one of your pieces — the conversation will be here."
        action={<ButtonLink href="/shop">Browse the wardrobe</ButtonLink>}
        className="border-t-0"
      />
    );
  }

  return (
    <ul className="border-rule border-t">
      {conversations.map((conversation) => {
        const image = conversation.listing?.images[0];

        return (
          <li key={conversation.id}>
            <Link
              href={`/account/messages/${conversation.id}`}
              className="border-rule hover:bg-paper-2 flex items-center gap-4 border-b py-4 transition-colors"
            >
              <span className="bg-paper-3 relative aspect-[4/5] w-12 shrink-0 overflow-hidden">
                {image ? (
                  <Image
                    src={mediaUrl(image.storageKey)}
                    alt=""
                    fill
                    sizes="48px"
                    placeholder={image.blurDataUrl ? "blur" : "empty"}
                    blurDataURL={image.blurDataUrl ?? undefined}
                    className="object-cover"
                  />
                ) : null}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span
                    className={cn(
                      "text-body truncate",
                      conversation.unread ? "text-ink font-medium" : "text-ink",
                    )}
                  >
                    {conversation.listing?.title ?? conversation.subject ?? "Conversation"}
                  </span>
                  <span className="meta text-ink-3 shrink-0">
                    {formatRelativeTime(conversation.lastMessageAt)}
                  </span>
                </span>

                <span className="meta text-ink-3 mt-0.5 block truncate">
                  {conversation.counterpart?.name ?? "Almirah"}
                  {conversation.rental ? (
                    <span className="numeric"> · {conversation.rental.reference}</span>
                  ) : null}
                </span>

                {conversation.preview ? (
                  <span
                    className={cn(
                      "text-small mt-1 block truncate",
                      conversation.unread ? "text-ink" : "text-ink-2",
                    )}
                  >
                    {conversation.preview.kind === "SYSTEM" ? (
                      <span className="text-ink-3">{conversation.preview.body}</span>
                    ) : (
                      <>
                        {conversation.preview.fromMe ? (
                          <span className="text-ink-3">You: </span>
                        ) : null}
                        {conversation.preview.body}
                      </>
                    )}
                  </span>
                ) : null}
              </span>

              {conversation.unread ? (
                <span aria-label="Unread" className="bg-claret h-1.5 w-1.5 shrink-0 rounded-full" />
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
