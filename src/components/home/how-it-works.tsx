import { Ornament } from "@/components/ui/ornament";
import { Eyebrow } from "@/components/ui/primitives";

/**
 * How it works.
 *
 * Four words and four sentences, set as a printed page rather than as a row of
 * feature cards — which is the single most recognisable tell of a page nobody
 * designed.
 *
 * Three things carry it. The numeral is set enormous and nearly out of ink, and
 * bleeds off the top of its column: it is the ground the step is printed on,
 * not a label in front of it. A block-print mark sits on the rule above each
 * step, drawn from the same vocabulary as the border that runs under the
 * opening, so the section belongs to the same publication as the rest of the
 * page. And the type sits over both, which is what stops the column reading as
 * three stacked things and starts it reading as one composition.
 */

const STEPS = [
  {
    number: "01",
    mark: "rosette" as const,
    title: "Find",
    body: "Browse by occasion, size or city. Every piece belongs to somebody, and you can see who.",
  },
  {
    number: "02",
    mark: "lozenge" as const,
    title: "Book",
    body: "Choose your dates. The owner confirms, or it books instantly if they have said it can.",
  },
  {
    number: "03",
    mark: "star" as const,
    title: "Wear",
    body: "It arrives cleaned and pressed, a day or two before you need it.",
  },
  {
    number: "04",
    mark: "temple" as const,
    title: "Return",
    body: "Send it back in the same packaging. Your deposit is returned within three days.",
  },
] as const;

export function HowItWorks() {
  return (
    <section className="page-gutter py-16 sm:py-24" aria-labelledby="how-heading">
      <div className="page-width">
        <div className="max-w-2xl">
          <Eyebrow className="mb-4">How it works</Eyebrow>
          <h2 id="how-heading" className="display-2">
            Four steps, and
            <br />
            none of them is <span className="display-accent">shopping.</span>
          </h2>
        </div>

        {/* Four hairlines rather than four cells.
            The steps used to sit in a bordered grid — a rule above the row and
            a rule down each division — which fenced each one into a box and
            made the section read as a table. A single rule heading each column
            is the device the rest of the site uses, and it lets the columns
            breathe apart instead of butting together.

            The numeral and the title now share a baseline. They were stacked
            with a margin between them before, so nothing lined up: the numeral
            floated, the title floated under it, and the eye had no axis to
            follow across the four. Set on one baseline the numerals rise above
            the titles in a row you can read straight across, which is what
            makes them ornament rather than labels. */}
        <ol className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li
              key={step.number}
              className="group border-rule relative overflow-hidden border-t pt-9"
            >
              {/* The rule draws itself in on hover — the only motion in the
                  section, and it points at what you are reading. */}
              <span
                aria-hidden="true"
                className="bg-ink absolute -top-px left-0 h-px w-0 transition-[width] duration-[--duration-slow] ease-[--ease-editorial] group-hover:w-full"
              />

              {/* The numeral, printed under everything and running off the top
                  of its column. Ghosted this far it is texture rather than a
                  figure to be read — the small one on the rule does the
                  counting. */}
              <span
                aria-hidden="true"
                className="numeric font-display pointer-events-none absolute -top-6 -right-2 text-[7.5rem] leading-none tracking-[-0.05em] text-[color:color-mix(in_oklab,var(--color-ink)_8%,transparent)] transition-colors duration-[--duration-slow] select-none group-hover:text-[color:color-mix(in_oklab,var(--color-claret)_14%,transparent)]"
              >
                {step.number}
              </span>

              <div className="relative flex items-center gap-3">
                <Ornament
                  name={step.mark}
                  className="text-ink-3 group-hover:text-claret h-[1.05rem] w-[1.05rem] transition-colors duration-[--duration-base]"
                />
                <span className="numeric meta text-ink-3 tracking-[0.18em]">{step.number}</span>
              </div>

              <h3 className="font-display relative mt-4 text-[1.6875rem] leading-none">
                {step.title}
              </h3>
              <p className="text-small text-ink-2 relative mt-4 leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
