import Link from "next/link";

import { formatDateLong, toIsoDate } from "@/domain/dates";
import { initialsAvatar } from "@/lib/media";
import { cn } from "@/lib/cn";
import { Rating } from "@/components/ui/primitives";

/**
 * The owner.
 *
 * The most important trust surface on the page. A peer-to-peer rental is a
 * transaction with a person, so the page says who they are, how long they have
 * been here, how much they have hosted, how fast they reply, and whether their
 * identity has been checked.
 *
 * Unverified is stated plainly rather than hidden. A trust signal that only
 * ever appears when it is good is not a trust signal.
 */
export function OwnerCard({
  owner,
  ownerId,
  listingCity,
  className,
}: {
  owner: {
    name: string;
    image: string | null;
    createdAt: Date;
    profile: {
      handle: string;
      bio: string | null;
      city: string | null;
      state: string | null;
      ratingAvgBps: number;
      ratingCount: number;
      rentalsHosted: number;
      responseRateBps: number;
      responseMins: number | null;
      isIdentityVerified: boolean;
      joinedAt: Date;
    } | null;
  };
  ownerId: string;
  listingCity: string;
  className?: string;
}) {
  const profile = owner.profile;
  const firstName = owner.name.split(" ")[0];

  const stats = [
    profile?.rentalsHosted
      ? {
          value: String(profile.rentalsHosted),
          label: profile.rentalsHosted === 1 ? "rental hosted" : "rentals hosted",
        }
      : null,
    profile?.responseRateBps
      ? { value: `${Math.round(profile.responseRateBps / 100)}%`, label: "reply rate" }
      : null,
    profile?.responseMins
      ? { value: formatResponse(profile.responseMins), label: "typical reply" }
      : null,
  ].filter((entry): entry is { value: string; label: string } => Boolean(entry));

  return (
    <section className={cn("border-rule border-t pt-8", className)} aria-labelledby="owner-heading">
      <h2 id="owner-heading" className="label text-ink-3 mb-6">
        The wardrobe
      </h2>

      <div className="flex items-start gap-5">
        <span className="border-rule relative h-16 w-16 shrink-0 overflow-hidden rounded-full border">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI avatar */}
          <img
            src={owner.image ?? initialsAvatar(owner.name, hueFor(ownerId))}
            alt=""
            width={64}
            height={64}
            className="h-full w-full object-cover"
          />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="title-2">
              {profile?.handle ? (
                <Link href={`/wardrobe/${profile.handle}`} className="link-underline">
                  {owner.name}
                </Link>
              ) : (
                owner.name
              )}
            </h3>
            {profile?.isIdentityVerified ? (
              <span className="meta text-positive inline-flex items-center gap-1">
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
                  <path
                    d="M2.5 6.2 4.8 8.5 9.5 3.8"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Verified wardrobe
              </span>
            ) : (
              <span className="meta text-ink-3">Identity not yet verified</span>
            )}
          </div>

          <p className="meta text-ink-2 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Rating value={(profile?.ratingAvgBps ?? 0) / 10_000} count={profile?.ratingCount} />
            <span aria-hidden="true">·</span>
            <span>{profile?.city ?? listingCity}</span>
            <span aria-hidden="true">·</span>
            <span>Joined {formatDateLong(toIsoDate(profile?.joinedAt ?? owner.createdAt))}</span>
          </p>

          {profile?.bio ? <p className="text-body text-ink-2 mt-4">{profile.bio}</p> : null}

          {stats.length > 0 ? (
            <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="numeric font-display block text-[1.375rem] leading-none">
                      {stat.value}
                    </span>
                    <span className="meta text-ink-3 mt-1.5 block">{stat.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          <p className="mt-6">
            <Link
              href={`/account/messages/new?owner=${ownerId}`}
              className="link-underline text-small text-ink"
            >
              Ask {firstName} a question
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

function formatResponse(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / (60 * 24))}d`;
}

/** A stable hue per member, so an avatar never changes between renders. */
function hueFor(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}
