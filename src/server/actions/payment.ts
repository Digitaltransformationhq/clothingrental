"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUserOrThrow } from "@/server/auth/session";
import { type ActionResult, guard } from "@/server/errors";
import { checkRateLimit } from "@/server/rate-limit";
import { beginPayment, type PaymentSession, settlePayment } from "@/server/services/payments";

/**
 * Payment actions.
 *
 * Both take a rental or order id and nothing else that matters. The amount, the
 * currency and whether the money actually arrived are all established
 * server-side against the provider.
 */

export async function createPaymentSession(input: {
  rentalId: string;
}): Promise<ActionResult<PaymentSession>> {
  return guard(async () => {
    const { rentalId } = z.object({ rentalId: z.string().min(1).max(64) }).parse(input);
    const user = await requireUserOrThrow();
    await checkRateLimit({ key: `pay:${user.id}`, limit: 20, windowSeconds: 60 });
    return beginPayment({ rentalId, userId: user.id });
  });
}

export async function confirmPayment(input: {
  providerOrderId: string;
  providerPaymentId: string;
}): Promise<ActionResult<{ status: "confirmed" | "failed"; rentalId: string; message?: string }>> {
  return guard(async () => {
    const parsed = z
      .object({
        providerOrderId: z.string().min(1).max(128),
        providerPaymentId: z.string().min(1).max(128),
      })
      .parse(input);

    const user = await requireUserOrThrow();
    await checkRateLimit({ key: `confirm:${user.id}`, limit: 20, windowSeconds: 60 });

    const result = await settlePayment({ ...parsed, userId: user.id });

    revalidatePath("/account/rentals");
    return result;
  });
}
