"use client";

import * as React from "react";

/**
 * Sharing a wishlist.
 *
 * Uses the platform share sheet where there is one — on a phone that is what
 * people expect — and falls back to copying the link. The confirmation is a
 * label change rather than a toast, because a toast for "copied" is more
 * interface than the action deserves.
 */
export function ShareWishlist({ token }: { token: string }) {
  const [copied, setCopied] = React.useState(false);

  const share = async () => {
    const url = `${window.location.origin}/wishlist/${token}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "My Almirah wishlist", url });
        return;
      } catch {
        // Cancelled, or unsupported in this context — fall through to copying.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  return (
    <button type="button" onClick={share} className="link-underline text-small text-ink">
      {copied ? "Link copied" : "Share this list"}
    </button>
  );
}
