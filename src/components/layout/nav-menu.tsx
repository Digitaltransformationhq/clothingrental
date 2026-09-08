"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { mediaUrl } from "@/lib/media";
import type { Navigation } from "@/server/services/navigation";

/**
 * The Explore panel.
 *
 * A category menu that opens under the masthead. It exists because "Explore"
 * pointing at a single undifferentiated grid wastes the one moment a visitor is
 * actively asking what is here — and because a marketplace with nineteen
 * categories across four groups should show them rather than bury them behind a
 * filter rail.
 *
 * Behaviour, and why:
 *
 *  · Opens on hover after a short delay, and closes after a longer one. The
 *    asymmetry is deliberate: opening instantly makes the menu fire when the
 *    pointer merely crosses the trigger on its way somewhere else, and closing
 *    instantly makes the diagonal journey from trigger to panel impossible.
 *  · Opens on focus and on Enter, closes on Escape, and returns focus to the
 *    trigger — a menu reachable only by pointer is not a menu.
 *  · Closes on navigation, because a panel still hanging open over the page you
 *    just asked for is the most common bug in this pattern.
 */
export function NavMenu({
  label,
  href,
  navigation,
}: {
  label: string;
  href: string;
  navigation: Navigation;
}) {
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<number | undefined>(undefined);
  const triggerRef = React.useRef<HTMLAnchorElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = undefined;
  };

  const openAfter = (delay: number) => {
    cancel();
    timer.current = window.setTimeout(() => setOpen(true), delay);
  };

  const closeAfter = (delay: number) => {
    cancel();
    timer.current = window.setTimeout(() => setOpen(false), delay);
  };

  /**
   * A navigation is an answer; the question can be put away.
   *
   * Compared during render rather than in an effect on `pathname`. An effect
   * would paint the new page with the panel still open and then close it a
   * frame later, which is visible. Any hover timer still pending has already
   * been cancelled by the pointer leaving the trigger.
   */
  const [lastPath, setLastPath] = React.useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  React.useEffect(() => cancel, []);

  React.useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => openAfter(90)}
      onMouseLeave={() => closeAfter(200)}
      onFocusCapture={() => {
        cancel();
        setOpen(true);
      }}
      onBlurCapture={(event) => {
        // Only when focus has genuinely left the whole menu, not while moving
        // between links inside it.
        if (!containerRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
      }}
      onClick={() => {
        // Choosing something closes the panel immediately, without waiting for
        // the route to change.
        cancel();
        setOpen(false);
      }}
    >
      <Link
        ref={triggerRef}
        href={href}
        aria-expanded={open}
        aria-haspopup="true"
        data-open={open}
        className={cn(
          "text-small relative inline-flex items-center py-2 transition-colors",
          open ? "text-ink" : "text-ink-2 hover:text-ink",
          open
            ? "group-data-[on-dark=true]/header:text-ink-inverse"
            : "group-data-[on-dark=true]/header:hover:text-ink-inverse group-data-[on-dark=true]/header:text-[color:color-mix(in_oklab,var(--color-ink-inverse)_80%,transparent)]",
        )}
      >
        {label}
        {/* The rule under the trigger is the only thing tying the panel to the
            word that opened it. */}
        <span
          aria-hidden="true"
          className={cn(
            "bg-ink absolute inset-x-0 -bottom-px h-px origin-left transition-transform",
            "duration-[--duration-base] ease-[--ease-editorial]",
            "group-data-[on-dark=true]/header:bg-[var(--color-ink-inverse)]",
            open ? "scale-x-100" : "scale-x-0",
          )}
        />
      </Link>

      {/* Full-bleed panel, hung from the bottom of the masthead. `invisible`
          rather than unmounted so the fade has something to animate and so the
          links stay in the document for assistive technology to find. */}
      <div
        className={cn(
          "border-rule bg-paper/97 fixed inset-x-0 z-40 border-b backdrop-blur-xl",
          "transition-[opacity,transform,visibility] duration-[--duration-base] ease-[--ease-editorial]",
          open
            ? "visible translate-y-0 opacity-100"
            : "pointer-events-none invisible -translate-y-1 opacity-0",
        )}
        style={{ top: "var(--header-h)" }}
        // Hidden from the accessibility tree when closed, so a screen reader
        // does not walk twenty links that are not on screen.
        aria-hidden={!open}
      >
        <div className="page-gutter">
          <div className="page-width grid gap-x-12 gap-y-10 py-9 lg:grid-cols-12">
            {/* ── Categories, grouped as the taxonomy groups them ────────── */}
            <div className="lg:col-span-7">
              <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
                {navigation.groups.map((group) => (
                  <div key={group.slug}>
                    <p className="label text-ink-3 mb-4">{group.name}</p>
                    <ul className="space-y-2.5">
                      {group.items.map((item) => (
                        <li key={item.slug}>
                          <Link
                            href={`/shop/${item.slug}`}
                            tabIndex={open ? 0 : -1}
                            className="text-small text-ink-2 hover:text-ink transition-colors"
                          >
                            {item.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* ── Occasions ──────────────────────────────────────────── */}
              <div className="border-rule mt-8 border-t pt-6">
                <p className="label text-ink-3 mb-3.5">By occasion</p>
                <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
                  {navigation.occasions.map((occasion) => (
                    <li key={occasion.slug}>
                      <Link
                        href={`/shop?occasion=${occasion.slug}`}
                        tabIndex={open ? 0 : -1}
                        className="text-small text-ink-2 hover:text-ink transition-colors"
                      >
                        {occasion.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* ── A way in that is not a list ─────────────────────────────
                A menu of twenty words is a filing cabinet. One photograph
                gives somebody who does not yet know what they want a place to
                start, which is most people opening this. */}
            {navigation.featured ? (
              <div className="lg:col-span-4 lg:col-start-9">
                <Link
                  href={`/collections/${navigation.featured.slug}`}
                  tabIndex={open ? 0 : -1}
                  className="photo-zoom group block"
                >
                  <div className="photo-frame bg-obsidian aspect-[3/2] w-full">
                    {navigation.featured.heroKey ? (
                      <Image
                        src={mediaUrl(`${navigation.featured.heroKey}-1`)}
                        alt=""
                        fill
                        sizes="(max-width: 1024px) 100vw, 30vw"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <p className="label text-ink-3 mt-4">The edit</p>
                  <p className="title-2 group-hover:text-claret mt-1.5 transition-colors">
                    {navigation.featured.title}
                  </p>
                  {navigation.featured.standfirst ? (
                    <p className="meta text-ink-2 clamp-2 mt-2">{navigation.featured.standfirst}</p>
                  ) : null}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
