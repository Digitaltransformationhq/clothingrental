import type { Metadata } from "next";
import Link from "next/link";

import { formatDateLong, toIsoDate } from "@/domain/dates";
import { ProfileForm } from "@/components/account/profile-form";
import { SignOutEverywhere } from "@/components/account/sign-out-everywhere";
import { Chip } from "@/components/ui/primitives";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Settings" };

/**
 * Settings.
 *
 * Public profile first, because it is the part other members see and therefore
 * the part worth getting right. Account and security follow, and the
 * destructive options sit at the bottom behind their own heading — never beside
 * a Save button.
 */
export default async function SettingsPage() {
  const user = await requireUser("/account/settings");
  const db = await getDb();

  const [profile, sessions, verification] = await Promise.all([
    db.profile.findUnique({
      where: { userId: user.id },
      select: {
        handle: true,
        bio: true,
        city: true,
        state: true,
        isIdentityVerified: true,
        joinedAt: true,
      },
    }),
    db.session.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, expiresAt: true, userAgent: true, ipAddress: true },
    }),
    db.identityVerification.findFirst({
      where: { userId: user.id, kind: "GOVERNMENT_ID" },
      select: { status: true, reviewedAt: true },
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-14">
      <section aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="title-1 mb-2">
          Your public profile
        </h2>
        <p className="body-lg mb-6">
          This is what somebody sees before they lend you a dress, or borrow yours.
        </p>

        <ProfileForm
          initial={{
            name: user.name,
            handle: profile?.handle ?? "",
            bio: profile?.bio ?? "",
            city: profile?.city ?? "",
            state: profile?.state ?? "",
          }}
        />
      </section>

      <section aria-labelledby="account-heading">
        <h2 id="account-heading" className="title-1 mb-6">
          Account
        </h2>
        <dl className="border-rule border-t">
          <div className="border-rule flex flex-wrap items-baseline justify-between gap-4 border-b py-3.5">
            <dt className="text-small text-ink-2">Email</dt>
            <dd className="text-small text-ink">
              {user.email}
              {user.emailVerified ? (
                <span className="meta text-positive ml-2">verified</span>
              ) : (
                <span className="meta text-caution ml-2">not verified</span>
              )}
            </dd>
          </div>
          <div className="border-rule flex flex-wrap items-baseline justify-between gap-4 border-b py-3.5">
            <dt className="text-small text-ink-2">Identity</dt>
            <dd className="text-small text-ink">
              {profile?.isIdentityVerified ? (
                <Chip tone="positive">Verified wardrobe</Chip>
              ) : verification?.status === "PENDING" ? (
                <Chip tone="caution">Being checked</Chip>
              ) : (
                <span className="text-ink-2">
                  Not verified ·{" "}
                  <Link href="/account/profile" className="link-underline text-ink">
                    verify your identity
                  </Link>
                </span>
              )}
            </dd>
          </div>
          <div className="border-rule flex flex-wrap items-baseline justify-between gap-4 border-b py-3.5">
            <dt className="text-small text-ink-2">Member since</dt>
            <dd className="text-small text-ink">
              {formatDateLong(toIsoDate(profile?.joinedAt ?? new Date()))}
            </dd>
          </div>
          <div className="border-rule flex flex-wrap items-baseline justify-between gap-4 border-b py-3.5">
            <dt className="text-small text-ink-2">Addresses</dt>
            <dd className="text-small text-ink">
              <Link href="/account/addresses" className="link-underline">
                Manage delivery addresses
              </Link>
            </dd>
          </div>
          <div className="border-rule flex flex-wrap items-baseline justify-between gap-4 border-b py-3.5">
            <dt className="text-small text-ink-2">Payouts</dt>
            <dd className="text-small text-ink">
              <Link href="/account/payments" className="link-underline">
                Where your earnings go
              </Link>
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="security-heading">
        <h2 id="security-heading" className="title-1 mb-2">
          Security
        </h2>
        <p className="body-lg mb-6">
          You are signed in on {sessions.length} {sessions.length === 1 ? "device" : "devices"}.
        </p>

        <ul className="border-rule border-t">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="border-rule flex flex-wrap items-baseline justify-between gap-4 border-b py-3.5"
            >
              <span className="text-small text-ink">
                {describeAgent(session.userAgent)}
                {session.ipAddress ? (
                  <span className="meta text-ink-3 ml-2">{session.ipAddress}</span>
                ) : null}
              </span>
              <span className="meta text-ink-3">
                since {formatDateLong(toIsoDate(session.createdAt))}
              </span>
            </li>
          ))}
        </ul>

        <SignOutEverywhere className="mt-6" />
      </section>
    </div>
  );
}

/** Turns a user-agent string into something a person can recognise. */
function describeAgent(agent: string | null): string {
  if (!agent) return "Unknown device";
  if (/iPhone|iPad/i.test(agent)) return "iPhone or iPad";
  if (/Android/i.test(agent)) return "Android device";
  if (/Macintosh/i.test(agent)) return "Mac";
  if (/Windows/i.test(agent)) return "Windows PC";
  if (/Linux/i.test(agent)) return "Linux";
  return "Browser";
}
