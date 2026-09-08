import { cn } from "@/lib/cn";

/**
 * Block-print marks.
 *
 * Small cuts of the motifs the border under the homepage opening is built
 * from — a rosette, an ikat lozenge, an eight-point star and a temple kumbha.
 * Shared so that a numbered sequence anywhere on the site is marked from one
 * vocabulary rather than each page inventing its own.
 *
 * Drawn fresh at this size rather than scaled down from the border: at 22 units
 * the border's serrations close up into a blot, so each mark here is cut with
 * fewer, larger teeth.
 *
 * Decorative by definition — always hidden from assistive technology, since
 * whatever it marks carries the meaning.
 */

const MARKS = {
  rosette: (
    <>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const s = Math.PI / 12;
        return (
          <path
            key={i}
            d={`M${11 + Math.cos(a - s) * 6} ${11 + Math.sin(a - s) * 6} L${11 + Math.cos(a) * 10} ${11 + Math.sin(a) * 10} L${11 + Math.cos(a + s) * 6} ${11 + Math.sin(a + s) * 6} Z`}
            fill="currentColor"
          />
        );
      })}
      <circle cx="11" cy="11" r="6.5" fill="currentColor" />
      <circle cx="11" cy="11" r="3" fill="var(--color-paper)" />
    </>
  ),
  lozenge: (
    <>
      <path d="M11 1 L21 11 L11 21 L1 11 Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 6 L16 11 L11 16 L6 11 Z" fill="currentColor" />
    </>
  ),
  star: (
    <path
      d={
        Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 === 0 ? 10 : 4;
          return `${i === 0 ? "M" : "L"}${11 + Math.cos(a) * r} ${11 + Math.sin(a) * r}`;
        }).join(" ") + " Z"
      }
      fill="currentColor"
    />
  ),
  temple: (
    <>
      <path d="M11 1 L21 20 L1 20 Z" fill="currentColor" />
      <path d="M11 9 L15.5 17 L6.5 17 Z" fill="var(--color-paper)" />
    </>
  ),
} as const;

export type OrnamentName = keyof typeof MARKS;

/** The marks in order, for a sequence that just needs four different ones. */
export const ORNAMENTS: readonly OrnamentName[] = ["rosette", "lozenge", "star", "temple"];

export function Ornament({ name, className }: { name: OrnamentName; className?: string }) {
  return (
    <svg viewBox="0 0 22 22" aria-hidden="true" className={cn("shrink-0", className)}>
      {MARKS[name]}
    </svg>
  );
}
