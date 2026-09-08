import type { Metadata } from "next";

import { ListingWizard, type WizardTaxonomy } from "@/components/sell/listing-wizard";
import { Eyebrow } from "@/components/ui/primitives";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = {
  title: "List a piece",
  robots: { index: false, follow: true },
};

/**
 * Loads the taxonomy the wizard offers as choices.
 *
 * Read from the database rather than hardcoded, so a category added by an
 * administrator is immediately listable without a deploy.
 */
export async function loadTaxonomy(): Promise<WizardTaxonomy> {
  const db = await getDb();

  const [categories, brands, sizes, colours, occasions] = await Promise.all([
    db.category.findMany({
      where: { parentId: { not: null } },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true, parent: { select: { name: true } } },
    }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
    db.size.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, label: true } }),
    db.color.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true, hex: true } }),
    db.occasion.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
  ]);

  return {
    categories: categories.map((entry) => ({
      slug: entry.slug,
      name: entry.name,
      parent: entry.parent?.name ?? null,
    })),
    brands,
    sizes,
    colours,
    occasions,
  };
}

export default async function NewListingPage() {
  const user = await requireUser("/sell/new");
  const [taxonomy, db] = await Promise.all([loadTaxonomy(), getDb()]);

  // Pre-fills the city, which is the field an owner is most likely to leave
  // blank and the one that most affects whether their piece is found.
  const profile = await db.profile.findUnique({
    where: { userId: user.id },
    select: { city: true, state: true },
  });

  return (
    <div className="page-gutter pt-10 pb-24 sm:pt-14">
      <div className="page-width max-w-6xl">
        <header className="mb-12 max-w-2xl">
          <Eyebrow className="mb-4">List your clothes</Eyebrow>
          <h1 className="display-2">Let’s get it listed.</h1>
          <p className="body-lg mt-4">
            About ten minutes. You set the price, the dates and who borrows it — and you can change
            any of it later.
          </p>
        </header>

        <ListingWizard
          taxonomy={taxonomy}
          defaultCity={profile?.city ?? undefined}
          defaultState={profile?.state ?? undefined}
        />
      </div>
    </div>
  );
}
