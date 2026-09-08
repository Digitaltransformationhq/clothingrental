import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/cn";
import { IMAGE_SIZES, mediaUrl } from "@/lib/media";
import type { HomeOccasion } from "@/server/services/home";

/**
 * Occasion tiles.
 *
 * Deliberately not a six-up grid of identical squares. The tiles are laid into
 * an asymmetric arrangement at three different proportions — a tall lead, two
 * landscape tiles beside it, then a wide one and two portraits — so the section
 * reads as a spread that somebody composed.
 *
 * The proportions are carried by the assets themselves, so the crop is right at
 * every size rather than being a centre-crop of a square.
 */

const LAYOUT = [
  "sm:col-span-4 sm:row-span-2 aspect-[4/5]",
  "sm:col-span-4 aspect-[4/3]",
  "sm:col-span-4 aspect-[4/3]",
  "sm:col-span-4 aspect-[4/3]",
  "sm:col-span-4 aspect-[4/3]",
  "sm:col-span-8 aspect-[16/9] sm:aspect-[21/9]",
] as const;

export function OccasionTiles({
  occasions,
  className,
}: {
  occasions: HomeOccasion[];
  className?: string;
}) {
  return (
    <ul className={cn("grid grid-cols-1 gap-4 sm:grid-cols-8 sm:gap-5", className)}>
      {occasions.map((occasion, index) => (
        <li key={occasion.slug} className={cn("relative", LAYOUT[index % LAYOUT.length])}>
          <Link
            href={`/shop?occasion=${occasion.slug}`}
            className="photo-zoom group block h-full w-full"
          >
            <div className="photo-frame bg-obsidian h-full w-full">
              <Image
                src={mediaUrl(`${occasion.heroKey}-1`)}
                alt=""
                fill
                sizes={IMAGE_SIZES.tile}
                loading={index < 2 ? "eager" : "lazy"}
                className="object-cover"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[linear-gradient(to_top,rgba(20,19,15,0.68)_0%,rgba(20,19,15,0.18)_52%,rgba(20,19,15,0)_100%)]"
              />

              <div className="text-ink-inverse absolute inset-x-0 bottom-0 p-5 sm:p-6">
                <h3 className="font-display text-[clamp(1.375rem,2.2vw,2rem)] leading-none tracking-[-0.01em]">
                  {occasion.name}
                </h3>
                {occasion.tagline ? (
                  <p className="text-small mt-2 max-w-xs leading-snug text-[color:color-mix(in_oklab,var(--color-ink-inverse)_76%,transparent)]">
                    {occasion.tagline}
                  </p>
                ) : null}
                <p className="meta mt-3 text-[color:color-mix(in_oklab,var(--color-ink-inverse)_62%,transparent)]">
                  {occasion.count} {occasion.count === 1 ? "piece" : "pieces"}
                </p>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
