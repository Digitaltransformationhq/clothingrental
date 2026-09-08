"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { UserRound } from "lucide-react";

import type { CurrentUser } from "@/server/auth/session";
import { authClient } from "@/lib/auth-client";
import { initialsAvatar } from "@/lib/media";
import { cn } from "@/lib/cn";

/**
 * The account control.
 *
 * Signed out it is a plain link — a menu containing one item is a menu nobody
 * wanted. Signed in it opens the member's own areas, which are named for what
 * they hold rather than for their function: "My wardrobe", not "Listings".
 */

const MEMBER_LINKS = [
  { href: "/account/rentals", label: "My rentals" },
  { href: "/account/listings", label: "My wardrobe" },
  { href: "/account/wishlist", label: "Saved pieces" },
  { href: "/account/messages", label: "Messages" },
  { href: "/account/calendar", label: "Availability" },
  { href: "/account/earnings", label: "Earnings" },
] as const;

export function HeaderAccount({ user }: { user: CurrentUser | null }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  if (!user) {
    return (
      <Link
        href="/auth/sign-in"
        aria-label="Sign in"
        className={cn(
          "text-small text-ink-2 hover:text-ink inline-flex h-9 items-center justify-center px-2 whitespace-nowrap transition-colors sm:px-3",
          "group-data-[on-dark=true]/header:hover:text-ink-inverse group-data-[on-dark=true]/header:text-[color:color-mix(in_oklab,var(--color-ink-inverse)_80%,transparent)]",
        )}
      >
        <UserRound
          className="h-[1.15rem] w-[1.15rem] sm:hidden"
          strokeWidth={1.4}
          aria-hidden="true"
        />
        <span className="hidden sm:inline">Sign in</span>
      </Link>
    );
  }

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
    } catch {
      setSigningOut(false);
      return;
    }
    // Refresh, and nothing after it.
    //
    // The cookie clears fine; the session is read in server components, so the
    // tree has to be refetched before the header knows. refresh() does that
    // and invalidates the whole client router cache, which also drops the
    // /account payloads rendered while signed in.
    //
    // This used to be `router.refresh()` followed by `router.push("/")`, and
    // the push superseded the refetch before it landed — so the cookie went,
    // the header carried on showing the account menu, and the button sat on
    // "Signing out…" for ever. There is nothing to push to: signing out is not
    // a navigation.
    router.refresh();
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          "text-small text-ink inline-flex h-10 items-center gap-2 px-2 transition-opacity hover:opacity-70 data-[state=open]:opacity-70",
          "group-data-[on-dark=true]/header:text-ink-inverse",
        )}
        aria-label={`Account — ${user.name}`}
      >
        <span
          className={cn(
            "border-rule relative h-7 w-7 overflow-hidden rounded-full border",
            "group-data-[on-dark=true]/header:border-[color:color-mix(in_oklab,var(--color-ink-inverse)_40%,transparent)]",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a data URI needs no optimisation pipeline */}
          <img
            src={user.image ?? initialsAvatar(user.name, 340)}
            alt=""
            width={28}
            height={28}
            className="h-full w-full object-cover"
          />
        </span>
        <span className="hidden xl:inline">{user.name.split(" ")[0]}</span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={10}
          className="border-rule bg-surface data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 min-w-56 border shadow-[var(--shadow-overlay)]"
        >
          <div className="border-rule border-b px-4 py-3">
            <p className="text-small text-ink font-medium">{user.name}</p>
            <p className="meta text-ink-3 truncate">{user.email}</p>
          </div>

          <div className="py-1">
            {MEMBER_LINKS.map((link) => (
              <DropdownMenu.Item key={link.href} asChild>
                <Link
                  href={link.href}
                  className="text-small text-ink-2 hover:bg-paper-2 hover:text-ink data-[highlighted]:bg-paper-2 data-[highlighted]:text-ink block cursor-pointer px-4 py-2 transition-colors outline-none"
                >
                  {link.label}
                </Link>
              </DropdownMenu.Item>
            ))}
          </div>

          {(user.role === "ADMIN" || user.role === "MODERATOR") && (
            <div className="border-rule border-t py-1">
              <DropdownMenu.Item asChild>
                <Link
                  href="/admin"
                  className="text-small text-ink-2 hover:bg-paper-2 hover:text-ink data-[highlighted]:bg-paper-2 data-[highlighted]:text-ink block cursor-pointer px-4 py-2 transition-colors outline-none"
                >
                  Administration
                </Link>
              </DropdownMenu.Item>
            </div>
          )}

          <div className="border-rule border-t py-1">
            <DropdownMenu.Item asChild>
              <Link
                href="/account/settings"
                className="text-small text-ink-2 hover:bg-paper-2 hover:text-ink data-[highlighted]:bg-paper-2 data-[highlighted]:text-ink block cursor-pointer px-4 py-2 transition-colors outline-none"
              >
                Settings
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={(event) => {
                event.preventDefault();
                void onSignOut();
              }}
              className="text-small text-ink-2 hover:bg-paper-2 hover:text-ink data-[highlighted]:bg-paper-2 data-[highlighted]:text-ink w-full cursor-pointer px-4 py-2 text-left transition-colors outline-none"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </DropdownMenu.Item>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
