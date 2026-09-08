import Link from "next/link";
import { Heart } from "lucide-react";

import { cn } from "@/lib/cn";
import type { CurrentUser } from "@/server/auth/session";
import { getNavigation } from "@/server/services/navigation";
import { SearchTrigger } from "@/components/search/search-trigger";
import { HeaderAccount } from "./header-account";
import { HeaderShell } from "./header-shell";
import { MobileNav } from "./mobile-nav";
import { NavMenu } from "./nav-menu";

/**
 * The masthead.
 *
 * Laid out as three columns — navigation, wordmark, actions — with the wordmark
 * optically centred. That arrangement is the convention in fashion retail for a
 * reason: it gives the name of the house the middle of the page and leaves both
 * flanks balanced, where a left-aligned bar strands everything at the edges with
 * a dead gap between them.
 *
 * The columns are a grid rather than flexbox with `justify-between`, because
 * the centre must hold regardless of how wide the two flanks happen to be. With
 * `justify-between` the wordmark drifts as soon as somebody signs in and their
 * name lengthens the right-hand cluster.
 *
 * A server component: it resolves the session and the navigation, and hands
 * both to thin client shells for the scroll and hover behaviour. The category
 * list never enters the client bundle.
 */

export const PRIMARY_NAV = [
  { href: "/shop", label: "Explore" },
  { href: "/collections", label: "Collections" },
  { href: "/how-it-works", label: "How it works" },
] as const;

export async function SiteHeader({ user }: { user: CurrentUser | null }) {
  const navigation = await getNavigation();

  return (
    <HeaderShell>
      <div className="page-gutter">
        {/* Equal flanks, so the centre column is genuinely centred. */}
        <div className="page-width grid h-[var(--header-h)] grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* ── Navigation ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-start">
            <MobileNav user={user} />

            <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
              <NavMenu label="Explore" href="/shop" navigation={navigation} />

              {PRIMARY_NAV.slice(1).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    "link-reveal text-small text-ink-2 hover:text-ink py-2 transition-colors " +
                    "group-data-[on-dark=true]/header:hover:text-ink-inverse group-data-[on-dark=true]/header:text-[color:color-mix(in_oklab,var(--color-ink-inverse)_80%,transparent)]"
                  }
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* ── Wordmark ───────────────────────────────────────────────────
              An almirah is the cupboard every Indian household keeps its good
              clothes in — the whole idea of the marketplace in one word.

              The tracking tightens and the size steps down as the bar
              condenses, so the name stays the right weight for the space it is
              in rather than rattling around in a shorter bar. */}
          <Link
            href="/"
            aria-label="Almirah — home"
            className={
              // Size and tracking vary by breakpoint only. They used to tighten
              // on scroll as well, to keep pace with a bar that shrank; the bar
              // no longer shrinks, so that would just be the wordmark twitching
              // under the reader.
              "font-display text-ink justify-self-center leading-none whitespace-nowrap " +
              "text-[1.0625rem] tracking-[0.2em] sm:text-[1.1875rem] sm:tracking-[0.24em] lg:text-[1.375rem] lg:tracking-[0.28em] " +
              "transition-opacity duration-[--duration-base] ease-[--ease-editorial] hover:opacity-60 " +
              "group-data-[on-dark=true]/header:text-ink-inverse"
            }
          >
            ALMIRAH
          </Link>

          {/* ── Actions ────────────────────────────────────────────────────
              Search and saved are icons. At this size a word and a glyph carry
              the same meaning, and the glyphs leave the wordmark the only type
              on its side of the bar. Both keep an accessible name. */}
          <div className="flex items-center justify-end gap-0.5 sm:gap-1">
            <SearchTrigger />

            <Link
              href="/account/wishlist"
              aria-label="Saved pieces"
              className={cn(
                "text-ink-2 hover:text-ink hidden h-8 w-8 items-center justify-center transition-colors sm:inline-flex",
                "group-data-[on-dark=true]/header:hover:text-ink-inverse group-data-[on-dark=true]/header:text-[color:color-mix(in_oklab,var(--color-ink-inverse)_80%,transparent)]",
              )}
            >
              <Heart className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.4} aria-hidden="true" />
            </Link>

            {/* The one action with a border. It is the marketplace's own ask —
                every other control here belongs to the member. Slimmer and
                more tightly tracked than the rest so it reads as a control
                rather than as a slab. */}
            <Link
              href="/sell"
              className={cn(
                "border-rule-strong text-ink hover:border-ink hover:bg-ink hover:text-ink-inverse ml-2.5 hidden h-8 items-center border px-3.5 text-[0.6563rem] tracking-[0.14em] uppercase transition-colors md:inline-flex",
                "group-data-[on-dark=true]/header:text-ink-inverse group-data-[on-dark=true]/header:border-[color:color-mix(in_oklab,var(--color-ink-inverse)_45%,transparent)]",
                "group-data-[on-dark=true]/header:hover:border-paper group-data-[on-dark=true]/header:hover:bg-paper group-data-[on-dark=true]/header:hover:text-ink",
              )}
            >
              List your clothes
            </Link>

            <HeaderAccount user={user} />
          </div>
        </div>
      </div>
    </HeaderShell>
  );
}
