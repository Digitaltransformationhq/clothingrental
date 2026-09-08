"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import type { AccountCounts } from "@/server/services/account";

/**
 * Navigation for the member's area.
 *
 * A horizontal row of named places rather than a sidebar. A sidebar is what an
 * administration tool has; this is somebody's cupboard, and it has six places
 * in it.
 *
 * Counts appear only where the number means something is waiting — pending
 * requests, unread messages. A count beside "Saved pieces" would be decoration.
 */

const LINKS = [
  { href: "/account/rentals", label: "My rentals", count: "activeRentals" },
  { href: "/account/listings", label: "My wardrobe", count: "pendingRequests" },
  { href: "/account/calendar", label: "Availability" },
  { href: "/account/wishlist", label: "Saved" },
  { href: "/account/messages", label: "Messages", count: "unreadMessages" },
  { href: "/account/earnings", label: "Earnings" },
  { href: "/account/settings", label: "Settings" },
] as const;

export function AccountNav({ counts, isStaff }: { counts: AccountCounts; isStaff: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Your account" className="border-rule border-b">
      {/* Scrolls rather than wrapping on a phone, so the row keeps its shape. */}
      <ul className="-mb-px flex [scrollbar-width:none] gap-6 overflow-x-auto sm:gap-8 [&::-webkit-scrollbar]:hidden">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          const count =
            "count" in link && link.count ? counts[link.count as keyof AccountCounts] : 0;

          return (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-small flex items-center gap-2 border-b-2 py-3.5 transition-colors",
                  active
                    ? "border-ink text-ink"
                    : "text-ink-2 hover:border-rule-strong hover:text-ink border-transparent",
                )}
              >
                {link.label}
                {count > 0 ? (
                  <span className="numeric bg-claret text-ink-inverse inline-grid h-4.5 min-w-4.5 place-items-center px-1 text-[0.625rem]">
                    {count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}

        {isStaff ? (
          <li className="shrink-0">
            <Link
              href="/admin"
              className="text-small text-ink-3 hover:text-ink flex items-center gap-2 border-b-2 border-transparent py-3.5 transition-colors"
            >
              Administration
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
