import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Eyebrow } from "@/components/ui/primitives";
import { LEGAL_DOCUMENTS, type LegalSlug } from "@/content/legal";

type Params = Promise<{ document: string }>;

export function generateStaticParams() {
  return Object.keys(LEGAL_DOCUMENTS).map((document) => ({ document }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { document } = await params;
  const doc = LEGAL_DOCUMENTS[document as LegalSlug];
  if (!doc) return { title: "Not found" };

  return {
    title: doc.title,
    description: doc.summary,
    alternates: { canonical: `/legal/${document}` },
  };
}

/**
 * Legal documents.
 *
 * Set at a reading width in the same type as the rest of the site, with a
 * plain-language summary at the top. A rental agreement written so that nobody
 * reads it is not consent, it is paperwork — and in a marketplace where members
 * hand each other expensive clothes, the terms are genuinely worth reading.
 */
export default async function LegalPage({ params }: { params: Params }) {
  const { document } = await params;
  const doc = LEGAL_DOCUMENTS[document as LegalSlug];
  if (!doc) notFound();

  return (
    <div className="page-gutter pt-14 pb-24 sm:pt-20">
      <div className="page-width max-w-[68ch]">
        <Eyebrow className="mb-4">{doc.eyebrow}</Eyebrow>
        <h1 className="display-2">{doc.title}</h1>

        <p className="body-lg border-rule-strong text-ink mt-6 border-l-2 pl-5">{doc.summary}</p>

        <p className="meta text-ink-3 mt-6">Last updated {doc.updated}</p>

        <div className="mt-12 space-y-10">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="title-1">{section.heading}</h2>
              <div className="mt-4 space-y-4">
                {section.paragraphs.map((paragraph, index) => (
                  <p key={index} className="text-body text-ink-2 leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
              {section.list ? (
                <ul className="mt-4 space-y-2">
                  {section.list.map((entry) => (
                    <li key={entry} className="text-body text-ink-2 flex gap-3">
                      <span
                        aria-hidden="true"
                        className="bg-rule-strong mt-2.5 h-px w-3 shrink-0"
                      />
                      {entry}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <nav className="border-rule mt-16 border-t pt-8" aria-label="Other documents">
          <p className="label text-ink-3 mb-4">Also worth reading</p>
          <ul className="space-y-2">
            {Object.entries(LEGAL_DOCUMENTS)
              .filter(([slug]) => slug !== document)
              .map(([slug, other]) => (
                <li key={slug}>
                  <Link href={`/legal/${slug}`} className="link-underline text-small text-ink">
                    {other.title}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
