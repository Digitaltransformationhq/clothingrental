import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The site's font sizes, which are `@theme` tokens rather than Tailwind's own
 * scale.
 *
 * tailwind-merge has to be told about them. Out of the box it recognises
 * `text-sm` and `text-lg` as sizes and treats every other `text-*` as a colour,
 * so `text-small` and `text-ink-2` looked like the same kind of class and the
 * later one silently won — `cn("text-small", "text-ink-2")` returned just
 * `text-ink-2`, and the element fell back to the inherited size. That was
 * happening at 27 call sites across the app.
 */
const FONT_SIZES = [
  "display-1",
  "display-2",
  "display-3",
  "title-1",
  "title-2",
  "body-lg",
  "body",
  "small",
  "meta",
  "label",
];

const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: FONT_SIZES }] } },
});

/**
 * Merges class names, letting later Tailwind utilities win over earlier ones of
 * the same kind. Without this, a component's default `px-4` and a caller's
 * `px-8` both land in the class list and the winner is decided by stylesheet
 * order rather than by intent.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
