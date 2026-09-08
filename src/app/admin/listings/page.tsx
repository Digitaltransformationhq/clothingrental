import Image from "next/image";
import Link from "next/link";

import { formatDateLong, toIsoDate } from "@/domain/dates";
import { formatMoney, money } from "@/domain/money";
import { ModerationActions } from "@/components/admin/moderation-actions";
import { Chip } from "@/components/ui/primitives";
import { mediaUrl } from "@/lib/media";
import { getModerationQueue } from "@/server/services/admin";

export const metadata = { title: "Listings" };

/**
 * The moderation queue.
 *
 * Everything needed for a decision is on screen at once — every photograph, the
 * full description, the price, and who the owner is. A moderator should never
 * have to open another tab to approve a listing, because that is how queues
 * stop being worked.
 */
export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = status === "rejected" ? "REJECTED" : status === "flagged" ? "FLAGGED" : "PENDING";
  const listings = await getModerationQueue(filter);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {[
          { key: "pending", label: "Awaiting review" },
          { key: "rejected", label: "Rejected" },
          { key: "flagged", label: "Flagged" },
        ].map((tab) => {
          const active = (status ?? "pending") === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/admin/listings?status=${tab.key}`}
              className={`text-small border px-3 py-1.5 transition-colors ${
                active
                  ? "border-ink bg-ink text-ink-inverse"
                  : "border-rule bg-surface text-ink-2 hover:border-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {listings.length === 0 ? (
        <p className="border-rule bg-surface text-body text-ink-2 border p-6">
          Nothing here. The queue is clear.
        </p>
      ) : (
        <ul className="space-y-5">
          {listings.map((listing) => (
            <li key={listing.id} className="border-rule bg-surface border">
              <div className="grid gap-6 p-5 lg:grid-cols-[20rem_1fr]">
                {/* Every photograph, not just the cover — the images are the
                    main thing being reviewed. */}
                <div className="grid grid-cols-3 gap-2 self-start">
                  {listing.item.images.map((image) => (
                    <div key={image.storageKey} className="bg-paper-3 relative aspect-[4/5]">
                      <Image
                        src={mediaUrl(image.storageKey)}
                        alt={image.alt}
                        fill
                        sizes="120px"
                        placeholder={image.blurDataUrl ? "blur" : "empty"}
                        blurDataURL={image.blurDataUrl ?? undefined}
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="title-2">{listing.item.title}</h2>
                      <p className="meta text-ink-3 mt-1">
                        {listing.item.brand?.name ?? "Unlabelled"} · {listing.item.category.name} ·{" "}
                        {listing.city} · listed {formatDateLong(toIsoDate(listing.createdAt))}
                      </p>
                    </div>
                    <Chip
                      tone={
                        listing.moderation === "PENDING"
                          ? "caution"
                          : listing.moderation === "REJECTED"
                            ? "critical"
                            : "neutral"
                      }
                    >
                      {listing.moderation.toLowerCase()}
                    </Chip>
                  </div>

                  <p className="text-small text-ink-2 mt-4 leading-relaxed whitespace-pre-line">
                    {listing.item.description}
                  </p>

                  <dl className="mt-5 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                    <Row label="Rate">
                      {formatMoney(money(listing.baseRateMinor, listing.currency as "INR"))} /{" "}
                      {listing.baseDurationDays} days
                    </Row>
                    <Row label="Deposit">
                      {formatMoney(money(listing.depositMinor, listing.currency as "INR"))}
                    </Row>
                    <Row label="Retail">
                      {listing.item.retailPriceMinor
                        ? formatMoney(money(listing.item.retailPriceMinor, "INR"))
                        : "Not given"}
                    </Row>
                    <Row label="Condition">
                      {listing.item.condition.replace(/_/g, " ").toLowerCase()}
                    </Row>
                    <Row label="Owner">
                      {listing.owner.name}
                      {listing.owner.profile?.isIdentityVerified ? (
                        <span className="text-positive"> · verified</span>
                      ) : (
                        <span className="text-caution"> · unverified</span>
                      )}
                      <span className="text-ink-3">
                        {" "}
                        · {listing.owner.profile?.rentalsHosted ?? 0} hosted
                      </span>
                    </Row>
                    <Row label="Joined">{formatDateLong(toIsoDate(listing.owner.createdAt))}</Row>
                  </dl>

                  {listing.moderationNote ? (
                    <p className="border-critical bg-critical-soft text-small text-ink mt-4 border-l-2 px-3 py-2">
                      {listing.moderationNote}
                    </p>
                  ) : null}

                  <ModerationActions
                    listingId={listing.id}
                    moderation={listing.moderation}
                    className="border-rule mt-6 border-t pt-5"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-small flex gap-2">
      <dt className="text-ink-3 shrink-0">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}
