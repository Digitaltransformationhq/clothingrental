import Image from "next/image";
import type { Metadata } from "next";

import { mediaUrl } from "@/lib/media";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

/**
 * The authentication shell.
 *
 * A split: the form on the left at a comfortable reading width, a photograph
 * filling the right. Sign-in pages are where most marketplaces stop designing;
 * this one keeps the same register as the rest of the site, because it is often
 * the second page a member ever sees.
 *
 * The hairline on top is load-bearing. At rest the masthead is transparent and
 * draws no rule of its own, so without this the photograph's top edge butts
 * straight into the navigation on the right half only, and reads as a rendering
 * fault rather than an edge. The heights match the masthead at rest — 3.5rem,
 * 4.25rem from `lg`, plus the 1px border it always carries — so the split fills
 * exactly what is left of the viewport and no more.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-rule grid min-h-[calc(100svh-3.5rem-1px)] border-t lg:min-h-[calc(100svh-4.25rem-1px)] lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-16 sm:px-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>

      <div className="relative hidden lg:block">
        <Image
          src={mediaUrl("editorial-list-your-clothes-1")}
          alt=""
          fill
          sizes="50vw"
          priority
          className="object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_top,rgba(20,19,15,0.72),rgba(20,19,15,0.1))]"
        />
        <div className="text-ink-inverse absolute inset-x-0 bottom-0 p-12">
          <p className="font-display text-[clamp(1.75rem,2.6vw,2.75rem)] leading-[1.05]">
            Own less.
            <br />
            <span className="italic">Wear more.</span>
          </p>
          <p className="text-small mt-4 max-w-sm text-[color:color-mix(in_oklab,var(--color-ink-inverse)_72%,transparent)]">
            Pieces from real wardrobes, for the occasions that ask for something.
          </p>
        </div>
      </div>
    </div>
  );
}
