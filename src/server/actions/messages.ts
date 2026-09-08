"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUserOrThrow } from "@/server/auth/session";
import { type ActionResult, guard } from "@/server/errors";
import { checkRateLimit } from "@/server/rate-limit";
import { openConversation, sendMessage } from "@/server/services/messaging";

/**
 * Messaging actions.
 *
 * Rate limited more tightly than most: messaging is the surface a marketplace
 * gets abused through, and thirty messages a minute is not a conversation.
 */

export async function postMessage(input: {
  conversationId: string;
  body: string;
}): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const parsed = z
      .object({
        conversationId: z.string().min(1).max(64),
        body: z.string().trim().min(1, "Write something first.").max(4000),
      })
      .parse(input);

    const user = await requireUserOrThrow();
    await checkRateLimit({
      key: `message:${user.id}`,
      limit: 30,
      windowSeconds: 60,
      message: "You are sending messages very quickly. Give it a moment.",
    });

    const message = await sendMessage({
      conversationId: parsed.conversationId,
      senderId: user.id,
      body: parsed.body,
    });

    revalidatePath(`/account/messages/${parsed.conversationId}`);
    revalidatePath("/account/messages");
    return message;
  });
}

/** Opens (or reuses) the thread between a member and a listing's owner. */
export async function startConversation(input: {
  listingId: string;
}): Promise<ActionResult<{ conversationId: string }>> {
  return guard(async () => {
    const parsed = z.object({ listingId: z.string().min(1).max(64) }).parse(input);
    const user = await requireUserOrThrow();
    await checkRateLimit({ key: `thread:${user.id}`, limit: 20, windowSeconds: 300 });

    return openConversation({ listingId: parsed.listingId, askerId: user.id });
  });
}
