import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Eyebrow, Rating } from "@/components/ui/primitives";
import { ListingTile } from "@/components/listing/listing-tile";
import { IMAGE_SIZES, initialsAvatar, mediaUrl } from "@/lib/media";
import { getDb } from "@/server/db/client";
import { listingCardSelect, toListingCard } from "@/server/services/listing-view";
import { PUBLIC_LISTING_WHERE } from "@/server/services/listings";

type Params = Promise<{ slug: string }>;

async function loadCollection(slug: string) {
  const db = await getDb();
  return db.collection.findFirst({
    where: { slug, publishedAt: { not: null } },
    select: {
      slug: true,
      title: true,
      standfirst: true,
      heroKey: true,
      curatorId: true,
      listings: {
        orderBy: { position: "asc" },
        where: { listing: PUBLIC_LISTING_WHERE },
        select: { listing: { select: listingCardSelect } },
      },
    },
  });
}

// No `generateStaticParams` here either — see the note in /shop/[category].
// Collections gain and lose pieces continuously, so the set is resolved per
// request and cached by `revalidate`.

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const collection = await loadCollection(slug);
  if (!collection) return { title: "Not found" };

  return {
    title: collection.title,
    description: collection.standfirst ?? `${collection.listings.length} pieces to rent.`,
    alternates: { canonical: `/collections/${slug}` },
    openGraph: {
      title: collection.title,
      description: collection.standfirst ?? undefined,
      images: collection.heroKey ? [{ url: mediaUrl(`${collection.heroKey}-1`) }] : [],
    },
  };
}

/**
 * A single collection.
 *
 * Opens with a full-bleed image and the standfirst laid over it, then drops
 * into the standard grid. Where the collection belongs to a member, their
 * wardrobe is introduced properly between the two — the edit is theirs, and
 * that is the reason to trust it.
 */
export default async function CollectionPage({ params }: { params: Params }) {
  const { slug } = await params;
  const collection = await loadCollection(slug);
  if (!collection) notFound();

  const db = await getDb();
  const curator = collection.curatorId
    ? await db.user.findUnique({
        where: { id: collection.curatorId },
        select: {
          id: true,
          name: true,
          image: true,
          profile: {
            select: {
              handle: true,
              bio: true,
              city: true,
              ratingAvgBps: true,
              ratingCount: true,
              rentalsHosted: true,
              isIdentityVerified: true,
            },
          },
        },
      })
    : null;

  const listings = collection.listings.map((entry) => toListingCard(entry.listing));

  return (
    <div className="pb-24">
      <header className="relative">
        <div className="bg-obsidian relative min-h-[52svh] w-full overflow-hidden sm:min-h-[60svh]">
          {collection.heroKey ? (
            <Image
              src={mediaUrl(`${collection.heroKey}-1`)}
              alt=""
              fill
              priority
              sizes={IMAGE_SIZES.editorial}
              className="object-cover"
            />
          ) : null}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(to_top,rgba(20,19,15,0.8)_0%,rgba(20,19,15,0.3)_55%,rgba(20,19,15,0.05)_100%)]"
          />
          <div className="page-gutter absolute inset-x-0 bottom-0">
            <div className="page-width pb-12 sm:pb-16">
              <div className="text-ink-inverse max-w-2xl">
                <Eyebrow className="text-[color:color-mix(in_oklab,var(--color-ink-inverse)_70%,transparent)]">
                  {curator ? `${curator.name}'s edit` : "The house edit"}
                </Eyebrow>
                <h1 className="display-1 mt-5">{collection.title}</h1>
                {collection.standfirst ? (
                  <p className="text-body-lg mt-6 max-w-xl text-[color:color-mix(in_oklab,var(--color-ink-inverse)_84%,transparent)]">
                    {collection.standfirst}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      {curator ? (
        <section className="page-gutter mt-14" aria-labelledby="curator-heading">
          <div className="page-width">
            <div className="border-rule flex max-w-2xl items-start gap-5 border-t pt-8">
              <span className="border-rule relative h-14 w-14 shrink-0 overflow-hidden rounded-full border">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URI avatar */}
                <img
                  src={curator.image ?? initialsAvatar(curator.name, 340)}
                  alt=""
                  width={56}
                  height={56}
                  className="h-full w-full object-cover"
                />
              </span>
              <div>
                <h2 id="curator-heading" className="title-2">
                  {curator.profile?.handle ? (
                    <Link href={`/wardrobe/${curator.profile.handle}`} className="link-underline">
                      {curator.name}
                    </Link>
                  ) : (
                    curator.name
                  )}
                </h2>
                <p className="meta text-ink-3 mt-1.5 flex flex-wrap items-center gap-x-3">
                  {curator.profile?.city ? <span>{curator.profile.city}</span> : null}
                  <Rating
                    value={(curator.profile?.ratingAvgBps ?? 0) / 10_000}
                    count={curator.profile?.ratingCount}
                  />
                  <span>{curator.profile?.rentalsHosted ?? 0} rentals hosted</span>
                </p>
                {curator.profile?.bio ? (
                  <p className="text-body text-ink-2 mt-3">{curator.profile.bio}</p>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="page-gutter mt-14">
        <div className="page-width">
          <p className="meta text-ink-3 mb-8">
            {listings.length} {listings.length === 1 ? "piece" : "pieces"}
          </p>
          <ul className="grid grid-cols-2 gap-x-5 gap-y-12 sm:grid-cols-3 sm:gap-x-6 xl:grid-cols-4">
            {listings.map((listing, index) => (
              <li key={listing.id}>
                <ListingTile listing={listing} sizes={IMAGE_SIZES.grid} priority={index < 4} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
