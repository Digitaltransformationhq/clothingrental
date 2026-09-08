"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { toggleWishlist } from "@/server/actions/wishlist";
import { cn } from "@/lib/cn";

/**
 * The wishlist control.
 *
 * Optimistic: the heart fills the instant it is pressed and reverts if the
 * server disagrees. Saving something you like should never feel like waiting
 * for a network.
 *
 * The animation is a single, quick scale — enough to confirm the press, short
 * enough that a member saving six pieces in a row is not made to watch six
 * animations.
 */
export function WishlistButton({
  listingId,
  title,
  initialSaved = false,
  className,
  size = "md",
}: {
  listingId: string;
  title: string;
  initialSaved?: boolean;
  className?: string;
  size?: "md" | "lg";
}) {
  const router = useRouter();
  const [saved, setSaved] = React.useState(initialSaved);
  const [pending, startTransition] = React.useTransition();
  const [pulse, setPulse] = React.useState(false);

  // Keeps the control honest when the server re-renders with a different truth
  // (signed in elsewhere, saved from another tab). Adjusted during render by
  // comparing against the previous prop, rather than in an effect — an effect
  // here would paint the stale value first and then correct it.
  const [lastInitial, setLastInitial] = React.useState(initialSaved);
  if (lastInitial !== initialSaved) {
    setLastInitial(initialSaved);
    setSaved(initialSaved);
  }

  const onClick = (event: React.MouseEvent) => {
    // The tile is a link; saving must not navigate.
    event.preventDefault();
    event.stopPropagation();

    const next = !saved;
    setSaved(next);
    if (next) {
      setPulse(true);
      window.setTimeout(() => setPulse(false), 240);
    }

    startTransition(async () => {
      const result = await toggleWishlist({ listingId });
      if (!result.ok) {
        setSaved(!next);
        // The overwhelmingly common cause is not being signed in.
        if (result.error.code === "UNAUTHENTICATED") {
          router.push(`/auth/sign-in?next=${encodeURIComponent(`/item`)}`);
        }
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
      disabled={pending}
      className={cn(
        // Always visible. It used to fade in on hover, with a carve-out for
        // touch, where there is no hover to fade in from — which meant the
        // control existed on a phone and had to be discovered on a desktop. It
        // sits beside the metadata rather than over the photograph now, so
        // there is nothing for it to keep out of the way of.
        "text-ink grid place-items-center",
        size === "lg" ? "h-11 w-11" : "h-10 w-10",
        className,
      )}
    >
      <svg
        viewBox="0 0 20 18"
        className={cn(
          "transition-transform duration-[--duration-quick] ease-[--ease-editorial]",
          size === "lg" ? "h-5 w-5" : "h-[1.05rem] w-[1.05rem]",
          pulse && "scale-125",
        )}
        fill={saved ? "var(--color-claret)" : "rgba(255,253,250,0.55)"}
        stroke={saved ? "var(--color-claret)" : "var(--color-ink)"}
        strokeWidth="1.25"
        aria-hidden="true"
      >
        <path
          d="M10 17S1.5 11.6 1.5 5.9A4.4 4.4 0 0 1 10 3.7a4.4 4.4 0 0 1 8.5 2.2C18.5 11.6 10 17 10 17Z"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
