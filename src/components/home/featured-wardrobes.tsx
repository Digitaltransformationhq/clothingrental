import Image from "next/image";
import Link from "next/link";

import { Rating } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { mediaUrl } from "@/lib/media";
import type { FeaturedWardrobe } from "@/server/services/home";

/**
 * Featured wardrobes.
 *
 * The section that makes the marketplace feel two-sided. Each entry leads with
 * a person — their name, their city, what they have actually hosted — and then
 * shows three pieces from their cupboard as a stepped row rather than a neat
 * grid, so it reads as a wardrobe rather than as inventory.
 */
export function FeaturedWardrobes({
  wardrobes,
  className,
}: {
  wardrobes: FeaturedWardrobe[];
  className?: string;
}) {
  if (wardrobes.length === 0) return null;

  return (
    <div className={cn("grid gap-12 lg:grid-cols-3 lg:gap-8", className)}>
      {wardrobes.map((wardrobe, index) => (
        <article key={wardrobe.slug} className="group">
          <Link href={`/collections/${wardrobe.slug}`} className="block">
            {/* Three pieces, the middle one dropped — a small asymmetry that
                stops three identical columns reading as a table. */}
            <div className="flex items-start gap-2.5">
              {wardrobe.pieces.map((piece, pieceIndex) => (
                <div
                  key={piece.id}
                  className={cn(
                    "photo-zoom relative flex-1",
                    pieceIndex === 1 && "mt-8",
                    pieceIndex === 2 && "mt-4",
                  )}
                >
                  <div className="photo-frame aspect-[4/5] w-full">
                    {piece.image ? (
                      <Image
                        src={mediaUrl(piece.image.storageKey)}
                        alt=""
                        fill
                        sizes="(max-width: 1024px) 30vw, 12vw"
                        loading={index === 0 ? "eager" : "lazy"}
                        placeholder={piece.image.blurDataUrl ? "blur" : "empty"}
                        blurDataURL={piece.image.blurDataUrl ?? undefined}
                        className="object-cover"
                      />
                    ) : (
                      <div className="bg-paper-3 h-full w-full" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-rule group-hover:border-ink mt-6 border-t pt-5 transition-colors">
              <h3 className="font-display text-[1.375rem] leading-tight">{wardrobe.title}</h3>
              {wardrobe.standfirst ? (
                <p className="clamp-3 text-small text-ink-2 mt-2.5 leading-relaxed">
                  {wardrobe.standfirst}
                </p>
              ) : null}

              {wardrobe.curator ? (
                <p className="meta text-ink-3 mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-ink">{wardrobe.curator.name}</span>
                  {wardrobe.curator.city ? <span>· {wardrobe.curator.city}</span> : null}
                  {wardrobe.curator.ratingCount > 0 ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <Rating
                        value={wardrobe.curator.ratingAvgBps / 10_000}
                        count={wardrobe.curator.ratingCount}
                        showCount={false}
                      />
                      <span>{wardrobe.curator.rentalsHosted} rentals</span>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          </Link>
        </article>
      ))}
    </div>
  );
}
