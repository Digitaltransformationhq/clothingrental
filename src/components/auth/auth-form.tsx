"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Sign in and sign up.
 *
 * One component for both, because they differ by a single field and keeping
 * them together is what stops the two drifting into different validation,
 * different error copy and different redirect behaviour.
 *
 * Errors are written for the person reading them. "Invalid credentials" tells
 * somebody nothing about what to do next; it is also, deliberately, not
 * specific about *which* of the two was wrong — saying "no account with that
 * address" turns the form into an account-enumeration oracle.
 */
export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    // Checked here for immediacy and again on the server, which is the one
    // that counts.
    const problems: Record<string, string> = {};
    if (!email.includes("@")) problems.email = "That doesn't look like an email address.";
    if (mode === "sign-up") {
      if (name.length < 2) problems.name = "Tell us what to call you.";
      if (password.length < 10) {
        problems.password = "Ten characters or more, please — a short phrase works well.";
      }
    } else if (password.length === 0) {
      problems.password = "Enter your password.";
    }

    if (Object.keys(problems).length > 0) {
      setFieldErrors(problems);
      setPending(false);
      return;
    }

    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });

    if (result.error) {
      setPending(false);
      setError(
        mode === "sign-up"
          ? result.error.status === 422
            ? "There's already an account with that address. Sign in instead."
            : "We couldn't create that account. Check the details and try again."
          : "That email and password don't match an account.",
      );
      return;
    }

    // Server components hold the session, so the whole tree must re-render.
    router.push(next);
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      {error ? (
        <p
          role="alert"
          className="border-critical bg-critical-soft text-small text-ink mb-6 border-l-2 px-4 py-3"
        >
          {error}
        </p>
      ) : null}

      <div className="space-y-5">
        {mode === "sign-up" ? (
          <Field
            label="Your name"
            name="name"
            autoComplete="name"
            error={fieldErrors.name}
            hint="Shown on your wardrobe and to anyone you rent from."
          />
        ) : null}

        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          error={fieldErrors.email}
        />

        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          error={fieldErrors.password}
          hint={mode === "sign-up" ? "At least ten characters." : undefined}
        />
      </div>

      <Button type="submit" fullWidth size="lg" loading={pending} className="mt-8">
        {mode === "sign-up" ? "Create account" : "Sign in"}
      </Button>

      <p className="meta text-ink-2 mt-6 text-center">
        {mode === "sign-up" ? (
          <>
            Already have an account?{" "}
            <Link
              href={`/auth/sign-in${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
              className="link-underline text-ink"
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link
              href={`/auth/sign-up${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
              className="link-underline text-ink"
            >
              Create an account
            </Link>
          </>
        )}
      </p>

      {mode === "sign-up" ? (
        <p className="meta text-ink-3 mt-6 text-center">
          By creating an account you agree to our{" "}
          <Link href="/legal/terms" className="link-underline text-ink-2">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="link-underline text-ink-2">
            privacy policy
          </Link>
          .
        </p>
      ) : null}
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  inputMode,
  error,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "email" | "text";
  error?: string;
  hint?: string;
}) {
  const id = `field-${name}`;
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <label htmlFor={id} className="label text-ink-2 mb-2 block">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        className={cn(
          "bg-surface text-body text-ink h-12 w-full border px-3.5 transition-colors",
          "placeholder:text-ink-3 focus:outline-none",
          error ? "border-critical focus:border-critical" : "border-rule focus:border-ink",
        )}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="meta text-ink-3 mt-1.5">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="meta text-critical mt-1.5">
          {error}
        </p>
      ) : null}
    </div>
  );
}
