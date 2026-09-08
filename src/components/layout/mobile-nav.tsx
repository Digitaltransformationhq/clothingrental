"use client";

import * as React from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";

import type { CurrentUser } from "@/server/auth/session";
import { Eyebrow } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

/**
 * Mobile navigation.
 *
 * A full-height drawer rather than a dropdown, so the navigation gets the same
 * editorial treatment as the rest of the site instead of being squeezed into a
 * list. Radix handles the focus trap, the escape key and the inert background,
 * which are the parts of a dialog that are tedious to get right and obvious
 * when they are wrong.
 */

const BROWSE = [
  { href: "/shop", label: "Everything" },
  { href: "/shop/sarees", label: "Sarees" },
  { href: "/shop/lehengas", label: "Lehengas" },
  { href: "/shop/dresses", label: "Dresses" },
  { href: "/shop/blazers", label: "Tailoring" },
  { href: "/shop/sherwanis", label: "Sherwanis" },
  { href: "/collections", label: "Collections" },
] as const;

const ACCOUNT = [
  { href: "/account/rentals", label: "My rentals" },
  { href: "/account/listings", label: "My wardrobe" },
  { href: "/account/wishlist", label: "Saved pieces" },
  { href: "/account/messages", label: "Messages" },
  { href: "/account/earnings", label: "Earnings" },
] as const;

export function MobileNav({ user }: { user: CurrentUser | null }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className={cn(
          "text-ink -ml-2 inline-flex h-10 w-10 items-center justify-center lg:hidden",
          "group-data-[on-dark=true]/header:text-ink-inverse",
        )}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="bg-obsidian/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50" />
        <Dialog.Content className="bg-paper data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left fixed inset-y-0 left-0 z-50 flex w-[min(22rem,88vw)] flex-col overflow-y-auto duration-300">
          <Dialog.Title className="sr-only">Menu</Dialog.Title>

          <div className="border-rule flex items-center justify-between border-b px-6 py-5">
            <span className="font-display text-[1.25rem] tracking-[0.18em]">ALMIRAH</span>
            <Dialog.Close aria-label="Close menu" className="text-ink-2 hover:text-ink -mr-2 p-2">
              <X className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <nav className="flex-1 px-6 py-8" aria-label="Mobile">
            <Eyebrow className="mb-4">Browse</Eyebrow>
            <ul className="space-y-1">
              {BROWSE.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="font-display text-ink block py-2 text-[1.5rem] leading-tight transition-opacity hover:opacity-60"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="border-rule mt-10 border-t pt-8">
              <Eyebrow className="mb-4">{user ? "Your account" : "Join"}</Eyebrow>
              <ul className="space-y-3">
                {user ? (
                  ACCOUNT.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="text-body text-ink-2 hover:text-ink block transition-colors"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))
                ) : (
                  <>
                    <li>
                      <Link
                        href="/auth/sign-in"
                        onClick={() => setOpen(false)}
                        className="text-body text-ink-2 hover:text-ink block transition-colors"
                      >
                        Sign in
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/auth/sign-up"
                        onClick={() => setOpen(false)}
                        className="text-body text-ink-2 hover:text-ink block transition-colors"
                      >
                        Create an account
                      </Link>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </nav>

          <div className="border-rule border-t p-6">
            <Link
              href="/sell"
              onClick={() => setOpen(false)}
              className="bg-ink text-ink-inverse flex h-12 w-full items-center justify-center text-[0.75rem] tracking-[0.14em] uppercase"
            >
              List your clothes
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
