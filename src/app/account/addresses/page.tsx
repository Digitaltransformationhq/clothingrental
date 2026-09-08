import type { Metadata } from "next";

import { AddressBook } from "@/components/account/address-book";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Addresses" };

/**
 * Delivery addresses.
 *
 * The most sensitive data a member gives this marketplace, so the page says
 * plainly who can see it — an owner sees a shipping address only after a
 * booking is confirmed, and never before.
 */
export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const db = await getDb();

  const addresses = await db.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      label: true,
      recipient: true,
      phone: true,
      line1: true,
      line2: true,
      city: true,
      state: true,
      postalCode: true,
      isDefault: true,
    },
  });

  return (
    <div className="max-w-2xl">
      <h2 className="title-1 mb-2">Where things arrive</h2>
      <p className="body-lg mb-8">
        An owner only sees the address for a rental they have already accepted, and only until it is
        returned.
      </p>

      <AddressBook addresses={addresses} />
    </div>
  );
}
