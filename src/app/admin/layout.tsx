import type { Metadata } from "next";
import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import { requireStaff } from "@/server/auth/session";
import { getModerationCounts } from "@/server/services/admin";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s · Admin · Almirah" },
  robots: { index: false, follow: false },
};

/**
 * The administration area.
 *
 * Deliberately the plainest surface in the application. It is a tool used by a
 * handful of people who use it every day, so it optimises for density and speed
 * of scanning rather than for atmosphere — this is the one place where the
 * editorial restraint of the rest of the site would actively get in the way.
 *
 * Access is enforced here by `requireStaff`, and again in every action. The
 * navigation not appearing is a convenience, not a control.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const counts = await getModerationCounts();

  return (
    <div className="bg-paper-2 min-h-[70svh]">
      <div className="page-gutter">
        <div className="page-width py-8">
          <header className="border-rule mb-6 flex flex-wrap items-baseline justify-between gap-4 border-b pb-5">
            <div>
              <p className="label text-ink-3">Almirah administration</p>
              <h1 className="title-1 mt-1.5">Moderation & operations</h1>
            </div>
            <p className="meta text-ink-3">
              Signed in as {user.name} · {user.role.toLowerCase()} ·{" "}
              <Link href="/" className="link-underline text-ink-2">
                back to the site
              </Link>
            </p>
          </header>

          <AdminNav counts={counts} />

          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
