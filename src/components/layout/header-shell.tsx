"use client";

import { usePathname } from "next/navigation";
import * as React from "react";

import { cn } from "@/lib/cn";

/**
 * The masthead's shell and its scroll behaviour.
 *
 * Two states, and the difference between them is ground, not geometry:
 *
 *  · At the top of a page the bar is transparent and part of the composition —
 *    the editorial opening runs straight under it.
 *  · Once the page moves it takes on a hairline and a lightly veiled ground. It
 *    has stopped being part of the page and become furniture.
 *
 * The height does not change. It used to shrink on scroll, which meant the
 * masthead resized under the reader's eye and every element measured against it
 * — the dropdown panel's offset, the auth split's viewport calculation — had
 * two different right answers depending on scroll position. One number is worth
 * more than the flourish was.
 *
 * It stays a custom property rather than a class so the wordmark, the nav and
 * the dropdown panel all read from that one number.
 *
 * On a page that opens with a full-bleed photograph the bar has no ground of
 * its own to sit on, so it sits on the picture: the opening is pulled up
 * underneath it and `data-on-dark` flips the controls to inverse ink. That
 * lasts only until the page moves — once the bar condenses it has a paper
 * ground again and takes its dark ink back.
 *
 * The header never hides on scroll. Search and the account are wanted at
 * unpredictable moments, and a masthead that plays hide-and-seek is a
 * well-documented way to irritate people.
 */
/**
 * Routes whose first section is a full-bleed photograph that runs up under the
 * masthead. Read during render rather than probed from the DOM on mount, so the
 * bar is never painted in the wrong ink and corrected a frame later.
 */
const DARK_OPENINGS: readonly string[] = ["/", "/sell"];

export function HeaderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [condensed, setCondensed] = React.useState(false);

  // Only while the bar is still transparent: once condensed it has its own
  // paper ground, and inverse ink on that would be unreadable.
  const onDark = DARK_OPENINGS.includes(pathname) && !condensed;

  React.useEffect(() => {
    let frame = 0;

    const onScroll = () => {
      // Reads are coalesced into a frame: `scroll` fires far more often than
      // the screen repaints, and measuring on every event is wasted work.
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        // A deliberate threshold rather than `> 0`: a one-pixel overscroll on a
        // trackpad should not flicker the bar between its two states.
        setCondensed(window.scrollY > 24);
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      data-condensed={condensed}
      data-on-dark={onDark}
      className={cn(
        "group/header sticky top-0 z-50",
        // One height, at every scroll position and in both states.
        "[--header-h:3.5rem] lg:[--header-h:4.25rem]",
        "transition-[background-color,border-color,backdrop-filter]",
        "duration-[--duration-base] ease-[--ease-editorial]",
        condensed
          ? "border-rule bg-paper/85 border-b backdrop-blur-xl backdrop-saturate-150"
          : "border-b border-transparent bg-transparent",
      )}
    >
      {children}
    </header>
  );
}
