import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Eyebrow } from "@/components/ui/primitives";
import { IMAGE_SIZES, mediaUrl } from "@/lib/media";
import { cn } from "@/lib/cn";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = {
  title: "Collections",
  description:
    "Edits pulled together by us and by members: the wedding season, quiet luxury, handloom first, and the wardrobes behind them.",
  alternates: { canonical: "/collections" },
};

export const revalidate = 600;

/**
 * Collections.
 *
 * Laid out as a run of editorial spreads at alternating proportions rather than
 * a grid of equal tiles. The first is full-bleed and the rest alternate sides,
 * so scrolling the page has a rhythm — which is the entire difference between a
 * magazine's contents page and a list of links.
 */
export default async function CollectionsPage() {
  const db = await getDb();

  const collections = await db.collection.findMany({
    where: { publishedAt: { not: null } },
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
    select: {
      slug: true,
      title: true,
      standfirst: true,
      heroKey: true,
      curatorId: true,
      _count: { select: { listings: true } },
      listings: {
        orderBy: { position: "asc" },
        take: 1,
        select: {
          listing: {
            select: {
              item: {
                select: {
                  images: {
                    orderBy: { position: "asc" },
                    take: 1,
                    select: { storageKey: true, blurDataUrl: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const curators = await db.user.findMany({
    where: {
      id: { in: collections.map((c) => c.curatorId).filter((id): id is string => Boolean(id)) },
    },
    select: { id: true, name: true, profile: { select: { city: true } } },
  });
  const curatorById = new Map(curators.map((curator) => [curator.id, curator]));

  return (
    <div className="pb-24">
      <header className="page-gutter pt-14 sm:pt-20">
        <div className="page-width max-w-3xl">
          <Eyebrow className="mb-4">Collections</Eyebrow>
          <h1 className="display-2">Edits, not categories.</h1>
          <p className="body-lg mt-5 max-w-xl">
            Some of these we put together. Some belong to members, who know their own cupboards
            better than we ever will.
          </p>
        </div>
      </header>

      <ul className="mt-16 space-y-16 sm:space-y-24">
        {collections.map((collection, index) => {
          const curator = collection.curatorId ? curatorById.get(collection.curatorId) : undefined;
          const fallback = collection.listings[0]?.listing.item.images[0];
          const key = collection.heroKey ? `${collection.heroKey}-1` : fallback?.storageKey;
          const reversed = index % 2 === 1;

          return (
            <li key={collection.slug} className="page-gutter">
              <div className="page-width">
                <Link href={`/collections/${collection.slug}`} className="photo-zoom group block">
                  <div
                    className={cn(
                      "grid items-center gap-8 lg:grid-cols-12 lg:gap-14",
                      reversed && "lg:[direction:rtl]",
                    )}
                  >
                    <div className={cn("lg:col-span-7", reversed && "lg:[direction:ltr]")}>
                      <div className="photo-frame bg-obsidian aspect-[16/10] w-full">
                        {key ? (
                          <Image
                            src={mediaUrl(key)}
                            alt=""
                            fill
                            sizes={IMAGE_SIZES.editorialHalf}
                            priority={index === 0}
                            loading={index === 0 ? "eager" : "lazy"}
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                    </div>

                    <div className={cn("lg:col-span-5", reversed && "lg:[direction:ltr]")}>
                      {curator ? (
                        <Eyebrow className="mb-4">
                          Curated by {curator.name}
                          {curator.profile?.city ? ` · ${curator.profile.city}` : ""}
                        </Eyebrow>
                      ) : (
                        <Eyebrow className="mb-4">The house edit</Eyebrow>
                      )}

                      <h2 className="display-3 transition-opacity group-hover:opacity-70">
                        {collection.title}
                      </h2>

                      {collection.standfirst ? (
                        <p className="body-lg mt-4 max-w-md">{collection.standfirst}</p>
                      ) : null}

                      <p className="meta text-ink-3 mt-6">
                        {collection._count.listings}{" "}
                        {collection._count.listings === 1 ? "piece" : "pieces"}
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
