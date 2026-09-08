import Link from "next/link";

/**
 * The footer.
 *
 * Opens with a full-width typographic statement rather than four columns of
 * links under a logo. The statement is the brand's argument in one line; the
 * navigation comes after it, set small and quiet, because by the time somebody
 * is down here they are looking for something specific.
 */

const COLUMNS = [
  {
    heading: "Rent",
    links: [
      { href: "/shop", label: "Everything" },
      { href: "/shop/sarees", label: "Sarees" },
      { href: "/shop/lehengas", label: "Lehengas" },
      { href: "/shop/dresses", label: "Dresses" },
      { href: "/shop/blazers", label: "Tailoring" },
      { href: "/collections", label: "Collections" },
    ],
  },
  {
    heading: "List",
    links: [
      { href: "/sell", label: "Start listing" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/sell#pricing", label: "What you'll earn" },
      { href: "/sell#protection", label: "Damage cover" },
    ],
  },
  {
    heading: "Almirah",
    links: [
      { href: "/about", label: "About us" },
      { href: "/how-it-works", label: "Trust & safety" },
      { href: "/account/messages", label: "Contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/rental-agreement", label: "Rental agreement" },
      { href: "/legal/cancellation", label: "Cancellations" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="grain bg-obsidian text-ink-inverse mt-24" data-print="hide">
      <div className="page-gutter">
        <div className="page-width">
          {/* The statement. Set to break across three lines at every width, so
              the shape of it is part of the design rather than an accident of
              the viewport. */}
          <div className="border-rule-inverse border-b py-16 sm:py-24">
            <p className="font-display text-[clamp(2rem,6.2vw,5.5rem)] leading-[0.98] tracking-[-0.02em]">
              The closet is bigger
              <br />
              <span className="italic">when we share it.</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-12 py-14 md:grid-cols-4 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
            <div className="col-span-2 md:col-span-4 lg:col-span-1">
              <p className="font-display text-[1.25rem] tracking-[0.18em]">ALMIRAH</p>
              <p className="text-small mt-4 max-w-xs leading-relaxed text-[color:color-mix(in_oklab,var(--color-ink-inverse)_62%,transparent)]">
                A marketplace for the clothes that spend most of the year in the dark. Rent them,
                wear them somewhere worth it, send them home.
              </p>
            </div>

            {COLUMNS.map((column) => (
              <nav key={column.heading} aria-label={column.heading}>
                <p className="label mb-5 text-[color:color-mix(in_oklab,var(--color-ink-inverse)_50%,transparent)]">
                  {column.heading}
                </p>
                <ul className="space-y-2.5">
                  {column.links.map((link) => (
                    <li key={`${column.heading}-${link.href}-${link.label}`}>
                      <Link
                        href={link.href}
                        className="text-small hover:text-ink-inverse text-[color:color-mix(in_oklab,var(--color-ink-inverse)_78%,transparent)] transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div className="border-rule-inverse flex flex-col gap-4 border-t py-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="meta text-[color:color-mix(in_oklab,var(--color-ink-inverse)_55%,transparent)]">
              © {new Date().getFullYear()} Almirah.
            </p>
            <div className="flex items-center gap-6">
              {["Instagram", "Pinterest"].map((network) => (
                <a
                  key={network}
                  href="/about"
                  className="meta hover:text-ink-inverse text-[color:color-mix(in_oklab,var(--color-ink-inverse)_70%,transparent)] transition-colors"
                >
                  {network}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* The wordmark, set full-bleed and barely there — the brand signed at the
          foot of the page rather than announced. Decorative: "Almirah" is
          already in the column above, so this is hidden from assistive tech and
          from selection. */}
      <div aria-hidden="true" className="@container overflow-hidden pt-4 select-none sm:pt-8">
        {/* 29.67cqw is not arbitrary: "almirah" measures 3.37em wide in Bodoni
            Moda at -0.03em tracking, and 100 / 3.37 = 29.67. Sized in cqw
            rather than vw so it resolves against the container's real inline
            size, which excludes the scrollbar — vw does not, and the word
            would hang off both edges by half the scrollbar's width.

            Mixed into the obsidian ground rather than faded toward transparent:
            a cream at low alpha loses almost all its chroma and reads cool grey
            against a warm near-black, which is the opposite of the intent. An
            opaque mix with paper-3 keeps the warmth at this lightness. */}
        <p className="font-display text-center text-[29.67cqw] leading-[0.88] tracking-[-0.03em] text-[color:color-mix(in_oklab,var(--color-paper-3)_44%,var(--color-obsidian))]">
          almirah
        </p>
      </div>
    </footer>
  );
}
