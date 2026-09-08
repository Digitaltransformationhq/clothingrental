import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/cn";

/**
 * The small typographic and structural pieces the whole site is assembled
 * from. Each is a named role rather than a bag of utilities, so that changing
 * what a section label looks like changes every section label.
 */

/**
 * The eyebrow above a section heading. Small, tracked, uppercase — the way a
 * printed page labels a spread without shouting a headline at you.
 */
export function Eyebrow({
  children,
  className,
  as: Component = "p",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "p" | "span" | "h2";
}) {
  return <Component className={cn("label text-ink-3", className)}>{children}</Component>;
}

/**
 * A section opener: eyebrow, display heading, optional standfirst, optional
 * action aligned to the baseline of the heading.
 */
export function SectionHead({
  eyebrow,
  title,
  standfirst,
  action,
  align = "start",
  className,
  headingLevel = "h2",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  standfirst?: React.ReactNode;
  action?: React.ReactNode;
  align?: "start" | "between";
  className?: string;
  headingLevel?: "h1" | "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <div
      className={cn(
        "flex flex-col gap-5 sm:flex-row sm:items-end",
        align === "between" ? "sm:justify-between" : "sm:gap-12",
        className,
      )}
    >
      <div className="max-w-2xl">
        {eyebrow ? <Eyebrow className="mb-4">{eyebrow}</Eyebrow> : null}
        <Heading className="display-3">{title}</Heading>
        {standfirst ? <p className="body-lg mt-4 max-w-prose">{standfirst}</p> : null}
      </div>
      {action ? <div className="shrink-0 sm:pb-1.5">{action}</div> : null}
    </div>
  );
}

/**
 * A text link that reveals its underline on approach. The default for
 * navigation and standalone actions, where a permanent rule would be noise.
 */
export function TextLink({
  href,
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link href={href} className={cn("link-reveal", className)} {...props}>
      {children}
    </Link>
  );
}

/**
 * The "read more" affordance used at the end of a section: a small caps label
 * over a rule that runs the full width of its column.
 */
export function RuleLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group border-rule flex items-baseline justify-between gap-6 border-t pt-4",
        "hover:border-ink transition-colors duration-[--duration-base] ease-[--ease-editorial]",
        className,
      )}
    >
      <span className="label text-ink">{children}</span>
      <span
        aria-hidden="true"
        className="text-ink-3 group-hover:text-ink transition-transform duration-[--duration-base] ease-[--ease-editorial] group-hover:translate-x-1"
      >
        →
      </span>
    </Link>
  );
}

/**
 * Status and metadata chips. Deliberately square, hairline-bordered and quiet:
 * a listing card carries several, and rounded coloured pills would turn a
 * catalogue into a dashboard.
 */
export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "positive" | "caution" | "critical" | "accent";
  className?: string;
}) {
  const tones = {
    neutral: "border-rule-strong text-ink-2",
    positive: "border-positive/35 text-positive bg-positive-soft",
    caution: "border-caution/35 text-caution bg-caution-soft",
    critical: "border-critical/35 text-critical bg-critical-soft",
    accent: "border-claret/30 text-claret bg-claret-soft",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-1 text-[0.6875rem] font-medium tracking-[0.1em] uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A live availability indicator. The one place a small colour dot earns itself. */
export function StatusDot({
  tone = "positive",
  className,
}: {
  tone?: "positive" | "caution" | "critical";
  className?: string;
}) {
  const tones = {
    positive: "bg-positive",
    caution: "bg-caution",
    critical: "bg-critical",
  } as const;
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-1.5 w-1.5 rounded-full", tones[tone], className)}
    />
  );
}

/** A hairline rule with optional label, used to separate editorial bands. */
export function Rule({ label, className }: { label?: string; className?: string }) {
  if (!label) return <hr className={cn("border-rule border-t", className)} />;
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <span className="label text-ink-3">{label}</span>
      <span className="bg-rule h-px flex-1" />
    </div>
  );
}

/**
 * A star rating. Renders as text for screen readers and as marks for everyone
 * else, because "4.9 out of 5" is far more useful to hear than five images.
 */
export function Rating({
  value,
  count,
  className,
  showCount = true,
}: {
  value: number;
  count?: number;
  className?: string;
  showCount?: boolean;
}) {
  if (!count) {
    return <span className={cn("meta text-ink-3", className)}>Not yet rated</span>;
  }
  return (
    <span className={cn("meta text-ink-2 inline-flex items-baseline gap-1.5", className)}>
      <span aria-hidden="true" className="text-claret">
        ★
      </span>
      <span className="numeric text-ink font-medium">{value.toFixed(1)}</span>
      {showCount ? <span className="text-ink-3">({count})</span> : null}
      <span className="sr-only">
        Rated {value.toFixed(1)} out of 5 from {count} {count === 1 ? "review" : "reviews"}
      </span>
    </span>
  );
}

/**
 * An empty state.
 *
 * Never "No data found". Each one says what is missing and what to do about it,
 * because an empty screen is a moment where a member is most likely to leave.
 */
export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-rule border-t py-16 text-center sm:py-24", className)}>
      <p className="display-3 mx-auto max-w-md text-balance">{title}</p>
      <p className="body-lg mx-auto mt-4 max-w-md text-balance">{body}</p>
      {action ? <div className="mt-8 flex justify-center">{action}</div> : null}
    </div>
  );
}

/**
 * A definition row: label on the left, value on the right, separated by a
 * hairline. The site's workhorse for specifications, price breakdowns and
 * anything else that is fundamentally a table without being one.
 */
export function DetailRow({
  label,
  children,
  emphasis = false,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-rule flex items-baseline justify-between gap-6 border-b py-3 last:border-b-0",
        className,
      )}
    >
      <dt className={cn("text-small", emphasis ? "text-ink font-medium" : "text-ink-2")}>
        {label}
      </dt>
      <dd
        className={cn(
          "numeric text-small text-right",
          emphasis ? "text-ink font-medium" : "text-ink",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
