"use server";

import { z } from "zod";

import { isIsoDate } from "@/domain/dates";
import { requireUserOrThrow } from "@/server/auth/session";
import { createBooking } from "@/server/services/booking";
import { type ActionResult, guard } from "@/server/errors";
import { checkRateLimit } from "@/server/rate-limit";

/**
 * Checkout actions.
 *
 * Note what crosses this boundary: a listing id, two dates, and a handover
 * choice. No prices, no totals, no availability claim, no user id. Everything
 * else is derived on the server inside the booking transaction.
 *
 * That is not defensive paranoia — it is the only design in which a member
 * cannot pay ₹1 for a ₹12,000 lehenga by editing a form field.
 */

const startCheckoutSchema = z.object({
  listingId: z.string().min(1).max(64),
  start: z.string().refine(isIsoDate, "Choose a valid start date"),
  end: z.string().refine(isIsoDate, "Choose a valid return date"),
  fulfilment: z.enum(["PICKUP", "LOCAL_DELIVERY", "SHIPPING"]),
  addressId: z.string().max(64).optional(),
  note: z.string().max(500).optional(),
});

export async function startCheckout(
  input: z.input<typeof startCheckoutSchema>,
): Promise<ActionResult<{ rentalId: string; reference: string }>> {
  return guard(async () => {
    const parsed = startCheckoutSchema.parse(input);
    const user = await requireUserOrThrow();

    // Booking writes rows and takes locks; it is worth a limit of its own.
    await checkRateLimit({ key: `checkout:${user.id}`, limit: 12, windowSeconds: 60 });

    const draft = await createBooking({
      renterId: user.id,
      items: [{ listingId: parsed.listingId, start: parsed.start, end: parsed.end }],
      fulfilment: parsed.fulfilment,
      // Pickup needs no address; anything else is chosen on the checkout page,
      // where the member can add one.
      deliveryAddressId: parsed.fulfilment === "PICKUP" ? undefined : parsed.addressId,
      note: parsed.note,
    });

    return { rentalId: draft.rentalId, reference: draft.reference };
  });
}
