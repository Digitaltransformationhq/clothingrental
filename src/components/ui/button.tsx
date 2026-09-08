import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/cn";

/**
 * Buttons.
 *
 * Four variants, and each one means something. `primary` is the single most
 * important action on a screen — if two of them appear together, one of them is
 * wrong. `secondary` is everything else you can do. `quiet` is for actions that
 * should be available but not advertised. `link` is a text action inside prose.
 *
 * Corners are square by default. Rounded pills read as consumer software; this
 * is a shop, and its buttons are set like type on a page.
 */

type Variant = "primary" | "secondary" | "quiet" | "link";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex items-center justify-center gap-2 font-sans font-medium " +
  "transition-[background-color,color,border-color,opacity] duration-[--duration-quick] " +
  "ease-[--ease-editorial] disabled:pointer-events-none disabled:opacity-45 " +
  "select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  // Ink rather than the accent: the accent is reserved so that when it does
  // appear — a wishlist heart, a live availability dot — it still means something.
  primary:
    "bg-ink text-ink-inverse border border-ink hover:bg-claret hover:border-claret " +
    "active:translate-y-px",
  secondary:
    "bg-transparent text-ink border border-rule-strong hover:border-ink " +
    "hover:bg-ink hover:text-ink-inverse active:translate-y-px",
  quiet:
    "bg-transparent text-ink-2 border border-transparent hover:text-ink " +
    "hover:bg-paper-2 active:translate-y-px",
  link: "bg-transparent text-ink underline underline-offset-4 decoration-rule-strong hover:decoration-ink p-0 h-auto",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[0.75rem] tracking-[0.1em] uppercase",
  md: "h-11 px-5 text-[0.75rem] tracking-[0.12em] uppercase",
  lg: "h-14 px-8 text-[0.8125rem] tracking-[0.14em] uppercase",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Renders a spinner and blocks interaction without changing layout width. */
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        base,
        variants[variant],
        variant !== "link" && sizes[size],
        fullWidth && "w-full",
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {/* The label keeps its space while loading, so the button does not
          collapse and shift everything around it. */}
      <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>
        {children}
      </span>
      {loading ? (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner />
          <span className="sr-only">Working…</span>
        </span>
      ) : null}
    </button>
  );
}

export interface ButtonLinkProps extends React.ComponentPropsWithoutRef<typeof Link> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        base,
        variants[variant],
        variant !== "link" && sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <path
        d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
