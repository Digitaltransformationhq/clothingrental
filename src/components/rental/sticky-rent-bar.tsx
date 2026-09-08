"use client";

import * as React from "react";

import { formatMoney, money } from "@/domain/money";
import { cn } from "@/lib/cn";

/**
 * The mobile action bar.
 *
 * On a phone the rental panel sits a long way down the page, below three
 * full-height photographs. This keeps the price and the action reachable, and
 * scrolls the panel into view rather than trying to reproduce it in a bar.
 *
 * It appears only once the member has scrolled past the first photograph —
 * showing it immediately would cover the opening image, which is the thing
 * doing the selling.
 */
export function StickyRentBar({
  priceMinor,
  currency,
  days,
  instantBook,
  hidden = false,
}: {
  priceMinor: number;
  currency: string;
  days: number;
  instantBook: boolean;
  hidden?: boolean;
}) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (hidden) return;
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.7);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hidden]);

  if (hidden) return null;

  const scrollToPanel = () => {
    const panel = document.querySelector<HTMLElement>("[data-rental-panel]");
    if (panel) {
      panel.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    window.scrollTo({ top: document.body.scrollHeight * 0.4, behavior: "smooth" });
  };

  return (
    <div
      className={cn(
        "border-rule bg-paper/96 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-[6px] lg:hidden",
        "transition-transform duration-[--duration-base] ease-[--ease-editorial]",
        visible ? "translate-y-0" : "translate-y-full",
      )}
      // Hidden from assistive technology when off-screen: the rental panel
      // itself is in the document and is the canonical control.
      aria-hidden={!visible}
    >
      <div className="flex items-center justify-between gap-4 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
        <div>
          <p className="numeric text-body text-ink">
            {formatMoney(money(priceMinor, currency as "INR"))}
            <span className="text-ink-3"> / {days} days</span>
          </p>
          <p className="meta text-ink-3">Deposit refundable</p>
        </div>
        <button
          type="button"
          onClick={scrollToPanel}
          tabIndex={visible ? 0 : -1}
          className="bg-ink text-ink-inverse h-12 shrink-0 px-6 text-[0.75rem] tracking-[0.12em] uppercase"
        >
          {instantBook ? "Rent now" : "Check dates"}
        </button>
      </div>
    </div>
  );
}
