import Link from "next/link";

import { formatDateLong, toIsoDate } from "@/domain/dates";
import { MemberActions } from "@/components/admin/member-actions";
import { Chip } from "@/components/ui/primitives";
import { getCurrentUser } from "@/server/auth/session";
import { getMembers } from "@/server/services/admin";

export const metadata = { title: "Members" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [members, viewer] = await Promise.all([getMembers(q), getCurrentUser()]);

  return (
    <div>
      <form method="get" className="mb-6 flex gap-2">
        <label htmlFor="member-search" className="sr-only">
          Search members
        </label>
        <input
          id="member-search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or email"
          className="border-rule bg-surface text-small text-ink placeholder:text-ink-3 focus:border-ink h-10 w-full max-w-sm border px-3 focus:outline-none"
        />
        <button
          type="submit"
          className="border-rule bg-surface text-small text-ink hover:border-ink border px-4 transition-colors"
        >
          Search
        </button>
      </form>

      <div className="border-rule bg-surface overflow-x-auto border">
        <table className="text-small w-full min-w-[64rem] border-collapse">
          <caption className="sr-only">Members</caption>
          <thead>
            <tr className="border-rule border-b text-left">
              {["Member", "Joined", "Wardrobe", "Rentals", "Rating", "Status", ""].map(
                (heading) => (
                  <th key={heading} scope="col" className="label text-ink-3 px-4 py-3">
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-rule border-b last:border-b-0">
                <td className="px-4 py-3">
                  <span className="text-ink block">
                    {member.profile?.handle ? (
                      <Link href={`/wardrobe/${member.profile.handle}`} className="link-underline">
                        {member.name}
                      </Link>
                    ) : (
                      member.name
                    )}
                  </span>
                  <span className="meta text-ink-3 block">{member.email}</span>
                  {member.profile?.isIdentityVerified ? (
                    <span className="meta text-positive">Verified</span>
                  ) : (
                    <span className="meta text-ink-3">Unverified</span>
                  )}
                </td>
                <td className="text-ink-2 px-4 py-3">
                  {formatDateLong(toIsoDate(member.createdAt))}
                </td>
                <td className="numeric text-ink-2 px-4 py-3">{member._count.listings}</td>
                <td className="numeric text-ink-2 px-4 py-3">
                  {member.profile?.rentalsHosted ?? 0} out · {member._count.rentals} in
                </td>
                <td className="numeric text-ink-2 px-4 py-3">
                  {member.profile?.ratingCount
                    ? `${(member.profile.ratingAvgBps / 10_000).toFixed(1)} (${member.profile.ratingCount})`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <Chip
                    tone={
                      member.status === "ACTIVE"
                        ? "positive"
                        : member.status === "SUSPENDED"
                          ? "critical"
                          : "neutral"
                    }
                  >
                    {member.status.toLowerCase()}
                  </Chip>
                  {member.role !== "MEMBER" ? (
                    <span className="meta text-ink-3 mt-1 block">{member.role.toLowerCase()}</span>
                  ) : null}
                  {member.suspendedReason ? (
                    <span className="meta text-critical mt-1 block">{member.suspendedReason}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <MemberActions
                    userId={member.id}
                    name={member.name}
                    status={member.status}
                    role={member.role}
                    canSetRole={viewer?.role === "ADMIN" && member.id !== viewer.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {members.length === 0 ? (
        <p className="text-small text-ink-2 mt-4">Nobody matches “{q}”.</p>
      ) : null}
    </div>
  );
}
