import type { Metadata } from "next";

import { AccountNav } from "@/components/account/account-nav";
import { requireUser } from "@/server/auth/session";
import { getAccountCounts } from "@/server/services/account";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * The member's area.
 *
 * Explicitly not a dashboard. There is no sidebar of icons, no widget grid, no
 * "Analytics". It is a wardrobe: the navigation is a horizontal row of named
 * places set in the same type as the rest of the site, and each place is about
 * clothes rather than about data.
 *
 * The same area serves both sides of the marketplace, because on Almirah they
 * are the same people — somebody renting a lehenga this weekend is lending a
 * blazer the next.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/account");
  const counts = await getAccountCounts(user.id);

  return (
    <div className="page-gutter pt-8 pb-24 sm:pt-12">
      <div className="page-width">
        <header className="mb-8">
          <p className="label text-ink-3">Your wardrobe</p>
          <h1 className="display-3 mt-3">{user.name}</h1>
        </header>

        <AccountNav counts={counts} isStaff={user.role === "ADMIN" || user.role === "MODERATOR"} />

        <div className="mt-10">{children}</div>
      </div>
    </div>
  );
}
