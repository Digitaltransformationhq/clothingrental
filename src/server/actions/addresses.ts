"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUserOrThrow } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { type ActionResult, errors, guard } from "@/server/errors";

/**
 * Address actions.
 *
 * Addresses are the most sensitive personal data this marketplace holds, so
 * every read and write is scoped to the session's user id. There is no code
 * path that fetches an address by id alone.
 */

const addressSchema = z.object({
  label: z.string().max(40).optional(),
  recipient: z.string().min(2, "Who should it be addressed to?").max(120),
  phone: z
    .string()
    .min(8, "A phone number helps the courier find you.")
    .max(20)
    .regex(/^[+\d][\d\s-]{7,}$/, "That doesn't look like a phone number."),
  line1: z.string().min(4, "Add the street address.").max(160),
  line2: z.string().max(160).optional(),
  landmark: z.string().max(120).optional(),
  city: z.string().min(2, "Add a city.").max(80),
  state: z.string().min(2, "Add a state.").max(80),
  postalCode: z
    .string()
    .regex(/^\d{6}$/, "Indian PIN codes are six digits.")
    .describe("PIN code"),
  isDefault: z.boolean().optional(),
});

export type AddressInput = z.input<typeof addressSchema>;

export async function saveAddress(
  input: AddressInput & { id?: string },
): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const user = await requireUserOrThrow();
    const parsed = addressSchema.parse(input);
    const db = await getDb();

    return db.$transaction(async (tx) => {
      // Only one default per member.
      if (parsed.isDefault) {
        await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      }

      if (input.id) {
        // Scoped by userId, so an id belonging to somebody else updates nothing.
        const updated = await tx.address.updateMany({
          where: { id: input.id, userId: user.id },
          data: { ...parsed, country: "IN" },
        });
        if (updated.count === 0) throw errors.notFound("address");
        revalidatePath("/account/addresses");
        return { id: input.id };
      }

      const count = await tx.address.count({ where: { userId: user.id } });
      const created = await tx.address.create({
        data: {
          ...parsed,
          userId: user.id,
          country: "IN",
          // The first address a member adds is their default, without asking.
          isDefault: parsed.isDefault ?? count === 0,
        },
        select: { id: true },
      });

      revalidatePath("/account/addresses");
      return created;
    });
  });
}

export async function deleteAddress(input: { id: string }): Promise<ActionResult<void>> {
  return guard(async () => {
    const user = await requireUserOrThrow();
    const db = await getDb();
    const deleted = await db.address.deleteMany({ where: { id: input.id, userId: user.id } });
    if (deleted.count === 0) throw errors.notFound("address");
    revalidatePath("/account/addresses");
  });
}

/** Attaches an address to a rental that is still awaiting payment. */
export async function setRentalAddress(input: {
  rentalId: string;
  addressId: string;
}): Promise<ActionResult<void>> {
  return guard(async () => {
    const user = await requireUserOrThrow();
    const db = await getDb();

    // Both the rental and the address must belong to the caller.
    const [rental, address] = await Promise.all([
      db.rental.findFirst({
        where: { id: input.rentalId, renterId: user.id },
        select: { id: true, status: true },
      }),
      db.address.findFirst({
        where: { id: input.addressId, userId: user.id },
        select: { id: true },
      }),
    ]);

    if (!rental) throw errors.notFound("rental");
    if (!address) throw errors.notFound("address");
    if (rental.status !== "PAYMENT_PENDING" && rental.status !== "DRAFT") {
      throw errors.conflict("This rental has already been confirmed.");
    }

    await db.rental.update({
      where: { id: rental.id },
      data: { deliveryAddressId: address.id },
    });

    revalidatePath(`/checkout/${rental.id}`);
  });
}

export async function listAddresses() {
  const user = await requireUserOrThrow();
  const db = await getDb();
  return db.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}
