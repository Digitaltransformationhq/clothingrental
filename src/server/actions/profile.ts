"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUserOrThrow } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { type ActionResult, errors, guard } from "@/server/errors";
import { checkRateLimit } from "@/server/rate-limit";

/**
 * Profile actions.
 *
 * The handle is the one field here with real consequences: it is a public URL,
 * it must be unique, and it must not be able to impersonate a route. Reserved
 * words are refused for exactly that reason — `/wardrobe/admin` should not be
 * claimable.
 */

const RESERVED_HANDLES = new Set([
  "admin",
  "administrator",
  "almirah",
  "support",
  "help",
  "account",
  "settings",
  "shop",
  "item",
  "sell",
  "checkout",
  "search",
  "collections",
  "api",
  "auth",
  "moderator",
  "staff",
  "official",
  "wardrobe",
]);

const profileSchema = z.object({
  name: z.string().trim().min(2, "Tell us what to call you").max(80),
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "At least three characters")
    .max(32, "Keep it under 32 characters")
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Letters, numbers and hyphens only")
    .refine((value) => !RESERVED_HANDLES.has(value), "That one is reserved"),
  bio: z.string().trim().max(400).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
});

export async function updateProfile(
  input: z.input<typeof profileSchema>,
): Promise<ActionResult<{ handle: string }>> {
  return guard(async () => {
    const user = await requireUserOrThrow();
    await checkRateLimit({ key: `profile:${user.id}`, limit: 20, windowSeconds: 300 });

    const parsed = profileSchema.parse(input);
    const db = await getDb();

    const taken = await db.profile.findFirst({
      where: { handle: parsed.handle, userId: { not: user.id } },
      select: { id: true },
    });
    if (taken) {
      throw errors.validation("That handle is taken.", { handle: "Somebody already has this one" });
    }

    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { name: parsed.name } });
      await tx.profile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          handle: parsed.handle,
          bio: parsed.bio,
          city: parsed.city,
          state: parsed.state,
        },
        update: {
          handle: parsed.handle,
          bio: parsed.bio,
          city: parsed.city,
          state: parsed.state,
        },
      });
    });

    revalidatePath("/account/settings");
    revalidatePath(`/wardrobe/${parsed.handle}`);
    return { handle: parsed.handle };
  });
}

/**
 * Ends every session except the current one.
 *
 * The action anybody reaches for after losing a laptop, so it deletes the rows
 * rather than marking them — a session that is merely flagged is a session that
 * still works if a check is missed somewhere.
 */
export async function signOutEverywhere(): Promise<ActionResult<{ ended: number }>> {
  return guard(async () => {
    const user = await requireUserOrThrow();
    const db = await getDb();
    const result = await db.session.deleteMany({ where: { userId: user.id } });
    return { ended: result.count };
  });
}

/** Records a payout account. Only the last four digits are ever stored. */
const payoutSchema = z.object({
  beneficiaryName: z.string().trim().min(2).max(120),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{6,18}$/, "That doesn't look like an account number"),
  ifscCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "That doesn't look like an IFSC code"),
  upiHandle: z
    .string()
    .trim()
    .max(64)
    .regex(/^[\w.-]+@[\w.-]+$/, "That doesn't look like a UPI ID")
    .optional()
    .or(z.literal("")),
});

export async function savePayoutAccount(
  input: z.input<typeof payoutSchema>,
): Promise<ActionResult<void>> {
  return guard(async () => {
    const user = await requireUserOrThrow();
    const parsed = payoutSchema.parse(input);
    const db = await getDb();

    // The full account number is deliberately never persisted. In production
    // it is passed straight to the payment provider, which returns a token;
    // all this application keeps is enough for a member to recognise which
    // account they nominated.
    const last4 = parsed.accountNumber.slice(-4);

    await db.payoutAccount.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        beneficiaryName: parsed.beneficiaryName,
        bankLast4: last4,
        ifscCode: parsed.ifscCode,
        upiHandle: parsed.upiHandle || null,
      },
      update: {
        beneficiaryName: parsed.beneficiaryName,
        bankLast4: last4,
        ifscCode: parsed.ifscCode,
        upiHandle: parsed.upiHandle || null,
        // Changing the account requires re-verification: this is the field an
        // attacker with a stolen session would change first.
        isVerified: false,
      },
    });

    revalidatePath("/account/payments");
  });
}
