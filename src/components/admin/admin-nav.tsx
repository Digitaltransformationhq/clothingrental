"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import type { ModerationCounts } from "@/server/services/admin";

const LINKS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/listings", label: "Listings", count: "listings" },
  { href: "/admin/users", label: "Members" },
  { href: "/admin/orders", label: "Rentals" },
  { href: "/admin/payouts", label: "Payouts", count: "payouts" },
  { href: "/admin/reports", label: "Reports", count: "reports" },
] as const;

export function AdminNav({ counts }: { counts: ModerationCounts }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Administration">
      <ul className="flex flex-wrap gap-1">
        {LINKS.map((link) => {
          const active =
            "exact" in link && link.exact ? pathname === link.href : pathname.startsWith(link.href);
          const count =
            "count" in link && link.count ? counts[link.count as keyof ModerationCounts] : 0;

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-small inline-flex items-center gap-2 border px-3.5 py-2 transition-colors",
                  active
                    ? "border-ink bg-ink text-ink-inverse"
                    : "border-rule bg-surface text-ink-2 hover:border-ink hover:text-ink",
                )}
              >
                {link.label}
                {count > 0 ? (
                  <span
                    className={cn(
                      "numeric inline-grid h-4 min-w-4 place-items-center px-1 text-[0.625rem]",
                      active ? "bg-paper text-ink" : "bg-claret text-ink-inverse",
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
