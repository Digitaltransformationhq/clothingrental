"use client";

import * as React from "react";

import { cn } from "@/lib/cn";
import { IMAGE_SIZES } from "@/lib/media";
import type { ListingCard } from "@/server/services/listing-view";
import { ListingTile } from "./listing-tile";

/**
 * A horizontal product rail.
 *
 * Used instead of another four-column grid, because a rail says "there is more
 * of this" in a way a grid cannot, and because it lets the homepage change
 * rhythm between sections.
 *
 * It scrolls natively — no carousel library, no transform trickery — so
 * trackpads, touch, shift-scroll and keyboard all work by default. The arrows
 * are an addition for mouse users, and they hide themselves at the ends rather
 * than sitting there disabled.
 */
export function ListingRail({
  listings,
  headingId,
  className,
}: {
  listings: ListingCard[];
  headingId?: string;
  className?: string;
}) {
  const railRef = React.useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = React.useState(true);
  const [atEnd, setAtEnd] = React.useState(false);

  const syncEdges = React.useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setAtStart(rail.scrollLeft < 8);
    setAtEnd(rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 8);
  }, []);

  React.useEffect(() => {
    syncEdges();
    const rail = railRef.current;
    if (!rail) return;
    rail.addEventListener("scroll", syncEdges, { passive: true });
    window.addEventListener("resize", syncEdges);
    return () => {
      rail.removeEventListener("scroll", syncEdges);
      window.removeEventListener("resize", syncEdges);
    };
  }, [syncEdges]);

  const scrollBy = (direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    // Advances by whole tiles rather than by a fixed pixel amount, so a tile is
    // never left half-cut at the edge.
    const tile = rail.querySelector("li");
    const step = tile ? tile.clientWidth + 24 : rail.clientWidth * 0.8;
    rail.scrollBy({ left: direction * step * 2, behavior: "smooth" });
  };

  if (listings.length === 0) return null;

  return (
    <div className={cn("relative", className)}>
      <ul ref={railRef} className="rail -mx-1 gap-6 px-1 pb-2" aria-labelledby={headingId}>
        {listings.map((listing, index) => (
          <li
            key={listing.id}
            className="xs:w-[52vw] w-[68vw] max-w-[300px] sm:w-[38vw] lg:w-[calc((100%-4.5rem)/4)] xl:w-[calc((100%-6rem)/5)]"
          >
            <ListingTile
              listing={listing}
              sizes={IMAGE_SIZES.rail}
              // Only the first two are likely above the fold on any width.
              priority={index < 2}
            />
          </li>
        ))}
      </ul>

      {/* Controls sit under the rail rather than above it, where they would
          collide with the section's own action. Hidden entirely when the rail
          does not overflow — two permanently disabled arrows are furniture. */}
      {!(atStart && atEnd) ? (
        <div className="mt-6 hidden justify-end gap-2 md:flex">
          <RailButton
            direction="left"
            disabled={atStart}
            onClick={() => scrollBy(-1)}
            label="Scroll left"
          />
          <RailButton
            direction="right"
            disabled={atEnd}
            onClick={() => scrollBy(1)}
            label="Scroll right"
          />
        </div>
      ) : null}
    </div>
  );
}

function RailButton({
  direction,
  disabled,
  onClick,
  label,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "border-rule text-ink pointer-events-auto grid h-9 w-9 place-items-center border",
        "transition-[opacity,border-color,background-color] duration-[--duration-quick]",
        "hover:border-ink hover:bg-ink hover:text-ink-inverse",
        disabled && "pointer-events-none opacity-25",
      )}
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
        <path
          d={direction === "left" ? "M10 2 4 8l6 6" : "M6 2l6 6-6 6"}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="square"
        />
      </svg>
    </button>
  );
}
